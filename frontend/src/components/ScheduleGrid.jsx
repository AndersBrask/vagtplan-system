import React from "react";

function ScheduleGrid({ schedule, employees, violations }) {
  if (!schedule) {
    return <p>Ingen vagtplan.</p>;
  }

  const days = Object.keys(schedule);
  if (days.length === 0) {
    return <p>Ingen vagter.</p>;
  }

  const firstDaySlots = Object.keys(schedule[days[0]]).sort();

  // id -> navn
  const idToName = {};
  employees.forEach((e) => {
    idToName[e.id] = e.name;
  });

  const renderCell = (ids) => {
    if (!ids || ids.length === 0) return "";
    return ids.map((id) => idToName[id] || id).join(", ");
  };

  // Violation-lookup: "day-start" -> violations[]
  const violationMap = {};
  (violations || []).forEach((v) => {
    const key = `${v.day}-${v.start}`;
    if (!violationMap[key]) {
      violationMap[key] = [];
    }
    violationMap[key].push(v);
  });

  const uniqueViolations = violations || [];

  // TIMER PR. MEDARBEJDER (1 time per slot)
  const hoursPerEmployee = {};
  employees.forEach((e) => {
    hoursPerEmployee[e.id] = 0;
  });

  days.forEach((day) => {
    firstDaySlots.forEach((slot) => {
      const ids = schedule[day][slot] || [];
      ids.forEach((id) => {
        if (!(id in hoursPerEmployee)) {
          hoursPerEmployee[id] = 0;
        }
        hoursPerEmployee[id] += 1;
      });
    });
  });

  return (
    <div>
      <table border="1" cellPadding="4">
        <thead>
          <tr>
            <th>Dag / Tid</th>
            {firstDaySlots.map((slot) => (
              <th key={slot}>{slot}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <td>
                <strong>{day}</strong>
              </td>
              {firstDaySlots.map((slot) => {
                const key = `${day}-${slot}`;
                const hasViolation = !!violationMap[key];
                const cellViolations = violationMap[key] || [];

                const title = cellViolations
                  .map((v) => `${v.constraint_id}: ${v.message}`)
                  .join(" • ");

                return (
                  <td
                    key={slot}
                    style={
                      hasViolation
                        ? {
                            backgroundColor: "#ffe5e5",
                            borderColor: "#ff0000",
                          }
                        : {}
                    }
                    title={title}
                  >
                    {hasViolation ? "⚠ " : ""}
                    {renderCell(schedule[day][slot])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Timer pr. medarbejder */}
      <div style={{ marginTop: "1rem" }}>
        <h3>Timer pr. medarbejder</h3>
        <ul>
          {employees.map((e) => (
            <li key={e.id}>
              {e.name}: {hoursPerEmployee[e.id] || 0} timer
            </li>
          ))}
        </ul>
      </div>

      {/* Liste over regel-brud */}
      {uniqueViolations.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Regel-brud</h3>
          <ul>
            {uniqueViolations.map((v, idx) => (
              <li key={idx}>
                <strong>
                  {v.day} {v.start}-{v.end}
                </strong>
                : [{v.constraint_id}] {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ScheduleGrid;
