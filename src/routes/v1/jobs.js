const express = require('express');
const crypto = require('crypto');

const constants = require('../../constants.js');
const logger = require('../../utils/logger.js');
const utils = require('../../utils/utils.js');
const {downloadToFile} = require('../../services/input-fetcher.js');
const jobService = require('../../services/job-service.js');
const {runProcessing} = require('../../services/media-processor.js');
const {analyzeAudioActivity} = require('../../services/audio-activity-analyzer.js');
const {parseJsonRequest, parseMultipartRequest} = require('../../services/request-parser.js');
const {createValidationError} = require('../../services/recipe-validator.js');
const {resolveTempPath} = require('../../services/temp-path.js');

const router = express.Router();

router.post('/url', async function(req, res, next) {
    try {
        const payload = await parseJsonRequest(req);
        return createJobFromPayload(payload, req, res, next);
    } catch (error) {
        next(error);
    }
});

router.post('/upload', async function(req, res, next) {
    try {
        const payload = await parseMultipartRequest(req);
        return createJobFromPayload(payload, req, res, next);
    } catch (error) {
        next(error);
    }
});

router.get('/:jobId', function(req, res, next) {
    try {
        const job = jobService.getJob(req.params.jobId);
        if (!job) {
            throw createValidationError('job not found', 404);
        }
        res.status(200).send(job);
    } catch (error) {
        next(error);
    }
});

router.post('/:jobId/cancel', function(req, res, next) {
    try {
        const job = jobService.cancelJob(req.params.jobId);
        res.status(202).send(job);
    } catch (error) {
        next(error);
    }
});

router.get('/:jobId/artifact', function(req, res, next) {
    try {
        const artifact = jobService.getJobArtifact(req.params.jobId);
        return utils.downloadFile(artifact.filePath, artifact.filename, req, res, next);
    } catch (error) {
        next(error);
    }
});

function createJobFromPayload(payload, req, res, next) {
    const shouldRunSync = canRunSync(payload);

    if (shouldRunSync) {
        return runSync(payload, req, res, next);
    }

    const job = jobService.createJob(payload);
    return res.status(202).send({
        id: job.id,
        status: job.status,
        links: {
            self: `/v1/jobs/${job.id}`,
            artifact: `/v1/jobs/${job.id}/artifact`,
            cancel: `/v1/jobs/${job.id}/cancel`,
        },
    });
}

function canRunSync(payload) {
    if (!constants.enableSyncSmallJobs) {
        return false;
    }

    if (payload.mode === 'async') {
        return false;
    }

    if (payload.mode === 'sync' && payload.input.type === 'url') {
        return true;
    }

    if (payload.input.type === 'upload' && payload.sizeBytes !== null) {
        return payload.sizeBytes <= constants.syncMaxInputBytes;
    }

    return false;
}

async function runSync(payload, req, res, next) {
    const syncJob = {
        id: crypto.randomBytes(8).toString('hex'),
        runtime: {},
        progress: {
            phase: 'processing',
            percent: 0,
        },
    };

    let inputFilePath = payload.input.filePath;
    let cleanupDownload = false;
    let audioActivityAnalysis = null;

    try {
        if (payload.input.type === 'url') {
            const downloaded = await downloadToFile(payload.input.url, resolveTempPath(`${syncJob.id}-input`), {
                maxBytes: constants.syncMaxInputBytes,
                timeoutMs: constants.downloadTimeoutMs,
                maxRedirects: constants.urlMaxRedirects,
                allowPrivateUrls: constants.allowPrivateUrls,
            });

            inputFilePath = downloaded.filePath;
            cleanupDownload = true;
        }

        if (payload.analysis && payload.analysis.audioActivity && payload.analysis.audioActivity.enabled) {
            audioActivityAnalysis = await analyzeAudioActivity(inputFilePath, payload.analysis.audioActivity.options || {});
            applyAudioActivityHeaders(res, audioActivityAnalysis);
        }

        logger.debug(`running synchronous v1 job ${syncJob.id}`);
        const artifact = await runProcessing(inputFilePath, payload.recipe, syncJob);
        return utils.downloadFile(artifact.filePath, artifact.filename, req, res, next);
    } catch (error) {
        next(error);
    } finally {
        if (payload.input.type === 'upload' && payload.input.filePath) {
            cleanupPath(payload.input.filePath);
        }
        if (cleanupDownload && inputFilePath) {
            cleanupPath(inputFilePath);
        }
    }
}

function cleanupPath(filePath) {
    try {
        if (filePath) {
            utils.deleteFile(filePath);
        }
    } catch (error) {
        logger.warn(`failed to cleanup ${filePath}: ${error.message}`);
    }
}

function applyAudioActivityHeaders(res, analysis) {
    res.setHeader('X-Audio-Activity-Has-Activity', `${analysis.hasAudioActivity}`);
    res.setHeader('X-Audio-Activity-Background-Only', `${analysis.likelyBackgroundOnly}`);
    res.setHeader('X-Audio-Activity-Contains-Speech-Like-Activity', `${analysis.likelyContainsSpeechLikeActivity}`);
    res.setHeader('X-Audio-Activity-Active-Ratio', `${analysis.activeRatio}`);
    res.setHeader('X-Audio-Activity-Longest-Active-Segment-Seconds', `${analysis.longestActiveSegmentSeconds}`);
}

module.exports = router;
