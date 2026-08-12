import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const modernSecretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const serviceKey = modernSecretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = new Set([
  "https://ganlu6633-source.github.io",
  "https://gan-chemistry-diagnostic.ganlu6633.chatgpt.site",
]);

function originAllowed(origin: string | null) {
  return !origin || allowedOrigins.has(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
}

function cors(origin: string | null) {
  const safeOrigin = origin && originAllowed(origin) ? origin : "https://ganlu6633-source.github.io";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeName(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
}

async function authenticateTeacher(req: Request) {
  const token = req.headers.get("x-app-session")?.trim();
  if (!token || token.length < 30) return null;
  const { data, error } = await db.rpc("chem_resolve_app_session", {
    p_token_hash: await sha256(token),
  });
  if (error || !Array.isArray(data) || !data.length || data[0].access_role !== "teacher") return null;
  return {
    displayName: String(data[0].principal_name || "甘老师"),
    expiresAt: String(data[0].expires_at || ""),
  };
}

type Row = Record<string, any>;

async function fetchCompletedAttempts(maxRows = 5000) {
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await db
      .from("chem_learning_attempts")
      .select("id,student_id,plan_day_id,attempt_kind,sequence,mode,started_at,completed_at,first_score")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { rows, truncated: rows.length >= maxRows };
}

async function fetchByIds(table: string, select: string, ids: string[]) {
  const rows: Row[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    if (!chunk.length) continue;
    const { data, error } = await db.from(table).select(select).in("id", chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchRecentAnswers(attemptIds: string[]) {
  const rows: Row[] = [];
  for (let index = 0; index < attemptIds.length; index += 100) {
    const chunk = attemptIds.slice(index, index + 100);
    if (!chunk.length) continue;
    const { data, error } = await db
      .from("chem_attempt_answers")
      .select("attempt_id,skill_id,correct,uncertain,duration_sec")
      .in("attempt_id", chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function buildReviewActivity(
  attempts: Row[],
  reviewStudents: Row[],
  plans: Row[],
  answers: Row[],
  quizStudents: Row[],
  sourceTruncated: boolean,
) {
  const reviewStudentById = new Map(reviewStudents.map((row) => [row.id, row]));
  const planById = new Map(plans.map((row) => [row.id, row]));
  const quizNames = new Map<string, number>();
  for (const row of quizStudents) {
    const normalized = normalizeName(row.normalized_name || row.display_name);
    if (normalized) quizNames.set(normalized, (quizNames.get(normalized) || 0) + 1);
  }

  const answersByAttempt = new Map<string, Row[]>();
  for (const answer of answers) {
    const list = answersByAttempt.get(answer.attempt_id) || [];
    list.push(answer);
    answersByAttempt.set(answer.attempt_id, list);
  }

  const shapedAttempts = attempts.map((attempt) => {
    const student = reviewStudentById.get(attempt.student_id) || {};
    const plan = planById.get(attempt.plan_day_id) || {};
    const attemptAnswers = answersByAttempt.get(attempt.id) || [];
    const answerCount = attemptAnswers.length;
    const correctCount = attemptAnswers.filter((answer) => answer.correct === true).length;
    const durationSec = attemptAnswers.reduce((sum, answer) => sum + Math.max(0, Number(answer.duration_sec) || 0), 0);
    const wrongSkillIds = [...new Set(attemptAnswers.filter((answer) => answer.correct !== true).map((answer) => answer.skill_id).filter(Boolean))];
    const slowSkillIds = [...new Set(attemptAnswers.filter((answer) => Number(answer.duration_sec) >= 45).map((answer) => answer.skill_id).filter(Boolean))];
    const displayName = String(student.display_name || "未命名学生");
    const matchCount = quizNames.get(normalizeName(displayName)) || 0;
    return {
      displayName,
      gradeBand: String(student.grade_band || ""),
      studentKey: String(attempt.student_id),
      completedAt: attempt.completed_at,
      attemptKind: String(attempt.attempt_kind || ""),
      sequence: Number(attempt.sequence) || 0,
      mode: String(attempt.mode || plan.mode || ""),
      firstScore: Number.isFinite(Number(attempt.first_score)) ? Number(attempt.first_score) : null,
      planDate: plan.plan_date || null,
      title: String(plan.title || "未命名复习任务"),
      skillIds: Array.isArray(plan.skill_ids) ? plan.skill_ids : [],
      answerCount,
      correctCount,
      durationSec,
      wrongSkillIds,
      slowSkillIds,
      quizMatch: matchCount === 1 ? "matched" : matchCount > 1 ? "ambiguous" : "not_found",
    };
  });

  const grouped = new Map<string, Row>();
  for (const attempt of shapedAttempts) {
    const current = grouped.get(attempt.studentKey) || {
      displayName: attempt.displayName,
      gradeBand: attempt.gradeBand,
      quizMatch: attempt.quizMatch,
      attemptCount: 0,
      lastCompletedAt: attempt.completedAt,
      lastAttempt: attempt,
    };
    current.attemptCount += 1;
    grouped.set(attempt.studentKey, current);
  }

  const students = [...grouped.values()]
    .sort((left, right) => String(right.lastCompletedAt).localeCompare(String(left.lastCompletedAt)))
    .map((row) => ({
      displayName: row.displayName,
      gradeBand: row.gradeBand,
      quizMatch: row.quizMatch,
      attemptCount: row.attemptCount,
      lastCompletedAt: row.lastCompletedAt,
      lastAttempt: {
        completedAt: row.lastAttempt.completedAt,
        planDate: row.lastAttempt.planDate,
        title: row.lastAttempt.title,
        mode: row.lastAttempt.mode,
        firstScore: row.lastAttempt.firstScore,
        answerCount: row.lastAttempt.answerCount,
        correctCount: row.lastAttempt.correctCount,
        durationSec: row.lastAttempt.durationSec,
        wrongSkillIds: row.lastAttempt.wrongSkillIds,
        slowSkillIds: row.lastAttempt.slowSkillIds,
      },
    }));

  return {
    generatedAt: new Date().toISOString(),
    source: "gan-chemistry-august-review",
    readOnly: true,
    sourceTruncated,
    summary: {
      completedAttempts: shapedAttempts.length,
      activeReviewStudents: students.length,
      matchedQuizStudents: students.filter((student) => student.quizMatch === "matched").length,
      unmatchedReviewStudents: students.filter((student) => student.quizMatch !== "matched").length,
    },
    students,
    recentAttempts: shapedAttempts.slice(0, 50).map(({ studentKey: _studentKey, ...attempt }) => attempt),
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method_not_allowed" });
  if (!originAllowed(origin)) return reply(origin, 403, { error: "origin_not_allowed" });

  try {
    const identity = await authenticateTeacher(req);
    if (!identity) return reply(origin, 401, { error: "teacher_session_required", message: "教师登录已失效，请重新登录。" });

    const body = await req.json();
    if (body?.action !== "review_activity") return reply(origin, 400, { error: "unknown_action" });

    const [{ rows: attempts, truncated }, quizResult] = await Promise.all([
      fetchCompletedAttempts(),
      db.from("students").select("display_name,normalized_name").eq("active", true),
    ]);
    if (quizResult.error) throw quizResult.error;

    const reviewStudentIds = [...new Set(attempts.map((attempt) => attempt.student_id).filter(Boolean))];
    const planIds = [...new Set(attempts.map((attempt) => attempt.plan_day_id).filter(Boolean))];
    const recentAttemptIds = attempts.slice(0, 100).map((attempt) => attempt.id);
    const [reviewStudents, plans, answers] = await Promise.all([
      fetchByIds("chem_students_v2", "id,display_name,grade_band", reviewStudentIds),
      fetchByIds("chem_learning_plans", "id,plan_date,mode,title,skill_ids", planIds),
      fetchRecentAnswers(recentAttemptIds),
    ]);

    return reply(origin, 200, {
      ok: true,
      teacher: { displayName: identity.displayName },
      activity: buildReviewActivity(attempts, reviewStudents, plans, answers, quizResult.data || [], truncated),
    });
  } catch (error) {
    console.error(error);
    return reply(origin, 500, { error: "server_error", message: "复习作答暂时无法读取，请稍后重试。" });
  }
});
