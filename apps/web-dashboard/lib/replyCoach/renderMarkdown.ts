import type { ReplyCoachResult } from './types';

function list(items: string[]): string {
  return items.length ? items.map((x) => `- ${x}`).join('\n') : '- None';
}

export function renderReplyCoachMarkdown(result: ReplyCoachResult): string {
  return [
    '# Reply Coach',
    '',
    `**Risk level:** ${result.risk_level}`,
    `**Recommended posture:** ${result.recommended_posture}`,
    '',
    '## Situation Summary',
    result.situation_summary || 'Not provided.',
    '',
    '## Primary Risk',
    result.primary_risk || 'Not provided.',
    '',
    '## Reply Strategy',
    result.reply_strategy || 'Not provided.',
    '',
    '## Suggested Reply',
    result.suggested_reply || 'Not provided.',
    '',
    '## Short Reply',
    result.short_reply || 'Not provided.',
    '',
    '## Firmer Reply',
    result.firm_reply || 'Not provided.',
    '',
    '## Internal Note',
    result.internal_note || 'Not provided.',
    '',
    '## Questions to Ask',
    list(result.questions_to_ask),
    '',
    '## Commitments to Avoid',
    list(result.commitments_to_avoid),
    '',
    '## Do Not Say',
    list(result.do_not_say),
    '',
    '## Next Steps',
    list(result.next_steps),
  ].join('\n');
}
