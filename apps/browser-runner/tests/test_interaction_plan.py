"""Tests for interaction_plan models and apply_interaction_plan."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from tools.capture_helpers import apply_interaction_plan, click_interaction_plan_target
from tools.interaction_plan import InteractionPlanStep, interaction_plan_max_steps, validate_plan_length


def test_click_step_strips_selector() -> None:
    s = InteractionPlanStep(action='click', selector='  #foo  ')
    assert s.selector == '#foo'


def test_wait_step_requires_ms() -> None:
    with pytest.raises(ValueError):
        InteractionPlanStep(action='wait_ms')


def test_validate_plan_length(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('WEB_INTERACTION_PLAN_MAX_STEPS', '2')
    plan = [
        InteractionPlanStep(action='click', selector='a'),
        InteractionPlanStep(action='wait_ms', wait_ms=100),
    ]
    validate_plan_length(plan)
    with pytest.raises(ValueError):
        validate_plan_length(
            plan
            + [
                InteractionPlanStep(action='click', selector='b'),
            ]
        )


def test_interaction_plan_max_steps_hard_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('WEB_INTERACTION_PLAN_MAX_STEPS', '99')
    assert interaction_plan_max_steps() == 50


def test_apply_interaction_plan_two_clicks() -> None:
    async def run() -> None:
        page = MagicMock()

        def make_loc() -> MagicMock:
            loc = MagicMock()
            cand = MagicMock()
            cand.is_visible = AsyncMock(return_value=True)
            cand.scroll_into_view_if_needed = AsyncMock()
            cand.click = AsyncMock()
            loc.count = AsyncMock(return_value=1)
            loc.nth = MagicMock(return_value=cand)
            return loc

        loc_a = make_loc()
        loc_b = make_loc()
        page.locator = MagicMock(side_effect=[loc_a, loc_b])
        await apply_interaction_plan(
            page,
            [
                InteractionPlanStep(action='click', selector='#a'),
                InteractionPlanStep(action='click', selector='#b'),
            ],
        )
        assert page.locator.call_count == 2
        assert page.locator.call_args_list[0][0][0] == '#a'
        assert page.locator.call_args_list[1][0][0] == '#b'

    asyncio.run(run())


def test_click_interaction_plan_force_click_on_overlay_intercept() -> None:
    async def run() -> None:
        page = MagicMock()
        loc = MagicMock()
        cand = MagicMock()
        cand.is_visible = AsyncMock(return_value=True)
        cand.scroll_into_view_if_needed = AsyncMock()
        calls: list[dict[str, object]] = []

        async def click_impl(*_a: object, **kwargs: object) -> None:
            calls.append(kwargs)
            if not kwargs.get('force'):
                raise RuntimeError(
                    'Locator.click: Timeout 300ms exceeded.\n'
                    '- <div class="onetrust-pc-dark-filter ot-fade-in"></div> intercepts pointer events'
                )

        cand.click = AsyncMock(side_effect=click_impl)
        loc.count = AsyncMock(return_value=1)
        loc.nth = MagicMock(return_value=cand)
        page.locator = MagicMock(return_value=loc)
        await click_interaction_plan_target(page, 'button#onetrust-accept-btn-handler', 2000)
        assert len(calls) == 2
        assert calls[0].get('force') is not True
        assert calls[1].get('force') is True

    asyncio.run(run())


def test_upload_step_validates_extension() -> None:
    import base64

    tiny = base64.standard_b64encode(b'hello').decode('ascii')
    with pytest.raises(ValueError, match='extension'):
        InteractionPlanStep(
            action='upload',
            selector='input',
            file_base64=tiny,
            filename='bad.exe',
        )


def test_apply_interaction_plan_click_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    async def run() -> None:
        page = MagicMock()
        loc = MagicMock()
        cand = MagicMock()
        cand.is_visible = AsyncMock(return_value=True)
        cand.scroll_into_view_if_needed = AsyncMock()
        cand.click = AsyncMock(side_effect=RuntimeError('timeout'))
        loc.count = AsyncMock(return_value=1)
        loc.nth = MagicMock(return_value=cand)
        page.locator = MagicMock(return_value=loc)
        monkeypatch.setattr('tools.capture_helpers.NAV_TIMEOUT_MS', 300)
        with pytest.raises(HTTPException) as ei:
            await apply_interaction_plan(
                page,
                [InteractionPlanStep(action='click', selector='#missing')],
            )
        assert ei.value.status_code == 502
        assert 'interaction_plan' in ei.value.detail

    asyncio.run(run())
