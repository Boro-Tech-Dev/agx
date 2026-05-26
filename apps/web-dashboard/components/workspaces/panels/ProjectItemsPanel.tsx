'use client';

import { useMemo } from 'react';
import { displayItemTypeLabel } from '../../../lib/pmMode';
import { statusChip, priorityChip, itemTypePill } from '../../../lib/workspaces/chips';
import { projectItemPrimary, projectItemSecondary } from '../../../lib/workspaces/projectItems';
import { useWorkspacesData } from '../WorkspacesDataContext';
import ProjectItemActions from './ProjectItemActions';
import TimelineKeyDatesSection from './TimelineKeyDatesSection';

export default function ProjectItemsPanel() {
  const d = useWorkspacesData();
  const timelineItems = useMemo(
    () => d.items.filter((it: any) => String(it?.item_type) === 'timeline_event'),
    [d.items],
  );
  const agentItems = useMemo(
    () => d.items.filter((it: any) => String(it?.item_type) !== 'timeline_event'),
    [d.items],
  );

  const persistTimeline = useMemo(() => {
    const p = d.projects.find((x: any) => x.key === d.selectedKey);
    if (!p) return true;
    return p.persist_timeline_events !== false;
  }, [d.projects, d.selectedKey]);

  const timelineMinting = useMemo(() => {
    return (d.projectDocs ?? []).some((doc: any) => {
      const kind = String(doc?.document_kind ?? '').toLowerCase();
      const st = String(doc?.processing_status ?? '').toLowerCase();
      return kind === 'timeline' && st === 'processing';
    });
  }, [d.projectDocs]);

  const timelineSkippedPolicy = useMemo(() => {
    return (d.projectDocs ?? []).some((doc: any) => {
      const kind = String(doc?.document_kind ?? '').toLowerCase();
      const meta = doc?.metadata?.timeline_pipeline;
      return kind === 'timeline' && meta?.status === 'skipped_policy';
    });
  }, [d.projectDocs]);

  const timelinePipelineError = useMemo(() => {
    const doc = (d.projectDocs ?? []).find((x: any) => {
      const kind = String(x?.document_kind ?? '').toLowerCase();
      const meta = x?.metadata?.timeline_pipeline;
      return kind === 'timeline' && meta?.status === 'error';
    });
    return doc?.metadata?.timeline_pipeline?.message as string | undefined;
  }, [d.projectDocs]);

  const showKeyDatesBuilding =
    persistTimeline && timelineMinting && timelineItems.length === 0;

  const showTimelineNotes =
    timelineSkippedPolicy ||
    timelinePipelineError ||
    showKeyDatesBuilding ||
    timelineItems.length > 0 ||
    persistTimeline === false;

  return (
    <section className="mb-2 rounded-lg border border-app-border bg-app-fill/80 p-2 shadow-inner">
      <div className="grid grid-cols-1 gap-2 desktop:grid-cols-1">
        <div className="min-w-0 rounded border border-app-border bg-app-surface p-2">
          <h3 className="text-[11px] font-semibold text-app-text">Project items</h3>
          <p className="text-[9px] text-app-muted">
            {d.personalPm
              ? 'From Synergy runs on a personal project — softer kind labels (next steps, tensions). Summary uses title plus JSON body when generic. Same kind + summary keeps the newest row only. Timeline files add key dates under the agent list.'
              : 'Generated from agent runs — summary uses title plus JSON body when the title is generic. When type and summary match, only the latest row is shown. Project files classified as timeline add a key-dates calendar and table under the agent list.'}
          </p>

          <div className="mt-1.5 min-w-0 overflow-x-auto">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-app-muted">Agent items</p>
            <table className="w-full min-w-[22rem] text-left text-[10px]">
              <thead className="sticky top-0 z-[1] border-b border-app-border bg-app-surface text-[9px] uppercase tracking-wide text-app-muted">
                <tr>
                  <th className="py-0.5 pr-1">{d.personalPm ? 'Kind' : 'Type'}</th>
                  <th className="py-0.5 pr-1">Priority</th>
                  <th className="py-0.5 pr-1">Summary</th>
                  <th className="py-0.5 pr-1">Status</th>
                  <th className="py-0.5 pr-1">Run</th>
                  <th className="py-0.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agentItems.map((it: any) => {
                  const primary = projectItemPrimary(it);
                  const secondary = projectItemSecondary(it, primary);
                  return (
                    <tr key={it.id} className="border-t border-app-border align-top even:bg-app-fill/90">
                      <td className="py-0.5 pr-1">
                        <span
                          className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold capitalize ${itemTypePill(it.item_type)}`}
                        >
                          {displayItemTypeLabel(it.item_type, d.personalPm)}
                        </span>
                      </td>
                      <td className="py-0.5 pr-1">
                        <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${priorityChip(it.priority)}`}>
                          {it.priority}
                        </span>
                      </td>
                      <td className="max-w-[min(28rem,55vw)] py-0.5 pr-1">
                        <div className="font-semibold leading-snug text-app-text">
                          {primary}
                          {it.metadata && typeof it.metadata === 'object' && (it.metadata as { flagged?: boolean }).flagged ? (
                            <span className="ml-1 text-[9px] font-normal text-amber-700 dark:text-amber-300" title="Flagged for later">
                              *
                            </span>
                          ) : null}
                        </div>
                        {secondary ? (
                          <div className="mt-0.5 line-clamp-3 text-[9px] leading-snug text-app-muted">{secondary}</div>
                        ) : null}
                      </td>
                      <td className="py-0.5 pr-1">
                        <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${statusChip(it.status)}`}>
                          {it.status}
                        </span>
                      </td>
                      <td className="py-0.5 pr-1">
                        {it.source_run_id ? (
                          <a
                            href={`/runs/${it.source_run_id}`}
                            className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-app-muted">—</span>
                        )}
                      </td>
                      <td className="py-0.5">
                        {d.selectedKey ? (
                          <ProjectItemActions
                            item={it}
                            selectedKey={d.selectedKey}
                            workspaceKey={
                              (d.projects.find((x: any) => x.key === d.selectedKey)?.workspace_key as string) || ''
                            }
                            personalPm={d.personalPm}
                            summaryLine={primary}
                            onMarkResolved={d.onMarkItemResolved}
                            onReopen={d.onReopenItem}
                            onFlagToggle={d.onFlagItemToggle}
                            onUpdateItemTitle={d.onUpdateItemTitle}
                            onSaveAsMemory={d.onSaveItemAsMemory}
                          />
                        ) : (
                          <span className="text-app-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {d.selectedKey && agentItems.length === 0 && (
              <p className="mt-1 text-[10px] text-app-muted">
                {timelineItems.length > 0
                  ? 'No agent-generated items for this project yet.'
                  : 'No items for this project yet.'}
              </p>
            )}
          </div>

          {showTimelineNotes ? (
            <div className="mt-2 min-w-0 space-y-2">
              {showKeyDatesBuilding ? (
                <p className="rounded border border-cyan-600/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-app-text">
                  Building key dates from your timeline file… This can take a minute while rows are mapped.
                </p>
              ) : null}
              {persistTimeline === false && timelineItems.length === 0 ? (
                <p className="rounded border border-app-border bg-app-fill/90 px-2 py-1 text-[10px] text-app-muted">
                  Key dates from timeline uploads are disabled for this project type.
                </p>
              ) : null}
              {timelineSkippedPolicy ? (
                <p className="rounded border border-amber-600/35 bg-amber-500/10 px-2 py-1 text-[10px] text-app-text">
                  Timeline processing skipped for this project (log-only / policy). Key-date rows are not stored.
                </p>
              ) : null}
              {timelinePipelineError ? (
                <p className="rounded border border-red-600/35 bg-red-500/10 px-2 py-1 text-[10px] text-app-text">
                  Timeline pipeline error: {timelinePipelineError}
                </p>
              ) : null}
              {timelineItems.length > 0 ? (
                <TimelineKeyDatesSection items={timelineItems} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
