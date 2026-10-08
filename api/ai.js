const { createClient } = require("@supabase/supabase-js");

// Monthly free-tier caps per action. Every accepted action is listed here; anything else is rejected.
const LIMITS = { exercise_swap:5, sequence_opt:3, plan_builder:1, coach_insight:2 };
const MODEL = "claude-haiku-4-5-20251001";
// Browsers on other sites may not read our responses. (Same-origin calls from the app need no CORS.)
const ALLOWED_ORIGINS = ["https://fitness-app-iota-pied.vercel.app"];

// ── Input hygiene: the client sends parameters, never prompt text. Every value is typed, trimmed and
// length-capped here before it is interpolated into a server-owned prompt.
const str = (v, max = 120) => (typeof v === "string" || typeof v === "number") ? String(v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? null : Number(v);
const list = (v, max) => Array.isArray(v) ? v.slice(0, max) : [];

function profileLine(p) {
  const o = p && typeof p === "object" ? p : {};
  const parts = [];
  const age = str(o.ageRange, 20), exp = str(o.experience, 30), goal = str(o.goal, 40), notes = str(o.jointNotes, 200);
  if (age) parts.push(`Age range: ${age}`);
  if (exp) parts.push(`Experience: ${exp}`);
  if (goal) parts.push(`Goal: ${goal}`);
  if (notes) parts.push(`Notes: ${notes}`);
  return parts.length ? `\nTrainer profile — ${parts.join(", ")}.` : "";
}

// ── Structured outputs: JSON replies are schema-constrained, so the app never parses prose.
const S = { type: "string" };
const EXERCISE = { type: "object", additionalProperties: false, required: ["name", "sets", "reps", "note", "muscle"],
  properties: { name: S, sets: S, reps: S, note: S, muscle: S } };
const SWAP_SCHEMA = { type: "object", additionalProperties: false, required: ["suggestions"],
  properties: { suggestions: { type: "array", items: EXERCISE } } };
const SEQUENCE_SCHEMA = { type: "object", additionalProperties: false, required: ["order"],
  properties: { order: { type: "array", items: S } } };
const PLAN_SCHEMA = { type: "object", additionalProperties: false, required: ["name", "subtitle", "description", "days"],
  properties: { name: S, subtitle: S, description: S,
    days: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "label", "tag", "isRest", "exercises"],
      properties: { name: S, label: S, tag: S, isRest: { type: "boolean" }, exercises: { type: "array", items: EXERCISE } } } } } };

const MUSCLES = "Chest, Back, Shoulders, Biceps, Triceps, Legs, Abs, Cardio, Recovery";

// Each action: a prompt builder (returns null for unusable input), a fixed output cap, optional schema.
const ACTIONS = {
  exercise_swap: { maxTokens: 600, schema: SWAP_SCHEMA, build: (p) => {
    const name = str(p.exercise, 80); if (!name) return null;
    const muscle = str(p.muscle, 30) || "unknown";
    return `You are a personal trainer. Suggest 6 alternative exercises to swap for "${name}" (muscle: ${muscle}).${profileLine(p.profile)}
Requirements: joint-friendly, similar muscle group, gym equipment available. Give each a brief reason in "note".`;
  } },
  sequence_opt: { maxTokens: 300, schema: SEQUENCE_SCHEMA, build: (p) => {
    const ex = list(p.exercises, 30).map(e => ({ name: str(e && e.name, 80), muscle: str(e && e.muscle, 30) })).filter(e => e.name);
    if (ex.length < 2) return null;
    return `You are an expert personal trainer. Reorder these exercises for optimal workout sequencing -- compound lifts first, isolation second, abs and cardio last. Consider muscle fatigue, joint stress, and training science.
Exercises with their muscle groups: ${ex.map(e => `${e.name} — ${e.muscle || "unknown"}`).join("; ")}
Return the order as these exact name strings, unchanged (no muscle labels or extra words): ${JSON.stringify(ex.map(e => e.name))}`;
  } },
  plan_builder: { maxTokens: 2000, schema: PLAN_SCHEMA, build: (p) => {
    const f = { goal: str(p.goal, 60), days: str(p.days, 30), duration: str(p.duration, 30), experience: str(p.experience, 40),
      limitations: str(p.limitations, 200), equipment: str(p.equipment, 80) };
    if (!f.goal || !f.days) return null;
    return `You are an expert personal trainer. Create a custom workout plan based on these answers:
Goal: ${f.goal}
Days/week: ${f.days}
Session length: ${f.duration}
Experience: ${f.experience}
Limitations: ${f.limitations}
Equipment: ${f.equipment}

Use 7 days, Monday through Sunday ("name" is the weekday, "label" a short day type such as Push, "tag" the muscles trained, e.g. "Chest . Shoulders . Triceps"). Rest days have isRest:true and one recovery item as their only exercise. "muscle" is one of: ${MUSCLES}. The description is two sentences. Make the plan practical and appropriate for the stated limitations.`;
  } },
  coach_insight: { maxTokens: (p) => (p.kind === "weekly" ? 300 : 800), build: (p) => {
    const profile = profileLine(p.profile);
    if (p.kind === "weekly") {
      const sessions = list(p.recentSessions, 10).map(s => ({ day: str(s && s.day, 40), date: str(s && s.date, 10), sets: num(s && s.sets) }));
      const prs = list(p.topPRs, 5).map(x => str(x, 80)).filter(Boolean);
      const total = num(p.totalSessions), weekVol = num(p.weekVol), delta = num(p.vol28Delta);
      return `You are a personal trainer AI.${profile} Analyze this user's recent workout data and provide ONE specific, actionable insight, short enough to read at a glance on a phone card.

Recent sessions: ${JSON.stringify(sessions)}
Top PRs: ${prs.join(", ")}
Total sessions: ${total ?? "N/A"}
This week volume: ${weekVol !== null ? Math.round(weekVol).toLocaleString("en-US") : "N/A"} lbs
28-day volume change: ${delta !== null ? `${delta > 0 ? "+" : ""}${delta}%` : "N/A"}

Focus on: progress trends, recovery patterns, or a specific recommendation to improve results. No generic advice.
Keep the tone encouraging and measured: call something an imbalance only when the gap is large and repeats across several sessions, and state its size. Write plain text without markdown — it's shown as-is.`;
    }
    if (p.kind === "exercise") {
      const e = p.exercise && typeof p.exercise === "object" ? p.exercise : {};
      const name = str(e.name, 80); if (!name) return null;
      return `You are a personal trainer specializing in hypertrophy and joint-safe training.${profile}
Exercise: "${name}" -- ${str(e.muscle, 30) || "unknown"}, ${str(e.sets, 10)} sets × ${str(e.reps, 20)}.
Provide:
1. THREE alternative exercises for the same muscle group (joint-friendly, brief reason each)
2. ONE form or progression tip for the current exercise
Plain text, no markdown, be concise and direct.`;
    }
    if (p.kind === "day") {
      const d = p.day && typeof p.day === "object" ? p.day : {};
      const ex = list(d.exercises, 30).map(e => `${str(e && e.name, 80)} (${str(e && e.sets, 10)}×${str(e && e.reps, 20)})`).filter(x => !x.startsWith(" ("));
      return `You are a personal trainer analyzing a workout day.${profile}
Day: "${str(d.label, 40)}" (${str(d.tag, 80)})
Exercises: ${ex.join(", ")}.
Provide:
1. Assessment of structure and volume balance (2 sentences)
2. Any muscle gaps or imbalances
3. One concrete optimization suggestion
Plain text, no markdown, be concise.`;
    }
    return null;
  } },
};

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});

  const authHeader=req.headers.authorization;
  if(!authHeader?.startsWith("Bearer "))return res.status(401).json({error:"Unauthorized"});
  const token=authHeader.slice(7);

  // Supabase URL + anon key are public by design (they ship in the client bundle); data is protected by RLS
  // and the caller's JWT below. Env vars win when set.
  const supabaseUrl=process.env.SUPABASE_URL||"https://ldbrabnvpiidrdkmjpbo.supabase.co";
  const supabaseKey=process.env.SUPABASE_ANON_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYnJhYm52cGlpZHJka21qcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDMxOTQsImV4cCI6MjA5MzUxOTE5NH0.mJZINJgMl8QD-gTSc2LLikwc8OUloCTyfqoHqRe1xZI";
  const supabase=createClient(supabaseUrl,supabaseKey,{
    auth:{autoRefreshToken:false,persistSession:false},
    global:{headers:{Authorization:`Bearer ${token}`}}
  });

  const{data:{user},error:authError}=await supabase.auth.getUser(token);
  if(authError||!user)return res.status(401).json({error:"Unauthorized"});

  const{action,params}=req.body||{};
  const spec=ACTIONS[action];
  if(!spec||LIMITS[action]===undefined)return res.status(400).json({error:"Unknown action"});
  const p=params&&typeof params==="object"?params:{};
  const prompt=spec.build(p);
  if(!prompt)return res.status(400).json({error:"Invalid parameters"});
  const maxTokens=typeof spec.maxTokens==="function"?spec.maxTokens(p):spec.maxTokens;

  const{data:profile}=await supabase.from("profiles").select("is_pro").eq("id",user.id).single();
  const isPro=profile?.is_pro===true;

  if(!isPro){
    const startOfMonth=new Date();
    startOfMonth.setDate(1);startOfMonth.setHours(0,0,0,0);
    const{count,error:countErr}=await supabase.from("ai_usage")
      .select("id",{count:"exact",head:true})
      .eq("user_id",user.id)
      .eq("action",action)
      .gte("created_at",startOfMonth.toISOString());
    if(countErr)return res.status(503).json({error:"Usage check unavailable"});
    if((count||0)>=LIMITS[action]){
      return res.status(402).json({error:"upgrade_required",action,used:count,limit:LIMITS[action]});
    }
  }

  const anthropicKey=process.env.ANTHROPIC_API_KEY;
  if(!anthropicKey)return res.status(500).json({error:"AI not configured"});

  let anthropicRes;
  try{
    anthropicRes=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":anthropicKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:MODEL,max_tokens:maxTokens,messages:[{role:"user",content:prompt}],
        ...(spec.schema?{output_config:{format:{type:"json_schema",schema:spec.schema}}}:{})})
    });
  }catch(e){
    return res.status(502).json({error:"AI service unavailable"});
  }

  const data=await anthropicRes.json();

  // Count only successful calls toward the free tier. (PostgREST builders have no .catch — use { error }.)
  if(!isPro&&anthropicRes.ok){
    try{
      const{error:usageErr}=await supabase.from("ai_usage").insert({user_id:user.id,action});
      if(usageErr)console.error("ai_usage insert:",usageErr.message);
    }catch(e){ console.error("ai_usage insert:",e); }
  }

  return res.status(anthropicRes.status).json(data);
};
