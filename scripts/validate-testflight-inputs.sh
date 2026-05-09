#!/usr/bin/env bash
# Validate the Apple/App Store Connect inputs required by .github/workflows/testflight.yml.
# This script is intentionally safe to run locally: it never prints secret values.

set -euo pipefail

missing=0

resolve_env() {
  local primary="$1"
  local fallback="${2:-}"
  local value="${!primary:-}"

  if [ -z "$value" ] && [ -n "$fallback" ]; then
    value="${!fallback:-}"
  fi

  printf '%s' "$value"
}

require_env() {
  local primary="$1"
  local fallback="${2:-}"
  local value
  value="$(resolve_env "$primary" "$fallback")"

  if [ -z "$value" ]; then
    if [ -n "$fallback" ]; then
      echo "ERROR: both $primary and $fallback are empty"
    else
      echo "ERROR: $primary is empty"
    fi
    missing=1
    return
  fi

  case "$value" in
    *PLACEHOLDER*|*placeholder*|*TODO*|*todo*|CHANGEME|changeme|YOUR_*|your_*)
      if [ -n "$fallback" ]; then
        echo "ERROR: $primary/$fallback still looks like a placeholder"
      else
        echo "ERROR: $primary still looks like a placeholder"
      fi
      missing=1
      ;;
  esac
}

require_env ASC_KEY_ID APPLE_API_KEY_ID
require_env ASC_ISSUER_ID APPLE_API_ISSUER_ID
require_env APPLE_TEAM_ID
require_env APPLE_API_KEY_CONTENT

if [ "$missing" -ne 0 ]; then
  echo "Required Apple CI configuration is incomplete."
  exit 1
fi

python3 <<'PYEOF'
import base64
import os
import re
import sys

key_id = (os.environ.get('ASC_KEY_ID') or os.environ.get('APPLE_API_KEY_ID') or '').strip()
issuer_id = (os.environ.get('ASC_ISSUER_ID') or os.environ.get('APPLE_API_ISSUER_ID') or '').strip()
team_id = os.environ.get('APPLE_TEAM_ID', '').strip()
raw_key = os.environ.get('APPLE_API_KEY_CONTENT', '').strip()

errors = []
warnings = []

if not re.fullmatch(r'[A-Z0-9]{10}', key_id):
    warnings.append('ASC_KEY_ID is not the usual 10-character Apple key id format; continuing, but please verify it.')

if not re.fullmatch(r'[A-Z0-9]{10}', team_id):
    warnings.append('APPLE_TEAM_ID is not the usual 10-character Apple team id format; continuing, but please verify it.')

if not re.fullmatch(r'[0-9a-fA-F-]{36}', issuer_id):
    warnings.append('ASC_ISSUER_ID is not the usual UUID format; continuing, but please verify it.')

if '-----BEGIN' in raw_key:
    key_text = raw_key
else:
    try:
        key_text = base64.b64decode(raw_key, validate=True).decode('utf-8')
    except Exception as exc:
        errors.append(f'APPLE_API_KEY_CONTENT is neither raw PEM text nor valid base64 PEM: {exc}')
        key_text = ''

if key_text and '-----BEGIN PRIVATE KEY-----' not in key_text:
    errors.append('APPLE_API_KEY_CONTENT does not look like an App Store Connect .p8 private key.')

for item in warnings:
    print(f'WARN: {item}')

if errors:
    for item in errors:
        print(f'ERROR: {item}')
    sys.exit(1)

print('Apple CI inputs look present and structurally valid.')
PYEOF
