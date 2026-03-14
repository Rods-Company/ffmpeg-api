const fs = require('fs');
const path = require('path');

let cachedDocument = null;
let cachedPath = null;

function getOpenApiDocument() {
    if (cachedDocument) {
        return cachedDocument;
    }

    const openApiPath = getOpenApiPath();
    cachedDocument = fs.readFileSync(openApiPath, 'utf8');
    cachedPath = openApiPath;
    return cachedDocument;
}

function getOpenApiPath() {
    if (cachedPath) {
        return cachedPath;
    }

    const candidates = [
        path.join(process.cwd(), 'docs', 'openapi.yaml'),
        path.join(process.cwd(), '..', 'docs', 'openapi.yaml'),
        path.join(__dirname, '..', '..', 'docs', 'openapi.yaml'),
        path.join(__dirname, '..', 'docs', 'openapi.yaml'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            cachedPath = candidate;
            return candidate;
        }
    }

    throw new Error('openapi.yaml not found');
}

module.exports = {
    getOpenApiDocument,
    getOpenApiPath,
};
