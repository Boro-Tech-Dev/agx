"""Timing profile ids loaded from config/scenario_planner/timing_profiles.json."""

from __future__ import annotations

from worker.scenario_engine.timing_profiles import scenario_tactics_tuple

ScenarioTactic = str

SCENARIO_TACTICS: tuple[str, ...] = scenario_tactics_tuple()
