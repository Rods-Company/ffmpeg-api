const {execFile} = require('child_process');

const constants = require('../constants.js');

function analyzeAudioActivity(filePath, options) {
    const settings = buildSettings(options);

    return getDurationSeconds(filePath).then(function(durationSeconds) {
        return runSilenceDetect(filePath, settings).then(function(output) {
            const silenceSegments = parseSilenceSegments(output, durationSeconds);
            const activeSegments = buildActiveSegments(silenceSegments, durationSeconds);
            const silenceDuration = sumDuration(silenceSegments);
            const activeDuration = Math.max(0, durationSeconds - silenceDuration);
            const activeRatio = durationSeconds > 0 ? activeDuration / durationSeconds : 0;
            const longestActiveSegment = activeSegments.reduce(function(maxValue, segment) {
                return Math.max(maxValue, segment.duration);
            }, 0);
            const hasActivity = activeSegments.length > 0 && longestActiveSegment > 0;
            const likelyBackgroundOnly = !hasActivity ||
                longestActiveSegment < settings.minSegmentDuration ||
                activeRatio < settings.minActiveRatio;

            return {
                analysisType: 'speech-band activity heuristic',
                warning: 'This analysis uses FFmpeg silence detection and does not perform speech recognition.',
                settings: settings,
                durationSeconds: durationSeconds,
                silenceDurationSeconds: silenceDuration,
                activeDurationSeconds: activeDuration,
                silenceRatio: durationSeconds > 0 ? silenceDuration / durationSeconds : 0,
                activeRatio: activeRatio,
                longestActiveSegmentSeconds: longestActiveSegment,
                hasAudioActivity: hasActivity,
                likelyBackgroundOnly: likelyBackgroundOnly,
                likelyContainsSpeechLikeActivity: !likelyBackgroundOnly,
                silenceSegments: silenceSegments,
                activeSegments: activeSegments,
            };
        });
    });
}

function buildSettings(options) {
    options = options || {};
    return {
        noiseThresholdDb: numberOrDefault(options.noiseThresholdDb, constants.audioActivityNoiseThresholdDb),
        minSilenceDuration: numberOrDefault(options.minSilenceDuration, constants.audioActivityMinSilenceDuration),
        minSegmentDuration: numberOrDefault(options.minSegmentDuration, constants.audioActivityMinSegmentDuration),
        minActiveRatio: numberOrDefault(options.minActiveRatio, constants.audioActivityMinActiveRatio),
        useSpeechBand: options.useSpeechBand === undefined ? constants.audioActivityUseSpeechBand : options.useSpeechBand,
    };
}

function getDurationSeconds(filePath) {
    return new Promise(function(resolve, reject) {
        execFile('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath,
        ], function(error, stdout) {
            if (error) {
                reject(error);
                return;
            }
            resolve(parseFloat(stdout.trim()) || 0);
        });
    });
}

function runSilenceDetect(filePath, settings) {
    return new Promise(function(resolve, reject) {
        const filters = [];
        if (settings.useSpeechBand) {
            filters.push('highpass=f=200');
            filters.push('lowpass=f=3000');
        }
        filters.push(`silencedetect=noise=${settings.noiseThresholdDb}dB:d=${settings.minSilenceDuration}`);

        execFile('ffmpeg', [
            '-hide_banner',
            '-i', filePath,
            '-af', filters.join(','),
            '-f', 'null',
            '-',
        ], {
            maxBuffer: 1024 * 1024 * 8,
        }, function(error, stdout, stderr) {
            if (error && !stderr) {
                reject(error);
                return;
            }
            resolve(`${stdout}\n${stderr}`);
        });
    });
}

function parseSilenceSegments(output, durationSeconds) {
    const lines = output.split(/\r?\n/);
    const segments = [];
    let currentStart = null;

    for (const line of lines) {
        const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
        if (startMatch) {
            currentStart = parseFloat(startMatch[1]);
            continue;
        }

        const endMatch = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/);
        if (endMatch) {
            const start = currentStart === null ? 0 : currentStart;
            const end = parseFloat(endMatch[1]);
            segments.push(createSegment(start, end));
            currentStart = null;
        }
    }

    if (currentStart !== null && durationSeconds > currentStart) {
        segments.push(createSegment(currentStart, durationSeconds));
    }

    return segments.filter(function(segment) {
        return segment.duration > 0;
    });
}

function buildActiveSegments(silenceSegments, durationSeconds) {
    if (durationSeconds <= 0) {
        return [];
    }

    const activeSegments = [];
    let currentStart = 0;

    for (const segment of silenceSegments) {
        if (segment.start > currentStart) {
            activeSegments.push(createSegment(currentStart, segment.start));
        }
        currentStart = Math.max(currentStart, segment.end);
    }

    if (currentStart < durationSeconds) {
        activeSegments.push(createSegment(currentStart, durationSeconds));
    }

    return activeSegments.filter(function(segment) {
        return segment.duration > 0;
    });
}

function createSegment(start, end) {
    const roundedStart = roundValue(start);
    const roundedEnd = roundValue(end);
    return {
        start: roundedStart,
        end: roundedEnd,
        duration: roundValue(Math.max(0, roundedEnd - roundedStart)),
    };
}

function sumDuration(segments) {
    return roundValue(segments.reduce(function(total, segment) {
        return total + segment.duration;
    }, 0));
}

function roundValue(value) {
    return Math.round(value * 1000) / 1000;
}

function numberOrDefault(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

module.exports = {
    analyzeAudioActivity,
    getDurationSeconds,
};
