const path = require('path');

const {createValidationError, normalizeMode} = require('./recipe-validator.js');

const SUPPORTED_OUTPUT_CONTAINERS = ['mp3', 'wav', 'ogg', 'mp4', 'm4a'];
const SUPPORTED_CHUNK_STRATEGIES = ['parts', 'duration', 'silence'];
const MAX_CHUNK_PARTS = 200;

function validateChunkRequest(body, inputHint) {
    const request = body || {};
    const output = normalizeOutput(request.output || {}, inputHint);
    const chunking = normalizeChunking(request.chunking || {});

    return {
        mode: normalizeMode(request.mode),
        output: output,
        chunking: chunking,
    };
}

function normalizeOutput(output, inputHint) {
    const filenamePrefix = normalizeText(output.filenamePrefix) || 'chunk';
    const archiveName = normalizeArchiveName(output.archiveName, filenamePrefix);
    const container = normalizeContainer(output.container, inputHint);

    return {
        container: container,
        filenamePrefix: filenamePrefix,
        archiveName: archiveName,
    };
}

function normalizeContainer(container, inputHint) {
    const normalized = normalizeText(container).toLowerCase();
    if (normalized) {
        if (SUPPORTED_OUTPUT_CONTAINERS.indexOf(normalized) === -1) {
            throw createValidationError(`unsupported chunk output.container: ${normalized}`, 400, 'unsupported_container');
        }
        return normalized;
    }

    const inferred = inferContainerFromInput(inputHint);
    if (!inferred) {
        throw createValidationError(
            'chunk output.container is required when the input extension can not be inferred',
            400,
            'missing_output_container'
        );
    }

    return inferred;
}

function inferContainerFromInput(inputHint) {
    if (!inputHint) {
        return null;
    }

    try {
        if (/^https?:\/\//i.test(inputHint)) {
            inputHint = new URL(inputHint).pathname || '';
        }
    } catch (error) {
        // Keep the raw input hint if URL parsing fails.
    }

    const extension = path.extname(`${inputHint}`).replace(/^\./, '').toLowerCase();
    return SUPPORTED_OUTPUT_CONTAINERS.indexOf(extension) === -1 ? null : extension;
}

function normalizeChunking(chunking) {
    if (!chunking || typeof chunking !== 'object' || Array.isArray(chunking)) {
        throw createValidationError('chunking must be an object');
    }

    const strategy = normalizeText(chunking.strategy).toLowerCase();
    if (!strategy || SUPPORTED_CHUNK_STRATEGIES.indexOf(strategy) === -1) {
        throw createValidationError('chunking.strategy must be one of parts, duration, or silence');
    }

    if (strategy === 'parts') {
        const parts = parseInteger(chunking.parts, 'chunking.parts');
        if (parts < 1 || parts > MAX_CHUNK_PARTS) {
            throw createValidationError(`chunking.parts must be between 1 and ${MAX_CHUNK_PARTS}`);
        }
        return {
            strategy: strategy,
            parts: parts,
            paddingBeforeSeconds: parseOptionalNonNegativeNumber(chunking.paddingBeforeSeconds, 0, 'chunking.paddingBeforeSeconds'),
            paddingAfterSeconds: parseOptionalNonNegativeNumber(chunking.paddingAfterSeconds, 0, 'chunking.paddingAfterSeconds'),
            noiseThresholdDb: parseNoiseThreshold(chunking.noiseThresholdDb, -35),
            minSilenceDuration: parseOptionalPositiveNumber(chunking.minSilenceDuration, 0.5, 'chunking.minSilenceDuration'),
            useSpeechBand: chunking.useSpeechBand === undefined ? true : Boolean(chunking.useSpeechBand),
        };
    }

    if (strategy === 'duration') {
        const segmentDurationSeconds = parseDurationSeconds(chunking.segmentDuration, 'chunking.segmentDuration');
        return {
            strategy: strategy,
            segmentDurationSeconds: segmentDurationSeconds,
            paddingBeforeSeconds: parseOptionalNonNegativeNumber(chunking.paddingBeforeSeconds, 0, 'chunking.paddingBeforeSeconds'),
            paddingAfterSeconds: parseOptionalNonNegativeNumber(chunking.paddingAfterSeconds, 0, 'chunking.paddingAfterSeconds'),
            noiseThresholdDb: parseNoiseThreshold(chunking.noiseThresholdDb, -35),
            minSilenceDuration: parseOptionalPositiveNumber(chunking.minSilenceDuration, 0.5, 'chunking.minSilenceDuration'),
            useSpeechBand: chunking.useSpeechBand === undefined ? true : Boolean(chunking.useSpeechBand),
        };
    }

    return {
        strategy: strategy,
        noiseThresholdDb: parseNoiseThreshold(chunking.noiseThresholdDb, -35),
        minSilenceDuration: parseOptionalPositiveNumber(chunking.minSilenceDuration, 0.5, 'chunking.minSilenceDuration'),
        paddingBeforeSeconds: parseOptionalNonNegativeNumber(chunking.paddingBeforeSeconds, 0.25, 'chunking.paddingBeforeSeconds'),
        paddingAfterSeconds: parseOptionalNonNegativeNumber(chunking.paddingAfterSeconds, 0.25, 'chunking.paddingAfterSeconds'),
        minChunkDurationSeconds: parseOptionalPositiveNumber(chunking.minChunkDurationSeconds, 1, 'chunking.minChunkDurationSeconds'),
        maxChunkDurationSeconds: parseOptionalPositiveNumberOrNull(chunking.maxChunkDurationSeconds, null, 'chunking.maxChunkDurationSeconds'),
        mergeGapSeconds: parseOptionalNonNegativeNumber(chunking.mergeGapSeconds, 0.15, 'chunking.mergeGapSeconds'),
        useSpeechBand: chunking.useSpeechBand === undefined ? true : Boolean(chunking.useSpeechBand),
    };
}

function normalizeArchiveName(value, filenamePrefix) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return `${filenamePrefix}-chunks.zip`;
    }

    return normalized.toLowerCase().endsWith('.zip') ? normalized : `${normalized}.zip`;
}

function parseInteger(value, fieldName) {
    const normalizedValue = normalizeScalarValue(value);
    const match = `${normalizedValue}`.match(/-?\d+/);
    const parsed = match ? parseInt(match[0], 10) : NaN;
    if (!Number.isFinite(parsed)) {
        throw createValidationError(`${fieldName} must be an integer`);
    }
    return parsed;
}

function parseDurationSeconds(value, fieldName) {
    value = normalizeScalarValue(value);

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return roundNumber(value);
    }

    const normalized = normalizeText(value);
    if (!normalized) {
        throw createValidationError(`${fieldName} is required`);
    }

    if (/^\d+(\.\d+)?$/.test(normalized)) {
        return roundNumber(parseFloat(normalized));
    }

    const match = normalized.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
    if (!match) {
        throw createValidationError(`${fieldName} must be a positive number of seconds or HH:MM:SS(.mmm)`);
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    const milliseconds = match[4] ? parseFloat(`0.${match[4]}`) : 0;
    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds + milliseconds;

    if (totalSeconds <= 0) {
        throw createValidationError(`${fieldName} must be greater than zero`);
    }

    return roundNumber(totalSeconds);
}

function parseOptionalPositiveNumber(value, fallback, fieldName) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = parseFloat(normalizeScalarValue(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw createValidationError(`${fieldName} must be greater than zero`);
    }

    return roundNumber(parsed);
}

function parseOptionalPositiveNumberOrNull(value, fallback, fieldName) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return parseOptionalPositiveNumber(value, fallback, fieldName);
}

function parseOptionalNonNegativeNumber(value, fallback, fieldName) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = parseFloat(normalizeScalarValue(value));
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw createValidationError(`${fieldName} must be zero or greater`);
    }

    return roundNumber(parsed);
}

function parseNoiseThreshold(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    value = normalizeScalarValue(value);

    if (typeof value === 'number' && Number.isFinite(value)) {
        return roundNumber(value);
    }

    const normalized = normalizeText(value).toLowerCase();
    const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s*db$/);
    if (match) {
        return roundNumber(parseFloat(match[1]));
    }

    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
        throw createValidationError('chunking.noiseThresholdDb must be a number or a string like -35dB');
    }

    return roundNumber(parsed);
}

function normalizeText(value) {
    return `${value || ''}`.trim();
}

function normalizeScalarValue(value) {
    if (Array.isArray(value)) {
        return value.length > 0 ? normalizeScalarValue(value[0]) : '';
    }

    if (value && typeof value === 'object') {
        if (value.value !== undefined) {
            return normalizeScalarValue(value.value);
        }
        if (value.raw !== undefined) {
            return normalizeScalarValue(value.raw);
        }

        const firstKey = Object.keys(value)[0];
        if (firstKey !== undefined) {
            return normalizeScalarValue(value[firstKey]);
        }
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }

    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
        return trimmed.slice(1, -1).trim();
    }

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'string' || typeof parsed === 'number') {
                return parsed;
            }
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed[0];
            }
            if (parsed && typeof parsed === 'object' && parsed.value !== undefined) {
                return parsed.value;
            }
        } catch (error) {
            // Keep the raw value if it is not valid JSON.
        }
    }

    return trimmed;
}

function roundNumber(value) {
    return Math.round(value * 1000) / 1000;
}

module.exports = {
    SUPPORTED_OUTPUT_CONTAINERS,
    SUPPORTED_CHUNK_STRATEGIES,
    validateChunkRequest,
};
