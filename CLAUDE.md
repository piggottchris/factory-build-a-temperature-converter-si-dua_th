# CLAUDE.md — agent conventions for this repo

This repo was scaffolded from the **darkpoc-template-fastapi-maf-copilotkit** template. The dark POC factory clones this template, hands a brief to you, and expects you to deliver feature code on top of the existing scaffolding via TDD.

**Read this whole file before writing any code.** The bug mitigations in `Critical conventions` below are load-bearing — if you ignore them, the build will fail in non-obvious ways.

## Stack (locked — do not change)

- **Backend**: Python 3.12 · FastAPI · Microsoft Agent Framework (`agent-framework-core==1.2.2`)
- **Agent runtime**: MAF agents exposed via AG-UI protocol at `/agent` (uses `agent-framework-ag-ui` — currently beta)
- **LLM provider**: Anthropic Claude via `agent_framework.anthropic.AnthropicClient`. **Do not switch to OpenAI** without explicit instruction — the factory and POCs share one Anthropic API key.
- **Frontend**: Next.js 15 (App Router) · React 19 · CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`)
- **AG-UI bridge**: `@ag-ui/client`'s `HttpAgent` in the Next.js `/api/copilotkit/route.ts`
- **Tests**: pytest (backend) · vitest (frontend)
- **Container**: Docker, multi-arch via `docker buildx`, native ARM64 on Apple Silicon

## Project layout

```
backend/
├── pyproject.toml          # deps; do not change build-system or [tool.hatch.build.targets.wheel]
├── Dockerfile              # uses pip (NOT uv) — see Critical conventions
└── app/
    ├── main.py             # FastAPI app; mounts MAF agents at /agent
    ├── agents/             # add new MAF agents here, one file per agent
    │   └── haiku_agent.py  # example — feel free to replace with your feature
    └── tests/              # pytest. Smoke tests don't hit the LLM; integration tests can.

frontend/
├── package.json            # do not switch package managers
├── Dockerfile              # multi-stage Next.js standalone build
├── vitest.config.ts
├── public/.gitkeep         # do not delete — the runner stage COPYs this directory
├── test/                   # vitest specs — start file names with the source they test
└── app/
    ├── layout.tsx
    ├── page.tsx            # CopilotKit + CopilotChat — wire your UI here
    ├── globals.css
    └── api/copilotkit/route.ts   # CopilotRuntime + HttpAgent — wires Next.js to the AG-UI backend

infra/
└── github-branch-protection.json  # applied to main on every factory-built repo

.github/workflows/
├── ci.yml                  # pytest + vitest + docker build, runs on PRs and pushes to main
└── claude.yml              # @claude in PR comments via anthropics/claude-code-action

docker-compose.yml          # local dev: backend on :8000, frontend on :3000
```

## Critical conventions (bug mitigations — non-negotiable)

These exist because of real bugs in the published packages as of May 2026. Verified during the factory's pre-flight spike.

### 1. Use `pip install`, NOT `uv pip install`, in `backend/Dockerfile`

`uv pip install --system` corrupts `agent_framework/__init__.py` to 0 bytes when multiple `agent-framework-*` packages share the namespace package directory. The published wheel is fine; `uv` mishandles install. **Plain `pip install` works.** Slower, but the file lands intact.

```dockerfile
# CORRECT
RUN pip install --no-cache-dir -e ".[dev]"

# WRONG — will silently break agent_framework imports at runtime
# RUN uv pip install --system --no-cache -e ".[dev]"
```

### 2. Use `@tool`, NOT `@ai_function`

Microsoft's older sample code references `@ai_function`. In the GA `agent-framework==1.2.2`, only `tool` exists. Same `description=` kwarg.

```python
from agent_framework import tool

@tool(description="Return today's specials.")
def get_specials() -> str:
    return "..."
```

### 3. Use `AnthropicClient`, not `OpenAIChatCompletionClient`

```python
from agent_framework.anthropic import AnthropicClient

client = AnthropicClient(
    api_key=os.environ["ANTHROPIC_API_KEY"],
    model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5"),
)
```

Other valid model IDs: `claude-sonnet-4-6`, `claude-opus-4-7`. Don't introduce OpenAI as a fallback — it requires a second vendor relationship and adds nothing.

### 4. Keep `[tool.hatch.build.targets.wheel] packages = ["app"]` in `backend/pyproject.toml`

Without it, `pip install -e .` fails with "Unable to determine which files to ship" because the project name doesn't match the source dir.

### 5. Don't delete `frontend/public/.gitkeep`

The frontend Dockerfile's `runner` stage does `COPY --from=builder /app/public ./public`. Without `public/`, the build fails. The `.gitkeep` ensures the directory survives a fresh clone, and the builder stage's `RUN mkdir -p public && npm run build` is a defensive belt-and-suspenders.

## How to add a feature (TDD)

The factory expects strict red→green→refactor:

1. **RED**: write a failing test in `backend/app/tests/test_<feature>.py` (or `frontend/test/<feature>.test.tsx`). Run pytest/vitest; confirm it fails with the expected reason.
2. **GREEN**: write the minimum implementation to make the test pass. Run; confirm it passes.
3. **REFACTOR**: improve clarity. Tests must stay green.

Each phase commits separately:
```
test(<feature>): add failing test for <behavior>      # RED
feat(<feature>): implement <behavior>                  # GREEN
refactor(<feature>): tighten <thing>                   # REFACTOR (optional)
```

After green tests, the factory's `refiner` subagent will run 5 critique-and-improve passes (recorded in `iterations.md`). Don't pre-empt this by over-polishing — let the refiner do its work.

## How to add a new MAF agent

```python
# backend/app/agents/my_feature_agent.py
from agent_framework import Agent, tool

@tool(description="Fetch user's recent orders.")
def get_recent_orders(user_id: str) -> list[dict]:
    return []  # implementation

def build_my_feature_agent(client) -> Agent:
    return Agent(
        client=client,
        name="my_feature_agent",
        instructions="You help users with their orders.",
        tools=[get_recent_orders],
    )
```

Then mount it in `app/main.py`:

```python
from app.agents.my_feature_agent import build_my_feature_agent
my_agent = build_my_feature_agent(chat_client)
add_agent_framework_fastapi_endpoint(app, my_agent, "/orders")
```

And register it in the frontend's runtime route:

```ts
// frontend/app/api/copilotkit/route.ts
const runtime = new CopilotRuntime({
  agents: {
    my_feature_agent: new HttpAgent({ url: `${backendUrl}/orders` }),
  },
});
```

## Environment variables

Copy `backend/.env.example` to `backend/.env` and set:
- `ANTHROPIC_API_KEY` (required) — your Anthropic API key
- `ANTHROPIC_MODEL` (optional, default `claude-haiku-4-5`)

Frontend (`frontend/.env.local`):
- `AG_UI_BACKEND_URL` — defaults to `http://backend:8000/agent` for the Docker network.

## Don't do these

- Don't introduce a Python package manager other than pip in the Dockerfile (see Critical convention #1).
- Don't add OpenAI as a chat provider unless explicitly briefed — it adds vendor sprawl.
- Don't weaken existing tests to make a new feature pass. The refiner subagent will catch and reject this.
- Don't introduce new top-level directories without updating `Project layout` above.
- Don't delete `.gitkeep` files.
- Don't change `output: "standalone"` in `next.config.mjs` without updating the multi-stage Dockerfile.
- Don't touch `.github/workflows/ci.yml` to skip checks — branch protection requires `ci/test` green.
