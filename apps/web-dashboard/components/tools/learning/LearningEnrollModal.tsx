'use client';

import { useEffect, useState } from 'react';

import { enrollLearning, getHierarchyTree } from '../../../lib/api';
import type { LearningPlaybookMeta } from '../../../lib/learning/moduleCatalog';

type BrandOption = { key: string; label: string };

function flattenBrands(tree: unknown): BrandOption[] {
  const out: BrandOption[] = [];
  const root = tree as { workspaces?: unknown[] };
  const workspaces = root?.workspaces ?? (Array.isArray(tree) ? tree : []);
  for (const ws of workspaces as Record<string, unknown>[]) {
    for (const cl of (ws.clients as Record<string, unknown>[]) ?? []) {
      for (const br of (cl.brands as Record<string, unknown>[]) ?? []) {
        const brand = br.brand as { key?: string; name?: string } | undefined;
        if (brand?.key) {
          out.push({ key: brand.key, label: String(brand.name ?? brand.key) });
        }
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function LearningEnrollModal({
  playbook,
  onClose,
  onEnrolled,
}: {
  playbook: LearningPlaybookMeta;
  onClose: () => void;
  onEnrolled: (enrollmentId: string) => void;
}) {
  const [useBrand, setUseBrand] = useState(false);
  const [brandKey, setBrandKey] = useState('');
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getHierarchyTree()
      .then((t) => setBrands(flattenBrands(t)))
      .catch(() => setBrands([]));
  }, []);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const en = await enrollLearning(playbook.id, useBrand ? brandKey || null : null);
      onEnrolled(String((en as { id: string }).id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-lg border border-app-border bg-app-surface p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-app-text">Enroll: {playbook.title}</h3>
        <label className="mt-3 flex items-center gap-2 text-[11px] text-app-text">
          <input type="checkbox" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} />
          Include brand-specific training
        </label>
        {useBrand ? (
          <select
            value={brandKey}
            onChange={(e) => setBrandKey(e.target.value)}
            className="mt-2 w-full rounded border border-app-border bg-app-fill p-2 text-[11px]"
          >
            <option value="">Select brand…</option>
            {brands.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        ) : null}
        {err ? <p className="mt-2 text-[11px] text-rose-500">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-app-border px-3 py-1 text-[11px]">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (useBrand && !brandKey)}
            onClick={() => void submit()}
            className="rounded border border-teal-500/40 bg-teal-500/15 px-3 py-1 text-[11px] font-medium"
          >
            {busy ? 'Enrolling…' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
