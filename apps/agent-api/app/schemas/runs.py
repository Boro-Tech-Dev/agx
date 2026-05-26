from pydantic import BaseModel, Field
from typing import Any, Literal

AgentKey = Literal["pm", "synergy", "clinic", "builder", "canon", "forge", "kitt", "eddie", "bubs"]

class CreateRunRequest(BaseModel):
    agent_key: AgentKey
    workflow: str
    project_key: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)

class CreateRunResponse(BaseModel):
    run_id: str
    status: str
    message: str
