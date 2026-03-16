# Product Roadmap

This document reflects the current stage of `ffmpeg-api`.

The local API foundation is already implemented. The roadmap is now focused on:

- keeping the developer experience clean
- keeping production configuration explicit
- documenting the product clearly
- automating versioning, releases, and image publishing
- preparing the project for long-term open-source maintenance under an organization

## Product summary

`ffmpeg-api` is an async-first media processing API built on FFmpeg.

It supports:

- file upload or direct URL input
- synchronous processing for small files
- asynchronous jobs for longer processing
- audio and video transformations through a recipe model
- audio activity analysis for background-only detection
- OpenAPI-driven documentation rendered with Scalar

## Current implementation status

### Core API

- [x] `POST /v1/jobs/url`
- [x] `POST /v1/jobs/upload`
- [x] `GET /v1/jobs/{jobId}`
- [x] `POST /v1/jobs/{jobId}/cancel`
- [x] `GET /v1/jobs/{jobId}/artifact`
- [x] `POST /v1/chunks/url`
- [x] `POST /v1/chunks/upload`
- [x] `POST /v1/analyze/audio-activity/url`
- [x] `POST /v1/analyze/audio-activity/upload`
- [x] `GET /v1/health`
- [x] `GET /v1/capabilities`
- [x] `POST /v1/analyze/audio-activity`

### Input modes

- [x] JSON URL input
- [x] multipart upload input
- [x] synchronous small-file mode
- [x] asynchronous queued mode

### Transformations

- [x] `speed`
- [x] `silence_trim`
- [x] `trim`
- [x] `normalize`
- [x] `volume`
- [x] `extract_audio`

### Diagnostics

- [x] standalone audio activity analysis endpoint
- [x] optional `analysis.audioActivity` inside `POST /v1/jobs/url` and `POST /v1/jobs/upload`
- [x] JSON error responses with `code`, `message`, and `details`

### Documentation

- [x] `docs/openapi.yaml`
- [x] Scalar UI at `/docs`
- [x] runnable examples in `README.md`
- [x] contributor and release guidance

### Quality gates

- [x] integration test suite
- [x] OpenAPI lint
- [x] Docker build check in CI
- [x] PR title validation for Conventional Commits

## Current roadmap

### Track 1: Developer and production environments

- [x] `.env.example`
- [x] `.env.development.example`
- [x] `.env.production.example`
- [x] environment-aware Scalar configuration
- [ ] document recommended production reverse proxy and storage layout
- [ ] document persistent storage strategy for artifacts if retention needs to survive restarts

### Track 2: Release engineering

- [x] CI workflow for tests, OpenAPI lint, and Docker build
- [x] automated release PRs with Release Please
- [x] automated semantic version tags and GitHub Releases
- [x] generated changelog at `CHANGELOG.md`
- [x] automated GHCR publishing after releases
- [x] optional Docker Hub publishing after releases
- [x] optional Docker Hub README sync from `README.md`
- [ ] decide whether to use a dedicated `RELEASE_PLEASE_TOKEN` instead of the default `GITHUB_TOKEN`

### Track 3: Distribution

- [x] Docker image builds locally
- [x] GitHub Actions ready for GHCR publishing
- [x] Docker Hub publishing path documented and implemented
- [x] publish the first automated release from the organization repository
- [x] publish the first public Docker Hub image under the chosen namespace

### Track 4: Future product expansion

- [ ] external artifact storage
- [ ] webhook notifications
- [ ] auth and rate limits
- [ ] presets and reusable recipes
- [ ] autoscaled workers

## Environment model

### Development

Development is optimized for:

- easier debugging
- local URL ingestion
- visible Scalar developer tools
- simple local startup with `.env.development.example`

### Production

Production is optimized for:

- safe URL ingestion defaults
- stable queue and timeout controls
- deterministic release images
- reduced interactive tooling exposure in docs

## Release model

The project is prepared for open-source distribution from a GitHub organization repository.

Current preferred registries:

- GitHub Container Registry
- Docker Hub as an optional secondary registry

Recommended release flow:

1. open a PR with a Conventional Commit title
2. merge into `main`
3. let CI validate tests, OpenAPI, and Docker build
4. let Release Please update or create the release PR
5. merge the release PR when you want the next version published
6. let the release workflow publish the image to GHCR and optionally Docker Hub

See [docs/release-guide.md](release-guide.md) for the operational details.

## Notes

- `silence_trim` removes silent sections; it is not noise reduction.
- `audio-activity` is a heuristic analysis; it is not speech recognition.
