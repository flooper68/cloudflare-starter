#!/usr/bin/env bash
# Entrypoint of a runner container (ops/runner/Dockerfile), started by scripts/runner.ts.
#
#   runner-entrypoint register   registers the runner with the short-lived registration token
#                                in RUNNER_TOKEN and saves the registration in /runner-state (a
#                                named volume per worker). Run once, in a throwaway container
#                                (`docker compose run --rm`), so the token never becomes part of
#                                the long-running container's configuration.
#   runner-entrypoint            (default) restores the saved registration and runs the runner.
#
# Never print RUNNER_TOKEN and never enable `set -x` here.
set -euo pipefail

STATE=/runner-state
# The files config.sh writes into the runner directory.
FILES=(.runner .credentials .credentials_rsaparams .env .path)

: "${RUNNER_NAME:?RUNNER_NAME is required}"
cd /home/runner

register() {
  : "${RUNNER_URL:?RUNNER_URL is required}"
  : "${RUNNER_LABELS:?RUNNER_LABELS is required}"
  if [ -f "$STATE/.runner" ]; then
    echo "runner-entrypoint: $RUNNER_NAME is already registered"
    return 0
  fi
  if [ -z "${RUNNER_TOKEN:-}" ]; then
    echo "runner-entrypoint: RUNNER_TOKEN is empty; register with 'bun run runner:up'" >&2
    exit 1
  fi
  echo "runner-entrypoint: registering $RUNNER_NAME at $RUNNER_URL (labels: $RUNNER_LABELS)"
  # The runner reads ACTIONS_RUNNER_INPUT_<ARG> like --<arg>: the token stays off every
  # command line. No --replace: a name another machine already uses fails instead of
  # silently taking over its runner.
  ACTIONS_RUNNER_INPUT_TOKEN="$RUNNER_TOKEN" ./config.sh --unattended \
    --url "$RUNNER_URL" \
    --name "$RUNNER_NAME" \
    --labels "$RUNNER_LABELS" \
    --work _work
  for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then cp -p "$file" "$STATE/$file"; fi
  done
}

run() {
  if [ ! -f "$STATE/.runner" ]; then
    echo "runner-entrypoint: $RUNNER_NAME is not registered; run 'bun run runner:up'" >&2
    exit 1
  fi
  for file in "${FILES[@]}"; do
    if [ -f "$STATE/$file" ]; then cp -p "$STATE/$file" "./$file"; fi
  done
  # Jobs inherit the runner's environment; nothing secret may be in it.
  unset RUNNER_TOKEN
  exec ./run.sh
}

case "${1:-run}" in
  register) register ;;
  run) run ;;
  *) echo "runner-entrypoint: unknown command '$1' (register | run)" >&2; exit 2 ;;
esac
