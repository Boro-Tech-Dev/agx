'use client';
import { useEffect, useState } from 'react';
import { listApprovals, approveApproval, rejectApproval } from '../../lib/api';
import { SubpageHeader } from '../../components/SubpageHeader';
import { DashboardShell } from '../../components/DashboardShell';
import { approvalStatusChip } from '../../lib/workspaces/chips';

export default function ApprovalsPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [loadError,setLoadError]=useState<string|null>(null);
  async function load(){
    setLoadError(null);
    try {
      setRows(await listApprovals());
    } catch (e: unknown) {
      setRows([]);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }
  async function act(id:string, mode:'approve'|'reject'){ mode==='approve' ? await approveApproval(id) : await rejectApproval(id); await load(); }
  useEffect(()=>{ load(); },[]);

  return (
    <DashboardShell
      header={<SubpageHeader badge="Gate" title="Approvals" />}
      activeTool="approvals"
    >
    {loadError && (
      <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
        Could not load approvals: {loadError}
      </div>
    )}
    {rows.length ? (
      <div className="grid gap-1.5">
        {rows.map((a:any)=>(
          <div key={a.id} className="rounded-md border border-app-border border-l-4 border-l-orange-500 bg-app-surface p-2.5 text-xs shadow-xs">
            <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">{a.approval_type}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${approvalStatusChip(a.status)}`}>{a.status}</span>
              </div>
              {a.status==='pending' && (
                <div className="flex w-full gap-1.5 tablet:w-auto">
                  <button onClick={()=>act(a.id,'approve')} className="flex-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 tablet:flex-none">Approve</button>
                  <button onClick={()=>act(a.id,'reject')} className="flex-1 rounded-md bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-600 tablet:flex-none">Reject</button>
                </div>
              )}
            </div>
            <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-app-fill p-2 text-[11px] text-app-muted ring-1 ring-app-border">{JSON.stringify(a.requested_action,null,2)}</pre>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-md border border-app-border bg-app-surface p-2.5 text-xs text-app-muted shadow-xs">No approvals are pending.</div>
    )}
    </DashboardShell>
  );
}
