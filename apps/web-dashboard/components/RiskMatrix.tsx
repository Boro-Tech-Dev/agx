function levelChip(level?:string){
  const s = (level || '').toLowerCase();
  if (s === 'high' || s === 'critical') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
  if (s === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
  if (s === 'low') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
  return 'bg-app-fill text-app-muted dark:bg-white/10';
}

export function RiskMatrix({risks=[]}:{risks?:any[]}) {
  if (!risks.length) return <div className="text-[11px] text-app-muted">No risks.</div>;
  return <div className="grid gap-1.5">
    {risks.map((r,i)=>(
      <div key={i} className="rounded-md border border-app-border border-l-4 border-l-rose-500 bg-app-surface p-2 text-[11px] shadow-xs">
        <div className="font-semibold text-rose-700 dark:text-rose-300">{r.risk || r.title || 'Risk'}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-app-muted">
          <span className="text-[10px] uppercase tracking-wide text-app-muted">Impact</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${levelChip(r.impact)}`}>{r.impact || 'n/a'}</span>
          <span className="text-[10px] uppercase tracking-wide text-app-muted">Likelihood</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${levelChip(r.likelihood)}`}>{r.likelihood || 'n/a'}</span>
        </div>
        {r.mitigation && <div className="mt-1 text-app-muted"><span className="text-[10px] uppercase tracking-wide text-app-muted">Mitigation:</span> {r.mitigation}</div>}
      </div>
    ))}
  </div>;
}
