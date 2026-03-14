const fs = require('fs');
const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');
const {URL} = require('url');

const constants = require('../constants.js');
const {createValidationError} = require('./recipe-validator.js');

function downloadToFile(sourceUrl, destinationPath, options) {
    options = options || {};
    const maxBytes = options.maxBytes || constants.fileSizeLimit;
    const timeoutMs = options.timeoutMs || constants.downloadTimeoutMs;
    const maxRedirects = options.maxRedirects || constants.urlMaxRedirects;
    const allowPrivateUrls = options.allowPrivateUrls === true || constants.allowPrivateUrls;
    const onRequest = options.onRequest;

    return resolveUrl(sourceUrl, allowPrivateUrls).then(function() {
        return requestToFile(sourceUrl, destinationPath, {
            maxBytes: maxBytes,
            timeoutMs: timeoutMs,
            maxRedirects: maxRedirects,
            allowPrivateUrls: allowPrivateUrls,
            onRequest: onRequest,
            redirectCount: 0,
        });
    });
}

function requestToFile(sourceUrl, destinationPath, options) {
    return new Promise(function(resolve, reject) {
        const parsedUrl = new URL(sourceUrl);
        const transport = parsedUrl.protocol === 'https:' ? https : http;
        const file = fs.createWriteStream(destinationPath);
        let bytes = 0;
        let finished = false;

        const req = transport.get(sourceUrl, function(res) {
            if (isRedirect(res.statusCode)) {
                file.close();
                return fs.unlink(destinationPath, function() {
                    handleRedirect(res.headers.location, options, reject, resolve, destinationPath, parsedUrl);
                });
            }

            if (res.statusCode < 200 || res.statusCode >= 300) {
                return cleanupAndReject(new Error(`failed to download url. status code ${res.statusCode}`));
            }

            res.on('data', function(chunk) {
                bytes += chunk.length;
                if (bytes > options.maxBytes) {
                    req.destroy(createValidationError(`remote file exceeds max size limit of ${options.maxBytes} bytes`, 413));
                }
            });

            res.pipe(file);

            file.on('finish', function() {
                finished = true;
                file.close(function() {
                    resolve({
                        filePath: destinationPath,
                        sizeBytes: bytes,
                        contentType: res.headers['content-type'] || 'application/octet-stream',
                        sourceUrl: sourceUrl,
                    });
                });
            });
        });

        if (options.onRequest) {
            options.onRequest(req);
        }

        req.setTimeout(options.timeoutMs, function() {
            req.destroy(new Error(`download timeout after ${options.timeoutMs}ms`));
        });

        req.on('error', function(error) {
            cleanupAndReject(error);
        });

        file.on('error', function(error) {
            cleanupAndReject(error);
        });

        function cleanupAndReject(error) {
            if (finished) {
                reject(error);
                return;
            }

            file.close(function() {
                fs.unlink(destinationPath, function() {
                    reject(error);
                });
            });
        }
    });
}

function handleRedirect(location, options, reject, resolve, destinationPath, parsedUrl) {
    if (!location) {
        reject(new Error('redirect response missing location header'));
        return;
    }

    if (options.redirectCount >= options.maxRedirects) {
        reject(createValidationError(`too many redirects, max is ${options.maxRedirects}`));
        return;
    }

    const nextUrl = new URL(location, parsedUrl).toString();
    resolveUrl(nextUrl, options.allowPrivateUrls)
        .then(function() {
            return requestToFile(nextUrl, destinationPath, Object.assign({}, options, {
                redirectCount: options.redirectCount + 1,
            }));
        })
        .then(resolve)
        .catch(reject);
}

function resolveUrl(sourceUrl, allowPrivateUrls) {
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw createValidationError('only http and https URLs are supported');
    }

    if (allowPrivateUrls) {
        return Promise.resolve(true);
    }

    return new Promise(function(resolve, reject) {
        dns.lookup(parsedUrl.hostname, function(error, address) {
            if (error) {
                reject(error);
                return;
            }

            if (isPrivateAddress(address) || parsedUrl.hostname === 'localhost') {
                reject(createValidationError('private and loopback URLs are disabled'));
                return;
            }

            resolve(true);
        });
    });
}

function isRedirect(statusCode) {
    return [301, 302, 303, 307, 308].indexOf(statusCode) !== -1;
}

function isPrivateAddress(address) {
    if (!address || !net.isIP(address)) {
        return false;
    }

    if (address === '127.0.0.1' || address === '::1') {
        return true;
    }

    if (address.indexOf('10.') === 0 || address.indexOf('192.168.') === 0) {
        return true;
    }

    if (address.indexOf('172.') === 0) {
        const secondOctet = parseInt(address.split('.')[1], 10);
        return secondOctet >= 16 && secondOctet <= 31;
    }

    if (address.indexOf('169.254.') === 0) {
        return true;
    }

    return address.indexOf('fc') === 0 || address.indexOf('fd') === 0;
}

module.exports = {
    downloadToFile,
};
