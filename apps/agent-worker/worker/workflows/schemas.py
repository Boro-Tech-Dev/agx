# Bounds for structured JSON generation (Ollama constrained decoding + UX). Keep vendor copy in sync.
PM_MAX_SUMMARY_LENGTH = 12000
PM_MAX_TASKS = 16
PM_MAX_RISKS = 10
PM_MAX_COSTS = 10
PM_MAX_ANOMALIES = 10
PM_MAX_DECISIONS = 10
PM_MAX_STRING_LIST = 12  # assumptions, open_questions, recommended_next_actions, reflections
PM_MAX_TASK_DEPS = 16
PM_MAX_ACCEPTANCE_CRITERIA = 12

# KITT triage / intake: same top-level shape as PM business, smaller caps for small local models (gemma3:270m, etc.).
KITT_MAX_SUMMARY_LENGTH = 4096
KITT_MAX_TASKS = 6
KITT_MAX_RISKS = 5
KITT_MAX_COSTS = 4
KITT_MAX_ANOMALIES = 4
KITT_MAX_DECISIONS = 4
KITT_MAX_STRING_LIST = 6
KITT_MAX_TASK_DEPS = 6
KITT_MAX_ACCEPTANCE_CRITERIA = 6

# Shared PM list item shapes (business + personal). Opaque {} rows were invalid UX; require a readable anchor field.
PM_TASK_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "minLength": 1,
            "description": "Short actionable task title; prefer imperative verb + object. Include owner or due in fields when the input states them.",
        },
        "description": {"type": "string"},
        "priority": {"type": "string", "description": "e.g. low, medium, high"},
        "status": {"type": "string", "description": "e.g. not_started, in_progress, done, open"},
        "owner": {"type": "string"},
        "due_date": {"type": "string"},
        "dependencies": {
            "type": "array",
            "maxItems": PM_MAX_TASK_DEPS,
            "items": {"type": "string"},
        },
        "acceptance_criteria": {
            "type": "array",
            "maxItems": PM_MAX_ACCEPTANCE_CRITERIA,
            "items": {"type": "string"},
        },
    },
    "required": ["title"],
}

PM_RISK_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "risk": {
            "type": "string",
            "minLength": 1,
            "description": "One delivery or execution risk statement.",
        },
        "impact": {"type": "string", "description": "e.g. low, medium, high"},
        "likelihood": {"type": "string", "description": "e.g. low, medium, high"},
        "mitigation": {"type": "string"},
    },
    "required": ["risk"],
}

PM_COST_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "minLength": 1, "description": "Cost line label (e.g. rush fee, extra hours)."},
        "cost": {"type": "string"},
        "description": {"type": "string"},
        "note": {"type": "string"},
        "amount": {"type": "string"},
    },
    "required": ["title"],
}

PM_ANOMALY_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "minLength": 1, "description": "Short label for the anomaly or surprise."},
        "anomaly": {"type": "string"},
        "note": {"type": "string"},
        "description": {"type": "string"},
    },
    "required": ["title"],
}

PM_DECISION_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "minLength": 1, "description": "What was decided or proposed."},
        "decision": {"type": "string"},
        "description": {"type": "string"},
        "status": {"type": "string"},
    },
    "required": ["title"],
}

# KITT: task rows use tighter nested list caps than PM business.
KITT_TASK_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 240,
            "description": "Short imperative task for triage; one line. Owner/due only if stated in intake.",
        },
        "description": {"type": "string", "maxLength": 1200},
        "priority": {"type": "string", "description": "e.g. low, medium, high"},
        "status": {"type": "string", "description": "e.g. not_started, in_progress, done, open"},
        "owner": {"type": "string", "maxLength": 200},
        "due_date": {"type": "string", "maxLength": 80},
        "dependencies": {
            "type": "array",
            "maxItems": KITT_MAX_TASK_DEPS,
            "items": {"type": "string", "maxLength": 160},
        },
        "acceptance_criteria": {
            "type": "array",
            "maxItems": KITT_MAX_ACCEPTANCE_CRITERIA,
            "items": {"type": "string", "maxLength": 240},
        },
    },
    "required": ["title"],
}

KITT_SCHEMA_TRIAGE = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "maxLength": KITT_MAX_SUMMARY_LENGTH,
            "description": "Brief triage synthesis (no markdown tables). Capture only what intake implies; HAL9000/PM runs handle deep synthesis later.",
        },
        "project_context": {
            "type": "string",
            "maxLength": 2000,
            "description": "One short paragraph of context from intake; omit if redundant with summary.",
        },
        "assumptions": {
            "type": "array",
            "maxItems": KITT_MAX_STRING_LIST,
            "description": "Triage-only explicit assumptions; keep each entry short and distinct.",
            "items": {"type": "string", "maxLength": 400},
        },
        "open_questions": {
            "type": "array",
            "maxItems": KITT_MAX_STRING_LIST,
            "description": "Blocking unknowns for the next PM pass; not task assignments.",
            "items": {"type": "string", "maxLength": 400},
        },
        "decisions": {
            "type": "array",
            "maxItems": KITT_MAX_DECISIONS,
            "description": "Only if intake states a decision; otherwise leave empty.",
            "items": PM_DECISION_ITEM_SCHEMA,
        },
        "tasks": {
            "type": "array",
            "maxItems": KITT_MAX_TASKS,
            "description": "Immediate follow-ups only; defer broad planning to HAL9000.",
            "items": KITT_TASK_ITEM_SCHEMA,
        },
        "risks": {
            "type": "array",
            "maxItems": KITT_MAX_RISKS,
            "description": "Top delivery risks implied by intake; keep statements short.",
            "items": PM_RISK_ITEM_SCHEMA,
        },
        "costs": {
            "type": "array",
            "maxItems": KITT_MAX_COSTS,
            "description": "Only if intake mentions budget/contract impact.",
            "items": PM_COST_ITEM_SCHEMA,
        },
        "anomalies": {
            "type": "array",
            "maxItems": KITT_MAX_ANOMALIES,
            "description": "Notable surprises in intake worth flagging before PM.",
            "items": PM_ANOMALY_ITEM_SCHEMA,
        },
        "recommended_next_actions": {
            "type": "array",
            "maxItems": KITT_MAX_STRING_LIST,
            "description": "Short next steps (sync, spike, doc); must not duplicate a task title.",
            "items": {"type": "string", "maxLength": 320},
        },
    },
    "required": ["summary", "tasks", "risks", "recommended_next_actions"],
}

PM_SCHEMA_BUSINESS = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "maxLength": PM_MAX_SUMMARY_LENGTH,
            "description": "Plain prose synthesis (no markdown tables); project/product terms only. Avoid copying task titles verbatim. Do not reframe pasted lyrics or quotes as the submitter's personal emotional state.",
        },
        "project_context": {"type": "string"},
        "assumptions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "decisions": {
            "type": "array",
            "maxItems": PM_MAX_DECISIONS,
            "description": "Bounded list; each decision title must be distinct.",
            "items": PM_DECISION_ITEM_SCHEMA,
        },
        "tasks": {
            "type": "array",
            "maxItems": PM_MAX_TASKS,
            "description": "Concrete follow-ups and work items (engineering, design, PM, ops). Not personal wellness or mental-health actions. Bounded list; no duplicate titles.",
            "items": PM_TASK_ITEM_SCHEMA,
        },
        "risks": {
            "type": "array",
            "maxItems": PM_MAX_RISKS,
            "description": "Delivery and execution risks: schedule slip, dependencies, quality, security, compliance ambiguity, key-person availability—not budget increases, contract rate changes, scope creep, or resourcing cost. Put those in costs. Bounded list; no duplicate risk statements.",
            "items": PM_RISK_ITEM_SCHEMA,
        },
        "costs": {
            "type": "array",
            "maxItems": PM_MAX_COSTS,
            "description": "Budget, contract, or scope-impact lines: extra hours, rate changes, added roles, tooling spend, license deltas, scope creep that changes cost—not generic schedule risk. Bounded list; no duplicate titles.",
            "items": PM_COST_ITEM_SCHEMA,
        },
        "anomalies": {
            "type": "array",
            "maxItems": PM_MAX_ANOMALIES,
            "description": "Bounded list; no duplicate titles.",
            "items": PM_ANOMALY_ITEM_SCHEMA,
        },
        "recommended_next_actions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Concrete next steps; must not repeat a task title verbatim. Project/product follow-ups (spike, ticket, sync). Not clinical advice or therapy. Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
    },
    "required": ["summary", "tasks", "risks", "recommended_next_actions"],
}

PM_SCHEMA_PERSONAL = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "maxLength": PM_MAX_SUMMARY_LENGTH,
            "description": "Plain prose qualitative synthesis (no markdown tables). Curated material may be creative context—not clinical facts about the user.",
        },
        "project_context": {"type": "string"},
        "assumptions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "open_questions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Real questions or unknowns—not imperative to-do lines (not therapy prompts). Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "decisions": {
            "type": "array",
            "maxItems": PM_MAX_DECISIONS,
            "description": "Bounded list; each decision title must be distinct.",
            "items": PM_DECISION_ITEM_SCHEMA,
        },
        "tasks": {
            "type": "array",
            "maxItems": PM_MAX_TASKS,
            "description": "Concrete next steps for the user's goal. Not clinical or mental-health treatment tasks. Bounded list; no duplicate titles.",
            "items": PM_TASK_ITEM_SCHEMA,
        },
        "risks": {
            "type": "array",
            "maxItems": PM_MAX_RISKS,
            "description": "Tensions or tradeoffs (time, accuracy, rights, misunderstanding)—not money, budget, or scope-economics; put those in costs. Bounded list; no duplicate risk statements.",
            "items": PM_RISK_ITEM_SCHEMA,
        },
        "costs": {
            "type": "array",
            "maxItems": PM_MAX_COSTS,
            "description": "Budget or scope-economics for the user's goal (extra spend, paid tools, commissioned work)—not abstract 'risk of delay' without a cost angle. Bounded list; no duplicate titles.",
            "items": PM_COST_ITEM_SCHEMA,
        },
        "anomalies": {
            "type": "array",
            "maxItems": PM_MAX_ANOMALIES,
            "description": "Notable one-off details, unique references, or standout facts about the material or plan. Bounded list; no duplicate titles.",
            "items": PM_ANOMALY_ITEM_SCHEMA,
        },
        "recommended_next_actions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Practical follow-ups; must not repeat a task title verbatim. Not clinical advice or therapy. Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "reflections": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Optional brief qualitative notes or angles (not persisted as separate DB rows). Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
    },
    "required": ["summary", "tasks", "risks", "recommended_next_actions"],
}

CLINIC_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "maxLength": PM_MAX_SUMMARY_LENGTH,
            "description": "Plain-language recap of what appears in the supplied health-record text and memories. Do not diagnose or prescribe; frame as organization and questions to verify with a licensed clinician.",
        },
        "project_context": {"type": "string"},
        "assumptions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Explicit assumptions about missing dates, unclear units, or ambiguous abbreviations in the record. Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "open_questions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Questions the patient or caregiver should ask their care team (clarify results, timing, follow-up). Not therapy prompts. Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "decisions": {
            "type": "array",
            "maxItems": PM_MAX_DECISIONS,
            "description": "Bounded list; each entry should be distinct.",
            "items": {"type": "object"},
        },
        "tasks": {
            "type": "array",
            "maxItems": PM_MAX_TASKS,
            "description": "Concrete records to obtain, appointments to schedule, or information to verify with clinicians—not treatment steps or medication changes. Bounded list; no duplicate items.",
            "items": {"type": "object"},
        },
        "risks": {
            "type": "array",
            "maxItems": PM_MAX_RISKS,
            "description": "Uncertainties, contradictions, missing follow-up, or safety-relevant gaps in care documentation—not billing/coverage/cost logistics; use costs for those. Bounded list; no duplicate items.",
            "items": {
                "type": "object",
                "description": "A single uncertainty or safety-relevant gap in the documentation (not a diagnosis).",
            },
        },
        "costs": {
            "type": "array",
            "maxItems": PM_MAX_COSTS,
            "description": "Care logistics with a cost or coverage angle (copay, prior auth, out-of-pocket, travel to specialty)—not clinical uncertainty. Bounded list; no duplicate items.",
            "items": {"type": "object"},
        },
        "anomalies": {
            "type": "array",
            "maxItems": PM_MAX_ANOMALIES,
            "description": "Notable values, dates, or phrases in the text worth flagging for human review (e.g. out-of-range lab if explicitly stated in the paste). Bounded list; no duplicate items.",
            "items": {"type": "object"},
        },
        "recommended_next_actions": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Bring-to-visit bullets: verify with clinician, obtain records, reconcile medications with pharmacist—never dosage changes or self-treatment. Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
        "reflections": {
            "type": "array",
            "maxItems": PM_MAX_STRING_LIST,
            "description": "Optional brief notes on how sections of the record relate (not persisted as separate DB rows). Bounded list; each entry must be distinct.",
            "items": {"type": "string"},
        },
    },
    "required": ["summary", "tasks", "risks", "recommended_next_actions"],
}

# Backward-compatible name for imports / default router schema
PM_SCHEMA = PM_SCHEMA_BUSINESS

BUILDER_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {"type": "string"},
        "repo_summary": {"type": "object"},
        "implementation_plan": {"type": "array", "items": {"type": "object"}},
        "files_to_create": {"type": "array", "items": {"type": "string"}},
        "files_to_modify": {"type": "array", "items": {"type": "string"}},
        "patches": {"type": "array", "items": {"type": "object"}},
        "risks": {"type": "array", "items": {"type": "string"}},
        "validation_commands": {"type": "array", "items": {"type": "string"}},
        "rollback_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["intent", "implementation_plan", "validation_commands", "rollback_notes"],
}
CANON_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "confidence": {"type": "string"},
        "supporting_memories": {"type": "array", "items": {"type": "object"}},
        "related_decisions": {"type": "array", "items": {"type": "object"}},
        "contradictions_or_uncertainties": {"type": "array", "items": {"type": "string"}},
        "recommended_updates_to_canon": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "confidence", "supporting_memories"],
}
FORGE_SCHEMA = {
    "type": "object",
    "properties": {
        "portfolio_summary": {"type": "string"},
        "opportunities": {"type": "array", "items": {"type": "object"}},
        "recommended_next_actions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["portfolio_summary", "opportunities", "recommended_next_actions"],
}
SCHEMAS = {
    "pm": PM_SCHEMA_BUSINESS,
    "synergy": PM_SCHEMA_PERSONAL,
    "clinic": CLINIC_SCHEMA,
    "builder": BUILDER_SCHEMA,
    "canon": CANON_SCHEMA,
    "forge": FORGE_SCHEMA,
    "kitt": KITT_SCHEMA_TRIAGE,
    "eddie": FORGE_SCHEMA,
    "bubs": PM_SCHEMA_PERSONAL,
}
