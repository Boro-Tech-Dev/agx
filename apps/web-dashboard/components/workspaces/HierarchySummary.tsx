import { timingProfileLabel } from '../../lib/scenarioPlanner/timingProfiles';

type Tree = { workspaces?: any[] } | null;

export function HierarchySummary({ tree }: { tree: Tree }) {
  if (!tree?.workspaces?.length) {
    return <p className="text-[11px] text-app-muted">No workspaces yet. Create one below.</p>;
  }
  return (
    <ul className="max-h-72 space-y-1.5 overflow-auto text-[11px] text-app-text">
      {tree.workspaces.map((wrap: any) => {
        const w = wrap.workspace;
        const wk = w?.key;
        return (
          <li key={wk || w?.id} className="rounded border border-app-border bg-app-fill/90 px-2 py-1">
            <span className="font-semibold text-app-text">{wk}</span>
            <span className="text-app-muted"> — {w?.name}</span>
            <ul className="ml-2 mt-1 space-y-1 border-l border-app-border pl-2">
              {(wrap.clients || []).map((cwrap: any) => {
                const cl = cwrap.client;
                const brands = cwrap.brands || [];
                return (
                  <li key={cl?.id} className="space-y-0.5">
                    <div>
                      <span className="text-app-text">{cl?.key}</span>
                      <span className="text-app-muted"> / {cl?.name}</span>
                      <span className="text-app-muted"> · {brands.length} brand(s)</span>
                    </div>
                    {brands.length > 0 ? (
                      <ul className="ml-2 border-l border-app-border pl-2 text-[10px] text-app-muted">
                        {brands.map((bwrap: any) => {
                          const br = bwrap.brand;
                          const brandCadence = br?.timing_profile_id;
                          return (
                            <li key={br?.id} className="space-y-0.5">
                              <div>
                                <span className="text-app-text">{br?.key}</span>
                                <span className="text-app-muted"> / {br?.name}</span>
                                {brandCadence ? (
                                  <span className="ml-1 rounded bg-fuchsia-100/80 px-1 py-px font-mono text-[9px] text-fuchsia-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-100">
                                    {timingProfileLabel(String(brandCadence))}
                                  </span>
                                ) : (
                                  <span className="ml-1 text-[9px] italic">no cadence</span>
                                )}
                              </div>
                              {(bwrap.projects || []).length > 0 ? (
                                <ul className="ml-2 border-l border-app-border/60 pl-2">
                                  {bwrap.projects.map((p: any) => {
                                    const resolved = p?.resolved_timing_profile;
                                    const override = p?.timing_profile_id;
                                    return (
                                      <li key={p?.key}>
                                        <span className="text-app-text">{p?.key}</span>
                                        {resolved ? (
                                          <span className="ml-1 font-mono text-[9px]">
                                            {timingProfileLabel(String(resolved))}
                                            {override ? ' *' : ''}
                                          </span>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="ml-2 text-[10px] text-app-muted">No brands under this client.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
