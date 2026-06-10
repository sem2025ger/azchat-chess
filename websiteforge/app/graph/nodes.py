"""The five WebsiteForge workflow nodes.

All nodes are deterministic (keyword heuristics + templates) so the MVP runs
locally without API keys. Each node reads from and writes to WorkflowState,
which makes swapping any node for an LLM-backed implementation a local change.
"""

from __future__ import annotations

import html
import re

from app.graph.state import WorkflowState
from app.schemas import (
    ColorPalette,
    ContentBundle,
    DesignTokens,
    ReviewReport,
    SectionContent,
    SEOMetadata,
    SiteBrief,
    Typography,
)

REQUIRED_SECTIONS = ["hero", "about", "services", "contact"]

# industry id -> (detection keywords, audience, default goal)
_INDUSTRY_RULES: dict[str, tuple[list[str], str, str]] = {
    "restaurant": (
        ["restaurant", "cafe", "coffee", "bakery", "bistro", "food", "menu"],
        "local diners and food lovers",
        "bring more guests through the door",
    ),
    "saas": (
        ["saas", "software", "app", "platform", "startup", "api", "tool"],
        "teams evaluating modern software",
        "convert visitors into trial signups",
    ),
    "portfolio": (
        ["portfolio", "photographer", "designer", "artist", "freelance", "writer"],
        "potential clients and collaborators",
        "showcase work and win commissions",
    ),
    "fitness": (
        ["gym", "fitness", "yoga", "trainer", "wellness", "studio"],
        "people committed to their health",
        "turn visitors into members",
    ),
    "agency": (
        ["agency", "marketing", "consulting", "consultancy", "studio"],
        "businesses looking for expert partners",
        "generate qualified leads",
    ),
    "ecommerce": (
        ["shop", "store", "ecommerce", "e-commerce", "boutique", "products"],
        "online shoppers",
        "drive product sales",
    ),
}

_OPTIONAL_SECTION_TRIGGERS: dict[str, list[str]] = {
    "pricing": ["pricing", "plans", "price", "subscription", "packages"],
    "testimonials": ["testimonial", "reviews", "social proof", "clients say"],
    "faq": ["faq", "questions", "q&a"],
    "gallery": ["gallery", "portfolio", "photos", "showcase", "work"],
}

_TONE_TRIGGERS: dict[str, list[str]] = {
    "playful": ["playful", "fun", "quirky", "whimsical", "friendly"],
    "luxury": ["luxury", "premium", "elegant", "high-end", "upscale"],
    "bold": ["bold", "edgy", "striking", "modern"],
}


def _detect_industry(prompt_lower: str) -> str:
    best, best_hits = "general", 0
    for industry, (keywords, _, _) in _INDUSTRY_RULES.items():
        hits = sum(1 for kw in keywords if kw in prompt_lower)
        if hits > best_hits:
            best, best_hits = industry, hits
    return best


def _extract_site_name(prompt: str, industry: str) -> str:
    # A double-quoted name wins: build a site for "Bella's Bakery".
    # Single quotes are excluded so apostrophes don't truncate the match.
    quoted = re.search(r'"([^"]{2,40})"|“([^”]{2,40})”', prompt)
    if quoted:
        return (quoted.group(1) or quoted.group(2)).strip()
    # "for/called/named <Proper Name>" — take consecutive capitalized words
    named = re.search(
        r"\b(?:for|called|named)\s+((?:[A-Z][\w&'-]*\s?){1,4})", prompt
    )
    if named:
        candidate = named.group(1).strip()
        if len(candidate) >= 3:
            return candidate
    return f"{industry.capitalize()} Co." if industry != "general" else "Your Brand"


def planner_node(state: WorkflowState) -> WorkflowState:
    """Convert the user prompt into a structured site brief."""
    prompt = state["prompt"].strip()
    prompt_lower = prompt.lower()

    industry = _detect_industry(prompt_lower)
    _, audience, primary_goal = _INDUSTRY_RULES.get(
        industry, ([], "visitors interested in your offering", "present a clear, credible online presence")
    )

    sections = list(REQUIRED_SECTIONS)
    for section, triggers in _OPTIONAL_SECTION_TRIGGERS.items():
        if any(t in prompt_lower for t in triggers):
            sections.insert(-1, section)  # keep contact last

    tone = state.get("tone")
    if not tone:
        tone = next(
            (t for t, kws in _TONE_TRIGGERS.items() if any(k in prompt_lower for k in kws)),
            "professional",
        )

    site_name = _extract_site_name(prompt, industry)
    brief = SiteBrief(
        site_name=site_name,
        tagline=f"{site_name} — {primary_goal}",
        industry=industry,
        target_audience=audience,
        goals=[primary_goal, "communicate the brand clearly", "make contact effortless"],
        sections=sections,
        tone=tone,
    )
    return {"brief": brief}


# ---------------------------------------------------------------------------
# Content node
# ---------------------------------------------------------------------------

_SECTION_TEMPLATES: dict[str, tuple[str, str, str | None]] = {
    # id -> (heading template, body template, cta)
    "hero": (
        "{site_name}",
        "Welcome to {site_name}. We help {audience} {goal}. "
        "Built for people who expect a {tone} experience from start to finish.",
        "Get started",
    ),
    "about": (
        "About {site_name}",
        "{site_name} was created with one purpose: to {goal}. "
        "We focus on {audience}, pairing attention to detail with a {tone} "
        "approach that puts your needs first.",
        None,
    ),
    "services": (
        "What we offer",
        "From first contact to final delivery, {site_name} provides services "
        "designed around {audience}. Every engagement is shaped to {goal} "
        "without unnecessary complexity.",
        "Explore services",
    ),
    "pricing": (
        "Pricing",
        "Simple, transparent plans that scale with you. Pick the option that "
        "fits today and upgrade whenever you are ready.",
        "See plans",
    ),
    "testimonials": (
        "What people say",
        "Don't take our word for it — here is what {audience} say about "
        "working with {site_name}.",
        None,
    ),
    "faq": (
        "Frequently asked questions",
        "Quick answers to the questions we hear most often from {audience}.",
        None,
    ),
    "gallery": (
        "Our work",
        "A selection of recent work from {site_name} — a snapshot of what we "
        "can do for you.",
        None,
    ),
    "contact": (
        "Get in touch",
        "Ready to start? Reach out and {site_name} will get back to you "
        "within one business day.",
        "Contact us",
    ),
}


def content_node(state: WorkflowState) -> WorkflowState:
    """Create website copy and SEO metadata from the brief."""
    brief = state["brief"]
    ctx = {
        "site_name": brief.site_name,
        "audience": brief.target_audience,
        "goal": brief.goals[0],
        "tone": brief.tone,
    }

    sections: list[SectionContent] = []
    for section_id in brief.sections:
        heading_tpl, body_tpl, cta = _SECTION_TEMPLATES.get(
            section_id,
            (section_id.title(), "More about {site_name} coming soon.", None),
        )
        sections.append(
            SectionContent(
                id=section_id,
                heading=heading_tpl.format(**ctx),
                body=body_tpl.format(**ctx),
                cta=cta,
            )
        )

    title = f"{brief.site_name} | {brief.industry.capitalize()}"[:70]
    description = (
        f"{brief.site_name}: we help {brief.target_audience} "
        f"{brief.goals[0]}. Get in touch today."
    )[:160]
    stopwords = {"the", "a", "an", "of", "to", "for", "into", "with", "and", "your", "our", "more"}
    goal_words = [w for w in brief.goals[0].lower().split() if w not in stopwords]
    keywords = list(
        dict.fromkeys(  # de-dupe, keep order
            [brief.industry, brief.site_name.lower(), *goal_words[-2:]]
        )
    )

    content = ContentBundle(
        seo=SEOMetadata(title=title, description=description, keywords=keywords),
        sections=sections,
    )
    return {"content": content}


# ---------------------------------------------------------------------------
# Design node
# ---------------------------------------------------------------------------

_DESIGN_PRESETS: dict[str, DesignTokens] = {
    "restaurant": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#9a3412", secondary="#78350f", accent="#f59e0b",
            background="#fffbeb", surface="#ffffff", text="#1c1917",
        ),
        typography=Typography(heading_font="Playfair Display", body_font="Inter"),
    ),
    "saas": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#4f46e5", secondary="#0ea5e9", accent="#a855f7",
            background="#f8fafc", surface="#ffffff", text="#0f172a",
        ),
        typography=Typography(heading_font="Inter", body_font="Inter"),
    ),
    "portfolio": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#18181b", secondary="#52525b", accent="#e11d48",
            background="#fafafa", surface="#ffffff", text="#18181b",
        ),
        typography=Typography(heading_font="Space Grotesk", body_font="Inter"),
    ),
    "fitness": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#16a34a", secondary="#15803d", accent="#facc15",
            background="#f0fdf4", surface="#ffffff", text="#14532d",
        ),
        typography=Typography(heading_font="Montserrat", body_font="Inter"),
    ),
    "agency": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#1d4ed8", secondary="#1e40af", accent="#f97316",
            background="#eff6ff", surface="#ffffff", text="#172554",
        ),
        typography=Typography(heading_font="Sora", body_font="Inter"),
    ),
    "ecommerce": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#be123c", secondary="#9f1239", accent="#fb7185",
            background="#fff1f2", surface="#ffffff", text="#1c1917",
        ),
        typography=Typography(heading_font="DM Sans", body_font="DM Sans"),
    ),
    "general": DesignTokens(
        layout="single-page",
        palette=ColorPalette(
            primary="#0f766e", secondary="#115e59", accent="#f59e0b",
            background="#f0fdfa", surface="#ffffff", text="#134e4a",
        ),
        typography=Typography(heading_font="Inter", body_font="Inter"),
    ),
}


def design_node(state: WorkflowState) -> WorkflowState:
    """Choose layout, colors and typography tokens for the brief."""
    brief = state["brief"]
    preset = _DESIGN_PRESETS.get(brief.industry, _DESIGN_PRESETS["general"])
    design = preset.model_copy(deep=True)
    if brief.tone == "luxury":
        design.border_radius = "0.25rem"
    elif brief.tone == "playful":
        design.border_radius = "1.5rem"
    return {"design": design}


# ---------------------------------------------------------------------------
# CodeGenerator node
# ---------------------------------------------------------------------------


def _render_section(section: SectionContent, design: DesignTokens, is_hero: bool) -> str:
    e = html.escape
    cta_html = (
        f'\n        <a href="#contact" class="cta-button inline-block mt-6 px-6 py-3 '
        f'font-semibold text-white">{e(section.cta)}</a>'
        if section.cta
        else ""
    )
    if is_hero:
        return f"""    <section id="{e(section.id)}" class="hero py-24 text-center">
      <div class="{design.max_width_class} mx-auto px-6">
        <h1 class="heading-font text-4xl md:text-6xl font-bold tracking-tight">{e(section.heading)}</h1>
        <p class="mt-6 text-lg md:text-xl max-w-2xl mx-auto opacity-80">{e(section.body)}</p>{cta_html}
      </div>
    </section>"""
    return f"""    <section id="{e(section.id)}" class="py-16">
      <div class="{design.max_width_class} mx-auto px-6">
        <h2 class="heading-font text-3xl font-bold">{e(section.heading)}</h2>
        <p class="mt-4 max-w-3xl leading-relaxed opacity-80">{e(section.body)}</p>{cta_html}
      </div>
    </section>"""


def codegen_node(state: WorkflowState) -> WorkflowState:
    """Generate index.html (Tailwind utility classes via CDN) and styles.css."""
    brief, content, design = state["brief"], state["content"], state["design"]
    e = html.escape

    nav_links = "\n          ".join(
        f'<a href="#{e(s.id)}" class="hover:underline opacity-80 hover:opacity-100">{e(s.heading if s.id != "hero" else "Home")}</a>'
        for s in content.sections
    )
    sections_html = "\n\n".join(
        _render_section(s, design, is_hero=(s.id == "hero")) for s in content.sections
    )
    keywords = ", ".join(e(k) for k in content.seo.keywords)

    index_html = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{e(content.seo.title)}</title>
    <meta name="description" content="{e(content.seo.description)}" />
    <meta name="keywords" content="{keywords}" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body class="site-body antialiased">
    <header class="border-b border-black/10">
      <nav class="{design.max_width_class} mx-auto px-6 py-4 flex items-center justify-between">
        <span class="heading-font font-bold text-lg">{e(brief.site_name)}</span>
        <div class="hidden md:flex gap-6 text-sm">
          {nav_links}
        </div>
      </nav>
    </header>

    <main>
{sections_html}
    </main>

    <footer class="border-t border-black/10 py-8 text-center text-sm opacity-70">
      <div class="{design.max_width_class} mx-auto px-6">
        &copy; {e(brief.site_name)} &middot; {e(brief.tagline)}
      </div>
    </footer>
  </body>
</html>
"""

    p, t = design.palette, design.typography
    styles_css = f""":root {{
  --color-primary: {p.primary};
  --color-secondary: {p.secondary};
  --color-accent: {p.accent};
  --color-background: {p.background};
  --color-surface: {p.surface};
  --color-text: {p.text};
  --font-heading: "{t.heading_font}", sans-serif;
  --font-body: "{t.body_font}", sans-serif;
  --radius: {design.border_radius};
}}

.site-body {{
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: {t.base_size_px}px;
}}

.heading-font {{
  font-family: var(--font-heading);
}}

.hero {{
  background: linear-gradient(160deg, var(--color-background), var(--color-surface));
}}

.cta-button {{
  background-color: var(--color-primary);
  border-radius: var(--radius);
}}

.cta-button:hover {{
  background-color: var(--color-secondary);
}}
"""

    return {"files": {"index.html": index_html, "styles.css": styles_css}}


# ---------------------------------------------------------------------------
# Reviewer node
# ---------------------------------------------------------------------------


def reviewer_node(state: WorkflowState) -> WorkflowState:
    """Validate required sections in the generated HTML and collect notes."""
    brief = state["brief"]
    files = state.get("files") or {}
    index_html = files.get("index.html", "")
    notes: list[str] = []

    expected = list(dict.fromkeys(REQUIRED_SECTIONS + brief.sections))
    missing = [
        s for s in expected if f'id="{s}"' not in index_html
    ]
    for section in missing:
        notes.append(f"Required section '{section}' is missing from index.html.")

    if "<title>" not in index_html:
        notes.append("index.html is missing a <title> tag.")
    if 'name="description"' not in index_html:
        notes.append("index.html is missing a meta description.")
    if "styles.css" not in files:
        notes.append("styles.css was not generated.")

    content = state.get("content")
    if content and len(content.seo.description) > 160:
        notes.append("SEO description exceeds 160 characters.")

    passed = not missing and not notes
    if passed:
        notes.append("All required sections and metadata are present.")
        if brief.industry == "general":
            notes.append(
                "Improvement: the prompt did not match a known industry; "
                "add more detail for tailored copy and design."
            )
        if "testimonials" not in brief.sections:
            notes.append(
                "Improvement: consider adding a testimonials section for social proof."
            )

    return {"review": ReviewReport(passed=passed, missing_sections=missing, notes=notes)}
