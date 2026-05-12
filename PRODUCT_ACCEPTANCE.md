# Product Acceptance — Temperature Converter

**Issue:** #1 — Scaffold & implement Temperature Converter  
**PRD source:** GitHub issue #1 (adapted from Vite/pnpm standalone PRD to FastAPI + MAF + CopilotKit stack)  
**Date:** 2026-05-12

---

## Product Archetype

An AI-assisted temperature unit converter. Users interact with a conversational CopilotKit UI
powered by a MAF (Microsoft Agent Framework) backend agent. The agent converts temperatures
between Celsius, Fahrenheit, and Kelvin — both via direct tool calls and via natural language.

---

## Primary User Journey

1. User opens the web app.
2. User types a natural language request: *"Convert 100°C to Fahrenheit"*.
3. The MAF `temperature_agent` calls the `convert_temperature` tool.
4. The agent returns the converted value with explanation.
5. User can also ask *"What units do you support?"* and receive a list.

---

## Acceptance Criteria

### UI / Frontend
- [x] Page renders a Temperature Converter header with description.
- [x] CopilotKit chat is wired to `temperature_agent`.
- [x] Loading, empty, and error states are handled by CopilotKit's built-in UI.
- [x] Responsive layout (flex column, full viewport height).

### Backend / Agent
- [x] `convert_temperature(value, from_unit, to_unit)` tool exists and is correct for:
  - Celsius ↔ Fahrenheit
  - Celsius ↔ Kelvin
  - Fahrenheit ↔ Kelvin
  - Same-unit pass-through (no conversion)
- [x] `list_supported_units()` tool returns at least 3 unit names.
- [x] Agent returns structured error on invalid unit input.
- [x] FastAPI `/agent-temperature` route is mounted and visible in OpenAPI spec.
- [x] `/healthz` still responds with updated agent name.

### Security
- [x] No secrets committed; ANTHROPIC_API_KEY loaded from environment.
- [x] Kelvin cannot go below 0 K (absolute zero guard).

### Observability
- [x] Datadog dd_init integration preserved (no-ops without DD_API_KEY).

### Tests
- [x] Backend: conversion correctness (all 6 unit pairs) — pytest green.
- [x] Backend: invalid unit raises ValueError — pytest green.
- [x] Backend: absolute zero guard — pytest green.
- [x] Backend: smoke — /healthz and /agent route exist — pytest green.
- [x] Frontend: vitest smoke passes.

---

## Stack Adaptation Notes

The issue PRD describes a standalone Vite + pnpm project. Since this repo uses the
**FastAPI + MAF + CopilotKit + Next.js** template, the following adaptations are made:

| PRD Deliverable | Adapted To |
|---|---|
| `vite.config.ts` | `vitest.config.ts` (already exists, Next.js handles bundling) |
| `src/convert.ts` | `backend/app/agents/temperature_agent.py` (`convert_temperature` tool) |
| `tests/convert.test.ts` | `backend/app/tests/test_temperature_agent.py` + `frontend/test/temperature.test.ts` |
| `src/index.html` / `src/main.ts` | `frontend/app/page.tsx` (Next.js App Router) |
| playwright / a11y tests | CopilotKit built-in a11y; vitest DOM tests |
| `pnpm install --frozen-lockfile` | `pnpm install` (lockfile exists) |
| `pnpm build` | `next build` |

---

## Security Posture

This is a **local-only demo** (POC). The security model is:

- **No authentication or authorization layer.** All routes are open. This is intentional for a
  POC — adding auth would require a user store (out of scope).
- **No user data is persisted.** Conversions are stateless; no database is present.
- **ANTHROPIC_API_KEY is loaded from environment** (`backend/.env`, never committed).
  `backend/.env.example` documents the required variable without a real key.
- **NaN, Infinity, and below-absolute-zero inputs are rejected** at both the Python tool layer
  and the TypeScript conversion function, preventing silent data integrity failures.
- **Broad exception handler** in `convert_temperature_tool` ensures unexpected errors are logged
  at ERROR level and return a safe string to the user, rather than leaking internal tracebacks.
- **Demo mode note:** In production, the API key should be injected via secrets management
  (e.g. AWS Secrets Manager, Vault) and the backend should be placed behind an authenticating
  reverse proxy. Neither is in scope for this POC.

---

## Known Limitations

- Integration tests (real LLM calls) are skipped in CI (no ANTHROPIC_API_KEY in CI).
- Playwright / e2e tests are not added (not supported by the current vitest + jsdom setup).
- `check:bundle` and `check:security` npm scripts from the PRD are not added (no standalone Vite build; Next.js build covers this).
- No authentication layer — this is a local demo POC only; not suitable for production deployment without adding auth.

---

## Status

**COMPLETE** — 2026-05-12

All acceptance criteria are met. The temperature converter delivers:

- A two-pane UI: quick converter (Enter-key, smart precision rounding) + CopilotKit AI chat
  wired to `temperature_agent`.
- A MAF backend agent with `convert_temperature_tool` and `list_supported_units_tool`, covering
  all 6 unit-pair combinations (C↔F, C↔K, F↔K) plus same-unit pass-through.
- Input validation rejecting NaN, Infinity, and below-absolute-zero values at both the Python
  and TypeScript layers.
- Structured logging (DEBUG on success, WARNING on validation error, ERROR on unexpected
  exception) with Datadog APM no-op integration.
- 49 pytest + 42 vitest tests — all passing. No tests were deleted or weakened across any
  iteration.
