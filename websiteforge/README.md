# WebsiteForge Agent — Backend MVP

A FastAPI + LangGraph backend that turns a natural-language prompt into a
complete static website: structured brief, copy + SEO metadata, design
tokens, and Tailwind-based HTML/CSS — with an automated review step.

## Agent workflow

The pipeline is a linear LangGraph `StateGraph` with five nodes:

```
prompt ─▶ Planner ─▶ Content ─▶ Design ─▶ CodeGenerator ─▶ Reviewer ─▶ result
```

| Node | Output |
|------|--------|
| **Planner** | `SiteBrief` — site name, tagline, industry, audience, goals, section list, tone |
| **Content** | `ContentBundle` — per-section copy + SEO title/description/keywords |
| **Design** | `DesignTokens` — layout, color palette, typography, radius |
| **CodeGenerator** | `files` — `index.html` (Tailwind utility classes via CDN) + `styles.css` (token CSS variables) |
| **Reviewer** | `ReviewReport` — validates required sections (`hero`, `about`, `services`, `contact`) and metadata, returns improvement notes |

**Note on determinism:** the nodes are deterministic (keyword heuristics +
templates), not LLM calls, so the MVP runs locally with **zero API keys and no
external services**. Each node only reads/writes the shared `WorkflowState`,
so swapping any node for an LLM-backed implementation later is a local change
to `app/graph/nodes.py`.

## Requirements

- Python 3.11+

## Setup & run

```bash
cd websiteforge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Interactive API docs: http://127.0.0.1:8000/docs

## API

### `GET /health`

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","service":"websiteforge-agent","version":"0.1.0"}
```

### `POST /api/generate`

Runs the full workflow and returns every artifact (brief, content, design,
files, review).

```bash
curl -s http://127.0.0.1:8000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Build a website for \"Bella'\''s Bakery\", a cozy local bakery with pricing info"}'
```

Optional field: `"tone"` (e.g. `"playful"`, `"luxury"`) overrides tone detection.

### `POST /api/export/zip`

Returns a zip archive of the site. Provide **exactly one** of:

- `prompt` — generates the site, then zips it:
  ```bash
  curl -s http://127.0.0.1:8000/api/export/zip \
    -H 'Content-Type: application/json' \
    -d '{"prompt": "Landing page for a SaaS platform with pricing"}' \
    -o website.zip
  ```
- `files` — zips a previously generated result as-is (must include `index.html`):
  ```bash
  curl -s http://127.0.0.1:8000/api/export/zip \
    -H 'Content-Type: application/json' \
    -d '{"files": {"index.html": "<html>...</html>", "styles.css": "..."}}' \
    -o website.zip
  ```

Unzip and open `index.html` in a browser — Tailwind loads from its CDN.

### Error handling

- `422` — invalid input (prompt too short, both/neither export inputs, missing `index.html` in `files`), with Pydantic validation details.
- `500` with `{"error": "workflow_error"}` — the workflow failed or produced incomplete artifacts.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

Covers all three endpoints, request validation, zip contents, each node's
behavior (industry detection, section triggers, reviewer failure cases), and
workflow determinism.

## Project layout

```
websiteforge/
├── app/
│   ├── main.py            # FastAPI app + endpoints + error handlers
│   ├── schemas.py         # Pydantic models (API + artifacts)
│   └── graph/
│       ├── state.py       # Shared WorkflowState
│       ├── nodes.py       # The five workflow nodes
│       └── workflow.py    # LangGraph wiring + run_workflow()
├── tests/
├── requirements.txt
└── requirements-dev.txt
```

## Out of scope (by design)

No deployment integrations (Netlify/Vercel/WordPress/GitHub), no Stripe, no
Supabase, no authentication, no drag-and-drop editor, no Next.js export.
