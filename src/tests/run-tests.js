const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

process.env.LOG_LEVEL = 'error';
process.env.ALLOW_PRIVATE_URLS = 'true';
process.env.ENABLE_SYNC_SMALL_JOBS = 'true';
process.env.SYNC_MAX_INPUT_BYTES = '10485760';
process.env.JOB_RETENTION_MS = '5000';
process.env.SHOW_STARTUP_BANNER = 'false';

const {startServer} = require('../app.js');

let apiServer;
let apiBaseUrl;
let assetServer;
let assetBaseUrl;
let samplePath;
let burstPath;
let videoPath;
let backgroundOnlyPath;

main().catch(async function(error) {
    console.error(error.stack || error.message);
    await shutdown();
    process.exit(1);
});

async function main() {
    await setup();

    await testHealth();
    await testDocs();
    await testSyncJob();
    await testAsyncJob();
    await testMultipartUploadJob();
    await testExtractAudioJob();
    await testSyncJobWithAudioActivityHeaders();
    await testAsyncJobWithAttachedAudioActivity();
    await testBackgroundOnlyAnalysis();
    await testForegroundActivityAnalysis();
    await testStructuredValidationError();

    await shutdown();
    console.log('All integration checks passed.');
    process.exit(0);
}

async function setup() {
    samplePath = path.join(os.tmpdir(), 'ffmpeg-api-test-tone.wav');
    burstPath = path.join(os.tmpdir(), 'ffmpeg-api-test-bursts.wav');
    videoPath = path.join(os.tmpdir(), 'ffmpeg-api-test-video.mp4');
    backgroundOnlyPath = path.join(os.tmpdir(), 'ffmpeg-api-test-background.wav');

    execFileSync('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'sine=frequency=1000:duration=1',
        '-y',
        samplePath,
    ], {stdio: 'ignore'});

    execFileSync('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'aevalsrc=if(lt(mod(t\\,3)\\,1.5)\\,0.6*sin(2*PI*440*t)\\,0):s=48000:d=9',
        '-y',
        burstPath,
    ], {stdio: 'ignore'});

    execFileSync('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'anullsrc=r=48000:cl=mono',
        '-t', '8',
        '-y',
        backgroundOnlyPath,
    ], {stdio: 'ignore'});

    execFileSync('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=24:duration=2',
        '-f', 'lavfi',
        '-i', 'sine=frequency=880:duration=2',
        '-shortest',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-y',
        videoPath,
    ], {stdio: 'ignore'});

    assetServer = http.createServer(function(req, res) {
        if (req.url === '/bursts.wav') {
            fs.createReadStream(burstPath).pipe(res);
            return;
        }
        if (req.url === '/silent-detect.ogg') {
            fs.createReadStream(backgroundOnlyPath).pipe(res);
            return;
        }
        if (req.url === '/video.mp4') {
            fs.createReadStream(videoPath).pipe(res);
            return;
        }
        fs.createReadStream(samplePath).pipe(res);
    });

    await listen(assetServer);
    assetBaseUrl = `http://127.0.0.1:${assetServer.address().port}`;

    apiServer = startServer(0);
    await onceListening(apiServer);
    apiBaseUrl = `http://127.0.0.1:${apiServer.address().port}`;
}

async function shutdown() {
    if (apiServer) {
        await closeServer(apiServer);
        apiServer = null;
    }
    if (assetServer) {
        await closeServer(assetServer);
        assetServer = null;
    }
    if (samplePath && fs.existsSync(samplePath)) {
        fs.unlinkSync(samplePath);
    }
    if (burstPath && fs.existsSync(burstPath)) {
        fs.unlinkSync(burstPath);
    }
    if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
    }
    if (backgroundOnlyPath && fs.existsSync(backgroundOnlyPath)) {
        fs.unlinkSync(backgroundOnlyPath);
    }
}

async function testHealth() {
    const response = await fetch(`${apiBaseUrl}/v1/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.syncSmallJobsEnabled, true);
}

async function testDocs() {
    const response = await fetch(`${apiBaseUrl}/docs`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Scalar/i);
    assert.match(body, /ffmpeg-api/i);
}

async function testSyncJob() {
    const response = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            mode: 'sync',
            input: {
                type: 'url',
                url: `${assetBaseUrl}/test-tone.wav`,
            },
            recipe: {
                output: {
                    container: 'ogg',
                    filename: 'sync-tone.ogg',
                },
                operations: [
                    {
                        type: 'speed',
                        factor: 1.1,
                    },
                ],
            },
        }),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /audio\/ogg/);
    assert.ok(buffer.length > 0);
}

async function testAsyncJob() {
    const createResponse = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            mode: 'async',
            input: {
                type: 'url',
                url: `${assetBaseUrl}/test-tone.wav`,
            },
            recipe: {
                output: {
                    container: 'ogg',
                    filename: 'async-tone.ogg',
                },
                operations: [
                    {
                        type: 'speed',
                        factor: 1.1,
                    },
                ],
            },
        }),
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 202);
    assert.ok(created.id);

    let job = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        await sleep(250);
        const statusResponse = await fetch(`${apiBaseUrl}/v1/jobs/${created.id}`);
        job = await statusResponse.json();
        if (job.status === 'completed' || job.status === 'failed') {
            break;
        }
    }

    assert.ok(job);
    assert.equal(job.status, 'completed');
    assert.equal(job.artifact.filename, 'async-tone.ogg');

    const artifactResponse = await fetch(`${apiBaseUrl}${job.artifact.downloadUrl}`);
    const artifactBuffer = Buffer.from(await artifactResponse.arrayBuffer());
    assert.equal(artifactResponse.status, 200);
    assert.ok(artifactBuffer.length > 0);
}

async function testMultipartUploadJob() {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(samplePath)]), 'upload-tone.wav');
    form.append('recipe', JSON.stringify({
        output: {
            container: 'mp3',
            filename: 'upload-tone.mp3',
        },
        operations: [
            {
                type: 'speed',
                factor: 1.1,
            },
        ],
    }));
    form.append('mode', 'sync');

    const response = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        body: form,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /audio\/mpeg/);
    assert.ok(buffer.length > 0);
}

async function testExtractAudioJob() {
    const response = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            mode: 'sync',
            input: {
                type: 'url',
                url: `${assetBaseUrl}/video.mp4`,
            },
            recipe: {
                output: {
                    container: 'mp3',
                    filename: 'from-video.mp3',
                },
                operations: [
                    {
                        type: 'extract_audio',
                    },
                ],
            },
        }),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /audio\/mpeg/);
    assert.ok(buffer.length > 0);
}

async function testBackgroundOnlyAnalysis() {
    const response = await fetch(`${apiBaseUrl}/v1/analyze/audio-activity`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            input: {
                type: 'url',
                url: `${assetBaseUrl}/silent-detect.ogg`,
            },
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.analysis.likelyBackgroundOnly, true);
    assert.equal(body.analysis.likelyContainsSpeechLikeActivity, false);
}

async function testForegroundActivityAnalysis() {
    const response = await fetch(`${apiBaseUrl}/v1/analyze/audio-activity`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            input: {
                type: 'url',
                url: `${assetBaseUrl}/bursts.wav`,
            },
            options: {
                minActiveRatio: 0.2,
                minSegmentDuration: 1.0,
            },
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.analysis.hasAudioActivity, true);
    assert.equal(body.analysis.likelyBackgroundOnly, false);
}

async function testStructuredValidationError() {
    const response = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            mode: 'async',
            input: {
                type: 'url',
                url: `${assetBaseUrl}/test-tone.wav`,
            },
            recipe: {
                output: {
                    container: 'mp3',
                },
                operations: [
                    {
                        type: 'not_real',
                    },
                ],
            },
        }),
    });

    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, 'unsupported_operation');
    assert.equal(body.details.type, 'not_real');
}

async function testSyncJobWithAudioActivityHeaders() {
    const response = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            mode: 'sync',
            input: {
                type: 'url',
                url: `${assetBaseUrl}/silent-detect.ogg`,
            },
            analysis: {
                audioActivity: true,
            },
            recipe: {
                output: {
                    container: 'mp3',
                    filename: 'sync-analysis.mp3',
                },
                operations: [
                    {
                        type: 'trim',
                        start: '00:00:00',
                        duration: '00:00:02',
                    },
                ],
            },
        }),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.ok(buffer.length > 0);
    assert.equal(response.headers.get('x-audio-activity-background-only'), 'true');
    assert.equal(response.headers.get('x-audio-activity-contains-speech-like-activity'), 'false');
}

async function testAsyncJobWithAttachedAudioActivity() {
    const createResponse = await fetch(`${apiBaseUrl}/v1/jobs`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            mode: 'async',
            input: {
                type: 'url',
                url: `${assetBaseUrl}/silent-detect.ogg`,
            },
            analysis: {
                audioActivity: true,
            },
            recipe: {
                output: {
                    container: 'mp3',
                    filename: 'async-analysis.mp3',
                },
                operations: [
                    {
                        type: 'trim',
                        start: '00:00:00',
                        duration: '00:00:02',
                    },
                ],
            },
        }),
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 202);
    assert.ok(created.id);

    let job = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(250);
        const statusResponse = await fetch(`${apiBaseUrl}/v1/jobs/${created.id}`);
        job = await statusResponse.json();
        if (job.status === 'completed' || job.status === 'failed') {
            break;
        }
    }

    assert.ok(job);
    assert.equal(job.status, 'completed');
    assert.ok(job.analysis);
    assert.ok(job.analysis.audioActivity);
    assert.equal(job.analysis.audioActivity.likelyBackgroundOnly, true);
}

function listen(server) {
    return new Promise(function(resolve, reject) {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}

function onceListening(server) {
    if (server.listening) {
        return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
        server.once('listening', resolve);
        server.once('error', reject);
    });
}

function closeServer(server) {
    return new Promise(function(resolve, reject) {
        if (!server.listening) {
            resolve();
            return;
        }
        if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
        }
        if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
        }
        server.close(function(error) {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function sleep(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}
