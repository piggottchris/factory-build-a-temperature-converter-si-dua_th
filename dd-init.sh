#!/usr/bin/env bash
# dd-init.sh — bootstrap Datadog wiring for this POC.
#
# Pre-wired by the dark POC factory's Phase H. Reads backend/.env so a
# developer who pasted DD_API_KEY locally can verify ingest + see their
# first traces without leaving the repo.
#
# What it does:
#   1. Sanity-check that backend/.env has DD_API_KEY filled in.
#   2. Echo back the resolved DD_SITE / DD_SERVICE / DD_ENV the running
#      stack will use, so the developer can grep DD for the right tags.
#   3. Print the DD UI deep-links for APM, Logs, and LLM Observability.
#
# Doesn't write to DD's API — that's a one-way trip and we want this
# script to be idempotent. Service registration happens automatically
# the first time the running app emits a span.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT}/backend/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found. Copy backend/.env.example to backend/.env first." >&2
  exit 1
fi

# Source backend/.env without leaking values; we only echo non-secrets.
set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

if [[ -z "${DD_API_KEY:-}" ]]; then
  echo "✗ DD_API_KEY is empty in ${ENV_FILE}." >&2
  echo "  Get a key at: https://app.${DD_SITE:-datadoghq.com}/organization-settings/api-keys" >&2
  exit 1
fi

DD_SITE="${DD_SITE:-datadoghq.com}"
DD_SERVICE="${DD_SERVICE:-darkpoc-backend}"
DD_ENV="${DD_ENV:-dev}"

echo "✓ DD_API_KEY: set (length ${#DD_API_KEY})"
echo "✓ DD_SITE:    ${DD_SITE}"
echo "✓ DD_SERVICE: ${DD_SERVICE}"
echo "✓ DD_ENV:     ${DD_ENV}"
echo
echo "Run the stack (docker compose up) and watch traces land at:"
echo "  APM:    https://app.${DD_SITE}/apm/services?env=${DD_ENV}"
echo "  Logs:   https://app.${DD_SITE}/logs?query=service%3A${DD_SERVICE}%20env%3A${DD_ENV}"
echo "  LLMObs: https://app.${DD_SITE}/llm/applications"
