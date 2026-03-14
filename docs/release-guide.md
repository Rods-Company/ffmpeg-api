# Release Guide

This document describes the automated release model for `ffmpeg-api`.

## What is automated

The repository is prepared to automate:

- release PR creation from Conventional Commits
- semantic version bumps and git tags
- GitHub Releases with notes generated from commits
- Docker image publishing to GHCR
- optional Docker image publishing to Docker Hub
- optional Docker Hub README and overview sync from `README.md`

## Current registries

Primary registry:

- `ghcr.io/<owner>/ffmpeg-api`

For the Rods Company organization, that becomes:

- `ghcr.io/rods-company/ffmpeg-api`

Optional secondary registry:

- `<dockerhub-namespace>/ffmpeg-api`

## Required GitHub setup

Before automation works correctly in the organization repository:

1. keep the repository under the `Rods-Company` organization
2. enable GitHub Actions for the repository
3. allow package publishing in the organization
4. after the first GHCR publish, set the package visibility to `Public`

## Required secrets and variables

For GHCR only, no extra secret is required beyond the built-in `GITHUB_TOKEN`.

If you want release PRs and release tags created by a token that can trigger downstream workflows on those PRs, add:

- secret `RELEASE_PLEASE_TOKEN`

If you want Docker Hub publishing, add:

- secret `DOCKERHUB_USERNAME`
- secret `DOCKERHUB_TOKEN`
- repository or organization variable `DOCKERHUB_NAMESPACE`

Use `DOCKERHUB_NAMESPACE` for the published image namespace, because the login user and the published namespace are not always the same thing.

## Workflow model

### CI

Every push and pull request to `main` or `master` runs:

- dependency install
- FFmpeg install
- integration tests
- OpenAPI lint
- Docker build smoke check

### PR title validation

Pull request titles are validated against Conventional Commits, for example:

- `feat: add webhook retries`
- `fix: reject malformed ogg uploads`
- `refactor: split ffmpeg command builder`

This is important because squash merges usually reuse the PR title as the final commit message on the default branch.

### Release automation

Every push to `main` or `master` runs the release workflow:

- if there are releasable commits, Release Please opens or updates a release PR
- when that release PR is merged, Release Please creates the next tag and GitHub Release
- the workflow then runs tests again and publishes container images

Published Docker tags include:

- `<version>`
- `<major>.<minor>`
- `<major>`
- `latest`

Example for version `1.2.3`:

- `ghcr.io/rods-company/ffmpeg-api:1.2.3`
- `ghcr.io/rods-company/ffmpeg-api:1.2`
- `ghcr.io/rods-company/ffmpeg-api:1`
- `ghcr.io/rods-company/ffmpeg-api:latest`

## Conventional Commit policy

Recommended types:

- `feat:` for minor releases
- `fix:` for patch releases
- `refactor:` for internal code changes that should appear in release notes
- `perf:` for performance improvements
- `docs:` for documentation changes
- `test:` for test changes
- `build:` for packaging or dependency work
- `ci:` for workflow changes
- `chore:` for maintenance that should usually stay hidden from release notes

For breaking changes, use `!`, for example:

- `feat!: remove legacy artifact retention defaults`
- `fix!: rename analysis response fields`

## Recommended day-to-day flow

1. create a feature branch
2. open a pull request with a Conventional Commit title
3. let CI pass
4. squash merge into `main`
5. let Release Please update or create the release PR
6. review and merge the release PR when you want to cut the next version
7. verify the GitHub Release and published images

## Docker Hub overview sync

If Docker Hub secrets and namespace are configured, the `Docker Hub Overview` workflow syncs the root `README.md` into the Docker Hub repository description.

That means the first sections of `README.md` should stay focused on:

- what the API is
- what problems it solves
- the main features
- where the public images and docs live
