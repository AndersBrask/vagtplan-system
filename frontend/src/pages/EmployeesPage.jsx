import React, { useEffect, useState } from "react";
import {
  getEmployees,
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from "../services/api";

const emptyRow = {
  id: "",
  name: "",
  roles: "",
  max_hours_per_week: 37,
  max_hours_per_day: 8,
};

function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // redigering af eksisterende
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyRow);

  // ny række nederst
  const [newEditing, setNewEditing] = useState(false);
  const [newForm, setNewForm] = useState(emptyRow);

  const load = () => {
    setLoading(true);
    setError(null);
    getEmployees()
      .then((data) => {
        setEmployees(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Kunne ikke hente medarbejdere");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  // ------------ Redigér eksisterende medarbejder ------------

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setEditForm({
      id: emp.id,
      name: emp.name,
      roles: (emp.roles || []).join(", "),
      max_hours_per_week: emp.max_hours_per_week ?? 37,
      max_hours_per_day: emp.max_hours_per_day ?? 8,
    });
    // luk evt. ny-række
    setNewEditing(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyRow);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((f) => ({ ...f, [name]: value }));
  };

  const saveEdit = (id) => {
    setError(null);

    const payload = {
      id,
      name: editForm.name.trim(),
      roles: editForm.roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      max_hours_per_week: Number(editForm.max_hours_per_week) || 37,
      max_hours_per_day: Number(editForm.max_hours_per_day) || 8,
      availability: [], // TODO: udbyg senere
    };

    if (!payload.name) {
      setError("Navn skal udfyldes");
      return;
    }

    updateEmployee(id, payload)
      .then(() => {
        load();
        cancelEdit();
      })
      .catch((err) => {
        console.error(err);
        setError("Fejl ved opdatering af medarbejder");
      });
  };

  const handleDelete = (id) => {
    if (!window.confirm("Er du sikker på, at du vil slette denne medarbejder?"))
      return;

    deleteEmployee(id)
      .then(() => {
        load();
      })
      .catch((err) => {
        console.error(err);
        setError("Fejl ved sletning af medarbejder");
      });
  };

  // ------------ Ny række nederst ("+ Ny") ------------

  const openNewRow = () => {
    setNewForm({
      id: "",
      name: "",
      roles: "",
      max_hours_per_week: 37,
      max_hours_per_day: 8,
    });
    setNewEditing(true);
    setEditingId(null);
  };

  const cancelNew = () => {
    setNewEditing(false);
    setNewForm(emptyRow);
  };

  const handleNewChange = (e) => {
    const { name, value } = e.target;
    setNewForm((f) => ({ ...f, [name]: value }));
  };

  const saveNew = () => {
    setError(null);

    const payload = {
      id: newForm.id || `emp_${Date.now()}`,
      name: newForm.name.trim(),
      roles: newForm.roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      max_hours_per_week: Number(newForm.max_hours_per_week) || 37,
      max_hours_per_day: Number(newForm.max_hours_per_day) || 8,
      availability: [],
    };

    if (!payload.name) {
      setError("Navn skal udfyldes");
      return;
    }

    createEmployee(payload)
      .then(() => {
        load();
        cancelNew();
      })
      .catch((err) => {
        console.error(err);
        setError("Fejl ved oprettelse af medarbejder");
      });
  };

  return (
    <div className="page">
      <h1>Medarbejdere</h1>

      <div className="card">
        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p>Henter medarbejdere...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Navn</th>
                <th>Roller</th>
                <th>Maks timer/uge</th>
                <th>Maks timer/dag</th>
                <th style={{ width: "190px" }}>Handling</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const isEditing = editingId === e.id;
                return (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                        />
                      ) : (
                        e.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          name="roles"
                          value={editForm.roles}
                          onChange={handleEditChange}
                          placeholder="lukkeansvarlig, kasse"
                        />
                      ) : (
                        (e.roles || []).join(", ")
                      )}
                    </td>
                    <td style={{ maxWidth: 90 }}>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          type="number"
                          name="max_hours_per_week"
                          value={editForm.max_hours_per_week}
                          onChange={handleEditChange}
                        />
                      ) : (
                        e.max_hours_per_week ?? 37
                      )}
                    </td>
                    <td style={{ maxWidth: 90 }}>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          type="number"
                          name="max_hours_per_day"
                          value={editForm.max_hours_per_day}
                          onChange={handleEditChange}
                        />
                      ) : (
                        e.max_hours_per_day ?? 8
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => saveEdit(e.id)}
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
                            onClick={() => startEdit(e)}
                          >
                            Redigér
                          </button>{" "}
                          <button
                            className="btn btn-danger"
                            type="button"
                            onClick={() => handleDelete(e.id)}
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
                      placeholder="emp_5 (valgfri)"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      name="name"
                      value={newForm.name}
                      onChange={handleNewChange}
                      placeholder="Navn"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      name="roles"
                      value={newForm.roles}
                      onChange={handleNewChange}
                      placeholder="lukkeansvarlig, kasse"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      type="number"
                      name="max_hours_per_week"
                      value={newForm.max_hours_per_week}
                      onChange={handleNewChange}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      type="number"
                      name="max_hours_per_day"
                      value={newForm.max_hours_per_day}
                      onChange={handleNewChange}
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
                  <td colSpan={6}>
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

export default EmployeesPage;
