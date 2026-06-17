from typing import List, Dict, Optional
from datetime import datetime

from .models import Employee, ShiftSlot, GeneratedSchedule, ConstraintViolation
from .constraints import (
    Constraint,
    Schedule,
    MinEmployeesConstraint,
    MaxEmployeesConstraint,
    NoShiftsConstraint,
    RoleRequiredConstraint,
    RoleForbiddenConstraint,
)


# ---------------------------------------------------------------------------
# Hjælpere
# ---------------------------------------------------------------------------


def can_assign_single_block(
    emp_id: str,
    day: str,
    slot_start: str,
    day_slot_starts: Dict[str, List[str]],
    emp_day_assignments: Dict[tuple, set],
) -> bool:
    """
    Sikrer at medarbejderen kun har én sammenhængende blok pr. dag.
    Vi tillader at fylde "inde i" den eksisterende blok, og at
    udvide med præcis én slot i hver ende.
    """
    assigned = emp_day_assignments.get((emp_id, day), set())
    if not assigned:
        return True

    slots = day_slot_starts[day]
    try:
        idx = slots.index(slot_start)
    except ValueError:
        return True

    assigned_indices = [slots.index(s) for s in assigned]
    min_idx = min(assigned_indices)
    max_idx = max(assigned_indices)

    return (min_idx - 1) <= idx <= (max_idx + 1)


def is_employee_available(employee: Employee, day: str, start: str, end: str) -> bool:
    for a in employee.availability:
        if a.day == day and a.start <= start and a.end >= end:
            return True
    return False


def slot_duration_in_hours(slot: ShiftSlot) -> float:
    """
    Beregn varighed af et timeslot i timer ud fra start/slut.
    """
    fmt = "%H:%M"
    start_dt = datetime.strptime(slot.start, fmt)
    end_dt = datetime.strptime(slot.end, fmt)
    return (end_dt - start_dt).seconds / 3600.0


def get_weekly_cap(e: Employee) -> float:
    return float(getattr(e, "max_hours_per_week", 37))


def get_daily_cap(e: Employee) -> float:
    return float(getattr(e, "max_hours_per_day", 8))


def get_slot_requirements(
    constraints: List[Constraint],
    slot: ShiftSlot,
) -> tuple[int, int, List[str]]:
    """
    Find min-/max-antal og krævede roller for et slot.
    """
    min_emp = 0
    max_emp = 9999
    required_roles = set(slot.required_roles or [])

    for c in constraints:
        if isinstance(c, MinEmployeesConstraint):
            if slot.day in c.days and c.time_from <= slot.start < c.time_to:
                min_emp = max(min_emp, c.min_count)
        elif isinstance(c, MaxEmployeesConstraint):
            if slot.day in c.days and c.time_from <= slot.start < c.time_to:
                max_emp = min(max_emp, c.max_count)
        elif isinstance(c, RoleRequiredConstraint):
            if slot.day in c.days:
                if c.time_from and c.time_to:
                    if not (c.time_from <= slot.start < c.time_to):
                        continue
                required_roles.add(c.role)

    return min_emp, max_emp, list(required_roles)


def slot_is_blocked_by_no_shifts(
    constraints: List[Constraint],
    slot: ShiftSlot,
) -> bool:
    """
    True hvis et no_shifts-constraint blokerer slotten.
    """
    for c in constraints:
        if isinstance(c, NoShiftsConstraint):
            if slot.day in c.days and c.time_from <= slot.start < c.time_to:
                return True
    return False


def get_forbidden_roles_for_slot(
    constraints: List[Constraint],
    slot: ShiftSlot,
) -> List[str]:
    """
    Samler roller, der er forbudt i denne slot.
    """
    forbidden: set[str] = set()
    for c in constraints:
        if isinstance(c, RoleForbiddenConstraint):
            if slot.day not in c.days:
                continue
            if c.time_from and c.time_to:
                if not (c.time_from <= slot.start < c.time_to):
                    continue
            forbidden.add(c.role)
    return list(forbidden)


def _remaining_week_hours(e: Employee, hours_worked: Dict[str, float]) -> float:
    """
    Hvor mange timer mangler medarbejderen op til sin kontrakt?
    Bruges til at minimere forskellen til max_hours_per_week.
    """
    cap = get_weekly_cap(e)
    used = hours_worked.get(e.id, 0.0)
    return max(0.0, cap - used)


def _has_adjacent_block(
    e: Employee,
    slot: ShiftSlot,
    day_slot_starts: Dict[str, List[str]],
    emp_day_assignments: Dict[tuple, set],
) -> bool:
    """
    Returnerer True hvis denne slot kan forlænge en eksisterende blok
    samme dag for denne medarbejder (dvs. nabo-slot).
    """
    assigned = emp_day_assignments.get((e.id, slot.day), set())
    if not assigned:
        return False

    slots = day_slot_starts[slot.day]
    try:
        idx = slots.index(slot.start)
    except ValueError:
        return False

    # har vedkommende en slot lige før eller efter?
    before = slots[idx - 1] if idx > 0 else None
    after = slots[idx + 1] if idx + 1 < len(slots) else None
    return (before in assigned) or (after in assigned)


def _candidate_score(
    e: Employee,
    slot: ShiftSlot,
    hours_worked: Dict[str, float],
    day_slot_starts: Dict[str, List[str]],
    emp_day_assignments: Dict[tuple, set],
) -> float:
    """
    Højere score = mere attraktiv kandidat.

    Vi kombinerer:
    - stor remaining_week_hours  → vi vil gerne give timer til dem der mangler
    - bonus hvis vi kan forlænge en eksisterende blok samme dag
      → færre personer på arbejde og længere vagter
    """
    remaining = _remaining_week_hours(e, hours_worked)  # i timer
    adj = 1.0 if _has_adjacent_block(e, slot, day_slot_starts, emp_day_assignments) else 0.0

    # Vægte kan justeres – adjacency får en stor bonus
    return adj * 1000.0 + remaining


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------


def generate_schedule(
    employees: List[Employee],
    slots: List[ShiftSlot],
    constraints: List[Constraint],
    # global state kan deles mellem områder
    hours_worked: Optional[Dict[str, float]] = None,
    day_hours_worked: Optional[Dict[tuple, float]] = None,
    emp_day_assignments: Optional[Dict[tuple, set]] = None,
) -> GeneratedSchedule:
    """
    Genererer en plan for *disse* slots, men timer m.m. kan genbruges globalt,
    hvis man giver dictionaries med ind udefra (til global scheduler).

    Mål:
    - Overhold constraints
    - Brug så få personer pr. tidsrum som muligt (vi kører kun op til min_emp)
    - Fordel timer, så forskellen til max_hours_per_week minimeres
      (via _remaining_week_hours + _candidate_score)
    """
    schedule: Schedule = {}

    # Hvis der ikke er givet globale dicts, initialiser lokalt
    if hours_worked is None:
        hours_worked = {e.id: 0.0 for e in employees}
    else:
        for e in employees:
            hours_worked.setdefault(e.id, 0.0)

    if day_hours_worked is None:
        day_hours_worked = {}

    if emp_day_assignments is None:
        emp_day_assignments = {}

    # hvilke slots findes pr. dag (kun for denne del-plan, fx ét område)
    day_slot_starts: Dict[str, List[str]] = {}

    for slot in slots:
        schedule.setdefault(slot.day, {})
        schedule[slot.day].setdefault(slot.start, [])
        day_slot_starts.setdefault(slot.day, [])
        if slot.start not in day_slot_starts[slot.day]:
            day_slot_starts[slot.day].append(slot.start)

    for day in day_slot_starts:
        day_slot_starts[day].sort()

    # Gennemgå alle slots
    for slot in slots:
        day_slots = schedule[slot.day][slot.start]

        min_emp, max_emp, required_roles = get_slot_requirements(constraints, slot)

        # spring helt over hvis der er no_shifts
        if slot_is_blocked_by_no_shifts(constraints, slot):
            continue

        forbidden_roles = set(get_forbidden_roles_for_slot(constraints, slot))

        # Kandidater der KAN arbejde dette slot (tilgængelighed + caps + ikke-forbudte roller)
        base_candidates: List[Employee] = []
        for e in employees:
            if not is_employee_available(e, slot.day, slot.start, slot.end):
                continue
            if any(r in forbidden_roles for r in e.roles):
                continue

            dur = slot_duration_in_hours(slot)
            new_week = hours_worked[e.id] + dur
            new_day = day_hours_worked.get((e.id, slot.day), 0.0) + dur

            if new_week > get_weekly_cap(e):
                continue
            if new_day > get_daily_cap(e):
                continue

            base_candidates.append(e)

        # ------------------------------------------------------------------
        # 1) Dæk required roles
        # ------------------------------------------------------------------
        for role in required_roles:
            # Tjek om rollen allerede er dækket
            already_has_role = False
            for emp_id in day_slots:
                emp = next((e for e in employees if e.id == emp_id), None)
                if emp and role in emp.roles:
                    already_has_role = True
                    break
            if already_has_role:
                continue

            role_candidates = [
                e
                for e in base_candidates
                if role in e.roles and e.id not in day_slots
            ]

            # Mest attraktive kandidat først
            role_candidates.sort(
                key=lambda e: _candidate_score(
                    e, slot, hours_worked, day_slot_starts, emp_day_assignments
                ),
                reverse=True,
            )

            for e in role_candidates:
                if len(day_slots) >= max_emp:
                    break

                dur = slot_duration_in_hours(slot)
                if hours_worked[e.id] + dur > get_weekly_cap(e):
                    continue
                if day_hours_worked.get((e.id, slot.day), 0.0) + dur > get_daily_cap(e):
                    continue

                if not can_assign_single_block(
                    e.id, slot.day, slot.start, day_slot_starts, emp_day_assignments
                ):
                    continue

                day_slots.append(e.id)
                hours_worked[e.id] += dur
                day_hours_worked[(e.id, slot.day)] = day_hours_worked.get(
                    (e.id, slot.day), 0.0
                ) + dur
                emp_day_assignments.setdefault((e.id, slot.day), set()).add(slot.start)
                break

        # ------------------------------------------------------------------
        # 2) Fyld op til min_emp (men ikke over max_emp)
        # ------------------------------------------------------------------
        while len(day_slots) < min_emp and len(day_slots) < max_emp:
            candidates = [e for e in base_candidates if e.id not in day_slots]
            if not candidates:
                break

            candidates.sort(
                key=lambda e: _candidate_score(
                    e, slot, hours_worked, day_slot_starts, emp_day_assignments
                ),
                reverse=True,
            )

            assigned_any = False
            for chosen in candidates:
                dur = slot_duration_in_hours(slot)

                if hours_worked[chosen.id] + dur > get_weekly_cap(chosen):
                    continue
                if day_hours_worked.get((chosen.id, slot.day), 0.0) + dur > get_daily_cap(
                    chosen
                ):
                    continue

                if not can_assign_single_block(
                    chosen.id, slot.day, slot.start, day_slot_starts, emp_day_assignments
                ):
                    continue

                day_slots.append(chosen.id)
                hours_worked[chosen.id] += dur
                day_hours_worked[(chosen.id, slot.day)] = day_hours_worked.get(
                    (chosen.id, slot.day), 0.0
                ) + dur
                emp_day_assignments.setdefault((chosen.id, slot.day), set()).add(
                    slot.start
                )
                assigned_any = True
                break

            if not assigned_any:
                break

    return GeneratedSchedule(schedule=schedule)


# ---------------------------------------------------------------------------
# Evaluering
# ---------------------------------------------------------------------------


def evaluate_schedule(
    schedule: Schedule,
    employees: List[Employee],
    slots: List[ShiftSlot],
    constraints: List[Constraint],
) -> List[ConstraintViolation]:
    violations: List[ConstraintViolation] = []

    for slot in slots:
        for c in constraints:
            if not c.check(schedule, slot, employees):
                message = c.description or f"Constraint {c.id} violated"
                violations.append(
                    ConstraintViolation(
                        constraint_id=c.id,
                        message=message,
                        day=slot.day,
                        start=slot.start,
                        end=slot.end,
                    )
                )
    return violations
