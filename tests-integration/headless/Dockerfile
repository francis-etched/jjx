# Environment for running the Playwright integration tests headlessly (see run.sh).
# The Playwright image version must match @playwright/test in package.json.
FROM mcr.microsoft.com/playwright:v1.61.1-noble

# Xvfb (the test harness auto-starts per-worker virtual displays when it is on
# PATH) plus the desktop libraries VS Code needs beyond Playwright's browser set.
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    libgtk-3-0t64 \
    libasound2t64 \
    libnss3 \
    libgbm1 \
    libsecret-1-0 \
    libxkbfile1 \
    fonts-liberation \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# jj binaries matching the versions installed in CI (.github/workflows/integration-tests.yml).
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
    aarch64) \
    jj044_sha=60d42fa2a9abaa445eff10cd2087458562aaad5a54b90309e5a3787ecc985ff2; \
    jj038_sha=bae97959e06d92b79d96b09a90545e157ef0f300a0482d9b9a81128610e896aa;; \
    x86_64) \
    jj044_sha=0a07bab4641a55fd2bc2fd1563ba3a3f9a577584086ad74086a1c5b69b3ffce9; \
    jj038_sha=ed830d9a34a304f8ba258806b52521250a9fffded32ae89c4eb5285b33556a17;; \
    *) echo "unsupported architecture: $arch" >&2; exit 1;; \
    esac; \
    curl -fsSL "https://github.com/jj-vcs/jj/releases/download/v0.44.0/jj-v0.44.0-${arch}-unknown-linux-musl.tar.gz" -o /tmp/jj.tar.gz; \
    echo "${jj044_sha}  /tmp/jj.tar.gz" | sha256sum -c; \
    tar -xzf /tmp/jj.tar.gz -C /usr/local/bin ./jj; \
    curl -fsSL "https://github.com/jj-vcs/jj/releases/download/v0.38.0/jj-v0.38.0-${arch}-unknown-linux-musl.tar.gz" -o /tmp/jj-0.38.tar.gz; \
    echo "${jj038_sha}  /tmp/jj-0.38.tar.gz" | sha256sum -c; \
    tar -xzf /tmp/jj-0.38.tar.gz -C /tmp ./jj; \
    mv /tmp/jj /usr/local/bin/jj-0.38; \
    rm /tmp/jj.tar.gz /tmp/jj-0.38.tar.gz

RUN corepack enable
