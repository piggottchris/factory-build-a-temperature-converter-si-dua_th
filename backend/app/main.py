"""FastAPI entry point. Mounts a MAF agent as an AG-UI endpoint at /agent."""

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

load_dotenv()


def build_chat_client() -> AnthropicClient:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("Set ANTHROPIC_API_KEY in backend/.env before starting.")
    return AnthropicClient(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5"),
    )


app = FastAPI(title="darkpoc: MAF + FastAPI + AG-UI (Claude)")

agent = build_haiku_agent(build_chat_client())
add_agent_framework_fastapi_endpoint(app, agent, "/agent")


@app.get("/healthz")
async def healthz():
    return {"ok": True, "agent": agent.name}
