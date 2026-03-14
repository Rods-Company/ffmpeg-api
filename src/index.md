# ffmpeg API

An async-first media processing API powered by FFMPEG.

Sources: https://github.com/gnh1201/ffmpeg-api

Based on:

- https://github.com/samisalkosuo/ffmpeg-api
- https://github.com/surebert/docker-ffmpeg-service
- https://github.com/jrottenberg/ffmpeg 
- https://github.com/fluent-ffmpeg/node-fluent-ffmpeg


# Docs

- [Interactive API reference](./docs)
- [OpenAPI document](./openapi.yaml)
- [Endpoint listing](./endpoints)

# Quick Start

- Health check: `GET /v1/health`
- Runtime capabilities: `GET /v1/capabilities`
- Interactive docs: `GET /docs`
- Create a job: `POST /v1/jobs`

# API Model

- The API is job-based and async-first.
- Small inputs can run synchronously when `mode=sync` or when `mode=auto` matches the configured sync threshold.
- Input can be sent as a remote URL in JSON or as multipart upload.
- Transformations are described by a `recipe` object.

# Important Note

The current `silence_trim` operation removes silent segments. It is not noise reduction.

If your expectation is to remove background hiss, hum, fan noise, or room noise, that is a different feature and should be implemented as a dedicated audio operation such as `noise_reduction`.
