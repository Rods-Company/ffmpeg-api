# Release Guide

This document describes the release model for `ffmpeg-api`.

## Current publishing target

The repository is prepared to publish Docker images to GitHub Container Registry:

- `ghcr.io/<owner>/ffmpeg-api`

For the Rods Company organization, that becomes:

- `ghcr.io/rods-company/ffmpeg-api`

## Why GHCR first

GHCR is the simplest first step because:

- it integrates directly with GitHub Actions
- it works well with organization-owned repositories
- it does not require a separate Docker Hub automation setup
- it keeps the open-source source code and published image in the same platform

Docker Hub can still be added later as a secondary distribution target.

The repository is now prepared for both:

- GHCR by default
- Docker Hub optionally, when repository secrets are configured

## Release flow

### Continuous integration

Every push and pull request to `main` or `master` runs:

- dependency install
- FFmpeg install
- integration tests
- OpenAPI lint
- Docker build smoke check

### Published release

Publishing is triggered by pushing a git tag that starts with `v`, for example:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That triggers the release workflow, which:

- runs tests again
- lints the OpenAPI document
- builds the container image
- pushes the image to GHCR
- optionally pushes the same image to Docker Hub

## GitHub organization setup

Before the workflow can push images from an organization repository:

1. create the repository under the `Rods-Company` organization
2. ensure GitHub Actions is enabled for the repository
3. ensure packages can be published for the organization
4. keep the workflow `packages: write` permission enabled

For GHCR, no separate Docker Hub account is required.

## Docker Hub later

If you want Docker Hub as an additional public registry later, you will need:

- a Docker Hub namespace
- repository credentials or access token
- GitHub Actions secrets for Docker Hub login
- repository secrets:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`

That can be added as a second publish target once GHCR is stable.

## Recommended first public release

For the first public release, use:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Expected image names:

- `ghcr.io/rods-company/ffmpeg-api:v1.0.0`
- `ghcr.io/rods-company/ffmpeg-api:latest`

If Docker Hub secrets are configured, also:

- `<dockerhub-username>/ffmpeg-api:v1.0.0`
- `<dockerhub-username>/ffmpeg-api:latest`
