const ffmpeg = require('fluent-ffmpeg');

const constants = require('../constants.js');
const logger = require('../utils/logger.js');
const {createValidationError} = require('./recipe-validator.js');
const {resolveTempPath} = require('./temp-path.js');

function runProcessing(inputPath, recipe, job) {
    return new Promise(function(resolve, reject) {
        const output = buildOutputDescriptor(recipe, job);
        const command = ffmpeg(inputPath).renice(constants.defaultFFMPEGProcessPriority);
        const audioFilters = [];
        const outputOptions = [];

        applyRecipe(recipe, audioFilters, outputOptions);
        applyOutputContainer(recipe.output.container, outputOptions);

        if (audioFilters.length > 0) {
            command.audioFilters(audioFilters);
        }

        if (outputOptions.length > 0) {
            command.outputOptions(outputOptions);
        }

        command.format(recipe.output.container);

        if (job) {
            job.runtime = job.runtime || {};
            job.runtime.command = command;
        }

        command.on('progress', function(progress) {
            if (!job) {
                return;
            }
            job.progress = {
                phase: 'processing',
                percent: progress.percent || null,
            };
        });

        command.on('error', function(error) {
            reject(error);
        });

        command.on('end', function() {
            logger.debug(`ffmpeg job finished: ${output.filePath}`);
            resolve(output);
        });

        command.save(output.filePath);
    });
}

function applyRecipe(recipe, audioFilters, outputOptions) {
    recipe.operations.forEach(function(operation) {
        if (operation.type === 'extract_audio') {
            outputOptions.push('-vn');
            return;
        }

        if (operation.type === 'trim') {
            if (operation.start) {
                outputOptions.push(`-ss ${operation.start}`);
            }
            if (operation.end) {
                outputOptions.push(`-to ${operation.end}`);
            }
            if (operation.duration) {
                outputOptions.push(`-t ${operation.duration}`);
            }
            return;
        }

        if (operation.type === 'speed') {
            buildAtempoFilters(parseFloat(operation.factor)).forEach(function(filterValue) {
                audioFilters.push(filterValue);
            });
            return;
        }

        if (operation.type === 'silence_trim') {
            audioFilters.push(buildSilenceRemoveFilter(operation));
            return;
        }

        if (operation.type === 'normalize') {
            audioFilters.push('loudnorm');
            return;
        }

        if (operation.type === 'volume') {
            audioFilters.push(`volume=${operation.gain || 1}`);
            return;
        }

        if (operation.type === 'channels') {
            outputOptions.push(`-ac ${parseInt(operation.count, 10)}`);
            return;
        }

        if (operation.type === 'sample_rate') {
            outputOptions.push(`-ar ${parseInt(operation.value, 10)}`);
            return;
        }

        throw createValidationError(`operation not implemented yet: ${operation.type}`);
    });
}

function applyOutputContainer(container, outputOptions) {
    if (container === 'mp3') {
        outputOptions.push('-codec:a libmp3lame');
        return;
    }

    if (container === 'wav') {
        outputOptions.push('-codec:a pcm_s16le');
        return;
    }

    if (container === 'ogg') {
        outputOptions.push('-codec:a libvorbis');
        return;
    }

    if (container === 'mp4') {
        outputOptions.push('-codec:v libx264');
        outputOptions.push('-profile:v high');
        outputOptions.push('-pix_fmt yuv420p');
        outputOptions.push('-codec:a aac');
        outputOptions.push('-b:a 128k');
        return;
    }

    if (container === 'm4a') {
        outputOptions.push('-vn');
        outputOptions.push('-codec:a aac');
        outputOptions.push('-b:a 128k');
    }
}

function buildOutputDescriptor(recipe, job) {
    const extension = recipe.output.container;
    const filename = recipe.output.filename || `${job.id}.${extension}`;
    return {
        filename: filename,
        filePath: resolveTempPath(`${job.id}-output.${extension}`),
        contentType: getContentType(extension),
        extension: extension,
    };
}

function getContentType(extension) {
    const mapping = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        mp4: 'video/mp4',
        m4a: 'audio/mp4',
    };

    return mapping[extension] || 'application/octet-stream';
}

function buildAtempoFilters(factor) {
    const filters = [];
    let remaining = factor;

    while (remaining > 2.0) {
        filters.push('atempo=2.0');
        remaining = remaining / 2.0;
    }

    while (remaining < 0.5) {
        filters.push('atempo=0.5');
        remaining = remaining / 0.5;
    }

    filters.push(`atempo=${remaining}`);
    return filters;
}

function buildSilenceRemoveFilter(operation) {
    const options = [
        `start_periods=${operation.startPeriod || 1}`,
        `start_duration=${operation.startDuration || 0.3}`,
        `start_threshold=${operation.startThreshold || '-40dB'}`,
        `stop_periods=${operation.stopPeriod || 1}`,
        `stop_duration=${operation.stopDuration || 0.5}`,
        `stop_threshold=${operation.stopThreshold || '-40dB'}`,
    ];

    return `silenceremove=${options.join(':')}`;
}

module.exports = {
    runProcessing,
    getContentType,
};
