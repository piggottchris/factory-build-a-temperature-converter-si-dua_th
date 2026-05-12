"""Smoke tests that don't hit the LLM. Verify the FastAPI app boots and routes are wired."""

import os

import pytest


@pytest.fixture
def app():
    # Provide a dummy key so app/main.py's startup check passes.
    os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-not-used")
    from fastapi.testclient import TestClient

    from app.main import app as fastapi_app

    return TestClient(fastapi_app)


def test_healthz_responds(app):
    r = app.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["agent"] == "haiku_agent"


def test_agent_route_is_mounted(app):
    # AG-UI mounts a POST handler at /agent. We don't call it for real
    # (would hit the LLM), just confirm the route exists.
    r = app.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    agent_paths = [p for p in paths if p.startswith("/agent")]
    assert agent_paths, f"expected an /agent route mounted by AG-UI, found paths: {list(paths.keys())}"
