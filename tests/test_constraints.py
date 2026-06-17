from core.constraints import MinEmployeesConstraint
from core.models import ShiftSlot, Employee


def test_min_employees_constraint():
    c = MinEmployeesConstraint(
        id="test",
        days=["monday"],
        time_from="08:00",
        time_to="18:00",
        min_count=1,
    )

    schedule = {"monday": {"08:00": ["emp_1"]}}
    slot = ShiftSlot(day="monday", start="08:00", end="09:00")

    e = Employee(
        id="emp_1",
        name="Test",
        roles=[],
        max_hours_per_week=10,
        availability=[]
    )

    assert c.check(schedule, slot, [e]) is True
