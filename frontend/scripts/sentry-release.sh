#!/usr/bin/env bash
set -euo pipefail

# Ensure required env vars are present without printing secrets
missing=0
for v in SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN; do
  if [ -z "${!v:-}" ]; then
    echo "[sentry-release] Missing required env var: $v" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "[sentry-release] Please export SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN before running." >&2
  exit 1
fi

SENTRY_RELEASE="${SENTRY_RELEASE:-$(git rev-parse --short HEAD)}"
export SENTRY_RELEASE

echo "[sentry-release] Using SENTRY_RELEASE=$SENTRY_RELEASE"

# Create release if it does not exist
if ! sentry-cli releases info "$SENTRY_RELEASE" >/dev/null 2>&1; then
  echo "[sentry-release] Creating release $SENTRY_RELEASE"
  sentry-cli releases new "$SENTRY_RELEASE"
else
  echo "[sentry-release] Release $SENTRY_RELEASE already exists"
fi

# Associate commits
echo "[sentry-release] Associating commits"
sentry-cli releases set-commits "$SENTRY_RELEASE" --auto

echo "[sentry-release] Done. You can now build and deploy, then finalize the release."