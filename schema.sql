CREATE TABLE exercises (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    implement TEXT
);

CREATE TABLE programs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE
);

CREATE TABLE workouts (
    id INTEGER PRIMARY KEY,
    date DATE NOT NULL,
    notes TEXT,
    goal TEXT,
    program_id INTEGER REFERENCES programs(id)
);

CREATE TABLE blocks (
    id INTEGER PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    intent TEXT NOT NULL,
    position INTEGER NOT NULL,
    strategy TEXT,
    UNIQUE(workout_id, position)
);

CREATE TABLE sets (
    id INTEGER PRIMARY KEY,
    block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'work',
    weight_lb REAL NOT NULL,
    rep_count INTEGER NOT NULL,
    rpe REAL CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10)),
    time TEXT,
    completed_at TEXT,
    UNIQUE (block_id, set_number)
);

CREATE TABLE reps (
    id INTEGER PRIMARY KEY,
    set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    rep_number INTEGER NOT NULL,
    mean_velocity REAL,
    peak_velocity REAL,
    mean_power REAL,
    peak_power REAL,
    height REAL,
    vertical_distance REAL,
    UNIQUE (set_id, rep_number)
);

CREATE INDEX idx_workouts_date ON workouts(date);
CREATE INDEX idx_workouts_program ON workouts(program_id);
CREATE INDEX idx_blocks_workout ON blocks(workout_id);
CREATE INDEX idx_sets_block ON sets(block_id);

CREATE TABLE athlete_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    height_inches REAL NOT NULL,
    birth_date DATE
);

CREATE TABLE body_measurements (
    date DATE PRIMARY KEY,
    weight_lb REAL NOT NULL,
    body_fat_pct REAL,
    notes TEXT
);

CREATE TABLE macro_targets (
    date DATE PRIMARY KEY,
    calories INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    rationale TEXT,
    planned_lift TEXT,
    planned_cardio TEXT
);

CREATE TABLE intake_log (
    date DATE PRIMARY KEY,
    calories INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    notes TEXT
);
