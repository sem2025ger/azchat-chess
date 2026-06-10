"""API tests for the WebsiteForge Agent endpoints."""

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PROMPT = 'Build a website for "Bella\'s Bakery", a cozy local bakery with pricing info'


def test_root_serves_ui(monkeypatch):
    # Change CWD to some other directory to ensure the path is correctly resolved
    monkeypatch.chdir("..")
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "websiteforge-agent"
    assert body["version"]


def test_generate_returns_all_artifacts():
    response = client.post("/api/generate", json={"prompt": PROMPT})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"brief", "content", "design", "files", "review"}

    assert body["brief"]["site_name"] == "Bella's Bakery"
    assert body["brief"]["industry"] == "restaurant"
    assert "pricing" in body["brief"]["sections"]

    assert body["content"]["seo"]["title"]
    assert len(body["content"]["seo"]["description"]) <= 160

    assert body["design"]["palette"]["primary"].startswith("#")
    assert body["design"]["typography"]["heading_font"]

    assert "index.html" in body["files"]
    assert "styles.css" in body["files"]
    assert "tailwindcss" in body["files"]["index.html"]
    for section in ("hero", "about", "services", "contact"):
        assert f'id="{section}"' in body["files"]["index.html"]

    assert body["review"]["passed"] is True
    assert body["review"]["missing_sections"] == []


def test_generate_respects_tone_override():
    response = client.post("/api/generate", json={"prompt": PROMPT, "tone": "playful"})
    assert response.status_code == 200
    assert response.json()["brief"]["tone"] == "playful"


@pytest.mark.parametrize("payload", [{}, {"prompt": ""}, {"prompt": "too short"}])
def test_generate_rejects_invalid_prompt(payload):
    response = client.post("/api/generate", json=payload)
    assert response.status_code == 422


def _read_zip(response) -> zipfile.ZipFile:
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


def test_export_zip_from_prompt():
    response = client.post("/api/export/zip", json={"prompt": PROMPT})
    assert response.status_code == 200
    archive = _read_zip(response)
    assert set(archive.namelist()) == {"index.html", "styles.css"}
    index_html = archive.read("index.html").decode()
    assert "Bella" in index_html


def test_export_zip_from_files():
    files = {"index.html": "<html></html>", "styles.css": "body {}"}
    response = client.post("/api/export/zip", json={"files": files})
    assert response.status_code == 200
    archive = _read_zip(response)
    assert archive.read("index.html").decode() == "<html></html>"


def test_export_zip_rejects_missing_input():
    response = client.post("/api/export/zip", json={})
    assert response.status_code == 422


def test_export_zip_rejects_both_inputs():
    response = client.post(
        "/api/export/zip",
        json={"prompt": PROMPT, "files": {"index.html": "<html></html>"}},
    )
    assert response.status_code == 422


def test_export_zip_rejects_files_without_index():
    response = client.post("/api/export/zip", json={"files": {"styles.css": "body {}"}})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "unsafe_name",
    [
        "../outside.html",
        "/outside.html",
        "C:\\outside.html",
        "folder/outside.html",
        "",
    ],
)
def test_export_zip_rejects_unsafe_names(unsafe_name):
    response = client.post(
        "/api/export/zip",
        json={"files": {"index.html": "<html></html>", unsafe_name: "content"}},
    )
    assert response.status_code == 422
