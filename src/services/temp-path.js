const fs = require('fs');
const os = require('os');
const path = require('path');
const uniqueFilename = require('unique-filename');

const baseTempDir = path.join(os.tmpdir(), 'ffmpeg-api');

function ensureTempDir() {
    if (!fs.existsSync(baseTempDir)) {
        fs.mkdirSync(baseTempDir, {recursive: true});
    }
    return baseTempDir;
}

function createTempPath(prefix) {
    ensureTempDir();
    return uniqueFilename(baseTempDir, prefix || 'file');
}

function resolveTempPath(name) {
    ensureTempDir();
    return path.join(baseTempDir, name);
}

module.exports = {
    createTempPath,
    resolveTempPath,
};
