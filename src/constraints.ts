// Constraint-system — porteret fra backend/core/constraints.py
// og udvidet (fundament v2) med StaffingConstraint + relative tidsvinduer.
import type {
  Schedule,
  ShiftSlot,
  Employee,
  ConstraintConfig,
  StaffingRequirement,
} from "./models";

type OpeningHours = Record<string, { from?: string; to?: string }>;

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

// --------- Staffing (min/max + sammensætnings-krav) ---------

export class StaffingConstraint implements Constraint {
  constructor(
    public id: string,
    public days: string[],
    /** Per-dag tidsvinduer. null/tom = hele dagen. */
    public dayWindows: Record<string, { from: string; to: string }>,
    public min_total: number | null,
    public max_total: number | null,
    public requirements: StaffingRequirement[],
    public description = ""
  ) {}

  appliesTo(slot: ShiftSlot): boolean {
    if (!this.days.includes(slot.day)) return false;
    const w = this.dayWindows[slot.day];
    if (!w) return true; // intet vindue → hele dagen
    return w.from <= slot.start && slot.start < w.to;
  }

  check(schedule: Schedule, slot: ShiftSlot, employees: Employee[]): boolean {
    if (!this.appliesTo(slot)) return true;
    const ids = assignedIds(schedule, slot);
    const assigned = employees.filter((e) => ids.includes(e.id));

    if (this.min_total != null && assigned.length < this.min_total) return false;
    if (this.max_total != null && assigned.length > this.max_total) return false;

    for (const req of this.requirements) {
      const matching = assigned.filter((e) => matchesRequirement(e, req));
      if (matching.length < req.count) return false;
    }
    return true;
  }
}

/** Om en medarbejder opfylder et sammensætnings-krav (rolle og/eller alder). */
export function matchesRequirement(e: Employee, req: StaffingRequirement): boolean {
  if (req.role && !e.roles.includes(req.role)) return false;
  if (req.min_age != null) {
    if (e.age == null || e.age < req.min_age) return false;
  }
  return true;
}

/** Udregn konkrete per-dag tidsvinduer for en (evt. relativ) staffing-constraint. */
function resolveDayWindows(
  cfg: ConstraintConfig,
  openingHours: OpeningHours
): Record<string, { from: string; to: string }> {
  const windows: Record<string, { from: string; to: string }> = {};
  const days = cfg.days ?? [];

  for (const day of days) {
    if (cfg.relative) {
      const oh = openingHours[day];
      if (!oh?.from || !oh?.to) continue;
      const anchor = cfg.relative.anchor === "open" ? oh.from : oh.to;
      const [h, m] = anchor.split(":").map(Number);
      const base = h * 60 + m;
      const fmt = (mins: number) =>
        `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      windows[day] = {
        from: fmt(base + cfg.relative.from_offset_min),
        to: fmt(base + cfg.relative.to_offset_min),
      };
    } else if (cfg.time_from && cfg.time_to) {
      windows[day] = { from: cfg.time_from, to: cfg.time_to };
    }
  }
  return windows;
}

// --------- Factory fra config ---------

export function buildConstraintsFromConfig(
  configs: ConstraintConfig[],
  openingHours: OpeningHours = {}
): Constraint[] {
  const out: Constraint[] = [];
  for (const cfg of configs) {
    switch (cfg.type) {
      case "staffing":
        out.push(
          new StaffingConstraint(
            cfg.id,
            cfg.days ?? [],
            resolveDayWindows(cfg, openingHours),
            cfg.min_total ?? null,
            cfg.max_total ?? null,
            cfg.requirements ?? [],
            cfg.description ?? ""
          )
        );
        break;
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
