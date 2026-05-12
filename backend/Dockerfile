FROM python:3.12-slim-bookworm

WORKDIR /app

# IMPORTANT: must use plain pip, not `uv pip install`, for the agent-framework
# stack. uv corrupts agent_framework/__init__.py to 0 bytes when multiple
# agent-framework-* packages share the namespace package directory. See
# SPIKE-NOTES.md for details. Revisit if uv ever fixes namespace handling.
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
