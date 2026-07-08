/**
 * Exercise how-to lookup backed by the bundled free-exercise-db dataset
 * (public-domain, 873 exercises, demo image pairs + step instructions).
 * No external API or key — images are served straight from the dataset's
 * GitHub CDN to the phone.
 */
import { readFileSync } from "fs";
import { join } from "path";

type DbExercise = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
  level?: string;
};

export type HowtoResult = {
  found: boolean;
  matchedName?: string;
  score?: number;
  images?: string[];
  instructions?: string[];
  primaryMuscles?: string[];
  equipment?: string | null;
  level?: string;
};

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// Query-side rewrites for names the dataset spells differently
const ALIASES: [RegExp, string][] = [
  [/bicycle crunch(es)?/i, "air bike"],
  [/lateral lunge(s)?/i, "side lunge"],
  [/side lunge(s)?/i, "side lunge"],
  [/tricep\b/i, "triceps"],
  [/jumping jacks/i, "jumping jacks star jump"],
  [/glute bridge(s)?/i, "butt lift bridge"],
  [/hip thrust(s)?/i, "barbell hip thrust"],
  [/rdl\b/i, "romanian deadlift"],
  [/ohp\b/i, "overhead press"],
];

const STOPWORDS = new Set(["the", "a", "an", "with", "on", "and", "for", "using"]);

let _index: { ex: DbExercise; tokens: Set<string> }[] | null = null;

function norm(s: string): Set<string> {
  let q = s;
  for (const [rx, repl] of ALIASES) {
    if (rx.test(q)) q = q.replace(rx, repl);
  }
  q = q.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z ]/g, " ");
  const toks = q.split(/\s+/).filter((t) => t && !STOPWORDS.has(t));
  return new Set(toks.map((t) => t.replace(/s$/, "")));
}

function loadIndex() {
  if (_index) return _index;
  const raw = readFileSync(join(process.cwd(), "server", "data", "free-exercise-db.json"), "utf8");
  const db = JSON.parse(raw) as DbExercise[];
  _index = db.map((ex) => ({ ex, tokens: norm(ex.name) }));
  console.log(`[ExerciseHowto] Loaded ${db.length} exercises`);
  return _index;
}

export function lookupHowto(name: string): HowtoResult {
  const qt = norm(name);
  if (!qt.size) return { found: false };
  let best: DbExercise | null = null;
  let bestScore = 0;
  for (const { ex, tokens } of loadIndex()) {
    const inter = [...qt].filter((t) => tokens.has(t)).length;
    if (!inter) continue;
    const union = new Set([...qt, ...tokens]).size;
    let score = inter / union;
    const qIn = [...qt].every((t) => tokens.has(t));
    const eIn = [...tokens].every((t) => qt.has(t));
    if (qIn || eIn) score += 0.3;
    // prefer the shorter (more canonical) name on near-ties
    if (
      score > bestScore + 1e-6 ||
      (Math.abs(score - bestScore) < 1e-6 && best && ex.name.length < best.name.length)
    ) {
      best = ex;
      bestScore = score;
    }
  }
  if (!best || bestScore < 0.55) return { found: false };
  return {
    found: true,
    matchedName: best.name,
    score: Math.round(bestScore * 100) / 100,
    images: best.images.map((p) => IMAGE_BASE + p),
    instructions: best.instructions,
    primaryMuscles: best.primaryMuscles,
    equipment: best.equipment,
    level: best.level,
  };
}
