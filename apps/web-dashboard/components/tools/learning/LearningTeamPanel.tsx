'use client';

import { useEffect, useState } from 'react';

import { getLearningOpsSummary } from '../../../lib/api';

export function LearningTeamPanel() {
  const [rows, setRows] = useState<
    {
      playbook_id: string;
      title: string;
      enrolled: number;
      completed: number;
      in_progress: number;
      completion_rate: number;
    }[]
  >([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getLearningOpsSummary()
      .then((d) => setRows(d.rows ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) {
    return <p className="text-[11px] text-rose-500">{err}</p>;
  }

  if (!rows.length) {
    return <p className="text-[11px] text-app-muted">No enrollment data yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-app-border">
      <table className="w-full text-left text-[11px]">
        <thead className="border-b border-app-border bg-app-fill text-app-muted">
          <tr>
            <th className="px-2 py-1.5 font-medium">Playbook</th>
            <th className="px-2 py-1.5 font-medium">Enrolled</th>
            <th className="px-2 py-1.5 font-medium">In progress</th>
            <th className="px-2 py-1.5 font-medium">Completed</th>
            <th className="px-2 py-1.5 font-medium">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playbook_id} className="border-b border-app-border/60">
              <td className="px-2 py-1.5 text-app-text">{r.title}</td>
              <td className="px-2 py-1.5">{r.enrolled}</td>
              <td className="px-2 py-1.5">{r.in_progress}</td>
              <td className="px-2 py-1.5">{r.completed}</td>
              <td className="px-2 py-1.5">{r.completion_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
