# Environment Reference

This document explains every environment variable supported by `ffmpeg-api`.

All variables have defaults. In most deployments, you only override the values that matter for your infrastructure.

## Runtime and logging

### `NODE_ENV`

- Default: `development`
- Common values: `development`, `production`
- Use `production` in deployed environments.

### `LOG_LEVEL`

- Default: `info`
- Common values: `error`, `warn`, `info`, `debug`
- Use `debug` only when you need more troubleshooting output.

### `SHOW_STARTUP_BANNER`

- Default: `true`
- Controls whether the Rods Company startup banner and quick links are printed on boot.
- Set to `false` if you want quieter logs in CI or strict log collectors.

## Network and public URLs

### `SERVER_PORT`

- Default: `3000`
- Internal port used by the Node.js server.

### `EXTERNAL_PORT`

- Default: `3000`
- Public port used when startup links are generated and `PUBLIC_BASE_URL` is not set.

### `PUBLIC_BASE_URL`

- Default: empty
- Example: `https://ffmpeg-api.rods.company`
- When set, this value is used in:
  - startup banner links
  - `/v1/health`
  - the OpenAPI `servers` block served to Scalar
- Recommended for reverse proxy and custom-domain deployments.

## Uploads and temporary files

### `FILE_SIZE_LIMIT_BYTES`

- Default: `536870912`
- Default size: `512MB`
- Maximum upload size for multipart requests.

### `KEEP_ALL_FILES`

- Default: `false`
- When `true`, temporary input and output files are kept longer instead of being cleaned aggressively.
- Keep this `false` unless you are debugging file lifecycle issues.

## Sync and async job execution

### `ENABLE_SYNC_SMALL_JOBS`

- Default: `true`
- Allows `mode=auto` to return direct synchronous output for small requests.

### `SYNC_MAX_INPUT_BYTES`

- Default: `10485760`
- Default size: `10MB`
- Maximum input size eligible for automatic synchronous processing.

### `JOB_CONCURRENCY`

- Default: `2`
- Number of jobs processed in parallel by the in-memory worker pool.
- Increase carefully because FFmpeg jobs consume CPU and I/O.

### `MAX_QUEUE_SIZE`

- Default: `100`
- Maximum queued async jobs before the API returns `429`.

### `JOB_RETENTION_MS`

- Default: `900000`
- Default duration: `15 minutes`
- How long completed artifacts stay available for download.

### `JOB_TIMEOUT_MS`

- Default: `3600000`
- Default duration: `1 hour`
- Socket and processing timeout for long-running requests.

## Remote URL ingestion

### `DOWNLOAD_TIMEOUT_MS`

- Default: `60000`
- Default duration: `60 seconds`
- Timeout for downloading remote input files by URL.

### `URL_MAX_REDIRECTS`

- Default: `5`
- Maximum redirects allowed while resolving remote URLs.

### `ALLOW_PRIVATE_URLS`

- Default: `false`
- When `true`, the API accepts loopback and private-network URLs.
- Keep this `false` in most public deployments to reduce SSRF risk.

### `JSON_BODY_LIMIT`

- Default: `1mb`
- Express JSON body parser limit for URL-based requests.

## Audio activity analysis

### `AUDIO_ACTIVITY_NOISE_THRESHOLD_DB`

- Default: `-35`
- Silence threshold used by the analyzer.

### `AUDIO_ACTIVITY_MIN_SILENCE_DURATION`

- Default: `0.5`
- Minimum silence duration, in seconds, used by the analyzer.

### `AUDIO_ACTIVITY_MIN_SEGMENT_DURATION`

- Default: `1.2`
- Minimum active segment duration, in seconds, required to avoid `likelyBackgroundOnly=true`.

### `AUDIO_ACTIVITY_MIN_ACTIVE_RATIO`

- Default: `0.08`
- Minimum active ratio required to avoid `likelyBackgroundOnly=true`.

### `AUDIO_ACTIVITY_USE_SPEECH_BAND`

- Default: `true`
- Applies a speech-band filter before silence detection.

## Scalar documentation UI

### `SCALAR_THEME`

- Default: `elysiajs`
- Controls the Scalar theme preset.

### `SCALAR_TITLE`

- Default: `ffmpeg-api`
- Title shown in the Scalar UI and browser tab.

### `SCALAR_TELEMETRY`

- Default: `true`
- Enables or disables Scalar telemetry.

### `SCALAR_LAYOUT`

- Default: `modern`
- Allowed values: `modern`, `classic`

## Suggested profiles

### Local development

- `NODE_ENV=development`
- `LOG_LEVEL=debug`
- `ALLOW_PRIVATE_URLS=true`
- `SHOW_STARTUP_BANNER=true`

### Public production deployment

- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `PUBLIC_BASE_URL=https://your-domain.example`
- `ALLOW_PRIVATE_URLS=false`
- `JOB_CONCURRENCY` tuned to your CPU budget
- `SHOW_STARTUP_BANNER=true` or `false` based on log preference
