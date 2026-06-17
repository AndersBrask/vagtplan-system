// Dumper TS-porten's output for alle områder som JSON (skal matche py_reference.py).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeSchedule } from "../src/scheduleService";
import type { Employee, Area, ConstraintConfig } from "../src/models";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backend", "data");
const load = (n: string) => JSON.parse(readFileSync(join(dataDir, n), "utf-8"));

const employees: Employee[] = load("employees.json").employees;
const areas: Area[] = load("areas.json").areas;
const config = load("config.json");
const constraints: ConstraintConfig[] = load("constraints.json").constraints;

// computeSchedule kører hele orkestreringen (alle områder, delt timeregnskab)
// deterministisk hver gang, så vi henter hvert områdes plan ud.
const full: Record<string, unknown> = {};
for (const area of areas) {
  full[area.id] = computeSchedule(employees, areas, config, constraints, area.id).schedule;
}

console.log(JSON.stringify(full));
