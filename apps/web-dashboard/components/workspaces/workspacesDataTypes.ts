import type { useWorkspacesPageModel } from '../../hooks/workspaces/useWorkspacesPageModel';

/** Full workspaces page domain (selection, items, documents, tactics, hierarchy forms, bulk). */
export type WorkspacesDataValue = ReturnType<typeof useWorkspacesPageModel>;
