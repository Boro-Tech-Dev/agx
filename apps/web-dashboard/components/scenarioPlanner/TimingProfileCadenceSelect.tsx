'use client';

import {
  TIMING_PROFILE_IDS,
  timingProfileLabel,
} from '../../lib/scenarioPlanner/timingProfiles';

export function TimingProfileCadenceSelect({
  value,
  onChange,
  inheritLabel,
  className = 'mt-1 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text',
  disabled,
}: {
  value: string | null | undefined;
  onChange: (profileId: string | null) => void;
  inheritLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const v = value ?? '';
  return (
    <select
      value={v}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      className={className}
    >
      <option value="">{inheritLabel ?? 'Inherit / none'}</option>
      {TIMING_PROFILE_IDS.map((id) => (
        <option key={id} value={id}>
          {timingProfileLabel(id)}
        </option>
      ))}
    </select>
  );
}
