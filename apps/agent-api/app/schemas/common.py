from pydantic import BaseModel, Field, model_validator
from typing import Any
from uuid import UUID


class RunCreate(BaseModel):
    agent_key: str
    workflow: str = 'general'
    project_key: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    parent_run_id: UUID | None = None
    reply: str | None = None
    include_parent_summary: bool = True

class MemorySearch(BaseModel):
    query: str
    project_key: str | None = None
    workspace_key: str | None = None
    limit: int = 12
    document_kinds: list[str] | None = None
    agent: str | None = None
    embedder_override: str | None = None
    reranker_override: str | None = None

    @model_validator(mode='after')
    def workspace_when_no_project(self):
        if not self.project_key and not self.workspace_key:
            raise ValueError('workspace_key is required when project_key is null')
        return self

class IngestText(BaseModel):
    title: str | None = None
    content: str
    project_key: str | None = None
    workspace_key: str | None = None
    source_type: str = 'manual_text'
    source_uri: str | None = None
    confidence: str = 'medium'
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode='after')
    def workspace_when_no_project(self):
        if not self.project_key and not self.workspace_key:
            raise ValueError('workspace_key is required when project_key is null')
        return self
