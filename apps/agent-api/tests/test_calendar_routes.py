"""cd apps/agent-api && PYTHONPATH=. python3 -m unittest discover -s tests -v"""

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class TestCalendarRoutes(unittest.TestCase):
    def test_holidays_bad_range(self):
        c = TestClient(app)
        r = c.get('/api/calendar/holidays', params={'from': '2026-12-31', 'to': '2026-01-01'})
        self.assertEqual(r.status_code, 400)

    @patch('app.services.holiday_service.fetch')
    def test_holidays_ok(self, mock_fetch):
        mock_fetch.return_value = [{'date': '2026-07-04', 'name': 'Independence Day'}]
        c = TestClient(app)
        r = c.get('/api/calendar/holidays', params={'from': '2026-07-01', 'to': '2026-07-31'})
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(len(data['holidays']), 1)
        self.assertEqual(data['holidays'][0]['date'], '2026-07-04')
        self.assertEqual(data['holidays'][0]['name'], 'Independence Day')


if __name__ == '__main__':
    unittest.main()
