"""Unit tests for HCP/cookie gate dismissal helpers."""

from types import SimpleNamespace

from tools.gate_dismiss import (
    GateDismissResult,
    affirmative_hcp_text_labels,
    is_affirmative_hcp_name,
    _should_run_gates,
)


def test_affirmative_hcp_yes_variants() -> None:
    assert is_affirmative_hcp_name('Yes, I am a US healthcare professional')
    assert is_affirmative_hcp_name("Yes, I'm a healthcare professional")
    assert is_affirmative_hcp_name('I am a healthcare professional')


def test_negative_hcp_not_professional() -> None:
    assert not is_affirmative_hcp_name('No, I am not a US healthcare professional')
    assert not is_affirmative_hcp_name('I am not a healthcare professional')
    assert not is_affirmative_hcp_name('')


def test_continue_as_hcp() -> None:
    assert is_affirmative_hcp_name('Continue as HCP')


def test_affirmative_hcp_text_labels() -> None:
    labels = affirmative_hcp_text_labels()
    assert 'Yes, I am a US healthcare professional' in labels
    assert all(is_affirmative_hcp_name(l) for l in labels)


def test_gateway_div_text_matches_affirmative() -> None:
    """Blueprint Ayvakit gate uses div.btn.gateway inner text, not button role."""
    ayvakit_yes = 'Yes, I am a US healthcare professional'
    assert is_affirmative_hcp_name(ayvakit_yes)
    assert not is_affirmative_hcp_name('No, I am not a US healthcare professional')


def test_should_run_gates() -> None:
    off = SimpleNamespace(consent_auto_clicks=False, auto_dismiss_gates=False)
    assert not _should_run_gates(off, auto_dismiss_gates=False)

    staging_auto = SimpleNamespace(consent_auto_clicks=False, auto_dismiss_gates=True)
    assert _should_run_gates(staging_auto, auto_dismiss_gates=False)

    consent_only = SimpleNamespace(consent_auto_clicks=True, auto_dismiss_gates=False)
    assert _should_run_gates(consent_only, auto_dismiss_gates=False)

    crawl_flag = SimpleNamespace(consent_auto_clicks=False, auto_dismiss_gates=False)
    assert _should_run_gates(crawl_flag, auto_dismiss_gates=True)


def test_gate_dismiss_result_aggregation() -> None:
    r = GateDismissResult()
    r.record_hcp()
    r.record_cookie()
    r.record_cookie()
    r.record_extra()
    assert r.overlay_clicks_attempted == 4
    assert r.hcp_clicks == 1
    assert r.cookie_clicks == 2
    assert r.extra_clicks == 1
    d = r.to_gate_dismissal_dict()
    assert d['overlay_clicks_attempted'] == 4
    assert d['hcp_clicks'] == 1
