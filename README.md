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
- [docs/transformation-roadmap.md](docs/transformation-roadmap.md) for implementation and release direction
- [docs/release-guide.md](docs/release-guide.md) for the release model
- [CONTRIBUTING.md](CONTRIBUTING.md) for commit and PR conventions

## 🔌 API

- `GET /` service landing page
- `GET /docs` interactive API documentation
- `GET /openapi.yaml` raw OpenAPI document
- `GET /endpoints` endpoint listing as JSON
- `GET /v1/health` service health and effective runtime settings
- `GET /v1/capabilities` runtime FFmpeg, FFprobe, formats, codecs, and filters
- `POST /v1/analyze/audio-activity` heuristic analysis for background-only detection
- `POST /v1/jobs` create a processing job from JSON URL input or multipart upload
- `GET /v1/jobs/:jobId` poll async job state
- `POST /v1/jobs/:jobId/cancel` cancel a queued or running job
- `GET /v1/jobs/:jobId/artifact` download the completed output file

## ⚙️ Execution Model

- URL input uses `application/json`
- upload input uses `multipart/form-data`
- `mode=auto|sync|async` controls whether the request should try the synchronous path
- small inputs can be processed synchronously when `ENABLE_SYNC_SMALL_JOBS=true`
- `analysis.audioActivity` can be enabled inside `POST /v1/jobs` to avoid sending the same file twice

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

- use the image built from this repository
- expose container port `3000`
- start from [.env.production.example](.env.production.example)
- override only the values you actually need
- keep `ALLOW_PRIVATE_URLS=false` unless you have a controlled private-network use case

## 🌍 Environment

The new `v1` job API is configurable through environment variables and all of them have defaults. For Docker, Dockploy, or Compose-style deployments, see [.env.example](.env.example).

- `SERVER_PORT=3000` internal HTTP port used by the service
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

## 🧪 Usage

Input media can be anything that FFmpeg supports. `.ogg` is a first-class supported output format in the API examples and tests.

### Sync request from URL

```bash
curl -X POST http://127.0.0.1:3000/v1/jobs \
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

### Async request from URL

```bash
curl -X POST http://127.0.0.1:3000/v1/jobs \
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

### Polling a job

- `curl http://127.0.0.1:3000/v1/jobs/<jobId>`
- `curl http://127.0.0.1:3000/v1/jobs/<jobId>/artifact > output.ogg`

When `analysis.audioActivity` is enabled for an async job, the diagnostic is attached to the job payload in the `analysis.audioActivity` field.

### Analyze whether audio is probably background-only

```bash
curl -X POST http://127.0.0.1:3000/v1/analyze/audio-activity \
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
