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
  const { data, error } = await db.rpc("chem_resolve_quiz_teacher_session", {
    p_token_hash: await sha256(token),
  });
  if (error || !Array.isArray(data) || !data.length || data[0].access_role !== "teacher") return null;
  return {
    displayName: String(data[0].principal_name || "甘老师"),
    expiresAt: String(data[0].expires_at || ""),
  };
}

type Row = Record<string, any>;

function shanghaiDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const startMs = Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function safeTextList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12)
    : [];
}

function shapeQuizSession(row: Row, studentById: Map<string, Row>) {
  const student = studentById.get(String(row.student_id)) || {};
  return {
    displayName: String(student.display_name || "未命名学生"),
    schoolClass: String(row.school_class || ""),
    day: Number(row.day) || 0,
    round: Number(row.round) || 0,
    trainingTheme: String(row.training_theme || "即时小测"),
    correctCount: Math.max(0, Number(row.correct_count) || 0),
    totalCount: Math.max(0, Number(row.total_count) || 0),
    totalSec: Math.max(0, Number(row.total_sec) || 0),
    wrongTags: safeTextList(row.wrong_tags),
    slowTags: safeTextList(row.slow_tags),
    completedAt: row.completed_at || row.received_at || null,
  };
}

function buildQuizActivity(activeStudents: Row[], todaySessions: Row[], recentSessions: Row[], date: string) {
  const studentById = new Map(activeStudents.map((student) => [String(student.id), student]));
  const todayByStudent = new Map<string, Row[]>();
  for (const session of todaySessions) {
    const key = String(session.student_id);
    const list = todayByStudent.get(key) || [];
    list.push(session);
    todayByStudent.set(key, list);
  }

  const recentByStudent = new Map<string, Row>();
  for (const session of recentSessions) {
    const key = String(session.student_id);
    if (!recentByStudent.has(key)) recentByStudent.set(key, session);
  }

  const students = activeStudents
    .map((student) => {
      const key = String(student.id);
      const sessions = (todayByStudent.get(key) || []).sort((left, right) =>
        String(right.completed_at || right.received_at || "").localeCompare(String(left.completed_at || left.received_at || ""))
      );
      const last = sessions[0] || recentByStudent.get(key) || null;
      return {
        displayName: String(student.display_name || "未命名学生"),
        todaySessionCount: sessions.length,
        lastCompletedAt: last ? last.completed_at || last.received_at || null : null,
        lastSession: last ? shapeQuizSession(last, studentById) : null,
      };
    })
    .sort((left, right) =>
      right.todaySessionCount - left.todaySessionCount ||
      String(right.lastCompletedAt || "").localeCompare(String(left.lastCompletedAt || "")) ||
      left.displayName.localeCompare(right.displayName, "zh-CN")
    );

  return {
    quizDate: date,
    summary: {
      activeQuizStudents: activeStudents.length,
      completedQuizSessionsToday: todaySessions.length,
      quizStudentsToday: todayByStudent.size,
    },
    quizStudents: students,
    recentQuizSessions: recentSessions.slice(0, 50).map((row) => shapeQuizSession(row, studentById)),
  };
}

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
      db.from("students").select("id,display_name,normalized_name").eq("active", true).order("display_name"),
    ]);
    if (quizResult.error) throw quizResult.error;

    const quizStudents = quizResult.data || [];
    const quizStudentIds = quizStudents.map((student) => student.id).filter(Boolean);
    const bounds = shanghaiDayBounds();
    const reviewStudentIds = [...new Set(attempts.map((attempt) => attempt.student_id).filter(Boolean))];
    const planIds = [...new Set(attempts.map((attempt) => attempt.plan_day_id).filter(Boolean))];
    const recentAttemptIds = attempts.slice(0, 100).map((attempt) => attempt.id);
    const quizSessionFields = "student_id,day,round,training_theme,school_class,correct_count,total_count,total_sec,wrong_tags,slow_tags,completed_at,received_at";
    const todayQuizRequest = quizStudentIds.length
      ? db
          .from("quiz_sessions")
          .select(quizSessionFields)
          .in("student_id", quizStudentIds)
          .gte("completed_at", bounds.start)
          .lt("completed_at", bounds.end)
          .order("completed_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null });
    const recentQuizRequest = quizStudentIds.length
      ? db
          .from("quiz_sessions")
          .select(quizSessionFields)
          .in("student_id", quizStudentIds)
          .order("completed_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null });
    const [reviewStudents, plans, answers, todayQuizResult, recentQuizResult] = await Promise.all([
      fetchByIds("chem_students_v2", "id,display_name,grade_band", reviewStudentIds),
      fetchByIds("chem_learning_plans", "id,plan_date,mode,title,skill_ids", planIds),
      fetchRecentAnswers(recentAttemptIds),
      todayQuizRequest,
      recentQuizRequest,
    ]);
    if (todayQuizResult.error) throw todayQuizResult.error;
    if (recentQuizResult.error) throw recentQuizResult.error;

    const reviewActivity = buildReviewActivity(attempts, reviewStudents, plans, answers, quizStudents, truncated);
    const quizActivity = buildQuizActivity(
      quizStudents,
      todayQuizResult.data || [],
      recentQuizResult.data || [],
      bounds.date,
    );

    return reply(origin, 200, {
      ok: true,
      teacher: { displayName: identity.displayName },
      activity: {
        ...reviewActivity,
        summary: { ...reviewActivity.summary, ...quizActivity.summary },
        quizDate: quizActivity.quizDate,
        quizStudents: quizActivity.quizStudents,
        recentQuizSessions: quizActivity.recentQuizSessions,
      },
    });
  } catch (error) {
    console.error(error);
    return reply(origin, 500, { error: "server_error", message: "复习作答暂时无法读取，请稍后重试。" });
  }
});
