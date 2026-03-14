# Changelog

All notable changes to this project are tracked here.

## [1.1.0](https://github.com/Rods-Company/ffmpeg-api/compare/v1.0.0...v1.1.0) (2026-03-14)


### Features

* auto release ([4f6e2db](https://github.com/Rods-Company/ffmpeg-api/commit/4f6e2dbe757f2b093e6622b93d58d48a81a71805))


### Bug Fixes

* remove invalid secrets checks from workflows ([7fcc162](https://github.com/Rods-Company/ffmpeg-api/commit/7fcc162c2c7a728b601f50d36e9c15f6e3d24de6))
* stabilize PR title validation ([605b6d4](https://github.com/Rods-Company/ffmpeg-api/commit/605b6d44a3be59fde5e79300843ca6f954bcc05a))


### Documentation

* polish public project overview ([#1](https://github.com/Rods-Company/ffmpeg-api/issues/1)) ([1978ad7](https://github.com/Rods-Company/ffmpeg-api/commit/1978ad7d5c0751376e2b0eb0d002d9efacaa8730))

## 1.0.0

- Introduced the `v1` async-first job API.
- Added job creation, polling, cancellation, and artifact download endpoints.
- Added synchronous small-file processing mode.
- Added URL input and multipart upload input.
- Added recipe-based media transformations including speed, trim, silence trim, normalize, volume, and extract audio.
- Added audio activity analysis and optional job-attached audio activity diagnostics.
- Added runtime capabilities endpoint.
- Added OpenAPI-driven documentation and Scalar UI.
- Added integration tests, CI workflow, and release workflow.
- Added development and production environment examples.

## 0.3

- Added `EXTERNAL_PORT` environment variable.

## 0.2

- Added extract images and audio endpoints.
- Added probe endpoint.
- Major refactoring.

## 0.1

- Initial version.
