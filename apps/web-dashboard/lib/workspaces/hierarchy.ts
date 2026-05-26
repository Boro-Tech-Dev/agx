export type BrandOption = { brandId: string; label: string };
export type ClientOption = { clientId: string; label: string };

export function flattenBrands(tree: { workspaces?: any[] } | null): BrandOption[] {
  const out: BrandOption[] = [];
  if (!tree?.workspaces) return out;
  for (const wrap of tree.workspaces) {
    const wk = wrap.workspace?.key as string;
    for (const cwrap of wrap.clients || []) {
      const ck = cwrap.client?.key as string;
      for (const bwrap of cwrap.brands || []) {
        const bk = bwrap.brand?.key as string;
        const bid = bwrap.brand?.id as string;
        if (wk && ck && bk && bid) out.push({ brandId: bid, label: `${wk} / ${ck} / ${bk}` });
      }
    }
  }
  return out;
}

export function flattenClients(tree: { workspaces?: any[] } | null): ClientOption[] {
  const out: ClientOption[] = [];
  if (!tree?.workspaces) return out;
  for (const wrap of tree.workspaces) {
    const wk = wrap.workspace?.key as string;
    for (const cwrap of wrap.clients || []) {
      const ck = cwrap.client?.key as string;
      const cid = cwrap.client?.id as string;
      if (wk && ck && cid) out.push({ clientId: cid, label: `${wk} / ${ck}` });
    }
  }
  return out;
}
