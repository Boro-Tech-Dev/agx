from datetime import date

from fastapi import APIRouter, HTTPException, Query

from ..services import holiday_service

router = APIRouter(prefix='/api/calendar', tags=['calendar'])


@router.get('/holidays')
def list_holidays(
    from_date: date = Query(..., alias='from'),
    to_date: date = Query(..., alias='to'),
    country: str = Query('US', min_length=2, max_length=8),
):
    try:
        return holiday_service.list_in_range(country, from_date, to_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
