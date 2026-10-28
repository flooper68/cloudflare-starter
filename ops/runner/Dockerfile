# Self-hosted GitHub Actions runner for this repository's CI, run in Docker by
# `bun run runner:up` (scripts/runner.ts). Guide: docs/guides/how-to-setup-ci.md#self-hosted-runners.
#
# The official runner image (Ubuntu, pinned by version and digest) plus what the CI jobs would
# otherwise download or apt-get on every run:
#   - Bun, the version of `packageManager` in package.json;
#   - Node, the version in .nvmrc (the jobs' setup action still installs its own copy);
#   - the Ubuntu packages Playwright's Chromium needs, for the Playwright version of apps/web.
#     The browser itself is downloaded by the first job and stays in the container.
# Every download is checked against a SHA-256 pinned here. The versions below must match
# package.json, .nvmrc and apps/web/package.json; test/architecture/ci.test.ts and
# `runner:up` check it. Already in the base image: git, curl, jq, unzip, tar and passwordless
# sudo.
FROM ghcr.io/actions/actions-runner:2.338.2@sha256:759a1d94a15b05941aba5196974ff43fe15b4cbba29b694b35cbc32a1166b232

ARG BUN_VERSION=1.3.14
ARG BUN_SHA256_ARM64=a27ffb63a8310375836e0d6f668ae17fa8d8d18b88c37c821c65331973a19a3b
ARG BUN_SHA256_AMD64=951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f
ARG NODE_VERSION=24.14.1
ARG NODE_SHA256_ARM64=71e427e28b78846f201d4d5ecc30cb13d1508ca099ef3871889a1256c7d6f67e
ARG NODE_SHA256_AMD64=84d38715d449447117d05c3e71acd78daa49d5b1bfa8aacf610303920c3322be
ARG PLAYWRIGHT_VERSION=1.64.1
ARG TARGETARCH

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# xz-utils unpacks Node's archive. Bun and Node are each verified against their pinned
# checksum before they are unpacked.
RUN apt-get update \
  && apt-get install -y --no-install-recommends xz-utils \
  && case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
      arm64) bun_arch=aarch64; node_arch=arm64; bun_sha="$BUN_SHA256_ARM64"; node_sha="$NODE_SHA256_ARM64" ;; \
      amd64) bun_arch=x64; node_arch=x64; bun_sha="$BUN_SHA256_AMD64"; node_sha="$NODE_SHA256_AMD64" ;; \
      *) echo "unsupported architecture" >&2; exit 1 ;; \
    esac \
  && cd /tmp \
  && curl -fsSLo bun.zip "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${bun_arch}.zip" \
  && echo "${bun_sha}  bun.zip" | sha256sum -c - \
  && unzip -q bun.zip \
  && install -m 0755 "bun-linux-${bun_arch}/bun" /usr/local/bin/bun \
  && ln -s /usr/local/bin/bun /usr/local/bin/bunx \
  && curl -fsSLo node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
  && echo "${node_sha}  node.tar.xz" | sha256sum -c - \
  && mkdir -p /opt/node \
  && tar -xJf node.tar.xz -C /opt/node --strip-components=1 \
  && ln -s /opt/node/bin/node /opt/node/bin/npm /opt/node/bin/npx /usr/local/bin/ \
  && rm -rf /tmp/bun.zip "/tmp/bun-linux-${bun_arch}" /tmp/node.tar.xz \
  && bun --version && node --version

# Chromium's Ubuntu packages, through Playwright's own installer (the list depends on the
# Playwright version; CI only runs Chromium).
RUN npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium \
  && rm -rf /root/.npm /var/lib/apt/lists/*

# The runner's registration (.runner, .credentials, ...) lives in a named volume per worker.
RUN install -d -o runner -g runner /runner-state
COPY --chmod=0755 entrypoint.sh /usr/local/bin/runner-entrypoint

# Read by scripts/ci-playwright-install.ts: the OS packages for this Playwright version are
# installed, so a job only downloads the browser. A different version installs them and warns.
ENV CI_RUNNER_IMAGE_PLAYWRIGHT="${PLAYWRIGHT_VERSION}"

USER runner
WORKDIR /home/runner
ENTRYPOINT ["/usr/local/bin/runner-entrypoint"]
