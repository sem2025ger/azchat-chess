"""Tests for coffee shop menu item generation (Menu Items Quality MVP)."""

from app.graph.workflow import run_workflow

COFFEE_PROMPT = "Build a website for a coffee shop"

EXPECTED_ITEMS = {
    "Espresso": "€2.50",
    "Cappuccino": "€3.50",
    "Flat White": "€3.80",
    "Latte": "€3.90",
    "Cold Brew": "€4.20",
    "Matcha Latte": "€4.50",
    "Croissant": "€2.80",
    "Cheesecake": "€4.90",
    "Sandwich": "€6.50",
}


def _menu_section(state):
    return next(s for s in state["content"].sections if s.heading == "Our Menu")


def test_coffee_shop_menu_has_specific_items():
    state = run_workflow(COFFEE_PROMPT)
    assert state["brief"].industry == "coffee_shop"
    menu = _menu_section(state)
    by_name = {item.name: item for item in menu.items}
    for name in ("Espresso", "Cappuccino", "Latte", "Croissant"):
        assert name in by_name
    assert set(by_name) == set(EXPECTED_ITEMS)
    for name, price in EXPECTED_ITEMS.items():
        assert by_name[name].price == price
        assert by_name[name].description


def test_menu_items_and_prices_rendered_in_html():
    state = run_workflow(COFFEE_PROMPT)
    index_html = state["files"]["index.html"]
    assert "Our Menu" in index_html
    for name, price in EXPECTED_ITEMS.items():
        assert name in index_html
        assert price in index_html
    assert "menu-card" in index_html
    assert "grid" in index_html
    assert state["review"].passed is True


def test_coffee_shop_does_not_use_restaurant_co():
    brief = run_workflow(COFFEE_PROMPT)["brief"]
    assert brief.site_name == "Bean & Brew"
    assert "Restaurant Co." not in brief.site_name


def test_opening_hours_still_appears_when_requested():
    state = run_workflow("Build a website for a coffee shop with opening hours")
    assert "hours" in state["brief"].sections
    index_html = state["files"]["index.html"]
    assert 'id="hours"' in index_html
    assert "Opening Hours" in index_html
    # menu items coexist with the hours section
    assert "Espresso" in index_html


def test_non_coffee_prompts_get_no_coffee_menu_items():
    state = run_workflow("A website for a local Italian restaurant")
    assert state["brief"].industry == "restaurant"
    assert all(s.items is None for s in state["content"].sections)
    index_html = state["files"]["index.html"]
    assert "Matcha Latte" not in index_html
    assert "€2.50" not in index_html
