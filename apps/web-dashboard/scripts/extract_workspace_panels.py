"""Extract renderWorkspacePanel cases from WorkspacesShell.tsx into panel modules."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
shell_lines = (ROOT / "components/workspaces/WorkspacesShell.tsx").read_text().splitlines()
out_dir = ROOT / "components/workspaces/panels"
out_dir.mkdir(parents=True, exist_ok=True)

CASES = [
    ("CurrentProjectChromePanel", 881, 951),
    ("TacticsPanel", 955, 1313),
    ("ProjectItemsPanel", 1317, 1412),
    ("ProjectFilesPanel", 1416, 1551),
    ("NarrativePanel", 1555, 1587),
    ("SetupHierarchyPanel", 1591, 2132),
    ("BulkImportPanel", 2136, 2292),
    ("WorkspaceAdminPanel", 2296, 2359),
    ("HierarchyOverviewPanel", 2363, 2368),
    ("RawJsonPanel", 2372, 2388),
]

COMMON_IMPORTS = """'use client';

import type { InputHTMLAttributes } from 'react';
import { PROJECT_DOCUMENT_KIND_VALUES, projectDocumentDownloadUrl } from '../../../lib/api';
import { displayItemTypeLabel } from '../../../lib/pmMode';
import { STORAGE_WORKSPACE } from '../../../lib/workspaces/constants';
import { statusChip, priorityChip, processingDocChip, itemTypePill } from '../../../lib/workspaces/chips';
import { inputClass, btnPrimary, btnDanger } from '../../../lib/workspaces/styles';
import { HierarchySummary } from '../HierarchySummary';
import { ProjectHierarchyPicker } from '../ProjectHierarchyPicker';
import { useWorkspacesData } from '../WorkspacesDataContext';
"""

ITEMS_IMPORTS = """'use client';

import { displayItemTypeLabel } from '../../../lib/pmMode';
import { statusChip, priorityChip, itemTypePill } from '../../../lib/workspaces/chips';
import { projectItemPrimary, projectItemSecondary } from '../../../lib/workspaces/projectItems';
import { useWorkspacesData } from '../WorkspacesDataContext';
"""

RAW_IMPORTS = """'use client';

import { useWorkspacesData } from '../WorkspacesDataContext';
"""

KEYS = [
    "setTree",
    "setProjects",
    "setSelectedKey",
    "setItems",
    "setTactics",
    "setKeyInput",
    "setNameInput",
    "setDescInput",
    "setProjectTypeInput",
    "setPmKindCreate",
    "setBrandIdInput",
    "setWsKeyInput",
    "setWsNameInput",
    "setClientWsKey",
    "setClientKeyInput",
    "setClientNameInput",
    "setBrandClientId",
    "setBrandKeyInput",
    "setBrandNameInput",
    "setTacticSearch",
    "setTacticSearchRows",
    "setTacticAttachId",
    "setTacticNewKey",
    "setTacticNewName",
    "setTacticLifecycleStatus",
    "setTacticPriority",
    "setTacticStartAt",
    "setTacticEndAt",
    "setTacticObjective",
    "setTacticNotes",
    "setTacticSuccessMetricsJson",
    "setTacticDependenciesJson",
    "setTacticProjectMetadataJson",
    "setTacticLibDescription",
    "setTacticLibKind",
    "setTacticLibChannel",
    "setTacticLibMedium",
    "setTacticLibFormat",
    "setTacticLibTagsCsv",
    "setTacticLibDefaultSuccessJson",
    "setTacticLibDefaultDepsJson",
    "setTacticLibDefaultStartOffsetDays",
    "setTacticLibDefaultDurationDays",
    "setTacticLibCadence",
    "setTacticLibEstimatedCostCents",
    "setTacticLibCurrency",
    "setTacticLibOwner",
    "setTacticLibStatus",
    "setTacticLibMetadataJson",
    "setMsg",
    "setErr",
    "setProjectDeleteOpen",
    "setProjectDeleteConfirm",
    "setWsDeleteTarget",
    "setWsDeleteConfirm",
    "setProjectDocs",
    "setUploadKind",
    "setDocKindFilter",
    "setBulkCsvText",
    "setBulkSkipExisting",
    "setBulkResult",
    "setBulkWorking",
    "setManifestCsv",
    "setManifestFolderFiles",
    "setManifestLog",
    "setManifestWorking",
    "setTacticEditId",
    "setTacticEditLibName",
    "setTacticEditLibDescription",
    "setTacticEditLibKind",
    "setTacticEditLibChannel",
    "setTacticEditLibMedium",
    "setTacticEditLibFormat",
    "setTacticEditLibTagsCsv",
    "setTacticEditLibDefaultSuccessJson",
    "setTacticEditLibDefaultDepsJson",
    "setTacticEditLibCadence",
    "setTacticEditLibEstimatedCostCents",
    "setTacticEditLibCurrency",
    "setTacticEditLibOwner",
    "setTacticEditLibStatus",
    "setTacticEditLibMetadataJson",
    "setTacticEditLifecycleStatus",
    "setTacticEditPriority",
    "setTacticEditStartAt",
    "setTacticEditEndAt",
    "setTacticEditObjectiveOverride",
    "setTacticEditNotes",
    "setTacticEditSuccessMetricsJson",
    "setTacticEditDependenciesJson",
    "setTacticEditProjectMetadataJson",
    "tree",
    "projects",
    "selectedKey",
    "items",
    "tactics",
    "keyInput",
    "nameInput",
    "descInput",
    "projectTypeRows",
    "projectTypeSlug",
    "setProjectTypeSlug",
    "allowBreakdownOnCreate",
    "setAllowBreakdownOnCreate",
    "pmKindCreate",
    "brandIdInput",
    "wsKeyInput",
    "wsNameInput",
    "clientWsKey",
    "clientKeyInput",
    "clientNameInput",
    "brandClientId",
    "brandKeyInput",
    "brandNameInput",
    "tacticSearch",
    "tacticSearchRows",
    "tacticAttachId",
    "tacticNewKey",
    "tacticNewName",
    "tacticLifecycleStatus",
    "tacticPriority",
    "tacticStartAt",
    "tacticEndAt",
    "tacticObjective",
    "tacticNotes",
    "tacticSuccessMetricsJson",
    "tacticDependenciesJson",
    "tacticProjectMetadataJson",
    "tacticLibDescription",
    "tacticLibKind",
    "tacticLibChannel",
    "tacticLibMedium",
    "tacticLibFormat",
    "tacticLibTagsCsv",
    "tacticLibDefaultSuccessJson",
    "tacticLibDefaultDepsJson",
    "tacticLibDefaultStartOffsetDays",
    "tacticLibDefaultDurationDays",
    "tacticLibCadence",
    "tacticLibEstimatedCostCents",
    "tacticLibCurrency",
    "tacticLibOwner",
    "tacticLibStatus",
    "tacticLibMetadataJson",
    "msg",
    "err",
    "projectDeleteOpen",
    "projectDeleteConfirm",
    "wsDeleteTarget",
    "wsDeleteConfirm",
    "projectDocs",
    "uploadKind",
    "docKindFilter",
    "bulkCsvText",
    "bulkSkipExisting",
    "bulkResult",
    "bulkWorking",
    "manifestCsv",
    "manifestFolderFiles",
    "manifestLog",
    "manifestWorking",
    "tacticEditId",
    "tacticEditLibName",
    "tacticEditLibDescription",
    "tacticEditLibKind",
    "tacticEditLibChannel",
    "tacticEditLibMedium",
    "tacticEditLibFormat",
    "tacticEditLibTagsCsv",
    "tacticEditLibDefaultSuccessJson",
    "tacticEditLibDefaultDepsJson",
    "tacticEditLibCadence",
    "tacticEditLibEstimatedCostCents",
    "tacticEditLibCurrency",
    "tacticEditLibOwner",
    "tacticEditLibStatus",
    "tacticEditLibMetadataJson",
    "tacticEditLifecycleStatus",
    "tacticEditPriority",
    "tacticEditStartAt",
    "tacticEditEndAt",
    "tacticEditObjectiveOverride",
    "tacticEditNotes",
    "tacticEditSuccessMetricsJson",
    "tacticEditDependenciesJson",
    "tacticEditProjectMetadataJson",
    "loadProjectDocuments",
    "loadTree",
    "loadProjects",
    "loadItems",
    "onMarkItemResolved",
    "loadTactics",
    "loadTacticLibrarySearch",
    "selectedProject",
    "personalPm",
    "brandOptions",
    "clientOptions",
    "stepShell",
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
    "projectTypeCatalog",
    "onChangeProjectTypeSlug",
    "onSetAllowStructuredBreakdown",
]


def prefix_model_ids(body: str, comp: str) -> str:
    out = body
    if comp == "ProjectFilesPanel":
        out = out.replace("projectDocs.map((d: any)", "projectDocs.map((docRow: any)")
        out = re.sub(
            r"\bd\.(id|document_kind|original_filename|title|processing_status|error_message|created_at)\b",
            r"docRow.\1",
            out,
        )
    for k in sorted(KEYS, key=len, reverse=True):
        out = re.sub(rf"\b{k}\b", f"d.{k}", out)
    return out


for comp, lo, hi in CASES:
    body = "\n".join(shell_lines[lo - 1 : hi])

    if comp == "NarrativePanel":
        text = f"""'use client';

import {{ useWorkspacesData }} from '../WorkspacesDataContext';

export default function {comp}() {{
  void useWorkspacesData();
  return (
{body}
  );
}}
"""
        (out_dir / f"{comp}.tsx").write_text(text)
        continue

    if comp == "RawJsonPanel":
        inner = prefix_model_ids(body, comp)
        text = f"""{RAW_IMPORTS}

export default function {comp}() {{
  const d = useWorkspacesData();
  return (
{inner}
  );
}}
"""
        (out_dir / f"{comp}.tsx").write_text(text)
        continue

    if comp == "ProjectItemsPanel":
        inner = prefix_model_ids(body, comp)
        text = f"""{ITEMS_IMPORTS}

export default function {comp}() {{
  const d = useWorkspacesData();
  return (
{inner}
  );
}}
"""
        (out_dir / f"{comp}.tsx").write_text(text)
        continue

    inner = prefix_model_ids(body, comp)
    text = f"""{COMMON_IMPORTS}

export default function {comp}() {{
  const d = useWorkspacesData();
  return (
{inner}
  );
}}
"""
    (out_dir / f"{comp}.tsx").write_text(text)
    print(comp, len(text.splitlines()))
