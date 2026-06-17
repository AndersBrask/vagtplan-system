# Datamodel & constraint-skema (fundament v2)

Dette er fundamentet for det udvidede vagtplan-værktøj (case: Billigblomst).
Designet er **bagudkompatibelt**: de gamle constraint-typer virker stadig, og
nye medarbejder-felter er valgfrie med fornuftige defaults.

## Planlægningsperiode

Vagtplanen laves for **én konkret uge** ad gangen. En forespørgsel kan angive
`week_start` (ISO-dato, mandag). Ugedage (`monday` …) mappes så til rigtige
datoer, hvilket er nødvendigt for at ferie/fravær (dato-baseret) og alder
(beregnet på ugens dato) giver mening. Uden `week_start` planlægges en
"generisk" uge (som i dag), og dato-afhængige regler springes over.

## Medarbejder (`Employee`)

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `id`, `name` | string | — |
| `roles` | string[] | Kvalifikationer/ansvar (fx `kasse`, `kasseansvarlig`, `drivhus`) |
| `birthdate` | string \| null | ISO `YYYY-MM-DD`. Bruges til alders-krav (fx "mindst 1 over 18") |
| `max_hours_per_week` | int | Kontraktloft (uge) |
| `max_hours_per_day` | int | Kontraktloft (dag) |
| `min_hours_per_week` | int | Ønsket/kontraktmæssigt minimum — mål for fair fordeling |
| `employment_type` | string \| null | fx `fuldtid`, `deltid`, `ungarbejder` (informativt + fremtidige regler) |
| `availability` | Availability[] | **Hård**: hvornår kan personen overhovedet arbejde (ugentligt) |
| `preferences` | Preference[] | **Blød**: ønsker — vægtes af motoren (fase 2) |
| `absences` | Absence[] | **Hård**: ferie/fravær som datointervaller |

```ts
Availability = { day: string; start: string; end: string }            // ugentlig
Preference   = { day: string; start: string; end: string;
                 kind: "prefer" | "avoid"; weight: number }           // blød
Absence      = { from: string; to: string;                            // ISO-datoer
                 kind: "vacation" | "sick" | "other"; note?: string }
```

## Afdeling (`Area`) og rolle (`Role`)

Uændret: `Area { id, name, roles[], default_min_staff, min_staff_rules }`,
`Role { id, name }`. Roller bruges både som kvalifikationer og som ansvar
(fx `kasseansvarlig`).

## Constraints

Gemmes som JSON-objekter i D1 (ingen migration ved nye typer). `area: null`
= global regel på tværs af afdelinger.

### Eksisterende (bevares)
`min_employees`, `max_employees`, `no_shifts`, `role_required`, `role_forbidden`.

### Ny: `staffing` (det centrale, fleksible krav)

Samler bemanding + sammensætnings-krav i ét. Eksempel — kassen: mindst 3,
heraf ≥1 over 18 og ≥1 kasseansvarlig:

```json
{
  "id": "kasse_bemanding",
  "type": "staffing",
  "area": "kasse",
  "days": ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
  "time_from": "07:00",
  "time_to": "19:00",
  "min_total": 3,
  "requirements": [
    { "count": 1, "min_age": 18 },
    { "count": 1, "role": "kasseansvarlig" }
  ]
}
```

Felter: `min_total?`, `max_total?`, `requirements?: [{count, role?, min_age?}]`.

### Tidsvinduer relativt til åbning/luk

I stedet for faste klokkeslæt kan et vindue defineres relativt — fx "2 timer
før luk, højst 2 personer":

```json
{
  "id": "global_foer_luk",
  "type": "staffing",
  "area": null,
  "days": ["monday","tuesday","wednesday","thursday","friday"],
  "relative": { "anchor": "close", "from_offset_min": -120, "to_offset_min": 0 },
  "max_total": 2
}
```

Relative vinduer udregnes til konkrete `time_from`/`time_to` pr. dag ud fra
åbningstiderne, før motoren kører.

### Globale planlægningsregler (config)

Ligger i `config.planning`: `max_consecutive_days`, `min_rest_hours_between_days`.
Disse håndhæves af motoren i fase 2.

## Hård vs. blød

- **Hårde** (må ALDRIG brydes): availability, absences, max-timer, min_total,
  requirements, no_shifts, role_forbidden.
- **Bløde** (optimeres mod): preferences, min_hours_per_week (fairness),
  færrest/længst mulige vagter. Motoren i fase 2 minimerer en vægtet straf.
