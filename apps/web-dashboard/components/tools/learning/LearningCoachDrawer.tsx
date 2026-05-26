'use client';

import { useState } from 'react';

import { postLearningCoach } from '../../../lib/api';

export function LearningCoachDrawer({
  enrollmentId,
  stepId,
}: {
  enrollmentId: string;
  stepId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const res = await postLearningCoach({
        enrollment_id: enrollmentId,
        message: message.trim(),
        step_id: stepId,
      });
      setReply(String((res as { reply?: string }).reply ?? ''));
    } catch (e) {
      setReply(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-app-muted underline hover:text-app-text"
      >
        Ask Twiki (coach)
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded border border-app-border bg-app-fill/50 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-app-muted">Learning coach</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-app-muted">
          Close
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full rounded border border-app-border bg-app-fill p-2 text-[11px]"
        placeholder="Ask about this step…"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void ask()}
        className="rounded border border-app-border bg-app-fill px-2 py-1 text-[11px]"
      >
        {busy ? 'Thinking…' : 'Ask'}
      </button>
      {reply ? <p className="text-[11px] leading-relaxed text-app-text">{reply}</p> : null}
    </div>
  );
}
