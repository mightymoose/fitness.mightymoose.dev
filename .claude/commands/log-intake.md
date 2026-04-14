---
description: Log the day's nutrition totals (calories + macros) from the athlete's tracker
---

# Log Intake

Ingest the day's consumed totals from the athlete's nutrition tracker and write to `intake_log`. This data feeds TDEE back-calculation and target-vs-actual dashboards.

Database: `sqlite3 fitness.db`.

## Workflow

### Step 1 — Parse input

From `$ARGUMENTS` or by asking. Accept flexible formats:
- `"2450 cal 230p 210c 78f"` → today
- `"yesterday: 2380/225/195/82"` → date('now', '-1 day')
- `"2026-04-13 2380 225 195 82"` → explicit date
- Screenshot from tracker app — extract consumed macros

Default date: today.

### Step 2 — Sanity check

Compare to today's target:
```sql
SELECT calories, protein_g, carbs_g, fat_g FROM macro_targets WHERE date = ?;
```

Flag if:
- Calories >15% off target
- Protein <90% of target (muscle-preservation risk)
- Fat <50g (hormonal floor breach)

### Step 3 — Write

```sql
PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO intake_log (date, calories, protein_g, carbs_g, fat_g, notes)
VALUES (?, ?, ?, ?, ?, ?);
```

### Step 4 — Report

```
Logged — 2026-04-14
  Intake:  2380 cal / 225P / 195C / 82F
  Target:  2350 cal / 235P / 180C / 80F
  Delta:   +30 cal / −10P / +15C / +2F
  Protein 96% of target — within range.
```

If ≥7 days of paired weight+intake data now exist, recompute TDEE and note any drift from the target deficit.

## Rules

- `INSERT OR REPLACE` — re-logging a date overwrites cleanly.
- Round macros to integers.
- If user provides partial data (e.g., "3200 cal, don't remember macros"), ask for the rest. Do not guess macros.
