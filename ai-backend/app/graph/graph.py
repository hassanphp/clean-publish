"""LangGraph pipeline compilation."""

import asyncio
from typing import Callable, Awaitable

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

from app.graph.state import GraphState
from app.graph.nodes import (
    gemini_classifier_node,
    dynamic_prompt_node,
    vertex_execution_node_async,
)

# Allow AutomotiveImageMetadata in checkpoint serialization (silences deserialization warning)
_SERDE = JsonPlusSerializer(allowed_msgpack_modules=[("app.schemas", "AutomotiveImageMetadata")])


def create_graph(get_token: Callable[[], Awaitable[str]]):
    """Build the automotive image processing graph."""

    def vertex_node(state: GraphState) -> dict:
        """Sync wrapper for async vertex execution."""
        return asyncio.run(vertex_execution_node_async(state, get_token))

    workflow = StateGraph(GraphState)

    workflow.add_node("classify", gemini_classifier_node)
    workflow.add_node("prompt", dynamic_prompt_node)
    workflow.add_node("execute", vertex_node)

    workflow.set_entry_point("classify")
    workflow.add_edge("classify", "prompt")
    workflow.add_edge("prompt", "execute")
    workflow.add_edge("execute", END)

    return workflow.compile(checkpointer=MemorySaver(serde=_SERDE))
