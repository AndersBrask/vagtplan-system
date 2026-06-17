export async function getSchedule(area) {
  const url = area ? `/api/schedule?area=${encodeURIComponent(area)}` : "/api/schedule";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunne ikke hente vagtplan");
  return res.json();
}

export async function getEmployees() {
  const res = await fetch("/api/employees");
  if (!res.ok) throw new Error("Kunne ikke hente medarbejdere");
  return res.json();
}

export async function createEmployee(employee) {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  if (!res.ok) throw new Error("Kunne ikke oprette medarbejder");
  return res.json();
}

export async function updateEmployee(empId, employee) {
  const res = await fetch(`/api/employees/${empId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  if (!res.ok) throw new Error("Kunne ikke opdatere medarbejder");
  return res.json();
}

export async function deleteEmployee(empId) {
  const res = await fetch(`/api/employees/${empId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Kunne ikke slette medarbejder");
  return res.json();
}

export async function getFixedSchedule() {
  const res = await fetch("/api/schedule/fix", { method: "POST" });
  if (!res.ok) throw new Error("Kunne ikke fixe vagtplan");
  return res.json();
}

export async function getAreas() {
  const res = await fetch("/api/areas");
  if (!res.ok) throw new Error("Kunne ikke hente områder");
  return res.json();
}

export async function createArea(area) {
  const res = await fetch("/api/areas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(area),
  });
  if (!res.ok) throw new Error("Kunne ikke oprette område");
  return res.json();
}

export async function updateArea(id, area) {
  const res = await fetch(`/api/areas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(area),
  });
  if (!res.ok) throw new Error("Kunne ikke opdatere område");
  return res.json();
}

export async function deleteArea(id) {
  const res = await fetch(`/api/areas/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Kunne ikke slette område");
  return res.json();
}

export async function getConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Kunne ikke hente config");
  return res.json();
}

export async function updateConfig(config) {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Kunne ikke gemme config");
  return res.json();
}

export async function getConstraints() {
  const res = await fetch("/api/constraints");
  if (!res.ok) throw new Error("Kunne ikke hente constraints");
  const data = await res.json();
  return data.constraints || [];
}

export async function updateConstraints(constraints) {
  const res = await fetch("/api/constraints", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ constraints }),
  });
  if (!res.ok) throw new Error("Kunne ikke gemme constraints");
  return res.json();
}
