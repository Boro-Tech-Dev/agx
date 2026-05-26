'use client';

type StepRow = {
  id: string;
  title: string;
  kind?: string;
  locked: boolean;
  done: boolean;
};

type Mission = {
  id: string;
  title: string;
  steps: StepRow[];
};

export function LearningMissionMap({
  missions,
  currentStepId,
  onSelectStep,
}: {
  missions: Mission[];
  currentStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {missions.map((mission) => (
        <section key={mission.id} className="rounded-lg border border-app-border bg-app-surface p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-app-muted">{mission.title}</h3>
          <ol className="mt-2 space-y-1.5">
            {mission.steps.map((step, idx) => {
              const active = step.id === currentStepId;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={step.locked && !step.done}
                    onClick={() => onSelectStep?.(step.id)}
                    className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] ${
                      step.done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-app-text'
                        : step.locked
                          ? 'cursor-not-allowed border-app-border/60 bg-app-fill/40 text-app-muted'
                          : active
                            ? 'border-teal-500/40 bg-teal-500/10 text-app-text'
                            : 'border-app-border bg-app-fill text-app-text hover:bg-app-fill-hover'
                    }`}
                  >
                    <span className="mt-0.5 w-4 shrink-0 font-mono text-[10px] text-app-muted">{idx + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{step.title}</span>
                      {step.kind ? (
                        <span className="ml-1 text-[10px] text-app-muted">({step.kind})</span>
                      ) : null}
                    </span>
                    {step.done ? (
                      <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-300">Done</span>
                    ) : step.locked ? (
                      <span className="shrink-0 text-[10px]">Locked</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
