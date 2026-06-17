// Constraint-system — porteret fra backend/core/constraints.py
import type { Schedule, ShiftSlot, Employee, ConstraintConfig } from "./models";

export interface Constraint {
  id: string;
  description: string;
  /** True hvis constraint er opfyldt for den givne slot. */
  check(schedule: Schedule, slot: ShiftSlot, employees: Employee[]): boolean;
}

function assignedIds(schedule: Schedule, slot: ShiftSlot): string[] {
  return schedule[slot.day]?.[slot.start] ?? [];
}

function inWindow(slot: ShiftSlot, from: string, to: string): boolean {
  return from <= slot.start && slot.start < to;
}

// --------- Min / max bemanding ---------

export class MinEmployeesConstraint implements Constraint {
  constructor(
    public id: string,
    public days: string[],
    public time_from: string,
    public time_to: string,
    public min_count: number,
    public description = ""
  ) {}

  check(schedule: Schedule, slot: ShiftSlot): boolean {
    if (!this.days.includes(slot.day)) return true;
    if (!inWindow(slot, this.time_from, this.time_to)) return true;
    return assignedIds(schedule, slot).length >= this.min_count;
  }
}

export class MaxEmployeesConstraint implements Constraint {
  constructor(
    public id: string,
    public days: string[],
    public time_from: string,
    public time_to: string,
    public max_count: number,
    public description = ""
  ) {}

  check(schedule: Schedule, slot: ShiftSlot): boolean {
    if (!this.days.includes(slot.day)) return true;
    if (!inWindow(slot, this.time_from, this.time_to)) return true;
    return assignedIds(schedule, slot).length <= this.max_count;
  }
}

export class NoShiftsConstraint implements Constraint {
  constructor(
    public id: string,
    public days: string[],
    public time_from: string,
    public time_to: string,
    public description = ""
  ) {}

  check(schedule: Schedule, slot: ShiftSlot): boolean {
    if (!this.days.includes(slot.day)) return true;
    if (!inWindow(slot, this.time_from, this.time_to)) return true;
    return assignedIds(schedule, slot).length === 0;
  }
}

// --------- Rolle-krav / rolle-forbud ---------

export class RoleRequiredConstraint implements Constraint {
  constructor(
    public id: string,
    public days: string[],
    public role: string,
    public time_from: string | null = null,
    public time_to: string | null = null,
    public description = ""
  ) {}

  check(schedule: Schedule, slot: ShiftSlot, employees: Employee[]): boolean {
    if (!this.days.includes(slot.day)) return true;
    if (this.time_from && this.time_to) {
      if (!inWindow(slot, this.time_from, this.time_to)) return true;
    }
    const ids = assignedIds(schedule, slot);
    const assigned = employees.filter((e) => ids.includes(e.id));
    return assigned.some((e) => e.roles.includes(this.role));
  }
}

export class RoleForbiddenConstraint implements Constraint {
  constructor(
    public id: string,
    public days: string[],
    public role: string,
    public time_from: string | null = null,
    public time_to: string | null = null,
    public description = ""
  ) {}

  check(schedule: Schedule, slot: ShiftSlot, employees: Employee[]): boolean {
    if (!this.days.includes(slot.day)) return true;
    if (this.time_from && this.time_to) {
      if (!inWindow(slot, this.time_from, this.time_to)) return true;
    }
    const ids = assignedIds(schedule, slot);
    const assigned = employees.filter((e) => ids.includes(e.id));
    return !assigned.some((e) => e.roles.includes(this.role));
  }
}

// --------- Factory fra config ---------

export function buildConstraintsFromConfig(configs: ConstraintConfig[]): Constraint[] {
  const out: Constraint[] = [];
  for (const cfg of configs) {
    switch (cfg.type) {
      case "min_employees":
        out.push(
          new MinEmployeesConstraint(
            cfg.id,
            cfg.days ?? [],
            cfg.time_from as string,
            cfg.time_to as string,
            cfg.min_count as number,
            cfg.description ?? ""
          )
        );
        break;
      case "max_employees":
        out.push(
          new MaxEmployeesConstraint(
            cfg.id,
            cfg.days ?? [],
            cfg.time_from as string,
            cfg.time_to as string,
            cfg.max_count as number,
            cfg.description ?? ""
          )
        );
        break;
      case "no_shifts":
        out.push(
          new NoShiftsConstraint(
            cfg.id,
            cfg.days ?? [],
            cfg.time_from as string,
            cfg.time_to as string,
            cfg.description ?? ""
          )
        );
        break;
      case "role_required":
        out.push(
          new RoleRequiredConstraint(
            cfg.id,
            cfg.days ?? [],
            cfg.role as string,
            cfg.time_from ?? null,
            cfg.time_to ?? null,
            cfg.description ?? ""
          )
        );
        break;
      case "role_forbidden":
        out.push(
          new RoleForbiddenConstraint(
            cfg.id,
            cfg.days ?? [],
            cfg.role as string,
            cfg.time_from ?? null,
            cfg.time_to ?? null,
            cfg.description ?? ""
          )
        );
        break;
      // Flere typer kan tilføjes her senere
    }
  }
  return out;
}
