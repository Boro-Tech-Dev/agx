import type { Dispatch, SetStateAction } from 'react';
import { flattenBrands, flattenClients } from './hierarchy';

type Tree = { workspaces?: any[] } | null;

/** When hierarchy `tree` changes, keep brand/client dropdown values valid (same logic as former `loadTree`). */
export function syncBrandClientPicklistsFromTree(
  t: Tree,
  setBrandIdInput: Dispatch<SetStateAction<string>>,
  setBrandClientId: Dispatch<SetStateAction<string>>,
) {
  const opts = flattenBrands(t);
  setBrandIdInput((prev) => {
    if (prev && opts.some((o) => o.brandId === prev)) return prev;
    return opts[0]?.brandId || '';
  });
  const clientOpts = flattenClients(t);
  setBrandClientId((prev) => {
    if (prev && clientOpts.some((o) => o.clientId === prev)) return prev;
    return clientOpts[0]?.clientId || '';
  });
}
