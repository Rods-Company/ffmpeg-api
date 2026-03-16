const fs = require('fs');
const AdmZip = require('adm-zip');

const {analyzeAudioActivity, getDurationSeconds} = require('./audio-activity-analyzer.js');
const {runProcessing} = require('./media-processor.js');
const {createValidationError} = require('./recipe-validator.js');
const {resolveTempPath} = require('./temp-path.js');

async function createChunksArchive(inputPath, chunkRequest, job) {
    const segments = await buildSegments(inputPath, chunkRequest.chunking);
    if (!segments.length) {
        throw createValidationError('no chunks were generated for this input', 422, 'no_chunks_detected');
    }

    const output = chunkRequest.output;
    const files = [];
    const archiveFilePath = resolveTempPath(`${job.id}-chunks.zip`);

    try {
        for (let index = 0; index < segments.length; index += 1) {
            const segment = segments[index];
            updateProgress(job, index, segments.length);

            const chunkNumber = `${index + 1}`.padStart(3, '0');
            const chunkFilename = `${output.filenamePrefix}-${chunkNumber}.${output.container}`;
            const chunkJob = {
                id: `${job.id}-chunk-${chunkNumber}`,
                runtime: job.runtime,
                progress: job.progress,
            };
            const artifact = await runProcessing(inputPath, {
                output: {
                    container: output.container,
                    filename: chunkFilename,
                },
                operations: [
                    {
                        type: 'trim',
                        start: `${segment.start}`,
                        duration: `${segment.duration}`,
                    },
                ],
            }, chunkJob);

            files.push({
                artifact: artifact,
                segment: Object.assign({index: index + 1}, segment, {
                    filename: chunkFilename,
                }),
            });
        }

        await createArchive(archiveFilePath, files);

        return {
            filename: output.archiveName,
            filePath: archiveFilePath,
            contentType: 'application/zip',
            extension: 'zip',
            chunkCount: files.length,
            manifest: {
                strategy: chunkRequest.chunking.strategy,
                chunks: files.map(function(entry) {
                    return entry.segment;
                }),
            },
        };
    } finally {
        files.forEach(function(entry) {
            safeDelete(entry.artifact.filePath);
        });
    }
}

async function buildSegments(inputPath, chunking) {
    if (chunking.strategy === 'parts') {
        const durationSeconds = await getDurationSeconds(inputPath);
        return buildEqualSegments(durationSeconds, chunking.parts, await findPreferredCutPoints(inputPath, durationSeconds, buildEqualPartBoundaries(durationSeconds, chunking.parts), chunking));
    }

    if (chunking.strategy === 'duration') {
        const durationSeconds = await getDurationSeconds(inputPath);
        return buildFixedDurationSegments(durationSeconds, chunking.segmentDurationSeconds, await findPreferredCutPoints(inputPath, durationSeconds, buildDurationBoundaries(durationSeconds, chunking.segmentDurationSeconds), chunking));
    }

    return buildSilenceBasedSegments(inputPath, chunking);
}

function buildEqualSegments(durationSeconds, parts, boundaries) {
    const segments = [];
    const splitPoints = boundaries || buildEqualPartBoundaries(durationSeconds, parts);
    let currentStart = 0;

    splitPoints.forEach(function(point) {
        pushSegment(segments, currentStart, point);
        currentStart = point;
    });

    pushSegment(segments, currentStart, durationSeconds);

    return segments;
}

function buildFixedDurationSegments(durationSeconds, segmentDurationSeconds, boundaries) {
    const segments = [];
    const splitPoints = boundaries || buildDurationBoundaries(durationSeconds, segmentDurationSeconds);
    let currentStart = 0;

    splitPoints.forEach(function(point) {
        pushSegment(segments, currentStart, point);
        currentStart = point;
    });

    pushSegment(segments, currentStart, durationSeconds);

    return segments;
}

function buildEqualPartBoundaries(durationSeconds, parts) {
    const boundaries = [];
    const chunkDuration = durationSeconds / parts;

    for (let index = 1; index < parts; index += 1) {
        boundaries.push(roundValue(index * chunkDuration));
    }

    return boundaries;
}

function buildDurationBoundaries(durationSeconds, segmentDurationSeconds) {
    const boundaries = [];

    for (let boundary = segmentDurationSeconds; boundary < durationSeconds; boundary += segmentDurationSeconds) {
        boundaries.push(roundValue(boundary));
    }

    return boundaries;
}

async function buildSilenceBasedSegments(inputPath, chunking) {
    const analysis = await analyzeAudioActivity(inputPath, {
        noiseThresholdDb: chunking.noiseThresholdDb,
        minSilenceDuration: chunking.minSilenceDuration,
        minSegmentDuration: chunking.minChunkDurationSeconds,
        minActiveRatio: 0,
        useSpeechBand: chunking.useSpeechBand,
    });

    const expanded = analysis.activeSegments.map(function(segment) {
        return {
            start: Math.max(0, roundValue(segment.start - chunking.paddingBeforeSeconds)),
            end: Math.min(analysis.durationSeconds, roundValue(segment.end + chunking.paddingAfterSeconds)),
        };
    });

    const merged = mergeSegments(expanded, chunking.mergeGapSeconds);
    return groupSpeechSegments(merged, chunking.minChunkDurationSeconds, chunking.maxChunkDurationSeconds);
}

function mergeSegments(segments, mergeGapSeconds) {
    if (!segments.length) {
        return [];
    }

    const sorted = segments.slice().sort(function(a, b) {
        return a.start - b.start;
    });
    const merged = [{start: sorted[0].start, end: sorted[0].end}];

    for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index];
        const last = merged[merged.length - 1];

        if (current.start <= last.end + mergeGapSeconds) {
            last.end = Math.max(last.end, current.end);
            continue;
        }

        merged.push({
            start: current.start,
            end: current.end,
        });
    }

    return merged.map(function(segment) {
        return createSegment(segment.start, segment.end);
    });
}

async function findPreferredCutPoints(inputPath, durationSeconds, targetBoundaries, chunking) {
    if (!targetBoundaries.length) {
        return [];
    }

    if (!chunking.paddingBeforeSeconds && !chunking.paddingAfterSeconds) {
        return targetBoundaries;
    }

    try {
        const analysis = await analyzeAudioActivity(inputPath, {
            noiseThresholdDb: chunking.noiseThresholdDb,
            minSilenceDuration: chunking.minSilenceDuration,
            minSegmentDuration: 0,
            minActiveRatio: 0,
            useSpeechBand: chunking.useSpeechBand,
        });

        const resolved = [];
        let previousBoundary = 0;

        targetBoundaries.forEach(function(target, index) {
            const nextBoundary = index < targetBoundaries.length - 1 ? targetBoundaries[index + 1] : durationSeconds;
            const adjusted = findNearestSilenceBoundary(
                target,
                previousBoundary,
                nextBoundary,
                analysis.silenceSegments,
                chunking.paddingBeforeSeconds,
                chunking.paddingAfterSeconds
            );

            resolved.push(adjusted);
            previousBoundary = adjusted;
        });

        return resolved;
    } catch (error) {
        return targetBoundaries;
    }
}

function findNearestSilenceBoundary(target, previousBoundary, nextBoundary, silenceSegments, paddingBeforeSeconds, paddingAfterSeconds) {
    const minGap = 0.05;
    const windowStart = Math.max(previousBoundary + minGap, target - paddingBeforeSeconds);
    const windowEnd = Math.min(nextBoundary - minGap, target + paddingAfterSeconds);

    if (windowEnd <= windowStart) {
        return roundValue(target);
    }

    let bestCandidate = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    silenceSegments.forEach(function(segment) {
        const overlapStart = Math.max(windowStart, segment.start);
        const overlapEnd = Math.min(windowEnd, segment.end);

        if (overlapEnd <= overlapStart) {
            return;
        }

        const candidate = roundValue((overlapStart + overlapEnd) / 2);
        const distance = Math.abs(candidate - target);

        if (distance < bestDistance) {
            bestDistance = distance;
            bestCandidate = candidate;
        }
    });

    return bestCandidate === null ? roundValue(target) : bestCandidate;
}

function createArchive(filePath, files) {
    return new Promise(function(resolve, reject) {
        try {
            const archive = new AdmZip();

            files.forEach(function(entry) {
                archive.addLocalFile(entry.artifact.filePath, '', entry.segment.filename);
            });

            archive.addFile('manifest.json', Buffer.from(JSON.stringify({
                generatedAt: new Date().toISOString(),
                chunkCount: files.length,
                chunks: files.map(function(entry) {
                    return entry.segment;
                }),
            }, null, 2), 'utf8'));

            archive.writeZip(filePath);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

function splitSegmentsByMaxDuration(segments, maxChunkDurationSeconds) {
    if (!maxChunkDurationSeconds || maxChunkDurationSeconds <= 0) {
        return segments;
    }

    const bounded = [];

    segments.forEach(function(segment) {
        if (segment.duration <= maxChunkDurationSeconds) {
            bounded.push(segment);
            return;
        }

        for (let start = segment.start; start < segment.end; start += maxChunkDurationSeconds) {
            const end = Math.min(segment.end, start + maxChunkDurationSeconds);
            pushSegment(bounded, start, end);
        }
    });

    return bounded;
}

function groupSpeechSegments(segments, minChunkDurationSeconds, maxChunkDurationSeconds) {
    if (!segments.length) {
        return [];
    }

    if (!maxChunkDurationSeconds || maxChunkDurationSeconds <= 0) {
        return mergeSmallSegments(segments, minChunkDurationSeconds);
    }

    const grouped = [];
    let current = createSegment(segments[0].start, segments[0].end);

    for (let index = 1; index < segments.length; index += 1) {
        const next = segments[index];

        if (current.duration >= maxChunkDurationSeconds) {
            pushOrSplit(grouped, current, maxChunkDurationSeconds);
            current = createSegment(next.start, next.end);
            continue;
        }

        const combined = createSegment(current.start, next.end);
        if (combined.duration <= maxChunkDurationSeconds) {
            current = combined;
            continue;
        }

        pushOrSplit(grouped, current, maxChunkDurationSeconds);
        current = createSegment(next.start, next.end);
    }

    pushOrSplit(grouped, current, maxChunkDurationSeconds);
    return mergeSmallSegments(grouped, minChunkDurationSeconds);
}

function pushOrSplit(target, segment, maxChunkDurationSeconds) {
    if (!maxChunkDurationSeconds || segment.duration <= maxChunkDurationSeconds) {
        target.push(segment);
        return;
    }

    splitSegmentsByMaxDuration([segment], maxChunkDurationSeconds).forEach(function(item) {
        target.push(item);
    });
}

function mergeSmallSegments(segments, minChunkDurationSeconds) {
    if (!minChunkDurationSeconds || minChunkDurationSeconds <= 0 || segments.length <= 1) {
        return segments;
    }

    const normalized = [];

    segments.forEach(function(segment) {
        const current = createSegment(segment.start, segment.end);

        if (normalized.length === 0) {
            normalized.push(current);
            return;
        }

        const last = normalized[normalized.length - 1];
        if (current.duration < minChunkDurationSeconds) {
            normalized[normalized.length - 1] = createSegment(last.start, current.end);
            return;
        }

        normalized.push(current);
    });

    return normalized;
}

function pushSegment(segments, start, end) {
    const segment = createSegment(start, end);
    if (segment.duration > 0) {
        segments.push(segment);
    }
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

function updateProgress(job, completedChunks, totalChunks) {
    if (!job) {
        return;
    }

    job.progress = {
        phase: 'chunking',
        percent: totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0,
    };
}

function safeDelete(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        // Best effort cleanup.
    }
}

function roundValue(value) {
    return Math.round(value * 1000) / 1000;
}

module.exports = {
    createChunksArchive,
};
