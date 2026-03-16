# ffmpeg-api

`ffmpeg-api` is an async-first HTTP API for FFmpeg maintained by Rods Company. It lets backend services upload a file or point to a URL, run a recipe of audio or video operations, and fetch the generated artifact either synchronously for small inputs or asynchronously through job polling.

It is built for practical media workflows such as:

- speeding up audio
- trimming clips
- removing silent sections
- normalizing loudness and adjusting volume
- extracting audio from video
- detecting whether an audio file is probably background-only

## 🚀 Overview

FFmpeg is powerful, but wiring uploads, URL ingestion, polling, output storage, and safe runtime defaults into a service usually gets repeated in every project.

This API packages that into a single service with:

- upload or remote URL input
- `sync`, `async`, and `auto` execution modes
- queue-based parallel processing
- recipe-driven transformations
- audio activity analysis
- chunking designed to keep transcription workloads manageable, including avoiding oversized files that may timeout in tools such as Whisper
- OpenAPI documentation rendered by Scalar

## ✨ Features

- upload or remote URL input
- `sync`, `async`, and `auto` execution modes
- queue-based parallel processing
- recipe-driven transformations
- audio activity analysis
- OpenAPI documentation rendered by Scalar

## 📦 Images

- GHCR: `ghcr.io/rods-company/ffmpeg-api`
- Docker Hub: `<your-dockerhub-namespace>/ffmpeg-api`

## 📚 Docs

- `GET /docs` for the interactive Scalar API reference
- `GET /openapi.yaml` for the raw OpenAPI contract
- [CHANGELOG.md](CHANGELOG.md) for generated release history
- [docs/environment-reference.md](docs/environment-reference.md) for the full environment variable reference
- [docs/transformation-roadmap.md](docs/transformation-roadmap.md) for implementation and release direction
- [docs/release-guide.md](docs/release-guide.md) for the release model
- [CONTRIBUTING.md](CONTRIBUTING.md) for commit and PR conventions

## 🔌 API

- `GET /` redirects to `/docs`
- `GET /docs` interactive API documentation
- `GET /openapi.yaml` raw OpenAPI document
- `GET /endpoints` endpoint listing as JSON
- `GET /v1/health` service health and effective runtime settings
- `GET /v1/capabilities` runtime FFmpeg, FFprobe, formats, codecs, and filters
- `POST /v1/analyze/audio-activity/url` heuristic analysis from a remote URL
- `POST /v1/analyze/audio-activity/upload` heuristic analysis from an uploaded file
- `POST /v1/jobs/url` create a processing job from JSON URL input
- `POST /v1/jobs/upload` create a processing job from multipart upload
- `POST /v1/chunks/url` split remote audio or video into chunks and return a ZIP file or async job
- `POST /v1/chunks/upload` split uploaded audio or video into chunks and return a ZIP file or async job
- `GET /v1/jobs/:jobId` poll async job state
- `POST /v1/jobs/:jobId/cancel` cancel a queued or running job
- `GET /v1/jobs/:jobId/artifact` download the completed output file

## ⚙️ Execution Model

- URL input uses `application/json`
- upload input uses `multipart/form-data`
- `mode=auto|sync|async` controls whether the request should try the synchronous path
- small inputs can be processed synchronously when `ENABLE_SYNC_SMALL_JOBS=true`
- `analysis.audioActivity` can be enabled inside `POST /v1/jobs/url` and `POST /v1/jobs/upload` to avoid sending the same file twice
- chunking is exposed through separate `url` and `upload` routes for clearer contracts and better API documentation
- supported input and output formats depend on the FFmpeg runtime; use `GET /v1/capabilities` when you need the real formats, codecs, and filters available in the current deployment

## ▶️ Running

### 🐳 Docker

Build the image from the repository root:

```bash
docker build -t ffmpeg-api .
```

Run the container with default settings:

```bash
docker run --rm -p 3000:3000 --name ffmpeg-api ffmpeg-api
```

Run the container in background using `.env.example` as a base:

```bash
cp .env.example .env
docker run -d \
  --name ffmpeg-api \
  --env-file .env \
  -p 3000:3000 \
  ffmpeg-api
```

After the container starts:

- API docs: `http://127.0.0.1:3000/docs`
- OpenAPI: `http://127.0.0.1:3000/openapi.yaml`
- Health check: `http://127.0.0.1:3000/v1/health`

### 💻 Local

Install dependencies inside `src/`:

```bash
cd src
npm install
```

Start the API:

```bash
npm start
```

If you want custom settings locally, create `src/.env` or export variables before starting the server.

### ☁️ Dockploy

For Dockploy or any container platform that supports environment variables:

- use [compose.dockploy.yml](compose.dockploy.yml) as the base compose file
- use the published image `rodscompany/ffmpeg-api:latest` or pin a version such as `rodscompany/ffmpeg-api:1.1.0`
- expose container port `3000`
- start from [.env.production.example](.env.production.example)
- override only the values you actually need
- keep `ALLOW_PRIVATE_URLS=false` unless you have a controlled private-network use case

Example Dockploy variables:

- `FFMPEG_API_IMAGE=rodscompany/ffmpeg-api:latest`
- `PUBLIC_PORT=3000`
- `EXTERNAL_PORT=3000`
- `PUBLIC_BASE_URL=https://ffmpeg-api.seudominio.com`
- `JOB_CONCURRENCY=2`
- `MAX_QUEUE_SIZE=100`

The compose file also mounts a named volume at `/tmp/ffmpeg-api` so temporary artifacts are not lost immediately when the container restarts.

## 🌍 Environment

The new `v1` job API is configurable through environment variables and all of them have defaults. For Docker, Dockploy, or Compose-style deployments, see [.env.example](.env.example).

For the full explanation of every variable, including defaults, tradeoffs, and when to change them, see [docs/environment-reference.md](docs/environment-reference.md).

- `SERVER_PORT=3000` internal HTTP port used by the service
- `EXTERNAL_PORT=3000` external/public port exposed by the deployment
- `PUBLIC_BASE_URL=` optional full public base URL used in startup links, for example `https://ffmpeg-api.rods.company`
- `ENABLE_SYNC_SMALL_JOBS=true` allows the API to process small requests synchronously instead of creating an async job
- `SYNC_MAX_INPUT_BYTES=10485760` maximum size in bytes for automatic synchronous processing
- `JOB_CONCURRENCY=2` number of FFmpeg jobs processed in parallel
- `MAX_QUEUE_SIZE=100` maximum queued async jobs before the API returns `429`
- `JOB_RETENTION_MS=900000` how long completed artifacts stay available for download
- `JOB_TIMEOUT_MS=3600000` socket timeout for long-running requests
- `DOWNLOAD_TIMEOUT_MS=60000` timeout for remote URL downloads
- `URL_MAX_REDIRECTS=5` maximum redirects allowed when ingesting a URL
- `ALLOW_PRIVATE_URLS=false` when `true`, the API accepts loopback and private network URLs
- `JSON_BODY_LIMIT=1mb` maximum JSON payload size for URL-based requests
- `AUDIO_ACTIVITY_NOISE_THRESHOLD_DB=-35` silence threshold used by the audio activity analyzer
- `AUDIO_ACTIVITY_MIN_SILENCE_DURATION=0.5` minimum silence duration for the analyzer
- `AUDIO_ACTIVITY_MIN_SEGMENT_DURATION=1.2` minimum active segment duration required to avoid being classified as background-only
- `AUDIO_ACTIVITY_MIN_ACTIVE_RATIO=0.08` minimum active ratio required to avoid being classified as background-only
- `AUDIO_ACTIVITY_USE_SPEECH_BAND=true` applies a speech-band filter before silence detection
- `SHOW_STARTUP_BANNER=true` enables the Rods Company startup banner and quick links in the server console

## 🧪 Usage

Input media can be anything that FFmpeg supports. `.ogg` is a first-class supported output format in the API examples and tests.

When you need the actual formats, codecs, and filters supported by the current deployment, use `GET /v1/capabilities`. That endpoint is the runtime source of truth.

You can send media in two ways:

- by URL with `application/json`
- by direct file upload with `multipart/form-data`

For uploads, use a file field named `file`.

### Sync request from URL

```bash
curl -X POST http://127.0.0.1:3000/v1/jobs/url \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sync",
    "input": {
      "type": "url",
      "url": "https://example.com/input.ogg"
    },
    "analysis": {
      "audioActivity": true
    },
    "recipe": {
      "output": {
        "container": "ogg",
        "filename": "output.ogg"
      },
      "operations": [
        {
          "type": "speed",
          "factor": 1.2
        }
      ]
    }
  }' > output.ogg
```

When `analysis.audioActivity` is enabled in synchronous mode, the API returns the generated file and includes the diagnostic summary in response headers such as:

- `X-Audio-Activity-Background-Only`
- `X-Audio-Activity-Contains-Speech-Like-Activity`
- `X-Audio-Activity-Active-Ratio`

### Sync request from upload

```bash
curl -X POST http://127.0.0.1:3000/v1/jobs/upload \
  -F "file=@./input.ogg" \
  -F "mode=sync" \
  -F "analysis={\"audioActivity\":true}" \
  -F "recipe={\"output\":{\"container\":\"ogg\",\"filename\":\"output.ogg\"},\"operations\":[{\"type\":\"speed\",\"factor\":1.2}]}" \
  -o output.ogg
```

### Async request from URL

```bash
curl -X POST http://127.0.0.1:3000/v1/jobs/url \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "async",
    "input": {
      "type": "url",
      "url": "https://example.com/input.ogg"
    },
    "analysis": {
      "audioActivity": true
    },
    "recipe": {
      "output": {
        "container": "ogg",
        "filename": "output.ogg"
      },
      "operations": [
        {
          "type": "silence_trim"
        },
        {
          "type": "speed",
          "factor": 1.2
        }
      ]
    }
  }'
```

### Chunk media into equal parts

```bash
curl -X POST http://127.0.0.1:3000/v1/chunks/url \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sync",
    "input": {
      "type": "url",
      "url": "https://example.com/input.ogg"
    },
    "output": {
      "container": "ogg",
      "filenamePrefix": "part",
      "archiveName": "parts.zip"
    },
    "chunking": {
      "strategy": "parts",
      "parts": 4,
      "paddingBeforeSeconds": 0.5,
      "paddingAfterSeconds": 0.5
    }
  }' > parts.zip
```

### Chunk media on silence

```bash
curl -X POST http://127.0.0.1:3000/v1/chunks/url \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "async",
    "input": {
      "type": "url",
      "url": "https://example.com/interview.ogg"
    },
    "output": {
      "container": "ogg",
      "filenamePrefix": "segment",
      "archiveName": "segments.zip"
    },
    "chunking": {
      "strategy": "silence",
      "minSilenceDuration": 0.5,
      "paddingBeforeSeconds": 0.2,
      "paddingAfterSeconds": 0.2,
      "minChunkDurationSeconds": 1,
      "maxChunkDurationSeconds": 20
    }
  }'
```

The generated artifact is a `.zip` file containing each chunk plus a `manifest.json` with the chunk boundaries.

`chunking.strategy` is the field that selects the chunk mode:

- `parts` divides the full media into equal parts and uses `parts`
- `duration` divides every fixed interval and uses `segmentDuration`
- `silence` cuts around active segments and uses silence-related options such as `minSilenceDuration`
- `maxChunkDurationSeconds` can be used with `silence` to keep chunks small enough for transcription without needing perfectly precise cuts
- in `parts` and `duration`, `paddingBeforeSeconds` and `paddingAfterSeconds` tell the API to look for a nearby silence before doing a hard cut

### Chunk upload with multipart form-data

```bash
curl -X POST http://127.0.0.1:3000/v1/chunks/upload \
  -F "file=@./input.ogg" \
  -F "mode=sync" \
  -F "container=ogg" \
  -F "filenamePrefix=part" \
  -F "archiveName=parts.zip" \
  -F "strategy=parts" \
  -F "parts=4" \
  -o parts.zip
```

### Chunk upload on silence with a maximum chunk duration

```bash
curl -X POST http://127.0.0.1:3000/v1/chunks/upload \
  -F "file=@./input.ogg" \
  -F "mode=async" \
  -F "container=ogg" \
  -F "filenamePrefix=segment" \
  -F "archiveName=segments.zip" \
  -F "strategy=silence" \
  -F "minSilenceDuration=0.5" \
  -F "paddingBeforeSeconds=0.2" \
  -F "paddingAfterSeconds=0.2" \
  -F "minChunkDurationSeconds=1" \
  -F "maxChunkDurationSeconds=20"
```

### Polling a job

- `curl http://127.0.0.1:3000/v1/jobs/<jobId>`
- `curl http://127.0.0.1:3000/v1/jobs/<jobId>/artifact > output.ogg`

When `analysis.audioActivity` is enabled for an async job, the diagnostic is attached to the job payload in the `analysis.audioActivity` field.

### Async request from upload

```bash
curl -X POST http://127.0.0.1:3000/v1/jobs/upload \
  -F "file=@./input.ogg" \
  -F "mode=async" \
  -F "analysis={\"audioActivity\":true}" \
  -F "recipe={\"output\":{\"container\":\"ogg\",\"filename\":\"output.ogg\"},\"operations\":[{\"type\":\"silence_trim\"},{\"type\":\"speed\",\"factor\":1.2}]}"
```

### Analyze whether audio is probably background-only

```bash
curl -X POST http://127.0.0.1:3000/v1/analyze/audio-activity/url \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "type": "url",
      "url": "https://example.com/input.ogg"
    }
  }'
```

This endpoint does not recognize speech. It uses a speech-band activity heuristic and returns fields such as:

- `hasAudioActivity`
- `likelyBackgroundOnly`
- `likelyContainsSpeechLikeActivity`
- `silenceSegments`
- `activeSegments`

### Analyze an uploaded file

```bash
curl -X POST http://127.0.0.1:3000/v1/analyze/audio-activity/upload \
  -F "file=@./input.ogg" \
  -F "options={\"minActiveRatio\":0.08,\"minSegmentDuration\":1.2}"
```

## 🏷️ Release Automation

The repository is set up to automate releases from Conventional Commits.

- pushes and pull requests run CI
- pull request titles are validated against a Conventional Commit pattern
- merges to `main` or `master` update a Release Please PR automatically
- merging the release PR creates the next version tag and GitHub Release automatically
- published images receive semantic Docker tags such as `1.2.3`, `1.2`, `1`, and `latest`

If you use squash merge, the pull request title becomes especially important because it usually becomes the final commit message on the default branch.

## 📝 Notes

- `silence_trim` removes silent sections. It is not noise reduction.
- `audio-activity` is a heuristic analysis. It is not speech recognition.

## 🙏 Origins

Originally developed by [Paul Visco @surebert](https://github.com/surebert).

This project builds on ideas or implementations from:

- https://github.com/samisalkosuo/ffmpeg-api
- https://github.com/surebert/docker-ffmpeg-service
- https://github.com/jrottenberg/ffmpeg
- https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
