function priorityChip(p?:string){
  const s = (p || 'medium').toLowerCase();
  if (s === 'high' || s === 'critical') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
  if (s === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
  if (s === 'low') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
  return 'bg-app-fill text-app-muted dark:bg-white/10';
}

function statusChip(s?:string){
  const v = (s || 'open').toLowerCase();
  if (v === 'done' || v === 'completed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
  if (v === 'blocked') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
  if (v === 'in_progress') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200';
  return 'bg-app-fill text-app-muted dark:bg-white/10';
}

export function TaskTable({tasks=[]}:{tasks?:any[]}) {
  if (!tasks.length) return <div className="text-[11px] text-app-muted">No tasks.</div>;
  return <div className="overflow-auto rounded-md border border-app-border bg-app-surface">
    <table className="w-full text-left text-[11px]">
      <thead className="text-[10px] uppercase tracking-wide text-app-muted">
        <tr className="bg-app-fill">
          <th className="px-2 py-1">Task</th>
          <th className="px-2 py-1">Priority</th>
          <th className="px-2 py-1">Status</th>
          <th className="px-2 py-1">Owner</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t,i)=>(
          <tr key={i} className="border-t border-app-border even:bg-app-fill">
            <td className="px-2 py-1 font-medium text-app-text">{t.title || t.task || 'Task'}</td>
            <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityChip(t.priority)}`}>{t.priority || 'medium'}</span></td>
            <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusChip(t.status)}`}>{t.status || 'open'}</span></td>
            <td className="px-2 py-1 text-app-muted">{t.owner || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}
