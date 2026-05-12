"""Datadog APM + LLM Observability bootstrap.

This module is imported FIRST in ``app/main.py`` — before FastAPI / MAF /
Anthropic — so ``ddtrace.patch_all`` can swap in instrumented client
classes before any user code captures unpatched references.

DD config is read from environment:
  DD_API_KEY               — required for live ingestion. Without it,
                             dd-trace is initialised but no spans are
                             sent (safe no-op in dev).
  DD_SITE                  — regional ingest host (datadoghq.com,
                             datadoghq.eu, us3.datadoghq.com, ...).
  DD_SERVICE               — service tag stamped on every span.
  DD_ENV / DD_VERSION      — env + version tags for cross-deploy slicing.
  DD_LLMOBS_ENABLED=1      — turns on LLM Observability (Anthropic SDK
                             calls captured with prompt/completion).

Disable everything (offline dev, tests) by leaving DD_API_KEY unset.
"""

from __future__ import annotations

import os


def _truthy(name: str) -> bool:
    return os.environ.get(name, "").lower() in ("1", "true", "yes", "on")


def _init() -> None:
    # Cheap exit when keys are unset — saves the import cost of ddtrace
    # in offline / test environments.
    if not os.environ.get("DD_API_KEY"):
        return

    # Late import: ddtrace patching has to happen before FastAPI/httpx/etc
    # are imported by the rest of app/, which is exactly what main.py
    # arranges by importing this module first.
    import ddtrace  # type: ignore[import-not-found]

    ddtrace.patch_all()

    if _truthy("DD_LLMOBS_ENABLED"):
        # LLMObs captures every Anthropic SDK call as a span with prompt,
        # completion, token counts, latency, and cost. Production must
        # configure redaction via the factory-side redactor before these
        # ship to DD's intake.
        from ddtrace.llmobs import LLMObs  # type: ignore[import-not-found]

        LLMObs.enable(
            ml_app=os.environ.get("DD_SERVICE", "darkpoc-backend"),
            api_key=os.environ["DD_API_KEY"],
            site=os.environ.get("DD_SITE", "datadoghq.com"),
        )


_init()
