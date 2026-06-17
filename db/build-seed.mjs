// Genererer db/seed.sql ud fra de oprindelige JSON-data i backend/data/.
// Kør: npm run seed:gen
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "backend", "data");

const read = (f) => JSON.parse(readFileSync(join(dataDir, f), "utf-8"));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"; // SQL-escape
const j = (v) => q(JSON.stringify(v));

const employees = read("employees.json").employees ?? [];
const areas = read("areas.json").areas ?? [];
const roles = read("roles.json").roles ?? [];
const constraints = read("constraints.json").constraints ?? [];
const config = read("config.json");

const lines = [];
lines.push("-- Auto-genereret af db/build-seed.mjs. Rediger ikke i hånden.");
lines.push("DELETE FROM employees;");
lines.push("DELETE FROM areas;");
lines.push("DELETE FROM roles;");
lines.push("DELETE FROM constraints;");
lines.push("DELETE FROM config;");
lines.push("");

for (const e of employees) {
  lines.push(
    `INSERT INTO employees (id, name, max_hours_per_week, max_hours_per_day, roles, availability) VALUES (` +
      `${q(e.id)}, ${q(e.name)}, ${e.max_hours_per_week ?? 37}, ${e.max_hours_per_day ?? 8}, ` +
      `${j(e.roles ?? [])}, ${j(e.availability ?? [])});`
  );
}
lines.push("");

for (const a of areas) {
  lines.push(
    `INSERT INTO areas (id, name, roles, default_min_staff, min_staff_rules) VALUES (` +
      `${q(a.id)}, ${q(a.name)}, ${j(a.roles ?? [])}, ${a.default_min_staff ?? 1}, ${j(a.min_staff_rules ?? {})});`
  );
}
lines.push("");

for (const r of roles) {
  lines.push(`INSERT INTO roles (id, name) VALUES (${q(r.id)}, ${q(r.name)});`);
}
lines.push("");

for (const c of constraints) {
  lines.push(`INSERT INTO constraints (id, data) VALUES (${q(c.id)}, ${j(c)});`);
}
lines.push("");

lines.push(`INSERT INTO config (key, value) VALUES ('global', ${j(config)});`);
lines.push("");

writeFileSync(join(__dirname, "seed.sql"), lines.join("\n"), "utf-8");
console.log("Skrev db/seed.sql");
