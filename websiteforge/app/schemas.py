"""Pydantic schemas for the WebsiteForge Agent API and workflow artifacts."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Workflow artifacts
# ---------------------------------------------------------------------------


class SiteBrief(BaseModel):
    """Structured brief produced by the Planner node."""

    site_name: str = Field(min_length=1)
    tagline: str
    industry: str
    target_audience: str
    goals: list[str] = Field(min_length=1)
    sections: list[str] = Field(min_length=1, description="Ordered section ids")
    tone: str = "professional"


class SEOMetadata(BaseModel):
    title: str = Field(min_length=1, max_length=70)
    description: str = Field(min_length=1, max_length=160)
    keywords: list[str] = Field(min_length=1)


class MenuItem(BaseModel):
    name: str
    description: str
    price: str


class SectionContent(BaseModel):
    id: str
    heading: str
    body: str
    cta: str | None = None
    items: list[MenuItem] | None = None


class ContentBundle(BaseModel):
    """Copy and SEO metadata produced by the Content node."""

    seo: SEOMetadata
    sections: list[SectionContent] = Field(min_length=1)


class ColorPalette(BaseModel):
    primary: str
    secondary: str
    accent: str
    background: str
    surface: str
    text: str


class Typography(BaseModel):
    heading_font: str
    body_font: str
    base_size_px: int = 16


class DesignTokens(BaseModel):
    """Layout, color and typography tokens produced by the Design node."""

    layout: str = Field(description="Layout strategy id, e.g. 'single-page'")
    palette: ColorPalette
    typography: Typography
    border_radius: str = "0.75rem"
    max_width_class: str = "max-w-6xl"


class ReviewReport(BaseModel):
    """Validation result produced by the Reviewer node."""

    passed: bool
    missing_sections: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# API request / response models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str = Field(
        min_length=10,
        max_length=4000,
        description="Natural-language description of the website to build",
    )
    tone: str | None = Field(
        default=None, description="Optional tone override, e.g. 'playful'"
    )


class GenerateResponse(BaseModel):
    brief: SiteBrief
    content: ContentBundle
    design: DesignTokens
    files: dict[str, str] = Field(description="Generated file name -> file contents")
    review: ReviewReport


class ExportRequest(BaseModel):
    """Export a site as a zip.

    Provide either a `prompt` (the site is generated first) or `files`
    (a previously generated result is zipped as-is), but not both.
    """

    prompt: str | None = Field(default=None, min_length=10, max_length=4000)
    tone: str | None = None
    files: dict[str, str] | None = None

    @model_validator(mode="after")
    def _exactly_one_input(self) -> "ExportRequest":
        if bool(self.prompt) == bool(self.files):
            raise ValueError("Provide exactly one of 'prompt' or 'files'.")
        if self.files is not None and "index.html" not in self.files:
            raise ValueError("'files' must include 'index.html'.")
        return self


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "websiteforge-agent"
    version: str
