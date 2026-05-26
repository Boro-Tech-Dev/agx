function actionChip(a?:string){
  const s = (a || 'modify').toLowerCase();
  if (s === 'create' || s === 'add')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
  if (s === 'delete' || s === 'remove')
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
  if (s === 'modify' || s === 'edit')
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200';
  return 'bg-app-fill text-app-muted dark:bg-white/10';
}

export function PatchViewer({patches=[]}:{patches?:any[]}) {
  if (!patches.length) return <div className="text-[11px] text-app-muted">No patches generated.</div>;
  return <div className="space-y-2">
    {patches.map((p,i)=>(
      <div key={i} className="overflow-hidden rounded-md border border-app-border bg-app-surface shadow-xs">
        <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-2 py-1 dark:border-indigo-500/25 dark:bg-indigo-500/10">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${actionChip(p.action)}`}>{p.action || 'modify'}</span>
          <span className="text-[11px] font-mono text-indigo-800 dark:text-indigo-200">{p.path}</span>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-app-fill p-2 font-mono text-[11px] text-app-text">{p.content_or_diff || p.content || JSON.stringify(p,null,2)}</pre>
      </div>
    ))}
  </div>;
}
