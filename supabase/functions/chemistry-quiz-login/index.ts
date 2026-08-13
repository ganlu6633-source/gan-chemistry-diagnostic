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
]);

function originAllowed(origin: string | null) {
  return !origin || allowedOrigins.has(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
}

function cors(origin: string | null) {
  const safeOrigin = origin && originAllowed(origin) ? origin : "https://ganlu6633-source.github.io";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method_not_allowed" });
  if (!originAllowed(origin)) return reply(origin, 403, { error: "origin_not_allowed" });

  try {
    const body = await req.json();
    if (body?.action !== "login") return reply(origin, 400, { error: "unknown_action" });

    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim();
    const rawFingerprint = `${req.headers.get("x-forwarded-for") || "unknown"}|${req.headers.get("user-agent") || "unknown"}`;
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.rpc("chem_exchange_quiz_teacher_code", {
      p_name: name,
      p_code: code,
      p_fingerprint_hash: await sha256(rawFingerprint),
      p_token_hash: await sha256(token),
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    if (!Array.isArray(data) || !data.length || data[0].access_role !== "teacher") {
      return reply(origin, 401, { error: "教师姓名或登录码不正确，或尝试过于频繁。" });
    }

    return reply(origin, 200, {
      session: {
        role: "teacher",
        token,
        displayName: String(data[0].principal_name || "甘老师"),
        expiresAt,
      },
    });
  } catch (error) {
    console.error(error);
    return reply(origin, 500, { error: "教师登录服务暂时不可用，请稍后重试。" });
  }
});
