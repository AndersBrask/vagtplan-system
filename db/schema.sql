-- D1 (SQLite) schema for vagtplan-systemet.
-- Liste-/nestede felter gemmes som JSON-tekst, så formerne matcher
-- præcist det gamle JSON-API (roller, availability, min_staff_rules m.m.).

CREATE TABLE IF NOT EXISTS employees (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  birthdate          TEXT,                          -- ISO YYYY-MM-DD (alders-krav)
  max_hours_per_week INTEGER NOT NULL DEFAULT 37,
  max_hours_per_day  INTEGER NOT NULL DEFAULT 8,
  min_hours_per_week INTEGER NOT NULL DEFAULT 0,
  employment_type    TEXT,
  roles              TEXT NOT NULL DEFAULT '[]',   -- JSON array of role ids
  availability       TEXT NOT NULL DEFAULT '[]',   -- JSON array of {day,start,end}
  preferences        TEXT NOT NULL DEFAULT '[]',   -- JSON array of preferences
  absences           TEXT NOT NULL DEFAULT '[]'    -- JSON array of absences
);

CREATE TABLE IF NOT EXISTS areas (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  roles             TEXT NOT NULL DEFAULT '[]',    -- JSON array of role ids
  default_min_staff INTEGER NOT NULL DEFAULT 1,
  min_staff_rules   TEXT NOT NULL DEFAULT '{}'     -- JSON object
);

CREATE TABLE IF NOT EXISTS roles (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Constraints gemmes som hele JSON-objekter for at bevare de
-- type-afhængige felter. seq bevarer rækkefølgen.
CREATE TABLE IF NOT EXISTS constraints (
  seq  INTEGER PRIMARY KEY AUTOINCREMENT,
  id   TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL
);

-- Global config gemmes som ét JSON-objekt under key='global'.
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
