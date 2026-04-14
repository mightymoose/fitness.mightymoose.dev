# fitness.db Schema Reference

Database: SQLite · File: `fitness.db` · Access: `sqlite3 fitness.db`

---

## exercises
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT UNIQUE NOT NULL | e.g., "Bench Press", "Squat" |
| implement | TEXT | Equipment type: `barbell`, `dumbbell`, `cable`, etc. |

## programs
Long-term training goals that span multiple workouts.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | e.g., "Bench 315", "June Meet Prep" |
| description | TEXT | Free-text: targets, reasoning, periodization notes |
| start_date | DATE | |
| end_date | DATE | |

## workouts
One training session.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| date | DATE NOT NULL | ISO 8601 (YYYY-MM-DD) |
| notes | TEXT | Session-level notes |
| goal | TEXT | Session theme, e.g., "bench strength day" |
| program_id | INTEGER → programs | NULL for ad-hoc sessions |

## blocks
Groups sets by exercise + intent within a workout. Same exercise can appear in multiple blocks with different intents.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| workout_id | INTEGER NOT NULL → workouts (CASCADE) | |
| exercise_id | INTEGER NOT NULL → exercises | |
| intent | TEXT NOT NULL | `strength`, `volume`, `technique`, `speed` |
| position | INTEGER NOT NULL | Ordering within workout (1-based) |
| strategy | TEXT | Progression plan for the coach, e.g., "Ramp to top single, cut if velocity drops below 0.3m/s" |

Constraint: UNIQUE(workout_id, position)

## sets
Individual sets within a block.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| block_id | INTEGER NOT NULL → blocks (CASCADE) | |
| set_number | INTEGER NOT NULL | 1-based within block |
| set_type | TEXT NOT NULL DEFAULT 'work' | `warmup`, `work`, `backoff`, `dropset` |
| weight_lb | REAL NOT NULL | Weight in pounds |
| rep_count | INTEGER NOT NULL | Target reps (planned) or actual reps (completed) |
| rpe | REAL | 0–10 scale, NULL if not reported |
| time | TEXT | ISO 8601 timestamp of set start/execution |
| completed_at | TEXT | ISO 8601 timestamp when finished. NULL = planned/not yet done |

Constraint: UNIQUE(block_id, set_number)

## athlete_profile
Single-row table for stable athlete attributes used in derived metrics (FFMI, TDEE).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK CHECK (id=1) | Always 1 |
| height_inches | REAL NOT NULL | Used for FFMI (height_m²) |
| birth_date | DATE | Optional |

## body_measurements
Daily morning weigh-in + scale body-fat %.

| Column | Type | Notes |
|--------|------|-------|
| date | DATE PK | One row per day |
| weight_lb | REAL NOT NULL | Fasted, post-bathroom |
| body_fat_pct | REAL | Scale BF% (noisy; trend matters more) |
| notes | TEXT | |

## macro_targets
Computed daily macro targets (written by `/morning`).

| Column | Type | Notes |
|--------|------|-------|
| date | DATE PK | |
| calories | INTEGER NOT NULL | |
| protein_g | INTEGER NOT NULL | |
| carbs_g | INTEGER NOT NULL | |
| fat_g | INTEGER NOT NULL | |
| rationale | TEXT | Brief reasoning |
| planned_lift | TEXT | |
| planned_cardio | TEXT | |

## intake_log
Actual consumed macros (written by `/log-intake`). Pairs with `body_measurements` to back out TDEE.

| Column | Type | Notes |
|--------|------|-------|
| date | DATE PK | |
| calories | INTEGER NOT NULL | |
| protein_g | INTEGER NOT NULL | |
| carbs_g | INTEGER NOT NULL | |
| fat_g | INTEGER NOT NULL | |
| notes | TEXT | |

## reps
Per-rep VBT (velocity-based training) data. Only populated when user provides device data.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| set_id | INTEGER NOT NULL → sets (CASCADE) | |
| rep_number | INTEGER NOT NULL | 1-based |
| mean_velocity | REAL | m/s |
| peak_velocity | REAL | m/s |
| mean_power | REAL | watts |
| peak_power | REAL | watts |
| height | REAL | meters |
| vertical_distance | REAL | meters |

Constraint: UNIQUE(set_id, rep_number)

---

## Key Relationships

```
program ──1:N──> workouts ──1:N──> blocks ──1:N──> sets ──1:N──> reps
                                     │
                                     └──> exercises (M:1)
```

## Useful Queries

**Recent sets for an exercise:**
```sql
SELECT w.date, s.weight_lb, s.rep_count, s.rpe, s.set_type, b.intent
FROM sets s
JOIN blocks b ON s.block_id = b.id
JOIN workouts w ON b.workout_id = w.id
WHERE b.exercise_id = ? AND s.completed_at IS NOT NULL
ORDER BY w.date DESC, b.position, s.set_number
LIMIT 30;
```

**Velocity trend for an exercise:**
```sql
SELECT w.date, s.weight_lb, r.rep_number, r.mean_velocity, r.peak_velocity
FROM reps r
JOIN sets s ON r.set_id = s.id
JOIN blocks b ON s.block_id = b.id
JOIN workouts w ON b.workout_id = w.id
WHERE b.exercise_id = ? AND s.set_type = 'work'
ORDER BY w.date DESC, s.set_number, r.rep_number
LIMIT 50;
```

**Incomplete sets in a workout (next up):**
```sql
SELECT s.id, e.name, b.intent, b.strategy, s.set_number, s.set_type, s.weight_lb, s.rep_count
FROM sets s
JOIN blocks b ON s.block_id = b.id
JOIN exercises e ON b.exercise_id = e.id
WHERE b.workout_id = ? AND s.completed_at IS NULL
ORDER BY b.position, s.set_number
LIMIT 1;
```
