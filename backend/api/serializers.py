from typing import List
from pydantic import BaseModel

from core.models import Employee, ScheduleResult, Area


class EmployeeCreate(BaseModel):
    name: str
    roles: List[str]
    max_hours_per_week: int


class EmployeeResponse(Employee):
    pass


class AreaResponse(Area):
    pass


class ScheduleResponse(ScheduleResult):
    # ekstra felt, som kun bruges til frontendens time-beregning
    slot_minutes: int = 60
