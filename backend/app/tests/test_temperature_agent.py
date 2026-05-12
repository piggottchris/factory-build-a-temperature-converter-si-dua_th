"""
Tests for the temperature converter MAF agent.
Phase: RED — written before implementation.
"""

import math
import os

import pytest


# ---------------------------------------------------------------------------
# Unit tests for the conversion tool (pure logic)
# ---------------------------------------------------------------------------

class TestConvertTemperature:
    """Tests for the convert_temperature tool function."""

    def setup_method(self):
        from app.agents.temperature_agent import convert_temperature
        self.convert = convert_temperature

    # --- Celsius → Fahrenheit ---
    def test_celsius_to_fahrenheit_boiling(self):
        result = self.convert(100, "celsius", "fahrenheit")
        assert math.isclose(result, 212.0, rel_tol=1e-6)

    def test_celsius_to_fahrenheit_freezing(self):
        result = self.convert(0, "celsius", "fahrenheit")
        assert math.isclose(result, 32.0, rel_tol=1e-6)

    def test_celsius_to_fahrenheit_negative(self):
        result = self.convert(-40, "celsius", "fahrenheit")
        assert math.isclose(result, -40.0, rel_tol=1e-6)

    # --- Fahrenheit → Celsius ---
    def test_fahrenheit_to_celsius_boiling(self):
        result = self.convert(212, "fahrenheit", "celsius")
        assert math.isclose(result, 100.0, rel_tol=1e-6)

    def test_fahrenheit_to_celsius_freezing(self):
        result = self.convert(32, "fahrenheit", "celsius")
        assert math.isclose(result, 0.0, rel_tol=1e-6)

    def test_fahrenheit_to_celsius_body_temp(self):
        result = self.convert(98.6, "fahrenheit", "celsius")
        assert math.isclose(result, 37.0, rel_tol=1e-4)

    # --- Celsius → Kelvin ---
    def test_celsius_to_kelvin_absolute_zero(self):
        result = self.convert(-273.15, "celsius", "kelvin")
        assert math.isclose(result, 0.0, abs_tol=1e-6)

    def test_celsius_to_kelvin_boiling(self):
        result = self.convert(100, "celsius", "kelvin")
        assert math.isclose(result, 373.15, rel_tol=1e-6)

    # --- Kelvin → Celsius ---
    def test_kelvin_to_celsius_zero(self):
        result = self.convert(0, "kelvin", "celsius")
        assert math.isclose(result, -273.15, rel_tol=1e-6)

    def test_kelvin_to_celsius_boiling(self):
        result = self.convert(373.15, "kelvin", "celsius")
        assert math.isclose(result, 100.0, rel_tol=1e-6)

    # --- Fahrenheit → Kelvin ---
    def test_fahrenheit_to_kelvin_boiling(self):
        result = self.convert(212, "fahrenheit", "kelvin")
        assert math.isclose(result, 373.15, rel_tol=1e-6)

    def test_fahrenheit_to_kelvin_freezing(self):
        """32°F is water's freezing point — should yield 273.15K."""
        result = self.convert(32, "fahrenheit", "kelvin")
        assert math.isclose(result, 273.15, rel_tol=1e-6)

    # --- Kelvin → Fahrenheit ---
    def test_kelvin_to_fahrenheit_boiling(self):
        result = self.convert(373.15, "kelvin", "fahrenheit")
        assert math.isclose(result, 212.0, rel_tol=1e-6)

    def test_kelvin_to_fahrenheit_absolute_zero(self):
        """0K → absolute zero in Fahrenheit = -459.67°F."""
        result = self.convert(0, "kelvin", "fahrenheit")
        assert math.isclose(result, -459.67, rel_tol=1e-5)

    # --- Same-unit pass-through ---
    def test_same_unit_celsius(self):
        result = self.convert(25, "celsius", "celsius")
        assert math.isclose(result, 25.0, rel_tol=1e-6)

    def test_same_unit_fahrenheit(self):
        result = self.convert(98.6, "fahrenheit", "fahrenheit")
        assert math.isclose(result, 98.6, rel_tol=1e-6)

    def test_same_unit_kelvin(self):
        result = self.convert(300, "kelvin", "kelvin")
        assert math.isclose(result, 300.0, rel_tol=1e-6)

    # --- Case insensitivity ---
    def test_case_insensitive_units(self):
        result = self.convert(100, "Celsius", "FAHRENHEIT")
        assert math.isclose(result, 212.0, rel_tol=1e-6)

    # --- Invalid units ---
    def test_invalid_from_unit_raises(self):
        with pytest.raises(ValueError, match="Unsupported unit"):
            self.convert(100, "rankine", "celsius")

    def test_invalid_to_unit_raises(self):
        with pytest.raises(ValueError, match="Unsupported unit"):
            self.convert(100, "celsius", "rankine")

    # --- Absolute zero guard ---
    def test_kelvin_below_absolute_zero_raises(self):
        with pytest.raises(ValueError, match="below absolute zero"):
            self.convert(-1, "kelvin", "celsius")

    def test_celsius_below_absolute_zero_raises(self):
        with pytest.raises(ValueError, match="below absolute zero"):
            self.convert(-274, "celsius", "kelvin")

    def test_fahrenheit_below_absolute_zero_raises(self):
        with pytest.raises(ValueError, match="below absolute zero"):
            self.convert(-460, "fahrenheit", "celsius")

    # --- NaN / Infinity guard ---
    def test_nan_value_raises(self):
        with pytest.raises(ValueError, match="finite number.*NaN"):
            self.convert(float("nan"), "celsius", "kelvin")

    def test_positive_infinity_raises(self):
        with pytest.raises(ValueError, match="finite number.*Infinity"):
            self.convert(float("inf"), "celsius", "kelvin")

    def test_negative_infinity_raises(self):
        with pytest.raises(ValueError, match="finite number.*Infinity"):
            self.convert(float("-inf"), "celsius", "kelvin")


class TestListSupportedUnits:
    """Tests for the list_supported_units tool function."""

    def setup_method(self):
        from app.agents.temperature_agent import list_supported_units
        self.list_units = list_supported_units

    def test_returns_at_least_three_units(self):
        units = self.list_units()
        assert len(units) >= 3

    def test_contains_celsius(self):
        units = self.list_units()
        assert any("celsius" in u.lower() for u in units)

    def test_contains_fahrenheit(self):
        units = self.list_units()
        assert any("fahrenheit" in u.lower() for u in units)

    def test_contains_kelvin(self):
        units = self.list_units()
        assert any("kelvin" in u.lower() for u in units)

    def test_returns_list_of_strings(self):
        units = self.list_units()
        assert isinstance(units, list)
        assert all(isinstance(u, str) for u in units)


class TestBuildTemperatureAgent:
    """Tests that the MAF agent is correctly constructed."""

    def test_agent_has_correct_name(self):
        from unittest.mock import MagicMock
        from app.agents.temperature_agent import build_temperature_agent
        mock_client = MagicMock()
        agent = build_temperature_agent(mock_client)
        assert agent.name == "temperature_agent"

    def test_agent_has_tools(self):
        from unittest.mock import MagicMock
        from app.agents.temperature_agent import build_temperature_agent
        mock_client = MagicMock()
        agent = build_temperature_agent(mock_client)
        # Tools are stored in default_options by the MAF framework
        tools = agent.default_options.get("tools", [])
        assert tools is not None
        assert len(tools) >= 2

    def test_agent_instructions_mention_convert_tool(self):
        """Instructions must reference the conversion tool so the LLM knows when to invoke it."""
        from unittest.mock import MagicMock
        from app.agents.temperature_agent import build_temperature_agent
        mock_client = MagicMock()
        agent = build_temperature_agent(mock_client)
        instructions = agent.default_options.get("instructions", "")
        assert "convert_temperature_tool" in instructions

    def test_agent_instructions_mention_list_units_tool(self):
        """Instructions must reference the list-units tool so the LLM uses it for unit queries."""
        from unittest.mock import MagicMock
        from app.agents.temperature_agent import build_temperature_agent
        mock_client = MagicMock()
        agent = build_temperature_agent(mock_client)
        instructions = agent.default_options.get("instructions", "")
        assert "list_supported_units_tool" in instructions


class TestConvertTemperatureTool:
    """Tests for the MAF tool wrapper (convert_temperature_tool)."""

    def setup_method(self):
        from app.agents.temperature_agent import convert_temperature_tool
        self.tool = convert_temperature_tool

    def test_success_returns_formatted_string(self):
        result = self.tool(100, "celsius", "fahrenheit")
        assert "212" in result
        assert "Celsius" in result
        assert "Fahrenheit" in result

    def test_exact_output_format_boiling(self):
        """Tool output must follow '<value> <From> = <result:.4f> <To> (rounded: <result:.2f>)'."""
        result = self.tool(100, "celsius", "fahrenheit")
        assert result == "100 Celsius = 212.0000 Fahrenheit (rounded: 212.00)"

    def test_exact_output_format_crossover(self):
        """-40 is the C=F crossover; format must be symmetric."""
        result = self.tool(-40, "celsius", "fahrenheit")
        assert result == "-40 Celsius = -40.0000 Fahrenheit (rounded: -40.00)"

    def test_exact_output_format_freezing_f_to_k(self):
        """32°F = 273.15K; verifies Fahrenheit→Kelvin formatting."""
        result = self.tool(32, "fahrenheit", "kelvin")
        assert result == "32 Fahrenheit = 273.1500 Kelvin (rounded: 273.15)"

    def test_invalid_unit_returns_error_string(self):
        result = self.tool(100, "rankine", "celsius")
        assert result.startswith("Error:")
        assert "rankine" in result.lower() or "unsupported" in result.lower()

    def test_below_absolute_zero_returns_error_string(self):
        result = self.tool(-1, "kelvin", "celsius")
        assert result.startswith("Error:")

    def test_nan_returns_error_string(self):
        result = self.tool(float("nan"), "celsius", "kelvin")
        assert result.startswith("Error:")

    def test_unexpected_exception_is_caught_and_logged(self, caplog):
        """A non-ValueError exception must be logged at ERROR and return a safe error string."""
        import logging
        from unittest.mock import patch
        from app.agents.temperature_agent import convert_temperature_tool

        with patch(
            "app.agents.temperature_agent.convert_temperature",
            side_effect=RuntimeError("simulated unexpected error"),
        ):
            with caplog.at_level(logging.ERROR, logger="app.agents.temperature_agent"):
                result = convert_temperature_tool(100, "celsius", "fahrenheit")

        assert result.startswith("Error:")
        assert "unexpected server error" in result
        assert any("unexpected" in r.message.lower() for r in caplog.records)

    def test_validation_error_is_logged_as_warning(self, caplog):
        """ValueError from convert_temperature must be logged at WARNING."""
        import logging

        with caplog.at_level(logging.WARNING, logger="app.agents.temperature_agent"):
            self.tool(100, "rankine", "celsius")

        assert any(r.levelno == logging.WARNING for r in caplog.records)


class TestFastAPISmoke:
    """Smoke tests for the FastAPI app with temperature agent mounted."""

    @pytest.fixture
    def app(self):
        os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-not-used")
        from fastapi.testclient import TestClient
        from app.main import app as fastapi_app
        return TestClient(fastapi_app)

    def test_healthz_responds(self, app):
        r = app.get("/healthz")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        # Should list agents (may be "agent" string for haiku or "agents" list for temperature)
        assert "agents" in body or "agent" in body

    def test_healthz_includes_model(self, app):
        r = app.get("/healthz")
        assert r.status_code == 200
        body = r.json()
        assert "model" in body
        assert isinstance(body["model"], str)
        assert len(body["model"]) > 0

    def test_temperature_agent_route_is_mounted(self, app):
        r = app.get("/openapi.json")
        assert r.status_code == 200
        paths = r.json()["paths"]
        temp_paths = [p for p in paths if "temperature" in p]
        assert temp_paths, (
            f"Expected a /agent-temperature route; found: {list(paths.keys())}"
        )
