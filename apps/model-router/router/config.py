from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ollama_base_url: str = "http://ollama:11434"
    default_pm_model: str = "llama3.1:8b"
    default_builder_model: str = "qwen2.5:7b"
    default_code_model: str = "qwen2.5-coder:7b"
    default_canon_model: str = "llama3.2:3b"
    default_forge_model: str = "llama3.2:3b"
    default_synergy_model: str = "llama3.2:3b"
    default_clinic_model: str = "llama3.2:3b"
    default_kitt_model: str = "gemma3:270m"
    default_eddie_model: str = "deepseek-r1:1.5b"
    default_bubs_model: str = "tinyllama:1.1b"
    default_embed_model: str = "nomic-embed-text"

settings = Settings()
