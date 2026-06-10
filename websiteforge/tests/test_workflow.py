"""Unit tests for individual workflow nodes and the compiled graph."""

import pytest

from app.graph.nodes import (
    REQUIRED_SECTIONS,
    content_node,
    design_node,
    planner_node,
    reviewer_node,
)
from app.graph.workflow import WorkflowError, run_workflow


def test_planner_detects_industry_and_sections():
    state = planner_node(
        {"prompt": "Landing page for our SaaS platform with pricing plans and FAQ"}
    )
    brief = state["brief"]
    assert brief.industry == "saas"
    for section in REQUIRED_SECTIONS:
        assert section in brief.sections
    assert "pricing" in brief.sections
    assert "faq" in brief.sections
    assert brief.sections[-1] == "contact"


def test_planner_extracts_quoted_site_name():
    state = planner_node({"prompt": 'A website for "Acme Studio" marketing agency'})
    assert state["brief"].site_name == "Acme Studio"


def test_planner_falls_back_to_general_industry():
    state = planner_node({"prompt": "I want a simple website please make it nice"})
    brief = state["brief"]
    assert brief.industry == "general"
    assert brief.site_name == "Your Brand"


def test_content_produces_copy_for_every_section():
    brief_state = planner_node({"prompt": "Website for a yoga and fitness studio"})
    content = content_node(brief_state)["content"]
    assert [s.id for s in content.sections] == brief_state["brief"].sections
    assert all(s.heading and s.body for s in content.sections)
    assert len(content.seo.description) <= 160
    assert len(content.seo.title) <= 70


def test_design_uses_industry_preset():
    brief_state = planner_node({"prompt": "Website for a yoga and fitness studio"})
    design = design_node(brief_state)["design"]
    assert design.layout == "single-page"
    assert design.palette.primary == "#16a34a"


def test_reviewer_flags_missing_sections():
    brief_state = planner_node({"prompt": "Website for a marketing agency"})
    broken_files = {
        "index.html": '<html><head><title>x</title><meta name="description" content="x"></head>'
        '<body><section id="hero"></section></body></html>',
        "styles.css": "",
    }
    review = reviewer_node({**brief_state, "files": broken_files})["review"]
    assert review.passed is False
    assert "about" in review.missing_sections
    assert "contact" in review.missing_sections
    assert any("about" in note for note in review.notes)


def test_full_workflow_produces_consistent_state():
    state = run_workflow("Build a website for a coffee shop with customer reviews")
    assert state["brief"].industry == "restaurant"
    assert "testimonials" in state["brief"].sections
    assert state["review"].passed is True
    for section in state["brief"].sections:
        assert f'id="{section}"' in state["files"]["index.html"]


def test_workflow_is_deterministic():
    prompt = "Build a website for a coffee shop"
    first = run_workflow(prompt)
    second = run_workflow(prompt)
    assert first["files"] == second["files"]
    assert first["brief"] == second["brief"]


def test_run_workflow_wraps_node_errors(monkeypatch):
    import app.graph.workflow as workflow_module

    class ExplodingWorkflow:
        def invoke(self, _state):
            raise RuntimeError("boom")

    monkeypatch.setattr(workflow_module, "get_workflow", lambda: ExplodingWorkflow())
    with pytest.raises(WorkflowError, match="boom"):
        workflow_module.run_workflow("Build a website for a coffee shop")
