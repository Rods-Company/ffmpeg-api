function createApiError(code, message, statusCode, details) {
    const error = new Error(message);
    error.code = code || 'request_failed';
    error.statusCode = statusCode || 500;
    if (details !== undefined) {
        error.details = details;
    }
    return error;
}

function normalizeError(error) {
    return {
        code: error.code || 'request_failed',
        message: error.message || 'internal server error',
        details: error.details || null,
        statusCode: error.statusCode || 500,
    };
}

module.exports = {
    createApiError,
    normalizeError,
};
