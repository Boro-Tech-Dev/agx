import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  STORAGE_WORKSPACES_SELECTION,
  readPersistedWorkspacesSelection,
  workspacesSelectionPath,
  writePersistedWorkspacesSelection,
} from './selectionPersistence';

describe('selectionPersistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null;
      },
      setItem(k: string, v: string) {
        this.store[k] = v;
      },
      removeItem(k: string) {
        delete this.store[k];
      },
    });
    vi.stubGlobal('window', {
      location: { pathname: '/workspaces', search: '' },
      history: { replaceState: vi.fn() },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes versioned blob and legacy keys', () => {
    writePersistedWorkspacesSelection({
      projectKey: 'proj-a',
      workspaceKey: 'ws-1',
      clientId: '42',
      brandId: '7',
    });
    const raw = localStorage.getItem(STORAGE_WORKSPACES_SELECTION);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({
      projectKey: 'proj-a',
      workspaceKey: 'ws-1',
      clientId: '42',
      brandId: '7',
    });
    expect(localStorage.getItem('dd.project_key')).toBe('proj-a');
    expect(localStorage.getItem('dd.workspace_key')).toBe('ws-1');
  });

  it('prefers URL over storage', () => {
    writePersistedWorkspacesSelection({ projectKey: 'stored', workspaceKey: 'ws-old' });
    (window as Window & typeof globalThis).location.search =
      '?project=from-url&workspace=ws-new';
    expect(readPersistedWorkspacesSelection().projectKey).toBe('from-url');
    expect(readPersistedWorkspacesSelection().workspaceKey).toBe('ws-new');
  });

  it('builds search path', () => {
    expect(
      workspacesSelectionPath({
        projectKey: 'p1',
        workspaceKey: 'w1',
        clientId: 'c1',
        brandId: 'b1',
      }),
    ).toBe('/workspaces?project=p1&workspace=w1&client=c1&brand=b1');
  });
});
