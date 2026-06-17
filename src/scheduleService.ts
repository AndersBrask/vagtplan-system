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
  allEmployees: Employee[],
  areas: Area[],
  config: Record<string, any>,
  baseConstraints: ConstraintConfig[],
  targetArea?: string | null
): ScheduleResponse {
  const openingHours = config.opening_hours ?? {};
  const slotMinutes: number = config.time_slot_minutes ?? 60;

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
    const constraints = buildConstraintsFromConfig(allConstraintsCfg.filter(noArea));
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
        allConstraintsCfg.filter((c) => c.area === area.id || noArea(c))
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
  targetArea?: string | null
): Promise<ScheduleResponse> {
  const [allEmployees, areas, config, baseConstraints] = await Promise.all([
    getEmployees(db),
    getAreas(db),
    getConfig(db) as Promise<Record<string, any>>,
    getConstraints(db),
  ]);
  return computeSchedule(allEmployees, areas, config, baseConstraints, targetArea);
}
