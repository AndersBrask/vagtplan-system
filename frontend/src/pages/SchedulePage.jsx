import React, { useEffect, useState } from "react";
import {
  getSchedule,
  getEmployees,
  getFixedSchedule,
  getAreas,
} from "../services/api";
import DayScheduleGrid from "../components/DayScheduleGrid";

// Hjælper til at lægge timer sammen fra en schedule
function accumulateHoursFromSchedule(hours, schedule, slotMinutes = 60) {
  const slotHours = slotMinutes / 60;

  Object.entries(schedule || {}).forEach(([day, slots]) => {
    Object.values(slots || {}).forEach((ids) => {
      (ids || []).forEach((id) => {
        hours[id] = (hours[id] || 0) + slotHours;
      });
    });
  });
}

function roundHoursMap(hours) {
  const rounded = {};
  Object.entries(hours).forEach(([id, value]) => {
    rounded[id] = Math.round(value * 10) / 10;
  });
  return rounded;
}

function SchedulePage() {
  const [schedule, setSchedule] = useState(null);
  const [slotMinutes, setSlotMinutes] = useState(60);

  const [employees, setEmployees] = useState([]);
  const [violations, setViolations] = useState([]);
  const [isFixing, setIsFixing] = useState(false);

  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // globalt: total timer på tværs af alle områder
  const [totalHoursPerEmployee, setTotalHoursPerEmployee] = useState({});

  const isWeeklyView = slotMinutes && slotMinutes !== 60;

  // helper til at hente plan for et enkelt område og vise den
  const loadScheduleForArea = async (areaId) => {
    try {
      setSchedule(null);
      const data = await getSchedule(areaId);
      setSchedule(data.schedule);
      setViolations(data.violations || []);
      setSlotMinutes(data.slot_minutes || 60);

      const days = Object.keys(data.schedule || {});
      if (!isWeeklyView && days.length > 0) {
        // i dag-view: vælg første dag, hvis ikke allerede valgt
        setSelectedDay((prev) => prev || days[0]);
      }
    } catch (err) {
      console.error("Fejl ved hentning af vagtplan:", err);
    }
  };

  // Re-beregn total timer på tværs af alle områder
  const recalcTotalHours = async (employeesData, areasData) => {
    if (!employeesData || employeesData.length === 0) return;

    const hours = {};
    employeesData.forEach((e) => {
      hours[e.id] = 0;
    });

    // Hvis der er defineret områder: sum af alle områder
    if (areasData && areasData.length > 0) {
      const responses = await Promise.all(
        areasData.map((a) => getSchedule(a.id))
      );
      responses.forEach((data) => {
        accumulateHoursFromSchedule(
          hours,
          data.schedule,
          data.slot_minutes || 60
        );
      });
    } else {
      // ingen områder -> global plan
      const data = await getSchedule(null);
      accumulateHoursFromSchedule(
        hours,
        data.schedule,
        data.slot_minutes || 60
      );
    }

    setTotalHoursPerEmployee(roundHoursMap(hours));
  };

  // initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [employeesData, areasData] = await Promise.all([
          getEmployees(),
          getAreas().catch((err) => {
            console.error("Fejl ved hentning af områder:", err);
            return [];
          }),
        ]);

        if (cancelled) return;

        const emps = employeesData || [];
        setEmployees(emps);

        // Beregn total timer globalt (på tværs af områder)
        await recalcTotalHours(emps, areasData);

        if (areasData && areasData.length > 0) {
          setAreas(areasData);
          const firstAreaId = areasData[0].id;
          setSelectedArea(firstAreaId);
          await loadScheduleForArea(firstAreaId);
        } else {
          await loadScheduleForArea(null);
        }
      } catch (err) {
        console.error("Fejl i init af SchedulePage:", err);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAreaClick = async (areaId) => {
    setSelectedArea(areaId);
    setSelectedDay(null);
    await loadScheduleForArea(areaId);
  };

  const handleFix = async () => {
    if (!schedule) return;
    setIsFixing(true);
    try {
      const data = await getFixedSchedule();
      setSchedule(data.schedule);
      setViolations(data.violations || []);
      setSlotMinutes(data.slot_minutes || 60);

      // Efter fix: beregn total timer igen
      await recalcTotalHours(employees, areas);
    } catch (err) {
      console.error("Fejl ved fix af vagtplan:", err);
    } finally {
      setIsFixing(false);
    }
  };

  if (!schedule) {
    return <p>Henter vagtplan...</p>;
  }

  const days = Object.keys(schedule);
  const daySchedule = selectedDay ? schedule[selectedDay] : null;

  const allViolations = violations || [];
  const dayViolations = isWeeklyView
    ? allViolations
    : allViolations.filter((v) => v.day === selectedDay);

  const currentArea = areas.find((a) => a.id === selectedArea) || null;

  return (
    <div className="schedule-page">
      <div className="schedule-header-row">
        <div>
          <h2>Genereret vagtplan</h2>
          <p className="schedule-description">
            {currentArea ? (
              <>
                Område: <strong>{currentArea.name}</strong>{" "}
                {isWeeklyView ? (
                  <>· ugeoverblik. Område-specifikke krav + global lukkeansvarlig.</>
                ) : (
                  <>
                    · vælg dag for detaljer. Område-specifikke krav (min.
                    bemanding) + global lukkeansvarlig i sidste time.
                  </>
                )}
              </>
            ) : (
              <>
                {isWeeklyView
                  ? "Ugeoverblik. Globale krav (min. bemanding osv.)."
                  : "Vælg en dag for at se detaljer. Globale krav (min. bemanding osv.)."}
              </>
            )}
          </p>
        </div>
        <button
          onClick={handleFix}
          disabled={isFixing}
          className="primary-button"
        >
          {isFixing ? "Fixer vagtplan..." : "Fix vagtplan"}
        </button>
      </div>

      {/* områder */}
      {areas.length > 0 && (
        <div className="day-tabs" style={{ marginBottom: "0.5rem" }}>
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => handleAreaClick(a.id)}
              className={
                a.id === selectedArea
                  ? "day-tab day-tab-active"
                  : "day-tab"
              }
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* dage – kun i dag-view */}
      {!isWeeklyView && (
        <div className="day-tabs">
          {days.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={
                day === selectedDay ? "day-tab day-tab-active" : "day-tab"
              }
            >
              {day}
            </button>
          ))}
        </div>
      )}

      <div className="schedule-layout">
        <div className="schedule-main">
          <DayScheduleGrid
            mode={isWeeklyView ? "week" : "day"}
            day={selectedDay}
            daySchedule={daySchedule}
            schedule={schedule}
            employees={employees}
            violations={dayViolations}
            slotMinutes={slotMinutes}
          />
        </div>

        <div className="schedule-side">
          <div className="schedule-card">
            <h3>Timer pr. medarbejder</h3>
            <ul className="plain-list">
              {employees.map((e) => (
                <li key={e.id}>
                  <strong>{e.name}:</strong>{" "}
                  {totalHoursPerEmployee[e.id] || 0} timer{" "}
                  <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
                    (mål {e.max_hours_per_week})
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="schedule-card">
            <h3>
              Regel-brud{" "}
              {isWeeklyView ? "(uge)" : selectedDay ? `(${selectedDay})` : ""}
            </h3>
            {dayViolations.length === 0 ? (
              <p>Ingen regel-brud 🎉</p>
            ) : (
              <ul className="plain-list">
                {dayViolations.map((v, idx) => (
                  <li key={idx}>
                    <strong>
                      {v.day} {v.start}-{v.end}
                    </strong>
                    : [{v.constraint_id}] {v.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchedulePage;
