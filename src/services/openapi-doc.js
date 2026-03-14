const fs = require('fs');
const path = require('path');
const constants = require('../constants.js');

let cachedDocument = null;
let cachedPath = null;

function getOpenApiDocument(req) {
    const rawDocument = getRawOpenApiDocument();
    const publicBaseUrl = getEffectivePublicBaseUrl(req);
    return injectServerUrl(rawDocument, publicBaseUrl);
}

function getRawOpenApiDocument() {
    if (!cachedDocument) {
        const openApiPath = getOpenApiPath();
        cachedDocument = fs.readFileSync(openApiPath, 'utf8');
        cachedPath = openApiPath;
    }

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

function getEffectivePublicBaseUrl(req) {
    if (constants.publicBaseUrl) {
        return constants.publicBaseUrl;
    }

    if (!req) {
        const fallbackPort = constants.externalPort || constants.serverPort;
        return `http://127.0.0.1:${fallbackPort}`;
    }

    const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const forwardedHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'http';
    const host = forwardedHost || req.get('host') || `127.0.0.1:${constants.externalPort || constants.serverPort}`;
    return `${protocol}://${host}`;
}

function injectServerUrl(document, serverUrl) {
    const escapedServerUrl = serverUrl.replace(/'/g, "''");
    const newline = document.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    const serverBlock = [
        'servers:',
        `  - url: '${escapedServerUrl}'`,
        '    description: Effective base URL for this deployment.',
    ].join(newline);

    return document.replace(
        /servers:\r?\n[\s\S]*?\r?\ntags:/m,
        `${serverBlock}${newline}tags:`
    );
}

module.exports = {
    getOpenApiDocument,
    getOpenApiPath,
    getEffectivePublicBaseUrl,
};
