# FFMPEG API

An async-first media processing API built on FFmpeg.

It is designed for backend workflows where you need to:

* transform audio or video files with a simple HTTP API
* process files by upload or direct URL
* run synchronous processing for small files
* queue larger jobs asynchronously
* detect whether an audio file is probably just background noise or silence
* inspect runtime FFmpeg capabilities from the API itself

In practice, this API can:

* speed up audio
* trim clips
* remove silent sections
* normalize and adjust volume
* extract audio from video
* analyze audio activity
* return generated artifacts directly or through job polling

Based on:

* https://github.com/samisalkosuo/ffmpeg-api
* https://github.com/surebert/docker-ffmpeg-service
* https://github.com/jrottenberg/ffmpeg 
* https://github.com/fluent-ffmpeg/node-fluent-ffmpeg

FFMPEG API is provided as Docker image for easy consumption. [See the use cases and troubleshooting (catswords-oss.rdbl.io)](https://catswords-oss.rdbl.io/1274143468/3500729784).

## Documentation
* `README.md` - Quick start and runtime configuration.
* `technical-notes.md` - Runtime and codec notes.
* `docs/transformation-roadmap.md` - Current product roadmap, environment model, and release direction.
* `docs/openapi.yaml` - OpenAPI document served by the application and used by Scalar.
* `docs/release-guide.md` - Release and publishing guide for organization-owned repositories.
* `GET /docs` - Interactive API reference powered by Scalar.

## Endpoints
* `GET /` - Service landing page.
* `GET /docs` - Interactive API documentation powered by Scalar.
* `GET /openapi.yaml` - Raw OpenAPI document.
* `GET /endpoints` - Service endpoints as JSON.
* `GET /v1/health` - Service health and effective runtime settings.
* `GET /v1/capabilities` - Runtime FFmpeg, FFprobe, formats, codecs, and filters.
* `POST /v1/analyze/audio-activity` - Heuristic analysis to detect whether audio is likely background-only.
* `POST /v1/jobs` - Create a processing job from JSON URL input or multipart upload.
* `GET /v1/jobs/:jobId` - Poll async job state.
* `POST /v1/jobs/:jobId/cancel` - Cancel a queued or running job.
* `GET /v1/jobs/:jobId/artifact` - Download the completed output file.

## API model
The service is async-first and job-based.

* URL input uses `application/json`.
* Upload input uses `multipart/form-data`.
* `mode=auto|sync|async` controls whether the request should try the synchronous path.
* Small inputs can be processed synchronously when `ENABLE_SYNC_SMALL_JOBS=true`.
* `analysis.audioActivity` can be enabled inside `POST /v1/jobs` when you want the job to include a background-only diagnostic without sending the file twice.

See [docs/transformation-roadmap.md](docs/transformation-roadmap.md) for the architecture and [docs/openapi.yaml](docs/openapi.yaml) for the contract.

## Release and environments

The repository is prepared for:

* local development with `.env.development.example`
* production-style configuration with `.env.production.example`
* CI validation on push and pull request
* tagged Docker image releases to GitHub Container Registry

See [docs/release-guide.md](docs/release-guide.md) for the release flow.

## Running

### Run with Docker

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

* API docs: `http://127.0.0.1:3000/docs`
* OpenAPI: `http://127.0.0.1:3000/openapi.yaml`
* Health check: `http://127.0.0.1:3000/v1/health`

### Run locally

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

After startup:

* API docs: `http://127.0.0.1:3000/docs`
* Health check: `http://127.0.0.1:3000/v1/health`

### Run in Dockploy

For Dockploy or any container platform that supports environment variables:

* use the image built from this repository
* expose container port `3000`
* start from [.env.production.example](.env.production.example)
* override only the values you actually need
* keep `ALLOW_PRIVATE_URLS=false` unless you have a controlled private-network use case

### Environment variables
* Default log level is _info_. Set log level using environment variable, _LOG_LEVEL_.
  * Set log level to debug:
  * `docker run -it --rm -p 3000:3000 -e LOG_LEVEL=debug gnh1201/ffmpeg-api`
* Default maximum file size of uploaded files is 512MB. Use environment variable _FILE_SIZE_LIMIT_BYTES_ to change it:
  * Set max file size to 1MB:
  * `docker run -it --rm -p 3000:3000 -e FILE_SIZE_LIMIT_BYTES=1048576 gnh1201/ffmpeg-api`
* All uploaded and converted files are deleted when they've been downloaded. Use environment variable _KEEP_ALL_FILES_ to keep all files inside the container /tmp-directory:
  * `docker run -it --rm -p 3000:3000 -e KEEP_ALL_FILES=true gnh1201/ffmpeg-api`
* When running on Docker/Kubernetes, port binding can be different than default 3000. Use _EXTERNAL_PORT_ to set up external port in returned URLs in extracted images JSON:
  * `docker run -it --rm -p 3001:3000 -e EXTERNAL_PORT=3001 gnh1201/ffmpeg-api`

### V1 service environment
The new `v1` job API is configurable through environment variables and all of them have defaults. For Docker, Dockploy, or Compose-style deployments, see [.env.example](.env.example).

* `SERVER_PORT=3000` - Internal HTTP port used by the service.
* `ENABLE_SYNC_SMALL_JOBS=true` - Allows the API to process small requests synchronously instead of creating an async job.
* `SYNC_MAX_INPUT_BYTES=10485760` - Maximum size in bytes for automatic synchronous processing. Default is 10MB.
* `JOB_CONCURRENCY=2` - Number of FFmpeg jobs processed in parallel.
* `MAX_QUEUE_SIZE=100` - Maximum queued async jobs before the API returns `429`.
* `JOB_RETENTION_MS=900000` - How long completed artifacts stay available for download. Default is 15 minutes.
* `JOB_TIMEOUT_MS=3600000` - Socket timeout for long-running requests. Default is 1 hour.
* `DOWNLOAD_TIMEOUT_MS=60000` - Timeout for remote URL downloads. Default is 60 seconds.
* `URL_MAX_REDIRECTS=5` - Maximum redirects allowed when ingesting a URL.
* `ALLOW_PRIVATE_URLS=false` - When `true`, the API accepts loopback and private network URLs. Keep this `false` in most deployments.
* `JSON_BODY_LIMIT=1mb` - Maximum JSON payload size for URL-based requests.
* `AUDIO_ACTIVITY_NOISE_THRESHOLD_DB=-35` - Silence threshold used by the audio activity analyzer.
* `AUDIO_ACTIVITY_MIN_SILENCE_DURATION=0.5` - Minimum silence duration for the analyzer.
* `AUDIO_ACTIVITY_MIN_SEGMENT_DURATION=1.2` - Minimum active segment duration required to avoid being classified as background-only.
* `AUDIO_ACTIVITY_MIN_ACTIVE_RATIO=0.08` - Minimum active ratio required to avoid being classified as background-only.
* `AUDIO_ACTIVITY_USE_SPEECH_BAND=true` - When enabled, the analyzer applies a speech-band filter before silence detection.

## Usage
Input file to FFMPEG API can be anything that ffmpeg supports. See [ffmpeg docs for supported formats (www.ffmpeg.org)](https://www.ffmpeg.org/general.html#Supported-File-Formats_002c-Codecs-or-Features).

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

* `X-Audio-Activity-Background-Only`
* `X-Audio-Activity-Contains-Speech-Like-Activity`
* `X-Audio-Activity-Active-Ratio`

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

* `curl http://127.0.0.1:3000/v1/jobs/<jobId>`
* `curl http://127.0.0.1:3000/v1/jobs/<jobId>/artifact > output.ogg`

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

* `hasAudioActivity`
* `likelyBackgroundOnly`
* `likelyContainsSpeechLikeActivity`
* `silenceSegments`
* `activeSegments`

## Background
Originally developed by [Paul Visco @surebert (github.com)](https://github.com/surebert).

Changes include new functionality, updated Node.js version, Docker image based on Alpine, logging and other major refactoring.

## Report abuse
* [GitHub Security Advisories (gnh1201/ffmpeg-api)](https://github.com/gnh1201/ffmpeg-api/security/advisories)
* abuse@catswords.net

## Join the community
* ActivityPub [@gnh1201@catswords.social](https://catswords.social/@gnh1201)
* XMPP [catswords@conference.omemo.id](xmpp:catswords@conference.omemo.id?join)
* [Join Catswords OSS on Microsoft Teams (teams.live.com)](https://teams.live.com/l/community/FEACHncAhq8ldnojAI)
* [Join Catswords OSS #ffmpeg-api on Discord (discord.gg)](https://discord.gg/uEwVWAyBRT)
