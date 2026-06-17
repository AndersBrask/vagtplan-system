// Typer — porteret fra backend/core/models.py

export interface Availability {
  day: string; // "monday"
  start: string; // "08:00"
  end: string; // "20:00"
}

/** Blødt ønske — vægtes af motoren (fase 2). */
export interface Preference {
  day: string;
  start: string;
  end: string;
  kind: "prefer" | "avoid";
  weight: number;
}

/** Hårdt fravær som datointerval (ISO YYYY-MM-DD). */
export interface Absence {
  from: string;
  to: string;
  kind: "vacation" | "sick" | "other";
  note?: string;
}

export interface Employee {
  id: string;
  name: string;
  roles: string[];
  birthdate: string | null; // ISO YYYY-MM-DD, til alders-krav
  max_hours_per_week: number;
  max_hours_per_day: number;
  min_hours_per_week: number; // mål for fair fordeling
  employment_type: string | null;
  availability: Availability[];
  preferences: Preference[];
  absences: Absence[];
  /** Beregnet ud fra birthdate + planlægningsugens dato (sættes runtime). */
  age?: number | null;
}

export interface Area {
  id: string;
  name: string;
  roles: string[];
  default_min_staff: number;
  min_staff_rules: Record<string, unknown[]>;
}

export interface Role {
  id: string;
  name: string;
}

export interface ShiftSlot {
  day: string;
  start: string;
  end: string;
  required_roles: string[];
}

export interface ConstraintViolation {
  constraint_id: string;
  message: string;
  day: string;
  start: string;
  end: string;
}

// schedule[day][slot_start] = [employee_ids]
export type Schedule = Record<string, Record<string, string[]>>;

/** Sammensætnings-krav i en staffing-constraint. */
export interface StaffingRequirement {
  count: number;
  role?: string;
  min_age?: number;
}

/** Tidsvindue relativt til åbning/luk. */
export interface RelativeWindow {
  anchor: "open" | "close";
  from_offset_min: number;
  to_offset_min: number;
}

// Rå constraint-config fra DB/JSON (felter afhænger af type).
export interface ConstraintConfig {
  id: string;
  type: string;
  description?: string;
  days?: string[];
  time_from?: string | null;
  time_to?: string | null;
  role?: string;
  min_count?: number;
  max_count?: number;
  area?: string | null;
  // staffing-felter
  min_total?: number;
  max_total?: number;
  requirements?: StaffingRequirement[];
  relative?: RelativeWindow;
  // globale planlægningsregler
  max_consecutive_days?: number;
  min_rest_hours?: number;
  [key: string]: unknown;
}

export interface ScheduleResponse {
  schedule: Schedule;
  violations: ConstraintViolation[];
  slot_minutes: number;
}
