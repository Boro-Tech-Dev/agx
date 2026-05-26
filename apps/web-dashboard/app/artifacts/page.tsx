import { listArtifacts, artifactDownloadUrl } from '../../lib/api';
import { SubpageHeader } from '../../components/SubpageHeader';
import { DashboardShell } from '../../components/DashboardShell';

export default async function ArtifactsPage() {
  let rows: any[] = [];
  let loadError: string | null = null;
  try {
    rows = await listArtifacts();
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : String(e);
  }
  return (
    <DashboardShell
      header={<SubpageHeader badge="Files" title="Artifacts" />}
      activeTool="artifacts"
    >
    {loadError && (
      <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
        Could not load artifacts: {loadError}
      </div>
    )}
    <div className="min-w-0 overflow-x-auto rounded-lg border border-app-border border-l-4 border-l-violet-500 bg-app-surface p-2 shadow-xs">
      <table className="w-full min-w-[32rem] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-app-muted">
          <tr>
            <th className="px-2 py-1">Title</th>
            <th className="px-2 py-1">Type</th>
            <th className="px-2 py-1">Created</th>
            <th className="px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a:any)=>(
            <tr key={a.id} className="border-t border-app-border even:bg-app-fill">
              <td className="px-2 py-1 font-medium text-app-text">
                {a.title}
                <div className="text-[10px] text-app-muted">{a.storage_key}</div>
              </td>
              <td className="px-2 py-1"><span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">{a.artifact_type}</span></td>
              <td className="px-2 py-1 text-app-muted">{a.created_at}</td>
              <td className="px-2 py-1"><a className="font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200" href={artifactDownloadUrl(a.id)}>Download</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </DashboardShell>
  );
}
