function getIntEnv(name, fallback) {
    const value = parseInt(process.env[name] || `${fallback}`, 10);
    return Number.isNaN(value) ? fallback : value;
}

function getBoolEnv(name, fallback) {
    const value = (process.env[name] || `${fallback}`).toLowerCase();
    return value === 'true' || value === '1' || value === 'yes';
}

function getEnumEnv(name, fallback, allowedValues) {
    const value = process.env[name] || fallback;
    return allowedValues.indexOf(value) !== -1 ? value : fallback;
}

function getStringEnv(name, fallback) {
    return (process.env[name] || fallback || '').trim();
}

function normalizeBaseUrl(value) {
    if (!value) {
        return '';
    }

    return value.replace(/\/+$/, '');
}

exports.fileSizeLimit = getIntEnv('FILE_SIZE_LIMIT_BYTES', 536870912); // 512MB
exports.defaultFFMPEGProcessPriority = 10;
exports.serverPort = getIntEnv('SERVER_PORT', 3000);
exports.externalPort = process.env.EXTERNAL_PORT;
exports.publicBaseUrl = normalizeBaseUrl(getStringEnv('PUBLIC_BASE_URL', ''));
exports.keepAllFiles = process.env.KEEP_ALL_FILES || "false";
exports.nodeEnv = process.env.NODE_ENV || 'development';
exports.enableSyncSmallJobs = getBoolEnv('ENABLE_SYNC_SMALL_JOBS', true);
exports.syncMaxInputBytes = getIntEnv('SYNC_MAX_INPUT_BYTES', 10485760); // 10MB
exports.jobConcurrency = getIntEnv('JOB_CONCURRENCY', 2);
exports.maxQueueSize = getIntEnv('MAX_QUEUE_SIZE', 100);
exports.jobRetentionMs = getIntEnv('JOB_RETENTION_MS', 900000); // 15 minutes
exports.jobTimeoutMs = getIntEnv('JOB_TIMEOUT_MS', 3600000); // 1 hour
exports.downloadTimeoutMs = getIntEnv('DOWNLOAD_TIMEOUT_MS', 60000); // 1 minute
exports.urlMaxRedirects = getIntEnv('URL_MAX_REDIRECTS', 5);
exports.allowPrivateUrls = getBoolEnv('ALLOW_PRIVATE_URLS', false);
exports.jsonBodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
exports.audioActivityNoiseThresholdDb = getIntEnv('AUDIO_ACTIVITY_NOISE_THRESHOLD_DB', -35);
exports.audioActivityMinSilenceDuration = parseFloat(process.env.AUDIO_ACTIVITY_MIN_SILENCE_DURATION || '0.5');
exports.audioActivityMinSegmentDuration = parseFloat(process.env.AUDIO_ACTIVITY_MIN_SEGMENT_DURATION || '1.2');
exports.audioActivityMinActiveRatio = parseFloat(process.env.AUDIO_ACTIVITY_MIN_ACTIVE_RATIO || '0.08');
exports.audioActivityUseSpeechBand = getBoolEnv('AUDIO_ACTIVITY_USE_SPEECH_BAND', true);
exports.scalarTheme = process.env.SCALAR_THEME || 'elysiajs';
exports.scalarTitle = process.env.SCALAR_TITLE || 'ffmpeg-api';
exports.scalarTelemetry = getBoolEnv('SCALAR_TELEMETRY', true);
exports.scalarLayout = getEnumEnv('SCALAR_LAYOUT', 'modern', ['modern', 'classic']);
exports.showStartupBanner = getBoolEnv('SHOW_STARTUP_BANNER', true);
