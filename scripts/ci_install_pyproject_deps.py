#!/usr/bin/env python3
"""Install [project].dependencies (+ optional extras) from pyproject.toml — no package build."""
from __future__ import annotations

import subprocess
import sys
import tomllib
from pathlib import Path


def main() -> None:
    app_dir = Path(sys.argv[1]).resolve()
    extras = sys.argv[2:]
    data = tomllib.loads((app_dir / "pyproject.toml").read_text(encoding="utf-8"))
    proj = data.get("project") or {}
    deps: list[str] = list(proj.get("dependencies") or [])
    optional = proj.get("optional-dependencies") or {}
    for extra in extras:
        deps.extend(optional.get(extra) or [])
    if not deps:
        return
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-q", *deps],
        cwd=app_dir,
    )


if __name__ == "__main__":
    main()
