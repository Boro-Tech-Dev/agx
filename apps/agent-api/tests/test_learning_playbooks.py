"""Learning playbook loader tests."""

from __future__ import annotations

import pytest

from app.learning.playbook_loader import (
    all_step_ids,
    catalog_entries,
    load_playbook,
    load_playbook_raw,
    merge_brand_overlay,
    step_completed,
    step_count,
)


def test_catalog_has_pharma_and_roles():
    ids = {e['id'] for e in catalog_entries()}
    assert 'pharma_knowledge' in ids
    assert 'account_management_pharma' in ids
    assert 'project_management_non_pharma' in ids


def test_step_ids_unique_within_playbook():
    for entry in catalog_entries():
        pb = load_playbook_raw(entry['id'])
        steps = all_step_ids(pb)
        assert len(steps) == len(set(steps)), entry['id']


def test_brand_overlay_appends_mission():
    base = load_playbook_raw('account_management_pharma')
    merged = merge_brand_overlay(base, 'advsm-hcp')
    assert step_count(merged) >= step_count(base)


def test_am_pharma_requires_pharma_knowledge():
    pb = load_playbook_raw('account_management_pharma')
    reqs = pb.get('requires') or []
    assert any(r.get('playbook_id') == 'pharma_knowledge' for r in reqs)


def test_pharma_knowledge_has_activity_content():
    pb = load_playbook('pharma_knowledge')
    assert step_count(pb) >= 12
    step = next(s for m in pb['missions'] for s in m['steps'] if s['id'] == 's1_intro')
    assert step.get('activity', {}).get('sections')


def test_step_completion_alias():
    assert step_completed('s2_platform_gov', {'s2_governance'})
    assert not step_completed('s2_platform_gov', set())


def test_catalog_includes_total_steps():
    pharma = next(e for e in catalog_entries() if e['id'] == 'pharma_knowledge')
    assert pharma.get('total_steps', 0) >= 12
