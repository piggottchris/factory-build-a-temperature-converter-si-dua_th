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
- [ ] Page renders a Temperature Converter header with description.
- [ ] CopilotKit chat is wired to `temperature_agent`.
- [ ] Loading, empty, and error states are handled by CopilotKit's built-in UI.
- [ ] Responsive layout (flex column, full viewport height).

### Backend / Agent
- [ ] `convert_temperature(value, from_unit, to_unit)` tool exists and is correct for:
  - Celsius ↔ Fahrenheit
  - Celsius ↔ Kelvin
  - Fahrenheit ↔ Kelvin
  - Same-unit pass-through (no conversion)
- [ ] `list_supported_units()` tool returns at least 3 unit names.
- [ ] Agent returns structured error on invalid unit input.
- [ ] FastAPI `/agent-temperature` route is mounted and visible in OpenAPI spec.
- [ ] `/healthz` still responds with updated agent name.

### Security
- [x] No secrets committed; ANTHROPIC_API_KEY loaded from environment.
- [x] Kelvin cannot go below 0 K (absolute zero guard).

### Observability
- [x] Datadog dd_init integration preserved (no-ops without DD_API_KEY).

### Tests
- [ ] Backend: conversion correctness (all 6 unit pairs) — pytest green.
- [ ] Backend: invalid unit raises ValueError — pytest green.
- [ ] Backend: absolute zero guard — pytest green.
- [ ] Backend: smoke — /healthz and /agent route exist — pytest green.
- [ ] Frontend: vitest smoke passes.

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

## Known Limitations

- Integration tests (real LLM calls) are skipped in CI (no ANTHROPIC_API_KEY in CI).
- Playwright / e2e tests are not added (not supported by the current vitest + jsdom setup).
- `check:bundle` and `check:security` npm scripts from the PRD are not added (no standalone Vite build; Next.js build covers this).

---

## Status

> Updated at end of build — see bottom of this file.
