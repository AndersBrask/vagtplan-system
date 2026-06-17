from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException

from datetime import datetime, timedelta

from core.models import Employee, ShiftSlot, OpeningHours, Config, Area
from core.constraints import build_constraints_from_config
from core.scheduler import generate_schedule, evaluate_schedule
from core.utils import generate_time_slots
from .serializers import ScheduleResponse, EmployeeResponse, AreaResponse

import json
from pathlib import Path


router = APIRouter()


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def load_json(name: str):
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(name: str, data):
    with open(DATA_DIR / name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _subtract_minutes(time_str: str, minutes: int) -> str:
    """Hjælpefunktion: '21:00' - 60 min -> '20:00'."""
    dt = datetime.strptime(time_str, "%H:%M")
    dt2 = dt - timedelta(minutes=minutes)
    return dt2.strftime("%H:%M")


def build_auto_constraints_from_global_config(config_data: dict) -> list[dict]:
    """
    Bygger automatiske constraints ud fra global config.
    - closing.require_closing_responsible + closing.closing_role:
      -> role_required i sidste åbningstime for hver dag.
    - planning.max_consecutive_days / min_rest_hours_between_days:
      -> 'globale' constraints (forberedt til motoren).
    Disse auto-constraints bliver IKKE gemt i constraints.json.
    """
    auto: list[dict] = []

    opening_hours = config_data.get("opening_hours", {})
    slot_minutes = config_data.get("time_slot_minutes", 60)

    # 1) Lukkeansvarlig i sidste time
    closing_cfg = config_data.get("closing") or {}
    require_closing = closing_cfg.get("require_closing_responsible", False)
    closing_role = closing_cfg.get("closing_role")

    if require_closing and closing_role:
        for day_key, oh in opening_hours.items():
            day_from = oh.get("from")
            day_to = oh.get("to")
            if not day_from or not day_to:
                continue

            last_start = _subtract_minutes(day_to, slot_minutes)

            auto.append(
                {
                    "id": f"auto_closing_{day_key}",
                    "type": "role_required",
                    "description": f"Automatisk: {closing_role} i sidste time ({day_key})",
                    "days": [day_key],
                    "time_from": last_start,
                    "time_to": day_to,
                    "role": closing_role,
                }
            )

    # 2) Globale planlægningsregler (forberedt)
    planning_cfg = config_data.get("planning") or {}

    max_consecutive = planning_cfg.get("max_consecutive_days")
    if max_consecutive:
        auto.append(
            {
                "id": "auto_max_consecutive_days",
                "type": "max_consecutive_days",
                "max_consecutive_days": max_consecutive,
            }
        )

    min_rest = planning_cfg.get("min_rest_hours_between_days")
    if min_rest:
        auto.append(
            {
                "id": "auto_min_rest_hours_between_days",
                "type": "min_rest_hours_between_days",
                "min_rest_hours": min_rest,
            }
        )

    return auto



@router.get("/health")
def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Medarbejdere
# ---------------------------------------------------------------------------

@router.get("/employees", response_model=List[EmployeeResponse])
def get_employees():
    employees_data = load_json("employees.json")
    employees = [Employee(**e) for e in employees_data["employees"]]
    return employees


@router.post("/employees", response_model=EmployeeResponse)
def create_employee(employee: EmployeeResponse):
    employees_data = load_json("employees.json")
    employees = employees_data.get("employees", [])

    # hvis id ikke er sat, generér et nyt
    if not employee.id:
        existing_ids = {e["id"] for e in employees}
        i = 1
        new_id = f"emp_{i}"
        while new_id in existing_ids:
            i += 1
            new_id = f"emp_{i}"
        employee.id = new_id

    employees.append(employee.model_dump())
    employees_data["employees"] = employees
    save_json("employees.json", employees_data)
    return employee


@router.put("/employees/{emp_id}", response_model=EmployeeResponse)
def update_employee(emp_id: str, employee: EmployeeResponse):
    employees_data = load_json("employees.json")
    employees = employees_data.get("employees", [])

    for i, e in enumerate(employees):
        if e["id"] == emp_id:
            payload = employee.model_dump()
            payload["id"] = emp_id  # lås id til path-param
            employees[i] = payload
            employees_data["employees"] = employees
            save_json("employees.json", employees_data)
            return Employee(**payload)

    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Employee not found")


@router.delete("/employees/{emp_id}")
def delete_employee(emp_id: str):
    employees_data = load_json("employees.json")
    employees = employees_data.get("employees", [])

    new_employees = [e for e in employees if e["id"] != emp_id]

    if len(new_employees) == len(employees):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Employee not found")

    employees_data["employees"] = new_employees
    save_json("employees.json", employees_data)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Vagtplan
# ---------------------------------------------------------------------------

@router.get("/schedule", response_model=ScheduleResponse)
def get_schedule(area: Optional[str] = Query(default=None)):
    employees_data = load_json("employees.json")
    config_data = load_json("config.json")
    constraints_data = load_json("constraints.json")
    areas_data = load_json("areas.json")

    all_employees = [Employee(**e) for e in employees_data["employees"]]
    areas = [Area(**a) for a in areas_data.get("areas", [])]

    # --- Config & åbningstider ---
    opening_hours = {
        day: OpeningHours(from_time=val["from"], to_time=val["to"])
        for day, val in config_data["opening_hours"].items()
    }

    cfg = Config(
        opening_hours=opening_hours,
        time_slot_minutes=config_data.get("time_slot_minutes", 60),
    )

    # --- Constraints: base + auto (closing, osv.) ---
    base_constraints_cfg = constraints_data.get("constraints", [])
    auto_constraints_cfg = build_auto_constraints_from_global_config(config_data)
    all_constraints_cfg = base_constraints_cfg + auto_constraints_cfg

    # Global state til timer og dagsfordeling på *tværs af områder*
    hours_worked: Dict[str, float] = {e.id: 0.0 for e in all_employees}
    day_hours_worked: Dict[tuple, float] = {}
    emp_day_assignments: Dict[tuple, set] = {}

    schedules_by_area: Dict[str, Dict[str, Dict[str, List[str]]]] = {}
    violations_by_area: Dict[str, List] = {}

    # Hvis der ikke er defineret områder → lav én samlet "global" plan
    if not areas:
        employees = all_employees

        slots: List[ShiftSlot] = []
        for day, oh in cfg.opening_hours.items():
            for start, end in generate_time_slots(
                oh.from_time, oh.to_time, cfg.time_slot_minutes
            ):
                slots.append(
                    ShiftSlot(day=day, start=start, end=end, required_roles=[])
                )

        # kun constraints uden area-felt
        filtered_constraints_cfg = [
            c for c in all_constraints_cfg if ("area" not in c or c.get("area") is None)
        ]
        constraints = build_constraints_from_config(filtered_constraints_cfg)

        generated = generate_schedule(
            employees,
            slots,
            constraints,
            hours_worked=hours_worked,
            day_hours_worked=day_hours_worked,
            emp_day_assignments=emp_day_assignments,
        )
        violations = evaluate_schedule(generated.schedule, employees, slots, constraints)

        schedules_by_area["__global__"] = generated.schedule
        violations_by_area["__global__"] = violations

        target_area_id = "__global__"

    else:
        # Der findes områder: planlæg alle én efter én, men med globalt timeregnskab
        for area_cfg in areas:
            area_id = area_cfg.id

            # medarbejdere der kan arbejde i området (roller)
            allowed_roles = set(area_cfg.roles)
            employees = [
                e for e in all_employees if any(r in allowed_roles for r in e.roles)
            ]

            # tids-slots for dette område
            slots: List[ShiftSlot] = []
            for day, oh in cfg.opening_hours.items():
                for start, end in generate_time_slots(
                    oh.from_time, oh.to_time, cfg.time_slot_minutes
                ):
                    slots.append(
                        ShiftSlot(day=day, start=start, end=end, required_roles=[])
                    )

            # constraints for dette område + globale
            filtered_constraints_cfg = [
                c
                for c in all_constraints_cfg
                if (c.get("area") == area_id)
                or ("area" not in c or c.get("area") is None)
            ]
            constraints = build_constraints_from_config(filtered_constraints_cfg)

            generated = generate_schedule(
                employees,
                slots,
                constraints,
                hours_worked=hours_worked,
                day_hours_worked=day_hours_worked,
                emp_day_assignments=emp_day_assignments,
            )
            violations = evaluate_schedule(
                generated.schedule, employees, slots, constraints
            )

            schedules_by_area[area_id] = generated.schedule
            violations_by_area[area_id] = violations

        # hvilken area skal vi returnere?
        if area:
            target_area_id = area
        else:
            target_area_id = areas[0].id  # default første område

    schedule_for_area = schedules_by_area.get(target_area_id, {})
    violations_for_area = violations_by_area.get(target_area_id, [])

    return ScheduleResponse(
        schedule=schedule_for_area,
        violations=violations_for_area,
        slot_minutes=cfg.time_slot_minutes,
    )


@router.post("/schedule/fix", response_model=ScheduleResponse)
def fix_schedule():
    """
    Placeholder-endpoint til en mere avanceret 'fix'-algoritme.
    Lige nu genererer den bare en ny plan med samme motor.
    """
    return get_schedule()


# ---------------------------------------------------------------------------
# Områder
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Områder
# ---------------------------------------------------------------------------

@router.get("/areas", response_model=List[AreaResponse])
def get_areas():
    data = load_json("areas.json")
    return [Area(**a) for a in data.get("areas", [])]


@router.post("/areas", response_model=AreaResponse)
def create_area(area: AreaResponse):
    """
    Opret et nyt område.
    ID skal være unikt – hvis det allerede findes, får du 400.
    """
    data = load_json("areas.json")
    areas = data.get("areas", [])

    if any(a["id"] == area.id for a in areas):
        raise HTTPException(status_code=400, detail="Area id already exists")

    areas.append(area.model_dump())
    data["areas"] = areas
    save_json("areas.json", data)
    return area


@router.put("/areas/{area_id}", response_model=AreaResponse)
def update_area(area_id: str, area: AreaResponse):
    data = load_json("areas.json")
    areas = data.get("areas", [])

    for i, a in enumerate(areas):
        if a["id"] == area_id:
            payload = area.model_dump()
            payload["id"] = area_id  # lås id til path-param
            areas[i] = payload
            data["areas"] = areas
            save_json("areas.json", data)
            return Area(**payload)

    raise HTTPException(status_code=404, detail="Area not found")


@router.delete("/areas/{area_id}")
def delete_area(area_id: str):
    data = load_json("areas.json")
    areas = data.get("areas", [])

    new_areas = [a for a in areas if a["id"] != area_id]
    if len(new_areas) == len(areas):
        raise HTTPException(status_code=404, detail="Area not found")

    data["areas"] = new_areas
    save_json("areas.json", data)
    return {"status": "ok"}

# ---------------------------------------------------------------------------
# Global config (åbningstider, tidsinterval)
# ---------------------------------------------------------------------------

@router.get("/config")
def get_config() -> Dict[str, Any]:
    """
    Returnerer config.json, fx:
    {
      "opening_hours": {
        "monday": {"from": "08:00", "to": "21:00"},
        ...
      },
      "time_slot_minutes": 60
    }
    """
    return load_json("config.json")


@router.put("/config")
def update_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Overskriver config.json med det payload, der kommer fra frontend.
    Her kunne vi senere lægge mere validering ind.
    """
    # Evt. lidt defensiv validering
    if "opening_hours" not in payload or "time_slot_minutes" not in payload:
        raise HTTPException(
            status_code=400,
            detail="Config skal indeholde 'opening_hours' og 'time_slot_minutes'",
        )

    save_json("config.json", payload)
    return payload

# ---------------------------------------------------------------------------
# Constraints (regler)
# ---------------------------------------------------------------------------

@router.get("/constraints")
def get_constraints():
    """
    Returnerer hele constraints.json, typisk:
    { "constraints": [ ... ] }
    """
    return load_json("constraints.json")


@router.put("/constraints")
def update_constraints(payload: dict):
    """
    Forventer et payload med key "constraints": [ ... ].
    Overskriver constraints.json med det nye indhold.
    """
    from fastapi import HTTPException

    if "constraints" not in payload or not isinstance(payload["constraints"], list):
        raise HTTPException(
            status_code=400,
            detail="Payload skal indeholde en liste i 'constraints'",
        )

    save_json("constraints.json", payload)
    return payload

