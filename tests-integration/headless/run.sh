#!/usr/bin/env bash
# Runs the Playwright integration tests headlessly inside a Linux container.
#
# VS Code is an Electron app and has no headless mode on macOS or Windows; on
# Linux the test harness starts per-worker Xvfb virtual displays automatically
# whenever Xvfb is on PATH (see base-test.ts). This script provides that Linux
# environment via Docker, so no windows open on the host and the host stays
# usable while tests run.
#
# Usage:
#   tests-integration/headless/run.sh [playwright args...]
#   tests-integration/headless/run.sh tests-integration/tests/squash.test.ts
#
# The repository is bind-mounted into the container, so test-results/ and
# playwright reports land in the working tree as usual. Linux node_modules and
# package-manager caches live in named Docker volumes to keep them separate
# from the host's; the Linux VS Code build is cached in .vscode-test/ next to
# the host's (the cache paths are platform-specific).
set -euo pipefail

cd "$(dirname "$0")/../.."

IMAGE=jjx-headless-tests
docker build -t "$IMAGE" tests-integration/headless

exec docker run --rm --init \
  --shm-size=1g \
  -v "$PWD:/repo" \
  -v jjx-headless-node-modules:/repo/node_modules \
  -v jjx-headless-cache:/root/.cache \
  -v jjx-headless-pnpm-store:/root/.local/share/pnpm \
  -w /repo \
  "$IMAGE" \
  bash -c '
    set -euo pipefail
    pnpm install --frozen-lockfile --prefer-offline
    node esbuild.js --production
    exec pnpm exec playwright test --config=tests-integration/playwright.config.ts "$@"
  ' bash "$@"
