#!/bin/sh
set -eu

exec gitleaks detect \
  --source . \
  --redact \
  --no-banner \
  --exit-code 1
