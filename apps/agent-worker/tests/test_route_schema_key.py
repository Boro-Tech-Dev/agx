"""Schema key selection for model-router (no HTTP)."""

import unittest

from worker.workflows.schema_route_key import router_schema_key
from worker.workflows.schemas import (
    BUILDER_SCHEMA,
    FORGE_SCHEMA,
    PM_SCHEMA_BUSINESS,
    PM_SCHEMA_PERSONAL,
    SCHEMAS,
    KITT_SCHEMA_TRIAGE,
)


class TestRouteSchemaKey(unittest.TestCase):
    def test_pm_business_and_personal(self):
        self.assertEqual(router_schema_key('pm', PM_SCHEMA_BUSINESS), 'pm_business')
        self.assertEqual(router_schema_key('pm', PM_SCHEMA_PERSONAL), 'pm_personal')
        self.assertIsNone(router_schema_key('pm', {'type': 'object'}))

    def test_agent_matches_schemas_dict(self):
        self.assertEqual(router_schema_key('synergy', SCHEMAS['synergy']), 'synergy')
        self.assertEqual(router_schema_key('builder', BUILDER_SCHEMA), 'builder')
        self.assertEqual(router_schema_key('kitt', SCHEMAS['kitt']), 'kitt')
        self.assertEqual(router_schema_key('kitt', KITT_SCHEMA_TRIAGE), 'kitt')
        self.assertIsNone(router_schema_key('kitt', PM_SCHEMA_BUSINESS))
        self.assertEqual(router_schema_key('bubs', PM_SCHEMA_PERSONAL), 'bubs')
        self.assertEqual(router_schema_key('eddie', FORGE_SCHEMA), 'eddie')


if __name__ == '__main__':
    unittest.main()
