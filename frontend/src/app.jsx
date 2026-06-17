import React, { useState } from "react";
import SchedulePage from "./pages/SchedulePage";
import EmployeesPage from "./pages/EmployeesPage";
import AreasPage from "./pages/AreasPage"; 
import ConfigPage from "./pages/ConfigPage";
import ConstraintsPage from "./pages/ConstraintsPage";
import "./styles/globals.css";

function App() {
  const [page, setPage] = useState("schedule");

  return (
    <div>
      <header
        style={{
          padding: "1rem",
          borderBottom: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Vagtplan</h1>
        <button
          onClick={() => setPage("schedule")}
          style={{ padding: "0.25rem 0.5rem" }}
        >
          Vagtplan
        </button>
        <button
          onClick={() => setPage("employees")}
          style={{ padding: "0.25rem 0.5rem" }}
        >
          Medarbejdere
        </button>
        <button
          onClick={() => setPage("areas")}
          style={{ padding: "0.25rem 0.5rem" }}
        >
          Områder
        </button>
        <button
          onClick={() => setPage("config")}
          style={{ padding: "0.25rem 0.5rem" }}
        >
          Konfiguration
        </button>
        <button
          onClick={() => setPage("constraints")}
          style={{ padding: "0.25rem 0.5rem" }}
        >
          Regler
        </button>

        {/* senere: knap til regler/constraints */}
      </header>
      <main style={{ padding: "1rem" }}>
        {page === "schedule" && <SchedulePage />}
        {page === "employees" && <EmployeesPage />}
        {page === "areas" && <AreasPage />}
        {page === "config" && <ConfigPage />}
        {page === "constraints" && <ConstraintsPage />}
      </main>

    </div>
  );
}

export default App;
