"""Minimal MAF agent with one tool — exercises AG-UI streaming + tool calling."""

import random

from agent_framework import Agent, tool


@tool(description="Return a randomly chosen haiku topic.")
def get_random_haiku_topic() -> str:
    topics = [
        "early morning light through a window",
        "the silence after rain",
        "Tailscale pinging across continents",
        "an empty Mac mini fan",
        "a Docker container starting up",
        "a senior engineer sighing at YAML",
    ]
    return random.choice(topics)


def build_haiku_agent(client) -> Agent:
    return Agent(
        name="haiku_agent",
        instructions=(
            "You are a haiku writer. When asked for a haiku, write a 5-7-5 syllable haiku. "
            "If the user asks for a topic suggestion or doesn't supply one, call the "
            "get_random_haiku_topic tool to pick one. Always show the haiku in three lines."
        ),
        client=client,
        tools=[get_random_haiku_topic],
    )
