const fs = require('fs');
const crypto = require('crypto');

const constants = require('../constants.js');
const logger = require('../utils/logger.js');
const utils = require('../utils/utils.js');
const {downloadToFile} = require('./input-fetcher.js');
const {runProcessing} = require('./media-processor.js');
const {createChunksArchive} = require('./chunk-service.js');
const {analyzeAudioActivity} = require('./audio-activity-analyzer.js');
const {createValidationError} = require('./recipe-validator.js');
const {resolveTempPath} = require('./temp-path.js');

const jobs = new Map();
const queue = [];
let activeJobs = 0;

function createJob(payload) {
    if (queue.length >= constants.maxQueueSize) {
        throw createValidationError(`queue is full, max size is ${constants.maxQueueSize}`, 429);
    }

    const now = new Date().toISOString();
    const job = {
        id: crypto.randomBytes(16).toString('hex'),
        kind: payload.kind || 'processing',
        status: 'queued',
        createdAt: now,
        updatedAt: now,
        input: payload.input,
        recipe: payload.recipe,
        chunkRequest: payload.chunkRequest || null,
        analysisRequest: payload.analysis || {},
        analysis: null,
        mode: payload.mode,
        progress: {
            phase: 'queued',
            percent: 0,
        },
        artifact: null,
        error: null,
        metrics: {
            queueWaitMs: 0,
            downloadMs: 0,
            processingMs: 0,
            totalMs: 0,
            inputBytes: payload.sizeBytes || 0,
            outputBytes: 0,
        },
        runtime: {},
    };

    jobs.set(job.id, job);
    queue.push(job.id);
    process.nextTick(processQueue);
    return sanitizeJob(job);
}

function getJob(jobId) {
    const job = jobs.get(jobId);
    return job ? sanitizeJob(job) : null;
}

function getJobArtifact(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
        throw createValidationError('job not found', 404);
    }

    if (job.status !== 'completed' || !job.artifact || !job.artifact.filePath) {
        throw createValidationError('job artifact is not available', 409);
    }

    if (!fs.existsSync(job.artifact.filePath)) {
        throw createValidationError('job artifact has expired', 404);
    }

    return job.artifact;
}

function cancelJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
        throw createValidationError('job not found', 404);
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
        throw createValidationError(`job can not be canceled from status ${job.status}`, 409);
    }

    job.status = 'canceled';
    job.updatedAt = new Date().toISOString();
    job.progress = {
        phase: 'canceled',
        percent: null,
    };

    if (job.runtime.request && typeof job.runtime.request.destroy === 'function') {
        job.runtime.request.destroy(new Error('job canceled'));
    }

    if (job.runtime.command && typeof job.runtime.command.kill === 'function') {
        job.runtime.command.kill('SIGKILL');
    }

    cleanupInput(job);
    return sanitizeJob(job);
}

function processQueue() {
    while (activeJobs < constants.jobConcurrency && queue.length > 0) {
        const jobId = queue.shift();
        const job = jobs.get(jobId);

        if (!job || job.status !== 'queued') {
            continue;
        }

        activeJobs += 1;
        runJob(job)
            .catch(function(error) {
                logger.error(`job ${job.id} failed: ${error.message}`);
            })
            .finally(function() {
                activeJobs -= 1;
                process.nextTick(processQueue);
            });
    }
}

async function runJob(job) {
    const startedAt = Date.now();
    job.metrics.queueWaitMs = startedAt - new Date(job.createdAt).getTime();

    let inputFile = job.input.filePath;

    try {
        if (job.status === 'canceled') {
            return;
        }

        if (job.input.type === 'url') {
            job.status = 'downloading';
            job.updatedAt = new Date().toISOString();
            job.progress = {
                phase: 'downloading',
                percent: null,
            };

            const downloadStartedAt = Date.now();
            const download = await downloadToFile(job.input.url, resolveTempPath(`${job.id}-input`), {
                maxBytes: constants.fileSizeLimit,
                timeoutMs: constants.downloadTimeoutMs,
                maxRedirects: constants.urlMaxRedirects,
                allowPrivateUrls: constants.allowPrivateUrls,
                onRequest: function(request) {
                    job.runtime.request = request;
                },
            });

            inputFile = download.filePath;
            job.input.filePath = inputFile;
            job.metrics.downloadMs = Date.now() - downloadStartedAt;
            job.metrics.inputBytes = download.sizeBytes;
        }

        if (job.status === 'canceled') {
            cleanupInput(job);
            return;
        }

        if (job.analysisRequest && job.analysisRequest.audioActivity && job.analysisRequest.audioActivity.enabled) {
            job.analysis = job.analysis || {};
            job.analysis.audioActivity = await analyzeAudioActivity(inputFile, job.analysisRequest.audioActivity.options || {});
        }

        job.status = 'processing';
        job.updatedAt = new Date().toISOString();
        job.progress = {
            phase: 'processing',
            percent: 0,
        };

        const processingStartedAt = Date.now();
        const artifact = job.kind === 'chunking' ?
            await createChunksArchive(inputFile, job.chunkRequest, job) :
            await runProcessing(inputFile, job.recipe, job);
        const outputStats = fs.statSync(artifact.filePath);

        job.metrics.processingMs = Date.now() - processingStartedAt;
        job.metrics.totalMs = Date.now() - new Date(job.createdAt).getTime();
        job.metrics.outputBytes = outputStats.size;
        job.status = 'completed';
        job.updatedAt = new Date().toISOString();
        job.progress = {
            phase: 'completed',
            percent: 100,
        };
        job.artifact = Object.assign({}, artifact, {
            sizeBytes: outputStats.size,
            downloadUrl: `/v1/jobs/${job.id}/artifact`,
        });

        cleanupInput(job);
        scheduleCleanup(job);
    } catch (error) {
        if (job.status !== 'canceled') {
            job.status = 'failed';
            job.updatedAt = new Date().toISOString();
            job.error = {
                code: 'job_failed',
                message: error.message,
            };
        }
        cleanupInput(job);
        cleanupArtifact(job);
        throw error;
    } finally {
        job.metrics.totalMs = Date.now() - new Date(job.createdAt).getTime();
        delete job.runtime.command;
        delete job.runtime.request;
    }
}

function scheduleCleanup(job) {
    if (constants.keepAllFiles !== 'false') {
        return;
    }

    setTimeout(function() {
        const currentJob = jobs.get(job.id);
        if (!currentJob || !currentJob.artifact) {
            return;
        }

        cleanupArtifact(currentJob);
    }, constants.jobRetentionMs);
}

function cleanupInput(job) {
    if (job.input && job.input.filePath && fs.existsSync(job.input.filePath)) {
        utils.deleteFile(job.input.filePath);
    }
}

function cleanupArtifact(job) {
    if (!job.artifact || !job.artifact.filePath) {
        return;
    }

    if (fs.existsSync(job.artifact.filePath)) {
        utils.deleteFile(job.artifact.filePath);
    }

    job.artifact = null;
}

function sanitizeJob(job) {
    return {
        id: job.id,
        kind: job.kind,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        input: buildPublicInput(job.input),
        recipe: job.recipe,
        chunkRequest: job.chunkRequest,
        analysis: job.analysis,
        progress: job.progress,
        artifact: job.artifact ? {
            filename: job.artifact.filename,
            contentType: job.artifact.contentType,
            sizeBytes: job.artifact.sizeBytes,
            downloadUrl: job.artifact.downloadUrl,
            chunkCount: job.artifact.chunkCount || null,
        } : null,
        error: job.error,
        metrics: job.metrics,
    };
}

function buildPublicInput(input) {
    if (!input) {
        return null;
    }

    if (input.type === 'url') {
        return {
            type: 'url',
            url: input.url,
        };
    }

    return {
        type: 'upload',
        originalFileName: input.originalFileName || null,
    };
}

module.exports = {
    createJob,
    getJob,
    getJobArtifact,
    cancelJob,
};
