// Typer — porteret fra backend/core/models.py

export interface Availability {
  day: string; // "monday"
  start: string; // "08:00"
  end: string; // "20:00"
}

export interface Employee {
  id: string;
  name: string;
  roles: string[];
  max_hours_per_week: number;
  max_hours_per_day: number;
  availability: Availability[];
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
  max_consecutive_days?: number;
  min_rest_hours?: number;
  [key: string]: unknown;
}

export interface ScheduleResponse {
  schedule: Schedule;
  violations: ConstraintViolation[];
  slot_minutes: number;
}
