const fs = require('fs');
const Busboy = require('busboy');

const constants = require('../constants.js');
const logger = require('../utils/logger.js');
const {createValidationError} = require('./recipe-validator.js');
const {assignNestedField, readMultipartValue} = require('./multipart-fields.js');
const {createTempPath} = require('./temp-path.js');

function parseAudioActivityRequest(req) {
    if (req.is('application/json')) {
        return parseJsonRequest(req);
    }

    if (req.is('multipart/form-data')) {
        return parseMultipartRequest(req);
    }

    throw createValidationError('unsupported content type. use application/json or multipart/form-data', 415);
}

function parseJsonRequest(req) {
    const body = req.body || {};
    if (!body.input || body.input.type !== 'url' || !body.input.url) {
        throw createValidationError('application/json requests must provide input.type=url and input.url');
    }

    return Promise.resolve({
        input: {
            type: 'url',
            url: body.input.url,
        },
        options: normalizeOptions(body.options || {}),
    });
}

function parseMultipartRequest(req) {
    return new Promise(function(resolve, reject) {
        let optionsValue = null;
        const rawFields = {};
        let hasFile = false;
        let originalFileName = null;
        let savedFile = createTempPath('v1-analysis');
        let settled = false;

        const busboy = new Busboy({
            headers: req.headers,
            limits: {
                fields: 25,
                files: 1,
                fileSize: constants.fileSizeLimit,
            },
        });

        busboy.on('field', function(fieldName, value) {
            assignNestedField(rawFields, fieldName, value);
            if (fieldName === 'options') {
                optionsValue = value;
                return;
            }
        });

        busboy.on('file', function(fieldName, file, filename) {
            if (fieldName !== 'file') {
                file.resume();
                rejectOnce(createValidationError('multipart upload must use a file field named "file"'));
                return;
            }

            hasFile = true;
            originalFileName = filename;
            savedFile = `${savedFile}-${filename || 'upload'}`;
            logger.debug(`uploading v1 analysis file ${savedFile}`);

            file.on('limit', function() {
                file.resume();
                safeDelete(savedFile);
                rejectOnce(createValidationError(`file exceeds max size limit of ${constants.fileSizeLimit} bytes`, 413));
            });

            file.pipe(fs.createWriteStream(savedFile));
        });

        busboy.on('error', rejectOnce);
        busboy.on('finish', function() {
            if (settled) {
                return;
            }

            try {
                if (!hasFile) {
                    throw createValidationError('multipart upload must include a file field named "file"');
                }

                settled = true;
                resolve({
                    input: {
                        type: 'upload',
                        filePath: savedFile,
                        originalFileName: originalFileName,
                    },
                    options: normalizeOptions(readMultipartValue(rawFields, 'options', optionsValue ? JSON.parse(optionsValue) : {})),
                });
            } catch (error) {
                safeDelete(savedFile);
                rejectOnce(error);
            }
        });

        req.pipe(busboy);

        function rejectOnce(error) {
            if (settled) {
                return;
            }
            settled = true;
            safeDelete(savedFile);
            reject(error);
        }
    });
}

function normalizeOptions(options) {
    const normalized = Object.assign({}, options);
    if (normalized.noiseThresholdDb !== undefined) {
        normalized.noiseThresholdDb = parseFloat(normalized.noiseThresholdDb);
    }
    if (normalized.minSilenceDuration !== undefined) {
        normalized.minSilenceDuration = parseFloat(normalized.minSilenceDuration);
    }
    if (normalized.minSegmentDuration !== undefined) {
        normalized.minSegmentDuration = parseFloat(normalized.minSegmentDuration);
    }
    if (normalized.minActiveRatio !== undefined) {
        normalized.minActiveRatio = parseFloat(normalized.minActiveRatio);
    }
    if (normalized.useSpeechBand !== undefined) {
        normalized.useSpeechBand = normalizeBoolean(normalized.useSpeechBand);
    }
    return normalized;
}

function normalizeBoolean(value) {
    return ['true', '1', 'yes'].indexOf(`${value}`.toLowerCase()) !== -1;
}

function safeDelete(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        logger.warn(`failed to delete temporary file ${filePath}: ${error.message}`);
    }
}

module.exports = {
    parseAudioActivityRequest,
    parseJsonRequest,
    parseMultipartRequest,
};
