from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://dd_agent:dd_agent_dev@postgres:5432/dd_agents"
    redis_url: str = "redis://redis:6379/0"
    model_router_url: str = "http://model-router:8085"
    agent_worker_url: str = "http://agent-worker:8091"
    # Dedicated planner HTTP service; if unset/blank, scenario routes fall back to agent_worker_url.
    scenario_worker_url: str = "http://scenario-worker:8093"
    artifact_root: str = "/artifacts"

settings = Settings()
