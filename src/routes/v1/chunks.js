const express = require('express');
const crypto = require('crypto');

const constants = require('../../constants.js');
const logger = require('../../utils/logger.js');
const utils = require('../../utils/utils.js');
const {downloadToFile} = require('../../services/input-fetcher.js');
const jobService = require('../../services/job-service.js');
const {createChunksArchive} = require('../../services/chunk-service.js');
const {
    parseJsonRequest,
    parseMultipartRequest,
} = require('../../services/chunk-request-parser.js');
const {resolveTempPath} = require('../../services/temp-path.js');

const router = express.Router();

router.post('/url', async function(req, res, next) {
    try {
        const payload = await parseJsonRequest(req);
        return createChunkJobFromPayload(payload, req, res, next);
    } catch (error) {
        next(error);
    }
});

router.post('/upload', async function(req, res, next) {
    try {
        const payload = await parseMultipartRequest(req);
        return createChunkJobFromPayload(payload, req, res, next);
    } catch (error) {
        next(error);
    }
});

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

function createChunkJobFromPayload(payload, req, res, next) {
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

async function runSync(payload, req, res, next) {
    const syncJob = {
        id: crypto.randomBytes(8).toString('hex'),
        runtime: {},
        progress: {
            phase: 'chunking',
            percent: 0,
        },
    };

    let inputFilePath = payload.input.filePath;
    let cleanupDownload = false;

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

        logger.debug(`running synchronous v1 chunk job ${syncJob.id}`);
        const artifact = await createChunksArchive(inputFilePath, payload.chunkRequest, syncJob);
        res.setHeader('X-Chunk-Count', `${artifact.chunkCount}`);
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

module.exports = router;
