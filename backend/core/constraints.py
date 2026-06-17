from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Dict, Any

from .models import ShiftSlot, Employee


Schedule = Dict[str, Dict[str, List[str]]]


class Constraint(ABC):
    id: str
    description: str

    def __init__(self, id: str, description: str = ""):
        self.id = id
        self.description = description

    @abstractmethod
    def check(
        self,
        schedule: Schedule,
        slot: ShiftSlot,
        employees: List[Employee],
    ) -> bool:
        """
        Returner True hvis constraint er opfyldt for den givne slot,
        baseret på den aktuelle schedule.
        """
        ...


# --------- Min / max bemanding ---------


class MinEmployeesConstraint(Constraint):
    def __init__(
        self,
        id: str,
        days: List[str],
        time_from: str,
        time_to: str,
        min_count: int,
        description: str = "",
    ):
        super().__init__(id, description)
        self.days = days
        self.time_from = time_from
        self.time_to = time_to
        self.min_count = min_count

    def check(
        self,
        schedule: Schedule,
        slot: ShiftSlot,
        employees: List[Employee],
    ) -> bool:
        if slot.day not in self.days:
            return True
        if not (self.time_from <= slot.start < self.time_to):
            return True

        assigned = schedule.get(slot.day, {}).get(slot.start, [])
        return len(assigned) >= self.min_count


class MaxEmployeesConstraint(Constraint):
    def __init__(
        self,
        id: str,
        days: List[str],
        time_from: str,
        time_to: str,
        max_count: int,
        description: str = "",
    ):
        super().__init__(id, description)
        self.days = days
        self.time_from = time_from
        self.time_to = time_to
        self.max_count = max_count

    def check(
        self,
        schedule: Schedule,
        slot: ShiftSlot,
        employees: List[Employee],
    ) -> bool:
        if slot.day not in self.days:
            return True
        if not (self.time_from <= slot.start < self.time_to):
            return True

        assigned = schedule.get(slot.day, {}).get(slot.start, [])
        return len(assigned) <= self.max_count


class NoShiftsConstraint(Constraint):
    """
    Ingen skal være på arbejde i de angivne slots.
    """

    def __init__(
        self,
        id: str,
        days: List[str],
        time_from: str,
        time_to: str,
        description: str = "",
    ):
        super().__init__(id, description)
        self.days = days
        self.time_from = time_from
        self.time_to = time_to

    def check(
        self,
        schedule: Schedule,
        slot: ShiftSlot,
        employees: List[Employee],
    ) -> bool:
        if slot.day not in self.days:
            return True
        if not (self.time_from <= slot.start < self.time_to):
            return True

        assigned = schedule.get(slot.day, {}).get(slot.start, [])
        # Skal være tomt
        return len(assigned) == 0


# --------- Rolle-krav / rolle-forbud ---------


class RoleRequiredConstraint(Constraint):
    def __init__(
        self,
        id: str,
        days: List[str],
        role: str,
        time_from: str | None = None,
        time_to: str | None = None,
        description: str = "",
    ):
        super().__init__(id, description)
        self.days = days
        self.role = role
        self.time_from = time_from
        self.time_to = time_to

    def check(
        self,
        schedule: Schedule,
        slot: ShiftSlot,
        employees: List[Employee],
    ) -> bool:
        if slot.day not in self.days:
            return True

        # Hvis constraint kun skal gælde i et bestemt interval
        if self.time_from and self.time_to:
            if not (self.time_from <= slot.start < self.time_to):
                return True

        assigned_ids = schedule.get(slot.day, {}).get(slot.start, [])
        assigned_employees = [e for e in employees if e.id in assigned_ids]

        for e in assigned_employees:
            if self.role in e.roles:
                return True

        # Ingen med den påkrævede rolle
        return False


class RoleForbiddenConstraint(Constraint):
    """
    Angiven rolle må ikke være til stede i de angivne slots.
    """

    def __init__(
        self,
        id: str,
        days: List[str],
        role: str,
        time_from: str | None = None,
        time_to: str | None = None,
        description: str = "",
    ):
        super().__init__(id, description)
        self.days = days
        self.role = role
        self.time_from = time_from
        self.time_to = time_to

    def check(
        self,
        schedule: Schedule,
        slot: ShiftSlot,
        employees: List[Employee],
    ) -> bool:
        if slot.day not in self.days:
            return True

        if self.time_from and self.time_to:
            if not (self.time_from <= slot.start < self.time_to):
                return True

        assigned_ids = schedule.get(slot.day, {}).get(slot.start, [])
        assigned_employees = [e for e in employees if e.id in assigned_ids]

        for e in assigned_employees:
            if self.role in e.roles:
                # Vi har en medarbejder med en forbudt rolle
                return False

        return True


# --------- Factory fra JSON ---------


def build_constraints_from_config(configs: List[Dict[str, Any]]) -> List[Constraint]:
    """
    Tager en liste af dicts (fra JSON) og laver Constraint-objekter.
    """
    constraints: List[Constraint] = []
    for cfg in configs:
        ctype = cfg.get("type")
        if ctype == "min_employees":
            constraints.append(
                MinEmployeesConstraint(
                    id=cfg["id"],
                    days=cfg["days"],
                    time_from=cfg["time_from"],
                    time_to=cfg["time_to"],
                    min_count=cfg["min_count"],
                    description=cfg.get("description", ""),
                )
            )
        elif ctype == "max_employees":
            constraints.append(
                MaxEmployeesConstraint(
                    id=cfg["id"],
                    days=cfg["days"],
                    time_from=cfg["time_from"],
                    time_to=cfg["time_to"],
                    max_count=cfg["max_count"],
                    description=cfg.get("description", ""),
                )
            )
        elif ctype == "no_shifts":
            constraints.append(
                NoShiftsConstraint(
                    id=cfg["id"],
                    days=cfg["days"],
                    time_from=cfg["time_from"],
                    time_to=cfg["time_to"],
                    description=cfg.get("description", ""),
                )
            )
        elif ctype == "role_required":
            constraints.append(
                RoleRequiredConstraint(
                    id=cfg["id"],
                    days=cfg["days"],
                    role=cfg["role"],
                    time_from=cfg.get("time_from"),
                    time_to=cfg.get("time_to"),
                    description=cfg.get("description", ""),
                )
            )
        elif ctype == "role_forbidden":
            constraints.append(
                RoleForbiddenConstraint(
                    id=cfg["id"],
                    days=cfg["days"],
                    role=cfg["role"],
                    time_from=cfg.get("time_from"),
                    time_to=cfg.get("time_to"),
                    description=cfg.get("description", ""),
                )
            )
        # Flere typer kan tilføjes her senere
    return constraints
