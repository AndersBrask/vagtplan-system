from typing import List, Optional, Dict
from pydantic import BaseModel


class Availability(BaseModel):
    day: str        # "monday"
    start: str      # "08:00"
    end: str        # "20:00"


class Employee(BaseModel):
    id: str
    name: str
    roles: List[str]
    max_hours_per_week: int = 37   
    max_hours_per_day: int = 8    
    availability: List[Availability]

class Area(BaseModel):
    id: str
    name: str
    roles: List[str]           
    default_min_staff: int = 1    
    min_staff_rules: Dict[str, List[Dict]] = {}  

class Role(BaseModel):
    id: str
    name: str


class OpeningHours(BaseModel):
    from_time: str  # "08:00"
    to_time: str    # "22:00"


class Config(BaseModel):
    opening_hours: Dict[str, OpeningHours]  # "monday": OpeningHours
    time_slot_minutes: int = 60


class ShiftSlot(BaseModel):
    day: str        # "monday"
    start: str      # "08:00"
    end: str        # "09:00"
    required_roles: List[str] = []


class ConstraintConfig(BaseModel):
    type: str
    id: str
    description: Optional[str] = None
    # resten er dynamisk afhængigt af type; vi håndterer det i constraints.py


class GeneratedSchedule(BaseModel):
    # schedule[day][slot_start] = [employee_ids]
    schedule: Dict[str, Dict[str, List[str]]]

class ConstraintViolation(BaseModel):
    constraint_id: str
    message: str
    day: str
    start: str
    end: str


class ScheduleResult(BaseModel):
    schedule: Dict[str, Dict[str, List[str]]]
    violations: List[ConstraintViolation] = []
