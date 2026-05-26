from worker.continuation import compose_user_content

from .common import (
    context_messages,
    fallback,
    event,
    pm_like_loose_shell_from_router_content,
    pm_like_should_recover_loose_from_parse_failure,
    route_model,
)
from .schemas import KITT_SCHEMA_TRIAGE
from .kitt_router_shape import kitt_coerce_router_shape
from .pm_prose_sections import merge_prose_sections_into_pm_if_lists_empty
from .pm_structured_cleanup import (
    attach_parse_warning_if_substantive_summary_empty_core_lists,
    normalize_pm_router_payload,
    pm_lists_effectively_empty,
    sanitize_pm_placeholder_rows,
)
from .pm_user_backfill import backfill_pm_lists_from_user_text

_LOOSE_UNPARSED_HINT = (
    'Model returned prose without usable JSON lists; structured panels may be incomplete. '
    'See Model/router diagnostics.'
)

_KITT_SPARSE_LISTS_MSG = (
    '[kitt_sparse_lists] Summary is present but tasks, risks, and recommended next actions are all empty. '
    'Check Model/router diagnostics or retry with a shorter request.'
)


def _kitt_flag_sparse_lists(run_id: str, out: dict | None) -> None:
    """Emit warning + event when triage core lists are empty but summary looks substantive."""
    if not isinstance(out, dict) or out.get('_fallback_scaffold'):
        return
    summary = (out.get('summary') or '').strip()
    if len(summary) < 40:
        return
    if not pm_lists_effectively_empty(out):
        return
    rna = out.get('recommended_next_actions')
    if isinstance(rna, list) and any(isinstance(x, str) and x.strip() for x in rna):
        return
    codes = out.get('kitt_parse_codes')
    if not isinstance(codes, list):
        codes = []
    if 'kitt_sparse_lists' not in codes:
        codes.append('kitt_sparse_lists')
    out['kitt_parse_codes'] = codes
    prev = (out.get('parse_warning') or '').strip()
    out['parse_warning'] = (prev + ' ' if prev else '') + _KITT_SPARSE_LISTS_MSG
    event(
        run_id,
        'workflow.kitt.sparse_output',
        'KITT triage lists empty while summary is substantive',
        {'summary_chars': len(summary), 'code': 'kitt_sparse_lists'},
    )


def _user_blob(inp) -> str:
    if not isinstance(inp, dict):
        return ''
    return compose_user_content(inp) or ''


async def run(run_id, workflow, content, project_key, inp, mems):
    event(
        run_id,
        'workflow.kitt',
        'KITT business-mode run',
        {'project_key': project_key},
    )
    content_for = (content or '').rstrip()
    schema = KITT_SCHEMA_TRIAGE
    user_only = _user_blob(inp)

    routed = await route_model(
        'kitt',
        workflow,
        context_messages('kitt', content_for, mems, None, pm_kind='business'),
        schema=schema,
        run_id=run_id,
    )
    raw_content = routed.get('content') if isinstance(routed.get('content'), str) else ''
    if isinstance(routed.get('parsed'), dict):
        parsed = routed['parsed']
        normalize_pm_router_payload(parsed, raw_content)
        kitt_coerce_router_shape(parsed)
        if sanitize_pm_placeholder_rows(parsed):
            event(
                run_id,
                'workflow.kitt.sanitize',
                'Removed vacuous structured rows (e.g. empty objects) before backfill',
                {},
            )
        if backfill_pm_lists_from_user_text(parsed, user_only):
            event(
                run_id,
                'workflow.kitt.backfill',
                'Structured lists were empty; filled from Update/Cost/Impact lines in the user request',
                {'user_chars': len(user_only)},
            )
        if merge_prose_sections_into_pm_if_lists_empty(parsed):
            event(
                run_id,
                'workflow.kitt.prose_sections',
                'Filled structured lists from markdown sections in model prose',
                {},
            )
        attach_parse_warning_if_substantive_summary_empty_core_lists(parsed)
        _kitt_flag_sparse_lists(run_id, parsed)
        return parsed, routed

    if pm_like_should_recover_loose_from_parse_failure(routed):
        routed.pop('error', None)
        loose = pm_like_loose_shell_from_router_content(
            run_id,
            routed,
            raw_content,
            user_only,
            workflow_evt_prefix='workflow.kitt',
            loose_unparsed_hint=_LOOSE_UNPARSED_HINT,
            post_normalize_pre_sanitize=kitt_coerce_router_shape,
        )
        _kitt_flag_sparse_lists(run_id, loose)
        return loose, routed

    if routed.get('parse_failed') and not routed.get('error'):
        routed['error'] = 'Schema parse failed: model-router could not parse JSON output.'
    if routed.get('error'):
        fb = fallback('kitt', user_only, {}, mems, router_error=routed.get('error'))
        return (fb if isinstance(fb, dict) else None), routed
    loose = {
        'summary': routed.get('content', ''),
        'tasks': [],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    normalize_pm_router_payload(loose, raw_content)
    kitt_coerce_router_shape(loose)
    sanitize_pm_placeholder_rows(loose)
    if backfill_pm_lists_from_user_text(loose, user_only):
        event(
            run_id,
            'workflow.kitt.backfill',
            'Structured lists were empty; filled from Update/Cost/Impact lines (unparsed model output)',
            {'user_chars': len(user_only)},
        )
    if merge_prose_sections_into_pm_if_lists_empty(loose):
        event(
            run_id,
            'workflow.kitt.prose_sections',
            'Filled structured lists from markdown sections in model prose',
            {},
        )
    attach_parse_warning_if_substantive_summary_empty_core_lists(loose)
    if pm_lists_effectively_empty(loose):
        if not loose.get('parse_warning'):
            loose['parse_warning'] = _LOOSE_UNPARSED_HINT
        loose['_loose_unparsed_marker'] = True
    _kitt_flag_sparse_lists(run_id, loose)
    return loose, routed
