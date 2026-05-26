from pathlib import Path
import re

body = Path("/tmp/ws_body.txt").read_text()
pairs = re.findall(r"const \[(\w+), (set\w+)\]", body)
extra = [
    "loadProjectDocuments",
    "loadTree",
    "loadProjects",
    "loadItems",
    "onMarkItemResolved",
    "loadTactics",
    "loadTacticLibrarySearch",
    "router",
    "searchParams",
    "selectedProject",
    "personalPm",
    "brandOptions",
    "clientOptions",
    "stepShell",
]
funcs = [
    "onCreateProject",
    "onCreateWorkspace",
    "onCreateClient",
    "onCreateBrand",
    "onAttachExistingTactic",
    "onCreateAndAttachNewTactic",
    "openEditTacticRow",
    "onSaveTacticEdits",
    "onDeleteTactic",
    "onUploadProjectFiles",
    "onBulkPreview",
    "onBulkApply",
    "onManifestUploadRun",
    "onDocKindRowChange",
    "onDocArchive",
    "onDocDelete",
    "onDeleteProject",
    "onDeleteWorkspace",
    "onChangeProjectPmKind",
]
parts = []
for a, b in pairs:
    parts.extend([f"    {a},", f"    {b},"])
for x in extra:
    parts.append(f"    {x},")
for f in funcs:
    parts.append(f"    {f},")

header = """'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  bulkImportHierarchy,
  type HierarchyImportResult,
  createBrand,
  createClient,
  createProject,
  attachProjectTactic,
  listTacticsLibrary,
  patchTacticLibrary,
  createWorkspace,
  deleteProject,
  deleteProjectDocument,
  deleteProjectTactic,
  deleteWorkspace,
  getHierarchyTree,
  getProjectItems,
  patchProjectItem,
  patchProjectTactic,
  listProjectDocuments,
  listProjectTactics,
  listProjects,
  patchProject,
  patchProjectDocument,
  PROJECT_DOCUMENT_KIND_VALUES,
  projectDocumentDownloadUrl,
  uploadProjectDocument,
} from '../../lib/api';
import { displayItemTypeLabel, isPersonalPm } from '../../lib/pmMode';
import { STORAGE_PROJECT, STORAGE_WORKSPACE } from '../../lib/workspaces/constants';
import { parseJsonField, toTags } from '../../lib/workspaces/jsonHelpers';
import {
  dedupeProjectItemsKeepNewest,
  projectItemPrimary,
  projectItemSecondary,
} from '../../lib/workspaces/projectItems';
import { flattenBrands, flattenClients } from '../../lib/workspaces/hierarchy';
import { parseManifestRows, findManifestFile } from '../../lib/workspaces/csvManifest';
import { inputClass, btnPrimary, btnDanger } from '../../lib/workspaces/styles';
import { useRouter, useSearchParams } from 'next/navigation';
import { statusChip, priorityChip, processingDocChip, itemTypePill } from '../../lib/workspaces/chips';

"""

out = Path("hooks/workspaces/useWorkspacesPageModel.ts")
out.parent.mkdir(parents=True, exist_ok=True)
full = header + "\nexport function useWorkspacesPageModel() {\n" + body + "\n  return {\n" + "\n".join(parts) + "\n  };\n}\n"
out.write_text(full)
print("lines", len(full.splitlines()))
