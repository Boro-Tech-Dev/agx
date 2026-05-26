from worker.continuation import compose_user_content

from .common import (
    context_messages,
    fallback,
    event,
    pm_like_loose_shell_from_router_content,
    pm_like_should_recover_loose_from_parse_failure,
    route_model,
)
from .pm_prose_sections import merge_prose_sections_into_pm_if_lists_empty
from .pm_structured_cleanup import (
    attach_parse_warning_if_substantive_summary_empty_core_lists,
    normalize_pm_router_payload,
    pm_lists_effectively_empty,
    sanitize_pm_placeholder_rows,
)
from .pm_user_backfill import backfill_pm_lists_from_user_text
from .schemas import PM_SCHEMA_PERSONAL

_LOOSE_UNPARSED_HINT = (
    'Model returned prose without usable JSON lists; structured panels may be incomplete. '
    'See Model/router diagnostics.'
)


def _user_blob(inp) -> str:
    if not isinstance(inp, dict):
        return ''
    return compose_user_content(inp) or ''


async def run(run_id, workflow, content, project_key, inp, mems):
    event(
        run_id,
        'workflow.synergy',
        'Synergy personal-mode run',
        {'mode': 'personal', 'project_key': project_key},
    )
    schema = PM_SCHEMA_PERSONAL
    user_only = _user_blob(inp)
    routed = await route_model(
        'synergy',
        workflow,
        context_messages('synergy', content, mems, None),
        schema=schema,
        run_id=run_id,
    )
    raw_content = routed.get('content') if isinstance(routed.get('content'), str) else ''

    if isinstance(routed.get('parsed'), dict):
        out = routed['parsed']
        normalize_pm_router_payload(out, raw_content)
        if sanitize_pm_placeholder_rows(out):
            event(
                run_id,
                'workflow.synergy.sanitize',
                'Removed vacuous structured rows (e.g. empty objects) before backfill',
                {},
            )
        if backfill_pm_lists_from_user_text(out, user_only):
            event(
                run_id,
                'workflow.synergy.backfill',
                'Structured lists were empty; filled from Update/Cost/Impact lines in the user request',
                {'user_chars': len(user_only)},
            )
        if merge_prose_sections_into_pm_if_lists_empty(out):
            event(
                run_id,
                'workflow.synergy.prose_sections',
                'Filled structured lists from markdown sections in model prose',
                {},
            )
        attach_parse_warning_if_substantive_summary_empty_core_lists(out)
        return out, routed

    if pm_like_should_recover_loose_from_parse_failure(routed):
        routed.pop('error', None)
        loose = pm_like_loose_shell_from_router_content(
            run_id,
            routed,
            raw_content,
            user_only,
            workflow_evt_prefix='workflow.synergy',
            loose_unparsed_hint=_LOOSE_UNPARSED_HINT,
        )
        return loose, routed

    if routed.get('parse_failed') and not routed.get('error'):
        routed['error'] = 'Schema parse failed: model-router could not parse JSON output.'

    if routed.get('error'):
        return fallback('synergy', user_only, {}, mems), routed

    loose = {
        'summary': routed.get('content', ''),
        'tasks': [],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    normalize_pm_router_payload(loose, raw_content)
    sanitize_pm_placeholder_rows(loose)
    if backfill_pm_lists_from_user_text(loose, user_only):
        event(
            run_id,
            'workflow.synergy.backfill',
            'Structured lists were empty; filled from Update/Cost/Impact lines (unparsed model output)',
            {'user_chars': len(user_only)},
        )
    if merge_prose_sections_into_pm_if_lists_empty(loose):
        event(
            run_id,
            'workflow.synergy.prose_sections',
            'Filled structured lists from markdown sections in model prose',
            {},
        )
    attach_parse_warning_if_substantive_summary_empty_core_lists(loose)
    if pm_lists_effectively_empty(loose):
        if not loose.get('parse_warning'):
            loose['parse_warning'] = _LOOSE_UNPARSED_HINT
        loose['_loose_unparsed_marker'] = True
    return loose, routed
