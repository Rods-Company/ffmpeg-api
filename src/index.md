# ffmpeg API

An async-first media processing API powered by FFMPEG and maintained by Rods Company.

## 🚀 Quick Start

- Health check: `GET /v1/health`
- Runtime capabilities: `GET /v1/capabilities`
- Interactive docs: `GET /docs`
- Raw OpenAPI: `GET /openapi.yaml`
- Create a URL job: `POST /v1/jobs/url`
- Upload a file job: `POST /v1/jobs/upload`
- Create URL chunks: `POST /v1/chunks/url`
- Upload file chunks: `POST /v1/chunks/upload`
- Analyze URL audio: `POST /v1/analyze/audio-activity/url`
- Analyze uploaded audio: `POST /v1/analyze/audio-activity/upload`
- Uploads use `multipart/form-data` with a file field named `file`

## ✨ What It Does

- Processes audio and video through a recipe-based API
- Accepts upload input and direct URL input
- Runs small requests synchronously and larger ones asynchronously
- Splits media into ZIP chunks by parts, duration, or silence
- Keeps chunking practical for transcription pipelines by helping avoid oversized chunks that may timeout in tools such as Whisper
- Analyzes audio activity to detect background-only input
- Exposes runtime FFmpeg capabilities and interactive documentation

The real supported formats, codecs, and filters depend on the FFmpeg runtime available in the current deployment. Use `GET /v1/capabilities` as the source of truth.

## 📚 Important Links

- [Interactive API reference](./docs)
- [OpenAPI document](./openapi.yaml)
- [Endpoint listing](./endpoints)

## 📝 Important Note

The current `silence_trim` operation removes silent segments. It is not noise reduction.

If your expectation is to remove background hiss, hum, fan noise, or room noise, that is a different feature and should be implemented as a dedicated audio operation such as `noise_reduction`.

---

![Rods Company logo](/assets/logo-rods-horizontal-cinza-escuro.png)

Construa com foco.
Crie com autonomia.

— with ❤️ by Rods Company
