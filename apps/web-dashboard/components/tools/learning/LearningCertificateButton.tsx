'use client';

import { useState } from 'react';

import { getLearningCertificate } from '../../../lib/api';

type Cert = {
  title?: string;
  completed_at?: string;
  playbook_id?: string;
  memories?: { title?: string; created_at?: string }[];
};

export function LearningCertificateButton({ enrollmentId }: { enrollmentId: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const data = (await getLearningCertificate(enrollmentId)) as Cert;
      const lines = [
        'RagTag Learning — Completion Certificate',
        '',
        `Path: ${data.title ?? data.playbook_id ?? 'Learning'}`,
        `Completed: ${data.completed_at ?? new Date().toISOString()}`,
        '',
        'Highlights saved during this path:',
        ...(data.memories ?? []).map((m) => `• ${m.title ?? 'Memory'} (${m.created_at ?? ''})`),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learning-certificate-${data.playbook_id ?? enrollmentId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void download()}
      className="rounded border border-teal-500/40 bg-teal-500/10 px-2 py-1 text-[11px] font-medium"
    >
      {busy ? 'Preparing…' : 'Download certificate'}
    </button>
  );
}
