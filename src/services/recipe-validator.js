const {createApiError} = require('./errors.js');

const SUPPORTED_OPERATIONS = [
    'speed',
    'silence_trim',
    'trim',
    'normalize',
    'volume',
    'channels',
    'sample_rate',
    'extract_audio',
];

function createValidationError(message, statusCode, code, details) {
    return createApiError(code || 'invalid_request', message, statusCode || 400, details);
}

function normalizeMode(mode) {
    const normalized = (mode || 'auto').toLowerCase();
    if (['auto', 'sync', 'async'].indexOf(normalized) === -1) {
        throw createValidationError('mode must be one of auto, sync, or async');
    }
    return normalized;
}

function validateRecipe(recipe) {
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
        throw createValidationError('recipe must be an object');
    }

    if (!recipe.output || typeof recipe.output !== 'object') {
        throw createValidationError('recipe.output is required');
    }

    const container = `${recipe.output.container || ''}`.trim().toLowerCase();
    if (!container) {
        throw createValidationError('recipe.output.container is required');
    }

    if (!Array.isArray(recipe.operations) || recipe.operations.length === 0) {
        throw createValidationError('recipe.operations must contain at least one operation');
    }

    const operations = recipe.operations.map(validateOperation);

    return {
        output: {
            container: container,
            filename: recipe.output.filename || null,
        },
        operations: operations,
    };
}

function validateOperation(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        throw createValidationError('each operation must be an object');
    }

    const type = `${operation.type || ''}`.trim().toLowerCase();
    if (!type) {
        throw createValidationError('operation.type is required');
    }

    if (SUPPORTED_OPERATIONS.indexOf(type) === -1) {
        throw createValidationError(`unsupported operation type: ${type}`, 400, 'unsupported_operation', {type: type});
    }

    if (type === 'speed') {
        const factor = parseFloat(operation.factor);
        if (!factor || factor <= 0) {
            throw createValidationError('speed.factor must be greater than zero');
        }
    }

    if (type === 'channels') {
        const count = parseInt(operation.count, 10);
        if (!count || count <= 0) {
            throw createValidationError('channels.count must be greater than zero');
        }
    }

    if (type === 'sample_rate') {
        const value = parseInt(operation.value, 10);
        if (!value || value <= 0) {
            throw createValidationError('sample_rate.value must be greater than zero');
        }
    }

    return Object.assign({}, operation, {type: type});
}

module.exports = {
    SUPPORTED_OPERATIONS,
    createValidationError,
    normalizeMode,
    validateRecipe,
};
