// Cloudflare Pages Function — hele API'et bag /api/*.
// Afløser FastAPI-routeren i backend/api/endpoints.py.
import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import type { Employee, Area, ConstraintConfig } from "../../src/models";
import * as db from "../../src/db";
import { buildSchedule } from "../../src/scheduleService";

interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ status: "ok" }));

// --------- Medarbejdere ---------

app.get("/employees", async (c) => c.json(await db.getEmployees(c.env.DB)));

app.post("/employees", async (c) => {
  const body = (await c.req.json()) as Employee;
  return c.json(await db.createEmployee(c.env.DB, body));
});

app.put("/employees/:id", async (c) => {
  const body = (await c.req.json()) as Employee;
  const updated = await db.updateEmployee(c.env.DB, c.req.param("id"), body);
  if (!updated) return c.json({ detail: "Employee not found" }, 404);
  return c.json(updated);
});

app.delete("/employees/:id", async (c) => {
  const ok = await db.deleteEmployee(c.env.DB, c.req.param("id"));
  if (!ok) return c.json({ detail: "Employee not found" }, 404);
  return c.json({ status: "ok" });
});

// --------- Vagtplan ---------

app.get("/schedule", async (c) => {
  const area = c.req.query("area") ?? null;
  return c.json(await buildSchedule(c.env.DB, area));
});

app.post("/schedule/fix", async (c) => {
  // Placeholder — genererer bare en ny plan med samme motor.
  return c.json(await buildSchedule(c.env.DB, null));
});

// --------- Områder ---------

app.get("/areas", async (c) => c.json(await db.getAreas(c.env.DB)));

app.post("/areas", async (c) => {
  const body = (await c.req.json()) as Area;
  if (await db.areaExists(c.env.DB, body.id)) {
    return c.json({ detail: "Area id already exists" }, 400);
  }
  return c.json(await db.createArea(c.env.DB, body));
});

app.put("/areas/:id", async (c) => {
  const body = (await c.req.json()) as Area;
  const updated = await db.updateArea(c.env.DB, c.req.param("id"), body);
  if (!updated) return c.json({ detail: "Area not found" }, 404);
  return c.json(updated);
});

app.delete("/areas/:id", async (c) => {
  const ok = await db.deleteArea(c.env.DB, c.req.param("id"));
  if (!ok) return c.json({ detail: "Area not found" }, 404);
  return c.json({ status: "ok" });
});

// --------- Roller ---------

app.get("/roles", async (c) => c.json(await db.getRoles(c.env.DB)));

// --------- Global config ---------

app.get("/config", async (c) => c.json(await db.getConfig(c.env.DB)));

app.put("/config", async (c) => {
  const payload = (await c.req.json()) as Record<string, unknown>;
  if (!("opening_hours" in payload) || !("time_slot_minutes" in payload)) {
    return c.json(
      { detail: "Config skal indeholde 'opening_hours' og 'time_slot_minutes'" },
      400
    );
  }
  return c.json(await db.saveConfig(c.env.DB, payload));
});

// --------- Constraints ---------

app.get("/constraints", async (c) => {
  const constraints = await db.getConstraints(c.env.DB);
  return c.json({ constraints });
});

app.put("/constraints", async (c) => {
  const payload = (await c.req.json()) as { constraints?: ConstraintConfig[] };
  if (!payload.constraints || !Array.isArray(payload.constraints)) {
    return c.json({ detail: "Payload skal indeholde en liste i 'constraints'" }, 400);
  }
  await db.saveConstraints(c.env.DB, payload.constraints);
  return c.json(payload);
});

export const onRequest = handle(app);
