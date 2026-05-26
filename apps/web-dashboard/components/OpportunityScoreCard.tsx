const tilePalette = [
  'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200',
  'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
];

export function OpportunityScoreCard({opportunity}:{opportunity:any}) {
  const score = opportunity?.score || {};
  return <div className="rounded-md border border-app-border border-l-4 border-l-emerald-500 bg-app-surface p-2 text-[11px] shadow-xs">
    <div className="font-semibold text-emerald-700 dark:text-emerald-300">
      {opportunity?.opportunity_name || opportunity?.name || 'Opportunity'}
    </div>
    {opportunity?.problem && <div className="mt-1 text-app-muted">{opportunity.problem}</div>}
    {Object.keys(score).length > 0 && (
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 tablet:grid-cols-3">
        {Object.entries(score).map(([k,v],i)=>(
          <div key={k} className={`rounded-md p-1.5 ${tilePalette[i % tilePalette.length]}`}>
            <div className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{k}</div>
            <div className="text-[12px] font-bold">{String(v)}</div>
          </div>
        ))}
      </div>
    )}
  </div>;
}
