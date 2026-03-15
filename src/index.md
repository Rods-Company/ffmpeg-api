# ffmpeg API

An async-first media processing API powered by FFMPEG and maintained by Rods Company.

## 🚀 Quick Start

- Health check: `GET /v1/health`
- Runtime capabilities: `GET /v1/capabilities`
- Interactive docs: `GET /docs`
- Raw OpenAPI: `GET /openapi.yaml`
- Create a job: `POST /v1/jobs`
- Uploads use `multipart/form-data` with a file field named `file`

## ✨ What It Does

- Processes audio and video through a recipe-based API
- Accepts upload input and direct URL input
- Runs small requests synchronously and larger ones asynchronously
- Analyzes audio activity to detect background-only input
- Exposes runtime FFmpeg capabilities and interactive documentation

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
