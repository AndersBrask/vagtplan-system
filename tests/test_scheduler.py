from core.models import Employee, Availability, ShiftSlot
from core.scheduler import generate_schedule
from core.constraints import build_constraints_from_config


def test_generate_schedule_runs():
    employees = [
        Employee(
            id="emp_1",
            name="Anna",
            roles=["lukkeansvarlig"],
            max_hours_per_week=10,
            availability=[Availability(day="monday", start="08:00", end="22:00")]
        )
    ]

    slots = [
        ShiftSlot(day="monday", start="08:00", end="09:00"),
        ShiftSlot(day="monday", start="09:00", end="10:00"),
    ]

    constraints = build_constraints_from_config([])
    schedule = generate_schedule(employees, slots, constraints)

    assert "monday" in schedule.schedule
