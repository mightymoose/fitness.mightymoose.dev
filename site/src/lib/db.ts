import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', '..', 'fitness.db');
const db = new Database(dbPath, { readonly: true });

// ─── Types ───

export interface Exercise {
  id: number;
  name: string;
  implement: string | null;
}

export interface Program {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Workout {
  id: number;
  date: string;
  notes: string | null;
  goal: string | null;
  program_id: number | null;
  program_name: string | null;
}

export interface Block {
  id: number;
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  implement: string | null;
  intent: string;
  position: number;
  strategy: string | null;
}

export interface Set {
  id: number;
  block_id: number;
  set_number: number;
  set_type: string;
  weight_lb: number;
  rep_count: number;
  rpe: number | null;
  completed: boolean;
}

export interface VelocityRep {
  date: string;
  weight_lb: number;
  set_number: number;
  rep_number: number;
  mean_velocity: number | null;
  peak_velocity: number | null;
}

export interface ExerciseSummary {
  id: number;
  name: string;
  implement: string | null;
  total_sets: number;
  work_sets: number;
  top_weight: number;
  total_reps: number;
  total_volume: number;
  last_date: string;
  has_velocity: boolean;
}

export interface PR {
  exercise_name: string;
  exercise_id: number;
  implement: string | null;
  weight_lb: number;
  rep_count: number;
  date: string;
  rpe: number | null;
}

export interface WeeklyVolume {
  week: string;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  workout_count: number;
}

// ─── Helpers ───

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Exercises ───

export function getExercises(): Exercise[] {
  return db.prepare('SELECT id, name, implement FROM exercises ORDER BY name').all() as Exercise[];
}

export function getExerciseBySlug(slug: string): Exercise | undefined {
  const exercises = getExercises();
  return exercises.find(e => slugify(e.name) === slug);
}

export function getExerciseSummaries(): ExerciseSummary[] {
  return db.prepare(`
    SELECT
      e.id, e.name, e.implement,
      COUNT(s.id) as total_sets,
      SUM(CASE WHEN s.set_type = 'work' AND s.completed_at IS NOT NULL THEN 1 ELSE 0 END) as work_sets,
      MAX(CASE WHEN s.set_type = 'work' AND s.completed_at IS NOT NULL THEN s.weight_lb ELSE 0 END) as top_weight,
      SUM(CASE WHEN s.completed_at IS NOT NULL THEN s.rep_count ELSE 0 END) as total_reps,
      SUM(CASE WHEN s.completed_at IS NOT NULL THEN s.weight_lb * s.rep_count ELSE 0 END) as total_volume,
      MAX(w.date) as last_date,
      EXISTS(
        SELECT 1 FROM reps r2
        JOIN sets s2 ON r2.set_id = s2.id
        JOIN blocks b2 ON s2.block_id = b2.id
        WHERE b2.exercise_id = e.id AND r2.mean_velocity IS NOT NULL
      ) as has_velocity
    FROM exercises e
    JOIN blocks b ON b.exercise_id = e.id
    JOIN sets s ON s.block_id = b.id
    JOIN workouts w ON b.workout_id = w.id
    WHERE s.completed_at IS NOT NULL
    GROUP BY e.id
    ORDER BY MIN(b.position)
  `).all() as ExerciseSummary[];
}

export function getExerciseHistory(exerciseId: number): any[] {
  return db.prepare(`
    SELECT w.date, s.weight_lb, s.rep_count, s.rpe, s.set_type, b.intent,
           s.set_number, s.completed_at IS NOT NULL as completed
    FROM sets s
    JOIN blocks b ON s.block_id = b.id
    JOIN workouts w ON b.workout_id = w.id
    WHERE b.exercise_id = ? AND s.completed_at IS NOT NULL
    ORDER BY w.date DESC, b.position, s.set_number
  `).all(exerciseId);
}

export function getVelocityData(exerciseId: number): VelocityRep[] {
  return db.prepare(`
    SELECT w.date, s.weight_lb, s.set_number, r.rep_number, r.mean_velocity, r.peak_velocity
    FROM reps r
    JOIN sets s ON r.set_id = s.id
    JOIN blocks b ON s.block_id = b.id
    JOIN workouts w ON b.workout_id = w.id
    WHERE b.exercise_id = ? AND s.set_type = 'work'
    ORDER BY w.date DESC, s.set_number, r.rep_number
  `).all(exerciseId) as VelocityRep[];
}

// ─── Workouts ───

export function getWorkouts(): Workout[] {
  return db.prepare(`
    SELECT w.id, w.date, w.notes, w.goal, w.program_id, p.name as program_name
    FROM workouts w
    LEFT JOIN programs p ON w.program_id = p.id
    ORDER BY w.date DESC
  `).all() as Workout[];
}

export function getWorkoutById(id: number): Workout | undefined {
  return db.prepare(`
    SELECT w.id, w.date, w.notes, w.goal, w.program_id, p.name as program_name
    FROM workouts w
    LEFT JOIN programs p ON w.program_id = p.id
    WHERE w.id = ?
  `).get(id) as Workout | undefined;
}

export function getBlocksForWorkout(workoutId: number): Block[] {
  return db.prepare(`
    SELECT b.id, b.workout_id, b.exercise_id, e.name as exercise_name,
           e.implement, b.intent, b.position, b.strategy
    FROM blocks b
    JOIN exercises e ON b.exercise_id = e.id
    WHERE b.workout_id = ?
    ORDER BY b.position
  `).all(workoutId) as Block[];
}

export function getSetsForBlock(blockId: number): Set[] {
  return db.prepare(`
    SELECT id, block_id, set_number, set_type, weight_lb, rep_count, rpe,
           completed_at IS NOT NULL as completed
    FROM sets
    WHERE block_id = ?
    ORDER BY set_number
  `).all(blockId) as Set[];
}

export function getVelocityForBlock(blockId: number): VelocityRep[] {
  return db.prepare(`
    SELECT s.weight_lb, s.set_number, r.rep_number, r.mean_velocity, r.peak_velocity
    FROM reps r
    JOIN sets s ON r.set_id = s.id
    WHERE s.block_id = ? AND r.mean_velocity IS NOT NULL
    ORDER BY s.set_number, r.rep_number
  `).all(blockId) as VelocityRep[];
}

// ─── Programs ───

export function getPrograms(): Program[] {
  return db.prepare('SELECT id, name, description, start_date, end_date FROM programs ORDER BY start_date DESC').all() as Program[];
}

export function getProgramById(id: number): Program | undefined {
  return db.prepare('SELECT id, name, description, start_date, end_date FROM programs WHERE id = ?').get(id) as Program | undefined;
}

export function getWorkoutsForProgram(programId: number): Workout[] {
  return db.prepare(`
    SELECT w.id, w.date, w.notes, w.goal, w.program_id, p.name as program_name
    FROM workouts w
    LEFT JOIN programs p ON w.program_id = p.id
    WHERE w.program_id = ?
    ORDER BY w.date DESC
  `).all(programId) as Workout[];
}

// ─── PRs ───

export function getPRs(): PR[] {
  return db.prepare(`
    SELECT e.name as exercise_name, e.id as exercise_id, e.implement,
           s.weight_lb, s.rep_count, w.date, s.rpe
    FROM sets s
    JOIN blocks b ON s.block_id = b.id
    JOIN exercises e ON b.exercise_id = e.id
    JOIN workouts w ON b.workout_id = w.id
    WHERE s.completed_at IS NOT NULL AND s.set_type = 'work'
    AND s.weight_lb = (
      SELECT MAX(s2.weight_lb)
      FROM sets s2
      JOIN blocks b2 ON s2.block_id = b2.id
      WHERE b2.exercise_id = e.id AND s2.completed_at IS NOT NULL AND s2.set_type = 'work'
    )
    GROUP BY e.id
    ORDER BY s.weight_lb DESC
  `).all() as PR[];
}

export interface E1RM {
  exercise_name: string;
  exercise_id: number;
  e1rm: number;
  method: 'velocity' | 'brzycki';
  based_on: string; // description of what data it's based on
  date: string;
}

// MVT (minimum velocity threshold) by implement type — m/s at which failure occurs
const MVT: Record<string, number> = {
  barbell: 0.15,
  dumbbell: 0.15,
  cable: 0.20,
  machine: 0.15,
};

const DEFAULT_MVT = 0.17;

/**
 * Velocity-based e1RM: linear regression on load vs mean velocity,
 * extrapolate to MVT. Falls back to Brzycki when no VBT data.
 */
export function getEstimated1RMs(): E1RM[] {
  const exercises = getExercises();
  const results: E1RM[] = [];

  for (const ex of exercises) {
    const vData = getVelocityData(ex.id).filter(d => d.mean_velocity !== null);

    if (vData.length >= 3) {
      // Velocity-based: linear regression weight vs velocity
      const points = vData.map(d => ({ x: d.weight_lb, y: d.mean_velocity! }));
      const n = points.length;
      const sumX = points.reduce((s, p) => s + p.x, 0);
      const sumY = points.reduce((s, p) => s + p.y, 0);
      const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
      const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
      const denom = n * sumX2 - sumX * sumX;

      if (Math.abs(denom) > 0.0001) {
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;

        // Only valid if slope is negative (heavier = slower)
        if (slope < 0) {
          const mvt = MVT[ex.implement ?? ''] ?? DEFAULT_MVT;
          const e1rm = (mvt - intercept) / slope;
          const latestDate = vData[0].date;

          if (e1rm > 0) {
            results.push({
              exercise_name: ex.name,
              exercise_id: ex.id,
              e1rm: Math.round(e1rm * 10) / 10,
              method: 'velocity',
              based_on: `${n} reps, MVT ${mvt} m/s`,
              date: latestDate,
            });
            continue;
          }
        }
      }
    }

    // Fallback: Brzycki formula
    const rows = db.prepare(`
      SELECT s.weight_lb, s.rep_count, w.date
      FROM sets s
      JOIN blocks b ON s.block_id = b.id
      JOIN workouts w ON b.workout_id = w.id
      WHERE b.exercise_id = ? AND s.completed_at IS NOT NULL
        AND s.set_type = 'work' AND s.rep_count <= 10
      ORDER BY w.date DESC
    `).all(ex.id) as any[];

    let bestE1rm = 0;
    let bestRow: any = null;
    for (const r of rows) {
      const e = r.rep_count === 1 ? r.weight_lb : r.weight_lb * (36 / (37 - r.rep_count));
      if (e > bestE1rm) { bestE1rm = e; bestRow = r; }
    }

    if (bestRow) {
      results.push({
        exercise_name: ex.name,
        exercise_id: ex.id,
        e1rm: Math.round(bestE1rm * 10) / 10,
        method: 'brzycki',
        based_on: `${bestRow.weight_lb} × ${bestRow.rep_count}`,
        date: bestRow.date,
      });
    }
  }

  return results.sort((a, b) => b.e1rm - a.e1rm);
}

/**
 * Velocity-based e1RM for a single exercise. Returns null if insufficient data.
 */
export function getVelocityE1RM(exerciseId: number): { e1rm: number; mvt: number; slope: number; intercept: number; r2: number } | null {
  const ex = db.prepare('SELECT implement FROM exercises WHERE id = ?').get(exerciseId) as { implement: string | null } | undefined;
  if (!ex) return null;

  const vData = getVelocityData(exerciseId).filter(d => d.mean_velocity !== null);
  if (vData.length < 3) return null;

  const points = vData.map(d => ({ x: d.weight_lb, y: d.mean_velocity! }));
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = points.reduce((s, p) => s + p.y * p.y, 0);
  const denom = n * sumX2 - sumX * sumX;

  if (Math.abs(denom) < 0.0001) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  if (slope >= 0) return null;

  // R² calculation
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const mvt = MVT[ex.implement ?? ''] ?? DEFAULT_MVT;
  const e1rm = (mvt - intercept) / slope;

  if (e1rm <= 0) return null;

  return { e1rm: Math.round(e1rm * 10) / 10, mvt, slope, intercept, r2: Math.round(r2 * 1000) / 1000 };
}

// ─── Analytics ───

export function getWeeklyVolume(): WeeklyVolume[] {
  return db.prepare(`
    SELECT
      strftime('%Y-W%W', w.date) as week,
      COUNT(DISTINCT s.id) as total_sets,
      SUM(s.rep_count) as total_reps,
      SUM(s.weight_lb * s.rep_count) as total_volume,
      COUNT(DISTINCT w.id) as workout_count
    FROM sets s
    JOIN blocks b ON s.block_id = b.id
    JOIN workouts w ON b.workout_id = w.id
    WHERE s.completed_at IS NOT NULL AND s.set_type = 'work'
    GROUP BY strftime('%Y-W%W', w.date)
    ORDER BY week DESC
  `).all() as WeeklyVolume[];
}

export function getIntentDistribution(): { intent: string; count: number }[] {
  return db.prepare(`
    SELECT b.intent, COUNT(s.id) as count
    FROM sets s
    JOIN blocks b ON s.block_id = b.id
    WHERE s.completed_at IS NOT NULL AND s.set_type = 'work'
    GROUP BY b.intent
    ORDER BY count DESC
  `).all() as any[];
}

export function getVolumeByExercise(): { exercise_name: string; exercise_id: number; volume: number; sets: number }[] {
  return db.prepare(`
    SELECT e.name as exercise_name, e.id as exercise_id,
           SUM(s.weight_lb * s.rep_count) as volume,
           COUNT(s.id) as sets
    FROM sets s
    JOIN blocks b ON s.block_id = b.id
    JOIN exercises e ON b.exercise_id = e.id
    WHERE s.completed_at IS NOT NULL AND s.set_type = 'work'
    GROUP BY e.id
    ORDER BY volume DESC
  `).all() as any[];
}

export function getWorkoutStreak(): number {
  const workouts = db.prepare(`SELECT date FROM workouts ORDER BY date DESC`).all() as { date: string }[];
  if (workouts.length === 0) return 0;

  // Count consecutive weeks with at least one workout
  let streak = 0;
  const now = new Date();
  const currentWeek = getWeekNumber(now);

  for (let i = 0; i < 52; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i * 7);
    const weekNum = getWeekNumber(checkDate);
    const hasWorkout = workouts.some(w => {
      const wd = new Date(w.date + 'T00:00:00');
      return getWeekNumber(wd) === weekNum && wd.getFullYear() === checkDate.getFullYear();
    });
    if (hasWorkout) streak++;
    else if (i > 0) break; // allow current week to be empty
  }
  return streak;
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

// ─── Body composition & nutrition ───

export interface AthleteProfile {
  height_inches: number;
  birth_date: string | null;
}

export interface BodyMeasurement {
  date: string;
  weight_lb: number;
  body_fat_pct: number | null;
}

export interface MacroTarget {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  rationale: string | null;
  planned_lift: string | null;
  planned_cardio: string | null;
}

export interface IntakeEntry {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface BodyCompRow {
  date: string;
  weight_lb: number;
  body_fat_pct: number | null;
  lbm_lb: number | null;
  ffmi: number | null;
  weight_7d_avg: number | null;
}

export interface TDEERow {
  window_end: string;
  days: number;
  avg_intake: number;
  weight_slope_per_day: number;
  tdee_estimate: number;
}

export interface MacroComparison {
  date: string;
  target_cal: number | null;
  target_p: number | null;
  target_c: number | null;
  target_f: number | null;
  actual_cal: number | null;
  actual_p: number | null;
  actual_c: number | null;
  actual_f: number | null;
}

export function getAthleteProfile(): AthleteProfile | null {
  return db.prepare('SELECT height_inches, birth_date FROM athlete_profile WHERE id = 1').get() as AthleteProfile | null;
}

export function getBodyMeasurements(days = 90): BodyMeasurement[] {
  return db.prepare(`
    SELECT date, weight_lb, body_fat_pct FROM body_measurements
    WHERE date >= date('now', ? )
    ORDER BY date ASC
  `).all(`-${days} days`) as BodyMeasurement[];
}

export function getIntake(days = 90): IntakeEntry[] {
  return db.prepare(`
    SELECT date, calories, protein_g, carbs_g, fat_g FROM intake_log
    WHERE date >= date('now', ?)
    ORDER BY date ASC
  `).all(`-${days} days`) as IntakeEntry[];
}

export function getMacroTargets(days = 90): MacroTarget[] {
  return db.prepare(`
    SELECT date, calories, protein_g, carbs_g, fat_g, rationale, planned_lift, planned_cardio
    FROM macro_targets WHERE date >= date('now', ?) ORDER BY date ASC
  `).all(`-${days} days`) as MacroTarget[];
}

/**
 * Join measurements + computed LBM + FFMI + 7-day weight avg.
 * Returns one row per measurement date, ASC.
 */
export function getBodyCompSeries(days = 90): BodyCompRow[] {
  const profile = getAthleteProfile();
  const rows = getBodyMeasurements(days);
  const heightM = profile ? (profile.height_inches * 0.0254) : null;

  return rows.map((r, i) => {
    const lbmLb = r.body_fat_pct != null ? r.weight_lb * (1 - r.body_fat_pct / 100) : null;
    const ffmi = (lbmLb != null && heightM != null)
      ? Math.round((lbmLb * 0.453592) / (heightM * heightM) * 100) / 100
      : null;

    // 7-day rolling avg of weight (trailing window, min 3 points)
    const start = Math.max(0, i - 6);
    const window = rows.slice(start, i + 1);
    const weight7d = window.length >= 3
      ? Math.round((window.reduce((s, w) => s + w.weight_lb, 0) / window.length) * 10) / 10
      : null;

    return {
      date: r.date,
      weight_lb: r.weight_lb,
      body_fat_pct: r.body_fat_pct,
      lbm_lb: lbmLb != null ? Math.round(lbmLb * 10) / 10 : null,
      ffmi,
      weight_7d_avg: weight7d,
    };
  });
}

/**
 * Linear regression of weight_lb vs day-index over a window. Returns slope (lb/day).
 */
function weightSlope(rows: BodyMeasurement[]): number {
  if (rows.length < 2) return 0;
  const xs = rows.map((_, i) => i);
  const ys = rows.map(r => r.weight_lb);
  const n = xs.length;
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 0.0001) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Rolling TDEE estimate: for each day with ≥7 days of paired weight + intake,
 * back-calculate TDEE = avg_intake - (Δweight × 3500 / days).
 */
export function getTDEERollingEstimate(windowDays = 7, lookbackDays = 60): TDEERow[] {
  const weights = getBodyMeasurements(lookbackDays);
  const intakes = getIntake(lookbackDays);
  if (weights.length < windowDays || intakes.length < windowDays) return [];

  const intakeByDate = new Map(intakes.map(i => [i.date, i]));
  const out: TDEERow[] = [];

  for (let i = windowDays - 1; i < weights.length; i++) {
    const window = weights.slice(i - windowDays + 1, i + 1);
    const paired = window.filter(w => intakeByDate.has(w.date));
    if (paired.length < Math.ceil(windowDays * 0.7)) continue;

    const avgIntake = paired.reduce((s, w) => s + intakeByDate.get(w.date)!.calories, 0) / paired.length;
    const slope = weightSlope(window);
    const tdee = avgIntake - slope * 3500;

    out.push({
      window_end: window[window.length - 1].date,
      days: paired.length,
      avg_intake: Math.round(avgIntake),
      weight_slope_per_day: Math.round(slope * 100) / 100,
      tdee_estimate: Math.round(tdee),
    });
  }
  return out;
}

export function getMacroComparison(days = 14): MacroComparison[] {
  return db.prepare(`
    SELECT
      COALESCE(t.date, i.date) as date,
      t.calories as target_cal, t.protein_g as target_p, t.carbs_g as target_c, t.fat_g as target_f,
      i.calories as actual_cal, i.protein_g as actual_p, i.carbs_g as actual_c, i.fat_g as actual_f
    FROM macro_targets t
    LEFT JOIN intake_log i ON t.date = i.date
    WHERE COALESCE(t.date, i.date) >= date('now', ?)
    UNION
    SELECT
      COALESCE(t.date, i.date) as date,
      t.calories, t.protein_g, t.carbs_g, t.fat_g,
      i.calories, i.protein_g, i.carbs_g, i.fat_g
    FROM intake_log i
    LEFT JOIN macro_targets t ON t.date = i.date
    WHERE t.date IS NULL AND i.date >= date('now', ?)
    ORDER BY date ASC
  `).all(`-${days} days`, `-${days} days`) as MacroComparison[];
}

export function getTotalStats() {
  const row = db.prepare(`
    SELECT
      COUNT(DISTINCT w.id) as workouts,
      COUNT(DISTINCT e.id) as exercises,
      COUNT(CASE WHEN s.set_type = 'work' AND s.completed_at IS NOT NULL THEN 1 END) as work_sets,
      SUM(CASE WHEN s.completed_at IS NOT NULL THEN s.rep_count ELSE 0 END) as total_reps,
      ROUND(SUM(CASE WHEN s.completed_at IS NOT NULL THEN s.weight_lb * s.rep_count ELSE 0 END)) as total_volume,
      MAX(CASE WHEN s.set_type = 'work' AND s.completed_at IS NOT NULL THEN s.weight_lb ELSE 0 END) as top_weight
    FROM sets s
    JOIN blocks b ON s.block_id = b.id
    JOIN exercises e ON b.exercise_id = e.id
    JOIN workouts w ON b.workout_id = w.id
  `).get() as any;
  return row;
}
