// D1-datalag — afløser load_json/save_json fra backend/api/endpoints.py.
// Liste-/nestede felter gemmes som JSON-tekst i kolonner, så de
// returnerede former matcher det gamle API præcist.
import type { Employee, Area, Role, ConstraintConfig } from "./models";

interface EmployeeRow {
  id: string;
  name: string;
  max_hours_per_week: number;
  max_hours_per_day: number;
  roles: string;
  availability: string;
}

interface AreaRow {
  id: string;
  name: string;
  roles: string;
  default_min_staff: number;
  min_staff_rules: string;
}

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

// --------- Employees ---------

function rowToEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    name: r.name,
    max_hours_per_week: r.max_hours_per_week,
    max_hours_per_day: r.max_hours_per_day,
    roles: parse<string[]>(r.roles, []),
    availability: parse(r.availability, []),
  };
}

export async function getEmployees(db: D1Database): Promise<Employee[]> {
  const { results } = await db.prepare("SELECT * FROM employees ORDER BY id").all<EmployeeRow>();
  return results.map(rowToEmployee);
}

export async function createEmployee(db: D1Database, emp: Employee): Promise<Employee> {
  let id = emp.id;
  if (!id) {
    const { results } = await db.prepare("SELECT id FROM employees").all<{ id: string }>();
    const existing = new Set(results.map((r) => r.id));
    let i = 1;
    id = `emp_${i}`;
    while (existing.has(id)) id = `emp_${++i}`;
  }
  const e: Employee = { ...emp, id };
  await db
    .prepare(
      "INSERT INTO employees (id, name, max_hours_per_week, max_hours_per_day, roles, availability) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(
      e.id,
      e.name,
      e.max_hours_per_week,
      e.max_hours_per_day,
      JSON.stringify(e.roles ?? []),
      JSON.stringify(e.availability ?? [])
    )
    .run();
  return e;
}

export async function updateEmployee(
  db: D1Database,
  id: string,
  emp: Employee
): Promise<Employee | null> {
  const e: Employee = { ...emp, id };
  const res = await db
    .prepare(
      "UPDATE employees SET name = ?, max_hours_per_week = ?, max_hours_per_day = ?, roles = ?, availability = ? WHERE id = ?"
    )
    .bind(
      e.name,
      e.max_hours_per_week,
      e.max_hours_per_day,
      JSON.stringify(e.roles ?? []),
      JSON.stringify(e.availability ?? []),
      id
    )
    .run();
  if (!res.meta.changes) return null;
  return e;
}

export async function deleteEmployee(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM employees WHERE id = ?").bind(id).run();
  return res.meta.changes > 0;
}

// --------- Areas ---------

function rowToArea(r: AreaRow): Area {
  return {
    id: r.id,
    name: r.name,
    roles: parse<string[]>(r.roles, []),
    default_min_staff: r.default_min_staff,
    min_staff_rules: parse(r.min_staff_rules, {}),
  };
}

export async function getAreas(db: D1Database): Promise<Area[]> {
  const { results } = await db.prepare("SELECT * FROM areas ORDER BY id").all<AreaRow>();
  return results.map(rowToArea);
}

export async function areaExists(db: D1Database, id: string): Promise<boolean> {
  const row = await db.prepare("SELECT id FROM areas WHERE id = ?").bind(id).first();
  return row !== null;
}

export async function createArea(db: D1Database, area: Area): Promise<Area> {
  await db
    .prepare(
      "INSERT INTO areas (id, name, roles, default_min_staff, min_staff_rules) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(
      area.id,
      area.name,
      JSON.stringify(area.roles ?? []),
      area.default_min_staff,
      JSON.stringify(area.min_staff_rules ?? {})
    )
    .run();
  return area;
}

export async function updateArea(db: D1Database, id: string, area: Area): Promise<Area | null> {
  const a: Area = { ...area, id };
  const res = await db
    .prepare(
      "UPDATE areas SET name = ?, roles = ?, default_min_staff = ?, min_staff_rules = ? WHERE id = ?"
    )
    .bind(
      a.name,
      JSON.stringify(a.roles ?? []),
      a.default_min_staff,
      JSON.stringify(a.min_staff_rules ?? {}),
      id
    )
    .run();
  if (!res.meta.changes) return null;
  return a;
}

export async function deleteArea(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM areas WHERE id = ?").bind(id).run();
  return res.meta.changes > 0;
}

// --------- Roles ---------

export async function getRoles(db: D1Database): Promise<Role[]> {
  const { results } = await db.prepare("SELECT id, name FROM roles ORDER BY id").all<Role>();
  return results;
}

// --------- Config ---------

export async function getConfig(db: D1Database): Promise<Record<string, unknown>> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = 'global'")
    .first<{ value: string }>();
  return row ? parse(row.value, {}) : {};
}

export async function saveConfig(
  db: D1Database,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await db
    .prepare(
      "INSERT INTO config (key, value) VALUES ('global', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(JSON.stringify(config))
    .run();
  return config;
}

// --------- Constraints ---------

export async function getConstraints(db: D1Database): Promise<ConstraintConfig[]> {
  const { results } = await db
    .prepare("SELECT data FROM constraints ORDER BY seq")
    .all<{ data: string }>();
  return results.map((r) => parse<ConstraintConfig>(r.data, {} as ConstraintConfig));
}

export async function saveConstraints(
  db: D1Database,
  constraints: ConstraintConfig[]
): Promise<void> {
  // PUT erstatter hele listen — slet og indsæt i rækkefølge.
  const statements = [db.prepare("DELETE FROM constraints")];
  for (const c of constraints) {
    statements.push(
      db
        .prepare("INSERT INTO constraints (id, data) VALUES (?, ?)")
        .bind(c.id, JSON.stringify(c))
    );
  }
  await db.batch(statements);
}
