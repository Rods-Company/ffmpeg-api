const fs = require('fs');
const Busboy = require('busboy');

const constants = require('../constants.js');
const logger = require('../utils/logger.js');
const {createValidationError, normalizeMode} = require('./recipe-validator.js');
const {validateChunkRequest} = require('./chunk-validator.js');
const {assignNestedField, readMultipartValue} = require('./multipart-fields.js');
const {createTempPath} = require('./temp-path.js');

function parseCreateChunkRequest(req) {
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

    const chunkRequest = validateChunkRequest(body, body.input.url);
    return Promise.resolve({
        kind: 'chunking',
        input: {
            type: 'url',
            url: body.input.url,
        },
        chunkRequest: chunkRequest,
        mode: normalizeMode(body.mode || chunkRequest.mode),
        sizeBytes: null,
    });
}

function parseMultipartRequest(req) {
    return new Promise(function(resolve, reject) {
        let bytes = 0;
        let chunking = null;
        let output = null;
        let mode = 'auto';
        const rawFields = {};
        let hasFile = false;
        let originalFileName = null;
        let savedFile = createTempPath('v1-chunks-upload');
        let settled = false;

        const busboy = new Busboy({
            headers: req.headers,
            limits: {
                fields: 50,
                files: 1,
                fileSize: constants.fileSizeLimit,
            },
        });

        busboy.on('field', function(fieldName, value) {
            assignNestedField(rawFields, fieldName, value);
            if (fieldName === 'chunking') {
                chunking = value;
                return;
            }
            if (fieldName === 'output') {
                output = value;
                return;
            }
            if (fieldName === 'mode') {
                mode = value;
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
            logger.debug(`uploading v1 chunks file ${savedFile}`);

            file.on('limit', function() {
                file.resume();
                safeDelete(savedFile);
                rejectOnce(createValidationError(`file exceeds max size limit of ${constants.fileSizeLimit} bytes`, 413));
            });

            file.on('data', function(chunk) {
                bytes += chunk.length;
            });

            file.pipe(fs.createWriteStream(savedFile));
        });

        busboy.on('error', function(error) {
            rejectOnce(error);
        });

        busboy.on('finish', function() {
            if (settled) {
                return;
            }

            try {
                if (!hasFile) {
                    throw createValidationError('multipart upload must include a file field named "file"');
                }

                const outputValue = resolveOutputValue(rawFields, output);
                const chunkingValue = resolveChunkingValue(rawFields, chunking);
                const modeValue = readMultipartValue(rawFields, 'mode', mode);

                if (!chunkingValue) {
                    throw createValidationError('multipart upload must include a chunking field');
                }

                const chunkRequest = validateChunkRequest({
                    mode: modeValue,
                    output: outputValue || {},
                    chunking: chunkingValue,
                }, originalFileName);

                settled = true;
                resolve({
                    kind: 'chunking',
                    input: {
                        type: 'upload',
                        filePath: savedFile,
                        originalFileName: originalFileName,
                    },
                    chunkRequest: chunkRequest,
                    mode: normalizeMode(modeValue || chunkRequest.mode),
                    sizeBytes: bytes,
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

function resolveOutputValue(rawFields, output) {
    const directValue = readMultipartValue(rawFields, 'output', output ? JSON.parse(output) : null);
    if (directValue && typeof directValue === 'object' && !Array.isArray(directValue)) {
        return directValue;
    }

    const aliases = {};
    if (rawFields.container !== undefined) {
        aliases.container = rawFields.container;
    }
    if (rawFields.filenamePrefix !== undefined) {
        aliases.filenamePrefix = rawFields.filenamePrefix;
    }
    if (rawFields.archiveName !== undefined) {
        aliases.archiveName = rawFields.archiveName;
    }

    return Object.keys(aliases).length > 0 ? aliases : {};
}

function resolveChunkingValue(rawFields, chunking) {
    const directValue = readMultipartValue(rawFields, 'chunking', chunking ? JSON.parse(chunking) : null);
    if (directValue && typeof directValue === 'object' && !Array.isArray(directValue)) {
        return directValue;
    }

    const strategy = rawFields.strategy;
    if (strategy === undefined) {
        return directValue;
    }

    const aliases = {
        strategy: strategy,
    };

    copyAlias(rawFields, aliases, 'parts');
    copyAlias(rawFields, aliases, 'segmentDuration');
    copyAlias(rawFields, aliases, 'noiseThresholdDb');
    copyAlias(rawFields, aliases, 'minSilenceDuration');
    copyAlias(rawFields, aliases, 'paddingBeforeSeconds');
    copyAlias(rawFields, aliases, 'paddingAfterSeconds');
    copyAlias(rawFields, aliases, 'minChunkDurationSeconds');
    copyAlias(rawFields, aliases, 'mergeGapSeconds');
    copyAlias(rawFields, aliases, 'useSpeechBand');

    return aliases;
}

function copyAlias(source, target, key) {
    if (source[key] !== undefined) {
        target[key] = source[key];
    }
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
    parseCreateChunkRequest,
    parseJsonRequest,
    parseMultipartRequest,
};
