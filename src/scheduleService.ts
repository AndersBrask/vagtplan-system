// Schedule-orkestrering — porteret fra get_schedule + build_auto_constraints
// i backend/api/endpoints.py.
import type { ConstraintConfig, ShiftSlot, ScheduleResponse, Schedule, ConstraintViolation, Employee, Area } from "./models";
import { generateTimeSlots, subtractMinutes } from "./timeUtils";
import { buildConstraintsFromConfig } from "./constraints";
import { generateSchedule, evaluateSchedule, newSchedulerState } from "./scheduler";
import { getEmployees, getAreas, getConfig, getConstraints } from "./db";

/**
 * Bygger automatiske constraints ud fra global config.
 * - closing.require_closing_responsible + closing.closing_role:
 *   -> role_required i sidste åbningstime for hver dag.
 * Auto-constraints gemmes IKKE i databasen.
 */
function buildAutoConstraintsFromGlobalConfig(config: Record<string, any>): ConstraintConfig[] {
  const auto: ConstraintConfig[] = [];

  const openingHours: Record<string, { from?: string; to?: string }> =
    config.opening_hours ?? {};
  const slotMinutes: number = config.time_slot_minutes ?? 60;

  const closing = config.closing ?? {};
  if (closing.require_closing_responsible && closing.closing_role) {
    for (const [dayKey, oh] of Object.entries(openingHours)) {
      const dayTo = oh?.to;
      if (!oh?.from || !dayTo) continue;
      const lastStart = subtractMinutes(dayTo, slotMinutes);
      auto.push({
        id: `auto_closing_${dayKey}`,
        type: "role_required",
        description: `Automatisk: ${closing.closing_role} i sidste time (${dayKey})`,
        days: [dayKey],
        time_from: lastStart,
        time_to: dayTo,
        role: closing.closing_role,
      });
    }
  }

  // Globale planlægningsregler (forberedt — håndhæves ikke i motoren endnu).
  const planning = config.planning ?? {};
  if (planning.max_consecutive_days) {
    auto.push({
      id: "auto_max_consecutive_days",
      type: "max_consecutive_days",
      max_consecutive_days: planning.max_consecutive_days,
    });
  }
  if (planning.min_rest_hours_between_days) {
    auto.push({
      id: "auto_min_rest_hours_between_days",
      type: "min_rest_hours_between_days",
      min_rest_hours: planning.min_rest_hours_between_days,
    });
  }

  return auto;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Alder på en given referencedato (ISO). null hvis fødselsdato mangler. */
function ageOn(birthdate: string | null, refISO: string): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate + "T00:00:00Z");
  const r = new Date(refISO + "T00:00:00Z");
  let age = r.getUTCFullYear() - b.getUTCFullYear();
  const m = r.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && r.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** Dato (ISO) for en ugedag givet ugens mandag. */
function dateForDay(weekStart: string, day: string): string {
  const idx = WEEKDAYS.indexOf(day);
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + idx);
  return d.toISOString().slice(0, 10);
}

function isAbsentOn(emp: Employee, dateISO: string): boolean {
  return emp.absences?.some((a) => a.from <= dateISO && dateISO <= a.to) ?? false;
}

/**
 * Forbered medarbejdere til motoren: beregn alder og fjern tilgængelighed
 * på fraværsdage (kun når en konkret uge er angivet).
 */
function prepareEmployees(employees: Employee[], weekStart: string | null): Employee[] {
  const refDate = weekStart ?? new Date().toISOString().slice(0, 10);
  return employees.map((e) => {
    const age = ageOn(e.birthdate ?? null, refDate);
    const availability = weekStart
      ? e.availability.filter((a) => !isAbsentOn(e, dateForDay(weekStart, a.day)))
      : e.availability;
    return { ...e, age, availability };
  });
}

function buildSlots(
  openingHours: Record<string, { from?: string; to?: string }>,
  slotMinutes: number
): ShiftSlot[] {
  const slots: ShiftSlot[] = [];
  for (const [day, oh] of Object.entries(openingHours)) {
    if (!oh?.from || !oh?.to) continue;
    for (const [start, end] of generateTimeSlots(oh.from, oh.to, slotMinutes)) {
      slots.push({ day, start, end, required_roles: [] });
    }
  }
  return slots;
}

/**
 * Ren beregning (ingen DB) — gør motoren testbar mod Python-referencen.
 */
export function computeSchedule(
  rawEmployees: Employee[],
  areas: Area[],
  config: Record<string, any>,
  baseConstraints: ConstraintConfig[],
  targetArea?: string | null,
  weekStart?: string | null
): ScheduleResponse {
  const openingHours = config.opening_hours ?? {};
  const slotMinutes: number = config.time_slot_minutes ?? 60;

  // Alder + fravær forberedes inden motoren kører.
  const allEmployees = prepareEmployees(rawEmployees, weekStart ?? null);

  const autoConstraints = buildAutoConstraintsFromGlobalConfig(config);
  const allConstraintsCfg = [...baseConstraints, ...autoConstraints];

  // Globalt timeregnskab på tværs af områder.
  const state = newSchedulerState();

  const schedulesByArea: Record<string, Schedule> = {};
  const violationsByArea: Record<string, ConstraintViolation[]> = {};
  let targetAreaId: string;

  const noArea = (c: ConstraintConfig) => c.area === undefined || c.area === null;

  if (areas.length === 0) {
    const slots = buildSlots(openingHours, slotMinutes);
    const constraints = buildConstraintsFromConfig(allConstraintsCfg.filter(noArea), openingHours);
    const schedule = generateSchedule(allEmployees, slots, constraints, state);
    const violations = evaluateSchedule(schedule, allEmployees, slots, constraints);
    schedulesByArea["__global__"] = schedule;
    violationsByArea["__global__"] = violations;
    targetAreaId = "__global__";
  } else {
    for (const area of areas) {
      const allowedRoles = new Set(area.roles);
      const employees = allEmployees.filter((e) => e.roles.some((r) => allowedRoles.has(r)));
      const slots = buildSlots(openingHours, slotMinutes);
      const constraints = buildConstraintsFromConfig(
        allConstraintsCfg.filter((c) => c.area === area.id || noArea(c)),
        openingHours
      );
      const schedule = generateSchedule(employees, slots, constraints, state);
      const violations = evaluateSchedule(schedule, employees, slots, constraints);
      schedulesByArea[area.id] = schedule;
      violationsByArea[area.id] = violations;
    }
    targetAreaId = targetArea ?? areas[0].id;
  }

  return {
    schedule: schedulesByArea[targetAreaId] ?? {},
    violations: violationsByArea[targetAreaId] ?? [],
    slot_minutes: slotMinutes,
  };
}

/** DB-wrapper: loader fra D1 og kalder computeSchedule. */
export async function buildSchedule(
  db: D1Database,
  targetArea?: string | null,
  weekStart?: string | null
): Promise<ScheduleResponse> {
  const [allEmployees, areas, config, baseConstraints] = await Promise.all([
    getEmployees(db),
    getAreas(db),
    getConfig(db) as Promise<Record<string, any>>,
    getConstraints(db),
  ]);
  return computeSchedule(allEmployees, areas, config, baseConstraints, targetArea, weekStart);
}
