-- Body composition + nutrition tracking

CREATE TABLE IF NOT EXISTS athlete_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    height_inches REAL NOT NULL,
    birth_date DATE
);

CREATE TABLE IF NOT EXISTS body_measurements (
    date DATE PRIMARY KEY,
    weight_lb REAL NOT NULL,
    body_fat_pct REAL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS macro_targets (
    date DATE PRIMARY KEY,
    calories INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    rationale TEXT,
    planned_lift TEXT,
    planned_cardio TEXT
);

CREATE TABLE IF NOT EXISTS intake_log (
    date DATE PRIMARY KEY,
    calories INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    notes TEXT
);

-- Seed athlete profile: 5'10"
INSERT OR IGNORE INTO athlete_profile (id, height_inches) VALUES (1, 70);
