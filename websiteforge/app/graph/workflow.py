"""LangGraph workflow wiring: planner -> content -> design -> codegen -> reviewer."""

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.graph.nodes import (
    codegen_node,
    content_node,
    design_node,
    planner_node,
    reviewer_node,
)
from app.graph.state import WorkflowState


class WorkflowError(RuntimeError):
    """Raised when the generation workflow fails or yields incomplete state."""


def build_workflow():
    graph = StateGraph(WorkflowState)
    # Node names must not collide with WorkflowState keys (a LangGraph rule),
    # hence "content_writer"/"designer" rather than "content"/"design".
    graph.add_node("planner", planner_node)
    graph.add_node("content_writer", content_node)
    graph.add_node("designer", design_node)
    graph.add_node("code_generator", codegen_node)
    graph.add_node("reviewer", reviewer_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "content_writer")
    graph.add_edge("content_writer", "designer")
    graph.add_edge("designer", "code_generator")
    graph.add_edge("code_generator", "reviewer")
    graph.add_edge("reviewer", END)
    return graph.compile()


@lru_cache(maxsize=1)
def get_workflow():
    return build_workflow()


def run_workflow(prompt: str, tone: str | None = None) -> WorkflowState:
    """Run the full pipeline and return the final state.

    Raises WorkflowError if execution fails or any artifact is missing.
    """
    try:
        result: WorkflowState = get_workflow().invoke({"prompt": prompt, "tone": tone})
    except Exception as exc:  # pragma: no cover - defensive
        raise WorkflowError(f"Workflow execution failed: {exc}") from exc

    missing = [k for k in ("brief", "content", "design", "files", "review") if k not in result]
    if missing:
        raise WorkflowError(f"Workflow finished with missing artifacts: {missing}")
    return result
