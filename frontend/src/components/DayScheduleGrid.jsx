import React from "react";

const WEEK_DAYS = [
  { key: "monday", label: "Man" },
  { key: "tuesday", label: "Tir" },
  { key: "wednesday", label: "Ons" },
  { key: "thursday", label: "Tor" },
  { key: "friday", label: "Fre" },
  { key: "saturday", label: "Lør" },
  { key: "sunday", label: "Søn" }
];

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTimeLabel(start, slotMinutes) {
  if (!slotMinutes || slotMinutes === 60) return start;
  const end = addMinutesToTime(start, slotMinutes);
  return `${start}–${end}`;
}

function DayScheduleGrid({
  mode = "day",
  day,
  daySchedule,
  schedule,
  employees,
  violations,
  slotMinutes = 60
}) {
  const employeeMap = {};
  employees.forEach((e) => {
    employeeMap[e.id] = e.name;
  });

  const isWeek = mode === "week";

  // lookup for violation pr. (day,start)
  const violationSet = new Set(
    (violations || []).map((v) => `${v.day}__${v.start}`)
  );

  if (isWeek) {
    // UGE-VIEW: én tabel med tider som rækker og dage som kolonner
    const days = WEEK_DAYS.map((d) => d.key).filter(
      (d) => schedule && schedule[d]
    );

    // alle tider på tværs af ugen
    const timeSet = new Set();
    (days || []).forEach((d) => {
      const slots = schedule[d] || {};
      Object.keys(slots).forEach((t) => timeSet.add(t));
    });
    const times = Array.from(timeSet).sort();

    if (!days.length || !times.length) {
      return <p>Ingen vagter at vise.</p>;
    }

    return (
      <table className="schedule-table">
        <thead>
          <tr>
            <th style={{ width: "90px" }}>Tid</th>
            {days.map((dKey) => {
              const dayDef = WEEK_DAYS.find((x) => x.key === dKey);
              return <th key={dKey}>{dayDef?.label || dKey}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time}>
              <td className="time-cell">
                {formatTimeLabel(time, slotMinutes)}
              </td>
              {days.map((dKey) => {
                const ids = (schedule[dKey] && schedule[dKey][time]) || [];
                const hasViolation = violationSet.has(`${dKey}__${time}`);
                return (
                  <td
                    key={dKey}
                    className={hasViolation ? "cell-has-violation" : ""}
                  >
                    {hasViolation && (
                      <span className="violation-icon" title="Regel-brud">
                        ⚠
                      </span>
                    )}
                    <div className="pill-row">
                      {ids.length === 0 ? (
                        <span className="pill pill-empty">Ingen</span>
                      ) : (
                        ids.map((id) => (
                          <span key={id} className="pill">
                            {employeeMap[id] || id}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // DAG-VIEW (som før, men med intervaller hvis slotMinutes != 60)
  if (!day || !daySchedule) {
    return <p>Vælg en dag.</p>;
  }

  const times = Object.keys(daySchedule || {}).sort();

  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th style={{ width: "90px" }}>Tid</th>
          <th>Medarbejdere</th>
        </tr>
      </thead>
      <tbody>
        {times.map((time) => {
          const ids = daySchedule[time] || [];
          const hasViolation = violationSet.has(`${day}__${time}`);
          return (
            <tr
              key={time}
              className={hasViolation ? "row-has-violation" : ""}
            >
              <td className="time-cell">
                {hasViolation && (
                  <span className="violation-icon" title="Regel-brud">
                    ⚠{" "}
                  </span>
                )}
                {formatTimeLabel(time, slotMinutes)}
              </td>
              <td>
                <div className="pill-row">
                  {ids.length === 0 ? (
                    <span className="pill pill-empty">Ingen</span>
                  ) : (
                    ids.map((id) => (
                      <span key={id} className="pill">
                        {employeeMap[id] || id}
                      </span>
                    ))
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default DayScheduleGrid;
