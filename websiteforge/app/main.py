"""WebsiteForge Agent — FastAPI application."""

import io
import logging
import zipfile

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.graph.workflow import WorkflowError, run_workflow
from app.schemas import (
    ExportRequest,
    GenerateRequest,
    GenerateResponse,
    HealthResponse,
)

__version__ = "0.1.0"

logger = logging.getLogger("websiteforge")

app = FastAPI(
    title="WebsiteForge Agent",
    description=(
        "Backend MVP: a LangGraph agent workflow that turns a prompt into a "
        "site brief, copy, design tokens, and a Tailwind-based static site."
    ),
    version=__version__,
)


@app.exception_handler(WorkflowError)
async def workflow_error_handler(request: Request, exc: WorkflowError) -> JSONResponse:
    logger.exception("Workflow failed for %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "error": "workflow_error"},
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(version=__version__)


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest) -> GenerateResponse:
    """Run the full agent workflow and return all intermediate artifacts."""
    state = run_workflow(request.prompt, request.tone)
    return GenerateResponse(
        brief=state["brief"],
        content=state["content"],
        design=state["design"],
        files=state["files"],
        review=state["review"],
    )


@app.post("/api/export/zip")
async def export_zip(request: ExportRequest) -> StreamingResponse:
    """Export a generated site as a zip archive.

    Accepts either a `prompt` (generates the site first) or `files`
    (zips a previously generated result as-is).
    """
    if request.files is not None:
        files = request.files
    else:
        state = run_workflow(request.prompt, request.tone)
        files = state["files"]

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, contents in files.items():
            archive.writestr(name, contents)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="website.zip"'},
    )
