import React, { useEffect, useState } from "react";
import { getConstraints, updateConstraints } from "../services/api";

const WEEK_DAYS = [
  { key: "monday", label: "Man" },
  { key: "tuesday", label: "Tir" },
  { key: "wednesday", label: "Ons" },
  { key: "thursday", label: "Tor" },
  { key: "friday", label: "Fre" },
  { key: "saturday", label: "Lør" },
  { key: "sunday", label: "Søn" },
];

const TYPE_OPTIONS = [
  { value: "min_employees", label: "Min. bemanding" },
  { value: "max_employees", label: "Max. bemanding" },
  { value: "no_shifts", label: "Ingen vagter" },
  { value: "role_required", label: "Rolle påkrævet" },
  { value: "role_forbidden", label: "Rolle ikke tilladt" },
];

const AREA_TYPES = [
  "min_employees",
  "max_employees",
  "no_shifts",
  "role_required",
  "role_forbidden",
];

const ROLE_TYPES = ["role_required", "role_forbidden"];
const COUNT_TYPES = ["min_employees", "max_employees"];

// Skabeloner til hurtig oprettelse
const TEMPLATES = [
  {
    id: "min_area_daytime",
    label: "Min. bemanding – område dagtid (man–fre, 08–17, min 2)",
    init: () => ({
      type: "min_employees",
      area: "kasse", // kan ændres i rækken
      role: "",
      description: "",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      time_from: "08:00",
      time_to: "17:00",
      min_count: 2,
      max_count: 0,
    }),
  },
  {
    id: "min_area_full_day",
    label: "Min. bemanding – område hele dagen (alle dage, åbningstid)",
    init: () => ({
      type: "min_employees",
      area: "kasse",
      role: "",
      description: "",
      days: WEEK_DAYS.map((d) => d.key),
      time_from: "08:00",
      time_to: "22:00",
      min_count: 1,
      max_count: 0,
    }),
  },
  {
    id: "role_evening",
    label: "Rolle påkrævet – alle dage, aften (17–21)",
    init: () => ({
      type: "role_required",
      area: "",
      role: "lukkeansvarlig",
      description: "",
      days: WEEK_DAYS.map((d) => d.key),
      time_from: "17:00",
      time_to: "21:00",
      min_count: undefined,
      max_count: undefined,
    }),
  },
];

const emptyNewConstraint = {
  type: "min_employees",
  area: "",
  role: "",
  description: "",
  days: WEEK_DAYS.map((d) => d.key),
  time_from: "08:00",
  time_to: "22:00",
  min_count: 1,
  max_count: 0,
};

function ConstraintsPage() {
  const [constraints, setConstraints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyNewConstraint);

  const [newEditing, setNewEditing] = useState(false);
  const [newForm, setNewForm] = useState(emptyNewConstraint);

  const [selectedTemplateId, setSelectedTemplateId] =
    useState("min_area_daytime");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await getConstraints();
      setConstraints(list);
    } catch (err) {
      console.error(err);
      setError("Kunne ikke hente regler");
    } finally {
      setLoading(false);
    }
  }

  const labelForType = (type) =>
    TYPE_OPTIONS.find((t) => t.value === type)?.label || type;

  const toggleDayInForm = (form, setForm, dayKey) => {
    setForm((prev) => {
      const days = prev.days || [];
      const has = days.includes(dayKey);
      return {
        ...prev,
        days: has ? days.filter((d) => d !== dayKey) : [...days, dayKey],
      };
    });
  };

  // ---------- Redigering af eksisterende ----------

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({
      type: c.type || "min_employees",
      area: c.area || "",
      role: c.role || "",
      description: c.description || "",
      days: c.days && c.days.length ? c.days : WEEK_DAYS.map((d) => d.key),
      time_from: c.time_from || "08:00",
      time_to: c.time_to || "22:00",
      min_count:
        typeof c.min_count === "number"
          ? c.min_count
          : c.min_count
          ? Number(c.min_count)
          : 1,
      max_count:
        typeof c.max_count === "number"
          ? c.max_count
          : c.max_count
          ? Number(c.max_count)
          : 0,
      id: c.id,
    });
    setNewEditing(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyNewConstraint);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    setSaveMessage("");

    let updated = constraints.map((c) => {
      if (c.id !== editingId) return c;

      const common = {
        id: editingId,
        description: editForm.description,
        days: editForm.days,
        time_from: editForm.time_from,
        time_to: editForm.time_to,
      };

      if (editForm.type === "min_employees") {
        if (!editForm.area) {
          setSaving(false);
          setError("Område skal udfyldes for 'Min. bemanding'");
          return c;
        }
        return {
          ...common,
          type: "min_employees",
          area: editForm.area,
          description:
            editForm.description ||
            `Mindst ${editForm.min_count || 1} i ${editForm.area}`,
          min_count: Number(editForm.min_count) || 1,
        };
      }

      if (editForm.type === "max_employees") {
        if (!editForm.area) {
          setSaving(false);
          setError("Område skal udfyldes for 'Max. bemanding'");
          return c;
        }
        return {
          ...common,
          type: "max_employees",
          area: editForm.area,
          description:
            editForm.description ||
            `Højst ${editForm.max_count || 0} i ${editForm.area}`,
          max_count: Number(editForm.max_count) || 0,
        };
      }

      if (editForm.type === "no_shifts") {
        if (!editForm.area) {
          setSaving(false);
          setError("Område skal udfyldes for 'Ingen vagter'");
          return c;
        }
        return {
          ...common,
          type: "no_shifts",
          area: editForm.area,
          description:
            editForm.description || `Ingen vagter i ${editForm.area}`,
        };
      }

      if (editForm.type === "role_required") {
        if (!editForm.role) {
          setSaving(false);
          setError("Rolle skal udfyldes for 'Rolle påkrævet'");
          return c;
        }
        return {
          ...common,
          type: "role_required",
          role: editForm.role,
          area: editForm.area || undefined,
          description:
            editForm.description || `Kræv ${editForm.role} i tidsrum`,
        };
      }

      if (editForm.type === "role_forbidden") {
        if (!editForm.role) {
          setSaving(false);
          setError("Rolle skal udfyldes for 'Rolle ikke tilladt'");
          return c;
        }
        return {
          ...common,
          type: "role_forbidden",
          role: editForm.role,
          area: editForm.area || undefined,
          description:
            editForm.description ||
            `${editForm.role} må ikke arbejde i dette tidsrum`,
        };
      }

      // fallback – uændret
      return c;
    });

    try {
      await updateConstraints(updated);
      setConstraints(updated);
      setSaveMessage("Regel opdateret ✔️");
      setTimeout(() => setSaveMessage(""), 2000);
      cancelEdit();
    } catch (err) {
      console.error(err);
      setError("Fejl ved gem af regel");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Slet denne regel?")) return;
    setSaving(true);
    setError(null);
    setSaveMessage("");
    const updated = constraints.filter((c) => c.id !== id);
    try {
      await updateConstraints(updated);
      setConstraints(updated);
    } catch (err) {
      console.error(err);
      setError("Fejl ved sletning af regel");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Ny regel + skabeloner ----------

  const openNewRow = () => {
    // Brug valgt skabelon som udgangspunkt
    const template = TEMPLATES.find((t) => t.id === selectedTemplateId);
    const base = template ? template.init() : emptyNewConstraint;
    setNewForm({
      ...emptyNewConstraint,
      ...base,
    });
    setNewEditing(true);
    setEditingId(null);
  };

  const cancelNew = () => {
    setNewEditing(false);
    setNewForm(emptyNewConstraint);
  };

  const handleNewChange = (e) => {
    const { name, value } = e.target;
    setNewForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveNew = async () => {
    setSaving(true);
    setError(null);
    setSaveMessage("");

    const id = `constraint_${Date.now()}`;

    let newConstraint;
    const common = {
      id,
      description: newForm.description,
      days: newForm.days,
      time_from: newForm.time_from,
      time_to: newForm.time_to,
    };

    if (newForm.type === "min_employees") {
      if (!newForm.area) {
        setSaving(false);
        setError("Område skal udfyldes for 'Min. bemanding'");
        return;
      }
      newConstraint = {
        ...common,
        type: "min_employees",
        area: newForm.area,
        description:
          newForm.description ||
          `Mindst ${newForm.min_count || 1} i ${newForm.area}`,
        min_count: Number(newForm.min_count) || 1,
      };
    } else if (newForm.type === "max_employees") {
      if (!newForm.area) {
        setSaving(false);
        setError("Område skal udfyldes for 'Max. bemanding'");
        return;
      }
      newConstraint = {
        ...common,
        type: "max_employees",
        area: newForm.area,
        description:
          newForm.description ||
          `Højst ${newForm.max_count || 0} i ${newForm.area}`,
        max_count: Number(newForm.max_count) || 0,
      };
    } else if (newForm.type === "no_shifts") {
      if (!newForm.area) {
        setSaving(false);
        setError("Område skal udfyldes for 'Ingen vagter'");
        return;
      }
      newConstraint = {
        ...common,
        type: "no_shifts",
        area: newForm.area,
        description:
          newForm.description || `Ingen vagter i ${newForm.area}`,
      };
    } else if (newForm.type === "role_required") {
      if (!newForm.role) {
        setSaving(false);
        setError("Rolle skal udfyldes for 'Rolle påkrævet'");
        return;
      }
      newConstraint = {
        ...common,
        type: "role_required",
        role: newForm.role,
        area: newForm.area || undefined,
        description:
          newForm.description || `Kræv ${newForm.role} i tidsrum`,
      };
    } else if (newForm.type === "role_forbidden") {
      if (!newForm.role) {
        setSaving(false);
        setError("Rolle skal udfyldes for 'Rolle ikke tilladt'");
        return;
      }
      newConstraint = {
        ...common,
        type: "role_forbidden",
        role: newForm.role,
        area: newForm.area || undefined,
        description:
          newForm.description ||
          `${newForm.role} må ikke arbejde i dette tidsrum`,
      };
    } else {
      // fallback – burde ikke ske
      newConstraint = { ...common, type: newForm.type };
    }

    const updated = [...constraints, newConstraint];

    try {
      await updateConstraints(updated);
      setConstraints(updated);
      setSaveMessage("Ny regel oprettet ✔️");
      setTimeout(() => setSaveMessage(""), 2000);
      cancelNew();
    } catch (err) {
      console.error(err);
      setError("Fejl ved oprettelse af regel");
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------

  return (
    <div className="page">
      <h1>Regler</h1>

      <div className="card">
        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p>Henter regler...</p>
        ) : (
          <>
            {/* Skabelon-vælger */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                gap: "1rem",
              }}
            >
              <div>
                <label style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                  Skabelon til ny regel:{" "}
                  <select
                    className="inline-input"
                    style={{ maxWidth: 420 }}
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!newEditing && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openNewRow}
                >
                  + Ny regel med skabelon
                </button>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Område</th>
                  <th>Rolle</th>
                  <th>Dage</th>
                  <th>Fra</th>
                  <th>Til</th>
                  <th>Antal</th>
                  <th>Beskrivelse</th>
                  <th style={{ width: "170px" }}>Handling</th>
                </tr>
              </thead>
              <tbody>
                {constraints.map((c) => {
                  const isEditing = editingId === c.id;
                  const days = c.days || [];

                  return (
                    <tr key={c.id}>
                      {/* Type */}
                      <td style={{ minWidth: 130 }}>
                        {isEditing ? (
                          <select
                            className="inline-input"
                            name="type"
                            value={editForm.type}
                            onChange={handleEditChange}
                          >
                            {TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          labelForType(c.type)
                        )}
                      </td>

                      {/* Område */}
                      <td>
                        {isEditing ? (
                          AREA_TYPES.includes(editForm.type) ? (
                            <input
                              className="inline-input"
                              name="area"
                              value={editForm.area}
                              onChange={handleEditChange}
                              placeholder="kasse, bolig, have ..."
                            />
                          ) : (
                            <span style={{ color: "#9ca3af" }}>–</span>
                          )
                        ) : c.area ? (
                          c.area
                        ) : (
                          <span style={{ color: "#9ca3af" }}>–</span>
                        )}
                      </td>

                      {/* Rolle */}
                      <td>
                        {isEditing ? (
                          ROLE_TYPES.includes(editForm.type) ? (
                            <input
                              className="inline-input"
                              name="role"
                              value={editForm.role}
                              onChange={handleEditChange}
                              placeholder="lukkeansvarlig, trainee ..."
                            />
                          ) : (
                            <span style={{ color: "#9ca3af" }}>–</span>
                          )
                        ) : ROLE_TYPES.includes(c.type) ? (
                          c.role
                        ) : (
                          <span style={{ color: "#9ca3af" }}>–</span>
                        )}
                      </td>

                      {/* Dage */}
                      <td>
                        {isEditing ? (
                          <div
                            style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
                          >
                            {WEEK_DAYS.map(({ key, label }) => {
                              const active = (editForm.days || []).includes(
                                key
                              );
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className="btn"
                                  style={
                                    active
                                      ? {
                                          backgroundColor: "#111827",
                                          color: "#fff",
                                          padding: "0.15rem 0.4rem",
                                          fontSize: "0.75rem",
                                        }
                                      : {
                                          padding: "0.15rem 0.4rem",
                                          fontSize: "0.75rem",
                                        }
                                  }
                                  onClick={() =>
                                    toggleDayInForm(editForm, setEditForm, key)
                                  }
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span>
                            {WEEK_DAYS.filter((d) => days.includes(d.key))
                              .map((d) => d.label)
                              .join(", ")}
                          </span>
                        )}
                      </td>

                      {/* Fra / Til */}
                      <td style={{ maxWidth: 90 }}>
                        {isEditing ? (
                          <input
                            className="inline-input"
                            type="time"
                            name="time_from"
                            value={editForm.time_from}
                            onChange={handleEditChange}
                          />
                        ) : (
                          c.time_from
                        )}
                      </td>
                      <td style={{ maxWidth: 90 }}>
                        {isEditing ? (
                          <input
                            className="inline-input"
                            type="time"
                            name="time_to"
                            value={editForm.time_to}
                            onChange={handleEditChange}
                          />
                        ) : (
                          c.time_to
                        )}
                      </td>

                      {/* Antal */}
                      <td style={{ maxWidth: 80 }}>
                        {isEditing ? (
                          COUNT_TYPES.includes(editForm.type) ? (
                            <input
                              className="inline-input"
                              type="number"
                              name={
                                editForm.type === "min_employees"
                                  ? "min_count"
                                  : "max_count"
                              }
                              value={
                                editForm.type === "min_employees"
                                  ? editForm.min_count
                                  : editForm.max_count
                              }
                              onChange={handleEditChange}
                              min="0"
                            />
                          ) : (
                            <span style={{ color: "#9ca3af" }}>–</span>
                          )
                        ) : c.type === "min_employees" ? (
                          c.min_count
                        ) : c.type === "max_employees" ? (
                          c.max_count
                        ) : (
                          <span style={{ color: "#9ca3af" }}>–</span>
                        )}
                      </td>

                      {/* Beskrivelse */}
                      <td style={{ minWidth: 200 }}>
                        {isEditing ? (
                          <input
                            className="inline-input"
                            name="description"
                            value={editForm.description}
                            onChange={handleEditChange}
                            placeholder="Kort beskrivelse"
                          />
                        ) : (
                          c.description
                        )}
                      </td>

                      {/* Handling */}
                      <td>
                        {isEditing ? (
                          <>
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={saveEdit}
                              disabled={saving}
                            >
                              Gem
                            </button>{" "}
                            <button
                              className="btn"
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              Annullér
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => startEdit(c)}
                            >
                              Redigér
                            </button>{" "}
                            <button
                              className="btn btn-danger"
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              disabled={saving}
                            >
                              Slet
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Ny regel-række */}
                {newEditing ? (
                  <tr className="new-row">
                    {/* Type */}
                    <td>
                      <select
                        className="inline-input"
                        name="type"
                        value={newForm.type}
                        onChange={handleNewChange}
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Område */}
                    <td>
                      {AREA_TYPES.includes(newForm.type) ? (
                        <input
                          className="inline-input"
                          name="area"
                          value={newForm.area}
                          onChange={handleNewChange}
                          placeholder="kasse, bolig, have ..."
                        />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>–</span>
                      )}
                    </td>

                    {/* Rolle */}
                    <td>
                      {ROLE_TYPES.includes(newForm.type) ? (
                        <input
                          className="inline-input"
                          name="role"
                          value={newForm.role}
                          onChange={handleNewChange}
                          placeholder="lukkeansvarlig, trainee ..."
                        />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>–</span>
                      )}
                    </td>

                    {/* Dage */}
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {WEEK_DAYS.map(({ key, label }) => {
                          const active = (newForm.days || []).includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              className="btn"
                              style={
                                active
                                  ? {
                                      backgroundColor: "#111827",
                                      color: "#fff",
                                      padding: "0.15rem 0.4rem",
                                      fontSize: "0.75rem",
                                    }
                                  : {
                                      padding: "0.15rem 0.4rem",
                                      fontSize: "0.75rem",
                                    }
                              }
                              onClick={() =>
                                toggleDayInForm(newForm, setNewForm, key)
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Fra/Til */}
                    <td>
                      <input
                        className="inline-input"
                        type="time"
                        name="time_from"
                        value={newForm.time_from}
                        onChange={handleNewChange}
                      />
                    </td>
                    <td>
                      <input
                        className="inline-input"
                        type="time"
                        name="time_to"
                        value={newForm.time_to}
                        onChange={handleNewChange}
                      />
                    </td>

                    {/* Antal */}
                    <td>
                      {COUNT_TYPES.includes(newForm.type) ? (
                        <input
                          className="inline-input"
                          type="number"
                          name={
                            newForm.type === "min_employees"
                              ? "min_count"
                              : "max_count"
                          }
                          value={
                            newForm.type === "min_employees"
                              ? newForm.min_count
                              : newForm.max_count
                          }
                          onChange={handleNewChange}
                          min="0"
                        />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>–</span>
                      )}
                    </td>

                    {/* Beskrivelse */}
                    <td>
                      <input
                        className="inline-input"
                        name="description"
                        value={newForm.description}
                        onChange={handleNewChange}
                        placeholder="Kort beskrivelse"
                      />
                    </td>

                    {/* Handling */}
                    <td>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={saveNew}
                        disabled={saving}
                      >
                        Gem
                      </button>{" "}
                      <button
                        className="btn"
                        type="button"
                        onClick={cancelNew}
                        disabled={saving}
                      >
                        Annullér
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr className="new-row-placeholder">
                    <td colSpan={9} style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={openNewRow}
                      >
                        + Ny regel
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: "1rem", minHeight: "1.2rem" }}>
              {saveMessage && (
                <span style={{ fontSize: "0.9rem", color: "#16a34a" }}>
                  {saveMessage}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ConstraintsPage;
