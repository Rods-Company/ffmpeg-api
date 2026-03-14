const express = require('express');
const fs = require('fs');

const constants = require('../../constants.js');
const logger = require('../../utils/logger.js');
const {downloadToFile} = require('../../services/input-fetcher.js');
const {parseAudioActivityRequest} = require('../../services/analysis-parser.js');
const {analyzeAudioActivity} = require('../../services/audio-activity-analyzer.js');
const {resolveTempPath} = require('../../services/temp-path.js');

const router = express.Router();

router.post('/audio-activity', async function(req, res, next) {
    let inputFilePath = null;
    let cleanupDownload = false;
    let payload = null;

    try {
        payload = await parseAudioActivityRequest(req);
        inputFilePath = payload.input.filePath;

        if (payload.input.type === 'url') {
            const tempPath = resolveTempPath(`analysis-${Date.now()}`);
            const downloaded = await downloadToFile(payload.input.url, tempPath, {
                maxBytes: constants.fileSizeLimit,
                timeoutMs: constants.downloadTimeoutMs,
                maxRedirects: constants.urlMaxRedirects,
                allowPrivateUrls: constants.allowPrivateUrls,
            });
            inputFilePath = downloaded.filePath;
            cleanupDownload = true;
        }

        const analysis = await analyzeAudioActivity(inputFilePath, payload.options);
        res.status(200).send({
            input: buildPublicInput(payload.input),
            analysis: analysis,
        });
    } catch (error) {
        next(error);
    } finally {
        if (payload && payload.input && payload.input.type === 'upload' && payload.input.filePath) {
            cleanupPath(payload.input.filePath);
        }
        if (cleanupDownload && inputFilePath) {
            cleanupPath(inputFilePath);
        }
    }
});

function buildPublicInput(input) {
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

function cleanupPath(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        logger.warn(`failed to cleanup ${filePath}: ${error.message}`);
    }
}

module.exports = router;
