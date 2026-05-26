from router.config import settings

def resolve_model(agent: str, override: str | None = None) -> str:
    if override:
        return override
    return {
        "pm": settings.default_pm_model,
        "builder": settings.default_builder_model,
        "canon": settings.default_canon_model,
        "forge": settings.default_forge_model,
        "synergy": settings.default_synergy_model,
        "clinic": settings.default_clinic_model,
        "kitt": settings.default_kitt_model,
        "eddie": settings.default_eddie_model,
        "bubs": settings.default_bubs_model,
        "embeddings": settings.default_embed_model,
    }.get(agent, settings.default_pm_model)
