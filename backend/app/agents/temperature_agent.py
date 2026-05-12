"""
MAF agent for temperature unit conversion.

Supports: Celsius, Fahrenheit, Kelvin.
"""

import logging
import math

from agent_framework import Agent, tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SUPPORTED_UNITS = {"celsius", "fahrenheit", "kelvin"}

# Absolute zero in each unit
ABSOLUTE_ZERO = {
    "celsius": -273.15,
    "fahrenheit": -459.67,
    "kelvin": 0.0,
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _celsius_to_kelvin(c: float) -> float:
    return c + 273.15


def _kelvin_to_celsius(k: float) -> float:
    return k - 273.15


# ---------------------------------------------------------------------------
# Exported conversion function (also called directly by tool)
# ---------------------------------------------------------------------------

def convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    """
    Convert *value* from *from_unit* to *to_unit*.

    Parameters
    ----------
    value : float
        The temperature value to convert.
    from_unit : str
        Source unit — 'celsius', 'fahrenheit', or 'kelvin' (case-insensitive).
    to_unit : str
        Target unit — 'celsius', 'fahrenheit', or 'kelvin' (case-insensitive).

    Returns
    -------
    float
        Converted temperature value.

    Raises
    ------
    ValueError
        If either unit is unsupported or the input value is below absolute zero.
    """
    from_unit = from_unit.lower().strip()
    to_unit = to_unit.lower().strip()

    if from_unit not in SUPPORTED_UNITS:
        raise ValueError(f"Unsupported unit: '{from_unit}'. Supported: {sorted(SUPPORTED_UNITS)}")
    if to_unit not in SUPPORTED_UNITS:
        raise ValueError(f"Unsupported unit: '{to_unit}'. Supported: {sorted(SUPPORTED_UNITS)}")

    # Reject IEEE 754 special values — NaN and Infinity are not physical temperatures
    if math.isnan(value):
        raise ValueError("Temperature value must be a finite number, got NaN.")
    if math.isinf(value):
        raise ValueError("Temperature value must be a finite number, got Infinity.")

    # Absolute-zero guard
    abs_zero = ABSOLUTE_ZERO[from_unit]
    if value < abs_zero - 1e-9:
        raise ValueError(
            f"{value} {from_unit} is below absolute zero "
            f"({abs_zero} {from_unit}). Physical temperatures cannot be this low."
        )

    # Same-unit pass-through
    if from_unit == to_unit:
        return float(value)

    # Convert to Celsius as intermediate
    if from_unit == "celsius":
        celsius = float(value)
    elif from_unit == "fahrenheit":
        celsius = (value - 32.0) * 5.0 / 9.0
    else:  # kelvin
        celsius = _kelvin_to_celsius(value)

    # Convert from Celsius to target
    if to_unit == "celsius":
        return celsius
    elif to_unit == "fahrenheit":
        return celsius * 9.0 / 5.0 + 32.0
    else:  # kelvin
        return _celsius_to_kelvin(celsius)


def list_supported_units() -> list[str]:
    """Return the list of supported temperature unit names."""
    return ["Celsius", "Fahrenheit", "Kelvin"]


# ---------------------------------------------------------------------------
# MAF tools (thin wrappers with string I/O for the agent)
# ---------------------------------------------------------------------------

@tool(description=(
    "Convert a temperature value between units. "
    "Supported units: celsius, fahrenheit, kelvin (case-insensitive). "
    "Returns the converted value as a float. "
    "Raises an error if the unit is unsupported or the value is below absolute zero."
))
def convert_temperature_tool(value: float, from_unit: str, to_unit: str) -> str:
    """MAF-registered tool wrapper for convert_temperature."""
    try:
        result = convert_temperature(value, from_unit, to_unit)
        logger.debug(
            "convert_temperature: %.6g %s -> %.6g %s",
            value, from_unit, result, to_unit,
        )
        return (
            f"{value} {from_unit.capitalize()} = {result:.4f} {to_unit.capitalize()} "
            f"(rounded: {result:.2f})"
        )
    except ValueError as exc:
        logger.warning("convert_temperature validation error: %s", exc)
        return f"Error: {exc}"
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "convert_temperature unexpected error: value=%r from_unit=%r to_unit=%r — %s",
            value, from_unit, to_unit, exc,
            exc_info=True,
        )
        return f"Error: unexpected server error during conversion."


@tool(description="List the temperature units supported by this converter.")
def list_supported_units_tool() -> str:
    """MAF-registered tool wrapper for list_supported_units."""
    units = list_supported_units()
    return "Supported temperature units: " + ", ".join(units)


# ---------------------------------------------------------------------------
# Agent factory
# ---------------------------------------------------------------------------

def build_temperature_agent(client) -> Agent:
    """Create and return the temperature converter MAF agent."""
    return Agent(
        name="temperature_agent",
        instructions=(
            "You are a helpful temperature converter assistant. "
            "When the user asks to convert a temperature, use the convert_temperature_tool "
            "to perform the conversion and then explain the result clearly. "
            "If the user asks which units are supported, use the list_supported_units_tool. "
            "Always state the input value and unit alongside the output value and unit. "
            "For context, mention the everyday significance of the temperature when relevant "
            "(e.g., 100°C is the boiling point of water)."
        ),
        client=client,
        tools=[convert_temperature_tool, list_supported_units_tool],
    )
