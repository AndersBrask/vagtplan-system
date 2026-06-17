import React, { useEffect, useState } from "react";
import {
  getAreas,
  createArea,
  updateArea,
  deleteArea,
} from "../services/api";

const emptyNew = {
  id: "",
  name: "",
  roles: "",
  default_min_staff: 1,
};

function AreasPage() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyNew);

  const [newEditing, setNewEditing] = useState(false);
  const [newForm, setNewForm] = useState(emptyNew);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getAreas();
      setAreas(data);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Redigér eksisterende område ----------

  function startEdit(area) {
    setEditingId(area.id);
    setEditForm({
      id: area.id,
      name: area.name,
      roles: area.roles.join(", "),
      default_min_staff: area.default_min_staff ?? 1,
    });
    // luk evt. ny-rækken
    setNewEditing(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyNew);
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((f) => ({ ...f, [name]: value }));
  }

  async function saveEdit(id) {
    const payload = {
      id,
      name: editForm.name.trim(),
      roles: editForm.roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      default_min_staff: Number(editForm.default_min_staff) || 1,
    };

    await updateArea(id, payload);
    await load();
    cancelEdit();
  }

  async function handleDelete(id) {
    if (!window.confirm("Slet dette område?")) return;
    await deleteArea(id);
    await load();
  }

  // ---------- Ny række nederst ("+ Ny") ----------

  function openNewRow() {
    // prefill med standarder – fx min_staff=1, tomme felter
    setNewForm({
      id: "",
      name: "",
      roles: "",
      default_min_staff: 1,
    });
    setNewEditing(true);
    setEditingId(null);
  }

  function cancelNew() {
    setNewEditing(false);
    setNewForm(emptyNew);
  }

  function handleNewChange(e) {
    const { name, value } = e.target;
    setNewForm((f) => ({ ...f, [name]: value }));
  }

  async function saveNew() {
    const payload = {
      id: newForm.id.trim(),
      name: newForm.name.trim(),
      roles: newForm.roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      default_min_staff: Number(newForm.default_min_staff) || 1,
    };

    if (!payload.id || !payload.name) {
      alert("ID og navn skal udfyldes");
      return;
    }

    await createArea(payload);
    await load();
    cancelNew();
  }

  return (
    <div className="page">
      <h1>Områder</h1>

      <div className="card">
        {loading ? (
          <p>Henter områder...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Navn</th>
                <th>Roller</th>
                <th>Min. bemanding (standard)</th>
                <th style={{ width: "180px" }}>Handling</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => {
                const isEditing = editingId === area.id;
                return (
                  <tr key={area.id}>
                    <td>{area.id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                        />
                      ) : (
                        area.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          name="roles"
                          value={editForm.roles}
                          onChange={handleEditChange}
                          placeholder="kasse, lukkeansvarlig"
                        />
                      ) : (
                        area.roles.join(", ")
                      )}
                    </td>
                    <td style={{ maxWidth: 80 }}>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          type="number"
                          name="default_min_staff"
                          value={editForm.default_min_staff}
                          onChange={handleEditChange}
                          min="1"
                        />
                      ) : (
                        area.default_min_staff ?? 1
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => saveEdit(area.id)}
                          >
                            Gem
                          </button>{" "}
                          <button
                            className="btn"
                            type="button"
                            onClick={cancelEdit}
                          >
                            Annullér
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => startEdit(area)}
                          >
                            Redigér
                          </button>{" "}
                          <button
                            className="btn btn-danger"
                            type="button"
                            onClick={() => handleDelete(area.id)}
                          >
                            Slet
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Ny-rækken nederst */}
              {newEditing ? (
                <tr className="new-row">
                  <td>
                    <input
                      className="inline-input"
                      name="id"
                      value={newForm.id}
                      onChange={handleNewChange}
                      placeholder="kasse"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      name="name"
                      value={newForm.name}
                      onChange={handleNewChange}
                      placeholder="Kasse"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      name="roles"
                      value={newForm.roles}
                      onChange={handleNewChange}
                      placeholder="kasse, lukkeansvarlig"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      type="number"
                      name="default_min_staff"
                      value={newForm.default_min_staff}
                      onChange={handleNewChange}
                      min="1"
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={saveNew}
                    >
                      Gem
                    </button>{" "}
                    <button
                      className="btn"
                      type="button"
                      onClick={cancelNew}
                    >
                      Annullér
                    </button>
                  </td>
                </tr>
              ) : (
                <tr className="new-row-placeholder">
                  <td colSpan={5}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={openNewRow}
                    >
                      + Ny
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AreasPage;
