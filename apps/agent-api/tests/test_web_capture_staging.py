"""Tests for web capture staging profile merge."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services import web_capture_staging


def test_merge_without_profile_id_passthrough():
    payload = {'url': 'https://example.com', 'staging': {'wait_until': 'load'}}
    out = web_capture_staging.merge_web_capture_payload(payload)
    assert out == payload


def test_merge_requires_project_key():
    with pytest.raises(HTTPException) as exc:
        web_capture_staging.merge_web_capture_payload(
            {'url': 'https://example.com', 'staging_profile_document_id': str(uuid.uuid4())},
        )
    assert exc.value.status_code == 400


@patch('app.services.web_capture_staging.download_row')
def test_merge_loads_credentials(mock_download, tmp_path: Path):
    doc_id = str(uuid.uuid4())
    profile_path = tmp_path / 'profile.json'
    profile_path.write_text(
        json.dumps(
            {
                'http_credentials': {'username': 'gw', 'password': 'secret'},
                'form_login': {'username': 'u', 'password': 'p', 'username_selector': '#u'},
            },
        ),
        encoding='utf-8',
    )
    mock_download.return_value = (
        {'document_kind': 'web_capture_staging'},
        profile_path,
    )
    out = web_capture_staging.merge_web_capture_payload(
        {
            'url': 'https://example.com',
            'project_key': 'proj-a',
            'staging_profile_document_id': doc_id,
            'staging': {'wait_until': 'networkidle'},
        },
    )
    assert 'staging_profile_document_id' not in out
    assert 'project_key' not in out
    assert out['staging']['wait_until'] == 'networkidle'
    assert out['staging']['http_credentials']['username'] == 'gw'
    assert out['staging']['form_login']['username_selector'] == '#u'
