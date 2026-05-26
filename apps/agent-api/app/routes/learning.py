from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..deps.dashboard_user import require_user_sub
from ..services import learning_service as svc

router = APIRouter(prefix='/api/learning', tags=['learning'])

_user = Depends(require_user_sub)


class EnrollBody(BaseModel):
    playbook_id: str = Field(..., min_length=1, max_length=120)
    brand_key: str | None = Field(default=None, max_length=120)


class CompleteBody(BaseModel):
    quiz_answers: dict[str, Any] | None = None


class CoachBody(BaseModel):
    enrollment_id: str
    message: str = Field(..., min_length=1, max_length=8000)
    step_id: str | None = None


@router.get('/catalog')
def catalog():
    return {'playbooks': svc.list_catalog()}


@router.get('/playbooks/{playbook_id}')
def playbook(playbook_id: str, brand_key: str | None = Query(default=None)):
    return svc.get_playbook(playbook_id, brand_key)


@router.post('/enroll')
def enroll(body: EnrollBody, user_sub: str = _user):
    return svc.enroll(user_sub, body.playbook_id.strip(), body.brand_key)


@router.get('/enrollments/me')
def enrollments_me(user_sub: str = _user):
    return {'enrollments': svc.list_my_enrollments(user_sub)}


@router.get('/enrollments/me/recap-due')
def recap_due(user_sub: str = _user):
    return {'enrollments': svc.list_recap_due(user_sub)}


@router.get('/enrollments/me/competencies')
def competencies_me(user_sub: str = _user):
    return {'competencies': svc.list_competencies(user_sub)}


@router.get('/enrollments/{enrollment_id}')
def enrollment_detail(enrollment_id: str, user_sub: str = _user):
    return svc.get_enrollment(enrollment_id, user_sub)


@router.post('/enrollments/{enrollment_id}/steps/{step_id}/complete')
def step_complete(
    enrollment_id: str,
    step_id: str,
    body: CompleteBody | None = None,
    user_sub: str = _user,
):
    return svc.complete_step(enrollment_id, user_sub, step_id, (body or CompleteBody()).quiz_answers)


@router.post('/enrollments/{enrollment_id}/validate')
def validate(
    enrollment_id: str,
    step_id: str | None = Query(default=None),
    user_sub: str = _user,
):
    return svc.validate_step(enrollment_id, user_sub, step_id)


@router.patch('/enrollments/{enrollment_id}/content-seen')
def content_seen(enrollment_id: str, user_sub: str = _user):
    return svc.mark_content_seen(enrollment_id, user_sub)


@router.get('/enrollments/{enrollment_id}/certificate')
def certificate(enrollment_id: str, user_sub: str = _user):
    return svc.certificate_data(enrollment_id, user_sub)


@router.get('/ops/summary')
def ops_summary(user_sub: str = _user):
    return {'rows': svc.ops_summary()}


@router.post('/coach')
async def coach(body: CoachBody, user_sub: str = _user):
    return await svc.coach(user_sub, body.enrollment_id, body.message, body.step_id)
