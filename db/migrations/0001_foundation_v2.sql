-- Migration: udvider employees med fundament-v2 felter.
-- Kør mod allerede-deployet D1:
--   wrangler d1 execute vagtplan-db --remote --file=./db/migrations/0001_foundation_v2.sql
-- (lokalt: skift --remote ud med --local)

ALTER TABLE employees ADD COLUMN birthdate TEXT;
ALTER TABLE employees ADD COLUMN min_hours_per_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN employment_type TEXT;
ALTER TABLE employees ADD COLUMN preferences TEXT NOT NULL DEFAULT '[]';
ALTER TABLE employees ADD COLUMN absences TEXT NOT NULL DEFAULT '[]';
