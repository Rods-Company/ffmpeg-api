const fs = require('fs');
const Busboy = require('busboy');

const constants = require('../constants.js');
const logger = require('../utils/logger.js');
const {createValidationError, normalizeMode, validateRecipe} = require('./recipe-validator.js');
const {createTempPath} = require('./temp-path.js');

function parseCreateJobRequest(req) {
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
        recipe: validateRecipe(body.recipe),
        analysis: normalizeAnalysisRequest(body.analysis || {}),
        mode: normalizeMode(body.mode),
        sizeBytes: null,
    });
}

function parseMultipartRequest(req) {
    return new Promise(function(resolve, reject) {
        let bytes = 0;
        let recipe = null;
        let analysis = null;
        let mode = 'auto';
        let hasFile = false;
        let originalFileName = null;
        let savedFile = createTempPath('v1-upload');
        let settled = false;

        const busboy = new Busboy({
            headers: req.headers,
            limits: {
                fields: 3,
                files: 1,
                fileSize: constants.fileSizeLimit,
            },
        });

        busboy.on('field', function(fieldName, value) {
            if (fieldName === 'recipe') {
                recipe = value;
                return;
            }
            if (fieldName === 'analysis') {
                analysis = value;
                return;
            }
            if (fieldName === 'mode') {
                mode = value;
                return;
            }
            rejectOnce(createValidationError(`unsupported field: ${fieldName}`));
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
            logger.debug(`uploading v1 file ${savedFile}`);

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

                if (!recipe) {
                    throw createValidationError('multipart upload must include a recipe field');
                }

                const parsedRecipe = validateRecipe(JSON.parse(recipe));
                settled = true;
                resolve({
                    input: {
                        type: 'upload',
                        filePath: savedFile,
                        originalFileName: originalFileName,
                    },
                    recipe: parsedRecipe,
                    analysis: normalizeAnalysisRequest(analysis ? JSON.parse(analysis) : {}),
                    mode: normalizeMode(mode),
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

function safeDelete(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        logger.warn(`failed to delete temporary file ${filePath}: ${error.message}`);
    }
}

function normalizeAnalysisRequest(analysis) {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
        return {};
    }

    const normalized = {};
    if (analysis.audioActivity === true) {
        normalized.audioActivity = {
            enabled: true,
            options: {},
        };
        return normalized;
    }

    if (analysis.audioActivity && typeof analysis.audioActivity === 'object' && !Array.isArray(analysis.audioActivity)) {
        normalized.audioActivity = {
            enabled: true,
            options: analysis.audioActivity,
        };
    }

    return normalized;
}

module.exports = {
    parseCreateJobRequest,
};
