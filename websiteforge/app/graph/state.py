"""Shared state passed between LangGraph nodes."""

from typing import TypedDict

from app.schemas import ContentBundle, DesignTokens, ReviewReport, SiteBrief


class WorkflowState(TypedDict, total=False):
    # Input
    prompt: str
    tone: str | None
    # Produced by nodes, in pipeline order
    brief: SiteBrief
    content: ContentBundle
    design: DesignTokens
    files: dict[str, str]
    review: ReviewReport
