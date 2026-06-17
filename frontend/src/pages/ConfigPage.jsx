import React, { useEffect, useState } from "react";
import { getConfig, updateConfig } from "../services/api";

const WEEK_DAYS = [
  { key: "monday", label: "Mandag" },
  { key: "tuesday", label: "Tirsdag" },
  { key: "wednesday", label: "Onsdag" },
  { key: "thursday", label: "Torsdag" },
  { key: "friday", label: "Fredag" },
  { key: "saturday", label: "Lørdag" },
  { key: "sunday", label: "Søndag" },
];

function ConfigPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const cfg = await getConfig();

        // Åbningstider (fallbacks)
        const opening = cfg.opening_hours || {};
        WEEK_DAYS.forEach(({ key }) => {
          if (!opening[key]) {
            opening[key] = { from: "08:00", to: "21:00" };
          }
        });

        // Defaults for medarbejdere
        const defaults = cfg.defaults || {
          max_hours_per_week: 37,
          max_hours_per_day: 8,
        };

        // Planlægningsregler
        const planning = cfg.planning || {
          max_consecutive_days: 6,
          min_rest_hours_between_days: 11,
        };

        // Lukkeansvarlig
        const closing = cfg.closing || {
          require_closing_responsible: true,
          closing_role: "lukkeansvarlig",
        };

        // Weekend-dage
        const weekend_days =
          cfg.weekend_days && Array.isArray(cfg.weekend_days)
            ? cfg.weekend_days
            : ["saturday", "sunday"];

        setConfig({
          opening_hours: opening,
          time_slot_minutes: cfg.time_slot_minutes || 60,
          defaults,
          planning,
          closing,
          weekend_days,
        });
      } catch (err) {
        console.error(err);
        setError("Kunne ikke hente config");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // --- handlers ---

  const handleTimeChange = (dayKey, field, value) => {
    setConfig((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [dayKey]: {
          ...prev.opening_hours[dayKey],
          [field]: value,
        },
      },
    }));
  };

  const handleSlotChange = (e) => {
    const value = e.target.value;
    setConfig((prev) => ({
      ...prev,
      time_slot_minutes: Number(value) || 60,
    }));
  };

  const handleDefaultsChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      defaults: {
        ...prev.defaults,
        [field]: Number(value) || 0,
      },
    }));
  };

  const handlePlanningChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      planning: {
        ...prev.planning,
        [field]: Number(value) || 0,
      },
    }));
  };

  const handleClosingChange = (field, value) => {
    if (field === "require_closing_responsible") {
      setConfig((prev) => ({
        ...prev,
        closing: {
          ...prev.closing,
          [field]: value,
        },
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        closing: {
          ...prev.closing,
          [field]: value,
        },
      }));
    }
  };

  const toggleWeekendDay = (dayKey) => {
    setConfig((prev) => {
      const list = prev.weekend_days || [];
      const exists = list.includes(dayKey);
      return {
        ...prev,
        weekend_days: exists
          ? list.filter((d) => d !== dayKey)
          : [...list, dayKey],
      };
    });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaveMessage("");

    try {
      await updateConfig(config);
      setSaveMessage("Config gemt ✔️");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch (err) {
      console.error(err);
      setError("Fejl ved gem af config");
    } finally {
      setSaving(false);
    }
  };

  // --- render ---

  return (
    <div className="page">
      <h1>Konfiguration</h1>

      <div className="card">
        {loading ? (
          <p>Henter config...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : (
          <>
            {/* Åbningstider */}
            <h2 className="section-title">Åbningstider (uge)</h2>
            <table className="data-table" style={{ marginTop: "0.5rem" }}>
              <thead>
                <tr>
                  <th>Dag</th>
                  <th>Åbner</th>
                  <th>Lukker</th>
                </tr>
              </thead>
              <tbody>
                {WEEK_DAYS.map(({ key, label }) => {
                  const oh = config.opening_hours[key] || {
                    from: "08:00",
                    to: "21:00",
                  };
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td style={{ maxWidth: 140 }}>
                        <input
                          className="inline-input"
                          type="time"
                          value={oh.from}
                          onChange={(e) =>
                            handleTimeChange(key, "from", e.target.value)
                          }
                        />
                      </td>
                      <td style={{ maxWidth: 140 }}>
                        <input
                          className="inline-input"
                          type="time"
                          value={oh.to}
                          onChange={(e) =>
                            handleTimeChange(key, "to", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Tidsinterval */}
            <h2 className="section-title">Tidsinterval</h2>
            <div style={{ marginTop: "0.5rem" }}>
              <label>
                Længde på time-slots (minutter):{" "}
                <input
                  className="inline-input"
                  type="number"
                  min="5"
                  step="5"
                  style={{ maxWidth: 120 }}
                  value={config.time_slot_minutes}
                  onChange={handleSlotChange}
                />
              </label>
            </div>

            {/* Standard for medarbejdere */}
            <h2 className="section-title">Standard for nye medarbejdere</h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                marginTop: "0.5rem",
              }}
            >
              <label>
                Maks timer/uge (default):
                <input
                  className="inline-input"
                  type="number"
                  style={{ maxWidth: 120, marginTop: "0.25rem" }}
                  value={config.defaults.max_hours_per_week}
                  onChange={(e) =>
                    handleDefaultsChange("max_hours_per_week", e.target.value)
                  }
                />
              </label>
              <label>
                Maks timer/dag (default):
                <input
                  className="inline-input"
                  type="number"
                  style={{ maxWidth: 120, marginTop: "0.25rem" }}
                  value={config.defaults.max_hours_per_day}
                  onChange={(e) =>
                    handleDefaultsChange("max_hours_per_day", e.target.value)
                  }
                />
              </label>
            </div>

            {/* Planlægningsregler */}
            <h2 className="section-title">Planlægningsregler (globalt)</h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                marginTop: "0.5rem",
              }}
            >
              <label>
                Maks dage i træk:
                <input
                  className="inline-input"
                  type="number"
                  style={{ maxWidth: 120, marginTop: "0.25rem" }}
                  value={config.planning.max_consecutive_days}
                  onChange={(e) =>
                    handlePlanningChange(
                      "max_consecutive_days",
                      e.target.value
                    )
                  }
                />
              </label>
              <label>
                Min. hviletid mellem dage (timer):
                <input
                  className="inline-input"
                  type="number"
                  style={{ maxWidth: 120, marginTop: "0.25rem" }}
                  value={config.planning.min_rest_hours_between_days}
                  onChange={(e) =>
                    handlePlanningChange(
                      "min_rest_hours_between_days",
                      e.target.value
                    )
                  }
                />
              </label>
            </div>

            {/* Lukning */}
            <h2 className="section-title">Lukning</h2>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={config.closing.require_closing_responsible}
                  onChange={(e) =>
                    handleClosingChange(
                      "require_closing_responsible",
                      e.target.checked
                    )
                  }
                />
                Kræv lukkeansvarlig i sidste time
              </label>
              <div style={{ marginTop: "0.5rem" }}>
                <label>
                  Rolle for lukkeansvarlig:
                  <input
                    className="inline-input"
                    style={{ maxWidth: 220, marginTop: "0.25rem" }}
                    value={config.closing.closing_role}
                    onChange={(e) =>
                      handleClosingChange("closing_role", e.target.value)
                    }
                    placeholder="lukkeansvarlig"
                  />
                </label>
              </div>
            </div>

            {/* Weekend-dage */}
            <h2 className="section-title">Weekend-dage</h2>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {WEEK_DAYS.map(({ key, label }) => {
                const isWeekend = config.weekend_days.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className="btn"
                    style={
                      isWeekend
                        ? {
                            backgroundColor: "#111827",
                            color: "#fff",
                            fontWeight: 500,
                          }
                        : {}
                    }
                    onClick={() => toggleWeekendDay(key)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Gem-knap */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
              <button
                className="primary-button"
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Gemmer..." : "Gem konfiguration"}
              </button>
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

export default ConfigPage;
