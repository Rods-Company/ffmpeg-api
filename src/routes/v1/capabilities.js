const express = require('express');
const {execFile} = require('child_process');

const router = express.Router();

router.get('/', async function(req, res, next) {
    try {
        const [ffmpegVersion, ffprobeVersion, formats, codecs, filters] = await Promise.all([
            runCommand('ffmpeg', ['-version']),
            runCommand('ffprobe', ['-version']),
            runCommand('ffmpeg', ['-hide_banner', '-formats']),
            runCommand('ffmpeg', ['-hide_banner', '-codecs']),
            runCommand('ffmpeg', ['-hide_banner', '-filters']),
        ]);

        res.status(200).send({
            ffmpegVersion: firstLine(ffmpegVersion),
            ffprobeVersion: firstLine(ffprobeVersion),
            formats: parseCapabilityLines(formats, 4),
            codecs: parseCapabilityLines(codecs, 7),
            filters: parseCapabilityLines(filters, 4),
        });
    } catch (error) {
        next(error);
    }
});

function runCommand(command, args) {
    return new Promise(function(resolve, reject) {
        execFile(command, args, function(error, stdout, stderr) {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout || stderr);
        });
    });
}

function firstLine(output) {
    return output.split(/\r?\n/)[0];
}

function parseCapabilityLines(output, offset) {
    return output
        .split(/\r?\n/)
        .filter(function(line) {
            return line.length > offset && line.indexOf('=') === -1;
        })
        .map(function(line) {
            return line.substring(offset).trim();
        })
        .filter(Boolean);
}

module.exports = router;
