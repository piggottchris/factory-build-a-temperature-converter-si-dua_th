"""FastAPI entry point. Mounts MAF agents as AG-UI endpoints."""

# Datadog APM + LLM Observability — imported FIRST so ddtrace.patch_all
# runs before FastAPI / httpx / Anthropic SDK bind their client classes.
# See app/dd_init.py — no-ops cleanly when DD_API_KEY is unset.
from app import dd_init  # noqa: F401

import os

from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint
from agent_framework.anthropic import AnthropicClient
from dotenv import load_dotenv
from fastapi import FastAPI

from app.agents.haiku_agent import build_haiku_agent
from app.agents.temperature_agent import build_temperature_agent

load_dotenv()


def build_chat_client() -> AnthropicClient:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("Set ANTHROPIC_API_KEY in backend/.env before starting.")
    return AnthropicClient(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5"),
    )


app = FastAPI(title="darkpoc: MAF + FastAPI + AG-UI (Claude) — Temperature Converter")

chat_client = build_chat_client()

# Haiku agent (template example — kept for reference)
haiku_agent = build_haiku_agent(chat_client)
add_agent_framework_fastapi_endpoint(app, haiku_agent, "/agent")

# Temperature converter agent
temperature_agent = build_temperature_agent(chat_client)
add_agent_framework_fastapi_endpoint(app, temperature_agent, "/agent-temperature")


@app.get("/healthz")
async def healthz():
    return {
        "ok": True,
        "agents": [haiku_agent.name, temperature_agent.name],
    }
