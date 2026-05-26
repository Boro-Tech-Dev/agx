'use client';
import { useEffect, useState } from 'react';
import { listMemory, searchMemory, ingestText } from '../../lib/api';
import { SubpageHeader } from '../../components/SubpageHeader';
import { DashboardShell } from '../../components/DashboardShell';

const field =
  'rounded-md border border-app-border bg-app-surface p-2 text-xs text-app-text outline-none focus:border-emerald-400 dark:focus:border-emerald-500';

export default function MemoryPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [query,setQuery]=useState('');
  const [title,setTitle]=useState('');
  const [content,setContent]=useState('');
  const [msg,setMsg]=useState('');
  const [loadError,setLoadError]=useState<string|null>(null);
  const [searchWarnings,setSearchWarnings]=useState<string[]>([]);

  async function load(){
    setLoadError(null);
    setSearchWarnings([]);
    try {
      setRows(await listMemory());
    } catch (e: unknown) {
      setRows([]);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }
  async function search(){
    if (!query.trim()) return load();
    const pk = typeof localStorage !== 'undefined' ? localStorage.getItem('dd.project_key') : null;
    const wk = typeof localStorage !== 'undefined' ? (localStorage.getItem('dd.workspace_key') || 'default') : 'default';
    setLoadError(null);
    try {
      const r = await searchMemory(query, pk, wk);
      setRows((r.results || []) as any[]);
      setSearchWarnings(Array.isArray(r.warnings) ? r.warnings : []);
    } catch (e: unknown) {
      setRows([]);
      setSearchWarnings([]);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }
  async function ingest(){
    setMsg('');
    const pk = typeof localStorage !== 'undefined' ? localStorage.getItem('dd.project_key') : null;
    const wk = typeof localStorage !== 'undefined' ? (localStorage.getItem('dd.workspace_key') || 'default') : 'default';
    const r = await ingestText({ title: title || 'Manual note', content, project_key: pk || null, workspace_key: wk });
    setMsg(`Ingested ${r.chunks} chunks, embedded ${r.embedded_chunks}.`);
    setTitle('');
    setContent('');
    await load();
  }
  useEffect(()=>{ load(); },[]);

  return (
    <DashboardShell
      header={<SubpageHeader badge="Canon" title="Memory" />}
      activeTool="memory"
    >
    {loadError && (
      <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
        {loadError}
      </div>
    )}
    {searchWarnings.length > 0 && (
      <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
        <span className="font-semibold">Partial search:</span> {searchWarnings.join(', ')}
      </div>
    )}
    <div className="mb-3 flex flex-col gap-2 tablet:grid tablet:grid-cols-[1fr_auto] tablet:items-stretch">
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')search()}} className={`min-w-0 ${field}`} placeholder="Search memory and chunks..."/>
      <button onClick={search} className="w-full shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 tablet:w-auto">Search</button>
    </div>

    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 shadow-xs dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="mb-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-100">Ingest Text</div>
      <input value={title} onChange={e=>setTitle(e.target.value)} className={`mb-1.5 w-full ${field}`} placeholder="Title"/>
      <textarea value={content} onChange={e=>setContent(e.target.value)} className={`h-24 w-full ${field}`} placeholder="Paste docs, notes, architecture decisions..."/>
      <div className="mt-1.5 flex flex-col gap-1.5 tablet:flex-row tablet:items-center tablet:gap-2">
        <button disabled={!content.trim()} onClick={ingest} className="w-full rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 tablet:w-auto">Ingest</button>
        {msg && <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{msg}</span>}
      </div>
    </div>

    <div className="grid gap-1.5">
      {rows.map((m:any)=>(
        <div key={m.id} className="rounded-md border border-app-border border-l-4 border-l-emerald-500 bg-app-surface p-2.5 shadow-xs">
          <div className="flex flex-col gap-1.5 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-3">
            <div className="min-w-0 text-sm font-semibold text-app-text">{m.title}</div>
            <div className="flex shrink-0 flex-wrap gap-1 text-[10px] text-app-muted">
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">{m.memory_type}</span>
              <span className="rounded bg-app-fill px-1.5 py-0.5 font-semibold text-app-muted dark:bg-white/10">{m.confidence}</span>
              <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">{m.status || m.source_kind}</span>
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{String(m.body || '').slice(0,900)}</p>
        </div>
      ))}
    </div>
    </DashboardShell>
  );
}
