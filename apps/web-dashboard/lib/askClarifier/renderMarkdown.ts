import type { AskClarifierResult } from './types';

function bullet(lines: string[]): string {
  return lines.filter(Boolean).map((x) => `- ${x}`).join('\n');
}

export function renderAskClarifierMarkdown(result: AskClarifierResult): string {
  const questions = result.clarifying_questions
    .map(
      (q, i) =>
        `${i + 1}. **${q.question}**\n   - Category: ${q.category}\n   - Priority: ${q.priority}\n   - Why it matters: ${q.why_it_matters}\n   - Risk if unanswered: ${q.risk_if_unanswered}${q.suggested_owner ? `\n   - Suggested owner: ${q.suggested_owner}` : ''}`,
    )
    .join('\n\n');

  const assumptions = result.assumptions_to_validate
    .map(
      (a) =>
        `- **${a.assumption}** — confidence: ${a.confidence}${a.confirm_with ? `; confirm with: ${a.confirm_with}` : ''}`,
    )
    .join('\n');

  const risks = result.risks
    .map((r) => `- **${r.severity.toUpperCase()}**: ${r.risk}\n  - Mitigation: ${r.mitigation}`)
    .join('\n');

  return `# Ask Clarifier Output

## Summary
${result.summary}

## Readiness
- Request type: ${result.request_type}
- Clarity score: ${result.clarity_score}/100
- Overall readiness: ${result.overall_readiness}

## Clarifying Questions
${questions || '- None'}

## Assumptions to Validate
${assumptions || '- None'}

## Risks / Watchouts
${risks || '- None'}

## Missing Inputs
${bullet(result.missing_inputs) || '- None'}

## Recommended Next Step
${result.recommended_next_step}

## Suggested Reply
${result.suggested_reply}

## Internal Handoff Note
${result.internal_handoff_note}
`;
}
