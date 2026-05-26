from __future__ import annotations

DOCUMENT_KINDS = frozenset(
    {
        'timeline',
        'brief',
        'estimate',
        'concept',
        'changeorder',
        'contract',
        'spec',
        'general',
        'clinical_note',
        'lab_report',
        'imaging_report',
        'scenario',
        'omnichannel_plan',
        'veeva_suite',
    }
)


def normalize_document_kind(value: str | None) -> str:
    k = (value or 'general').strip().lower()
    if k not in DOCUMENT_KINDS:
        raise ValueError(f'invalid document_kind: {value!r}')
    return k
