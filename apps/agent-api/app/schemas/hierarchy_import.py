from pydantic import BaseModel, Field


class HierarchyImportRequest(BaseModel):
    csv_text: str = Field(..., min_length=1, description='UTF-8 CSV with header row; see docs/workspace_bulk_import.md')
    dry_run: bool = False
    skip_existing: bool = False
