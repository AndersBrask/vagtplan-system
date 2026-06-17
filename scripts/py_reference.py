"""Dumper Python-scheduleren's output for alle områder som JSON (reference)."""
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from core.models import Employee, ShiftSlot, OpeningHours, Config, Area
from core.constraints import build_constraints_from_config
from core.scheduler import generate_schedule, evaluate_schedule
from core.utils import generate_time_slots
from api.endpoints import build_auto_constraints_from_global_config

DATA = BACKEND / "data"
load = lambda n: json.loads((DATA / n).read_text(encoding="utf-8"))

employees_data = load("employees.json")
config_data = load("config.json")
constraints_data = load("constraints.json")
areas_data = load("areas.json")

all_employees = [Employee(**e) for e in employees_data["employees"]]
areas = [Area(**a) for a in areas_data.get("areas", [])]

opening_hours = {
    day: OpeningHours(from_time=val["from"], to_time=val["to"])
    for day, val in config_data["opening_hours"].items()
}
cfg = Config(opening_hours=opening_hours, time_slot_minutes=config_data.get("time_slot_minutes", 60))

base = constraints_data.get("constraints", [])
auto = build_auto_constraints_from_global_config(config_data)
all_cfg = base + auto

hours_worked = {e.id: 0.0 for e in all_employees}
day_hours_worked = {}
emp_day_assignments = {}

out = {}
for area_cfg in areas:
    allowed = set(area_cfg.roles)
    emps = [e for e in all_employees if any(r in allowed for r in e.roles)]
    slots = []
    for day, oh in cfg.opening_hours.items():
        for start, end in generate_time_slots(oh.from_time, oh.to_time, cfg.time_slot_minutes):
            slots.append(ShiftSlot(day=day, start=start, end=end, required_roles=[]))
    filtered = [c for c in all_cfg if c.get("area") == area_cfg.id or ("area" not in c or c.get("area") is None)]
    constraints = build_constraints_from_config(filtered)
    gen = generate_schedule(emps, slots, constraints, hours_worked, day_hours_worked, emp_day_assignments)
    out[area_cfg.id] = gen.schedule

print(json.dumps(out, sort_keys=True))
