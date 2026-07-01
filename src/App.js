import { useState, useEffect, useRef, Component } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@supabase/supabase-js";
import { planWeekOf, elapsedDaysSince, parsePlanDate, programWeekFromDate, planWeekSessions } from "./lib/planWeek";
import { estimate1RM } from "./lib/oneRepMax";
import { projectExercise } from "./lib/projections";
import { rollingVolume } from "./lib/volume";
import { detectPlateaus, priorBests } from "./lib/plateaus";
import { liftSeriesFromSets } from "./lib/liftSeries";
import { liftSessionsFromSets } from "./lib/liftSessions";
import { coachingFromRow, coachingToRow, COACHING_DEFAULTS } from "./lib/coachingSettings";
import { deloadVisible } from "./lib/deloadVisible";
import { longestWeeklyStreak } from "./lib/longestWeeklyStreak";
import { resolveActivePlanKey } from "./lib/activePlan";
import { serializeTrainingExport } from "./lib/exportTraining";
import { weeklyAdherence } from "./lib/weeklyAdherence";
import { assembleDigest } from "./lib/overviewDigest";
import { mapSessionRow } from "./lib/sessionMap";
import { historyWindow } from "./lib/historyWindow";
import { flagPRs } from "./lib/prFlags";
import { lifetimePRs } from "./lib/lifetimePRs";
import { renameSetsData, setsToArr, enrichIsPR, otherOccurrence } from "./lib/renameExercise";
import { recentPRs } from "./lib/recentPRs";
import { muscleContributions, rollupToGroup, DISPLAY_GROUPS, primaryMoverGroup } from "./lib/muscleVolume";
import { analyzePlan } from "./lib/planAnalysis";
import { analyzeRealized } from "./lib/realizedVolume";
import { classifyDriverTrend, dominantPrimaryLift, progressCopy } from "./lib/volumeProgress";
import { volumeAwarePlateauAdvice, primaryGatedMuscles } from "./lib/plateauVolume";
import { exerciseOrderForSession } from "./lib/historyOrder";
import volumeGuidelines from "./data/volumeGuidelines.json";
import { Dumbbell, CalendarDays, History as HistoryIcon, TrendingUp, Settings as SettingsIcon, Moon, Sun, Trophy, Check, GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

// lucide icon sizing scale. Color always inherits via currentColor from a
// token-styled parent; icons are never filled. Stroke 1.75 everywhere.
const ICON = { sm: 16, md: 20, lg: 24 };

// Shared PR marker — the StatsTab Progress-tab treatment verbatim: literal "PR"
// (plus optional weight via `value`) in gold, mono, bold. Used on workout rows,
// the WorkoutSummary, and History markers so every PR reads identically.
function PRMark({ value, C }) {
  return <span style={{fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,color:C.goldInk,fontWeight:700,whiteSpace:"nowrap"}}>PR{value!=null&&value!==""?` ${value}`:""}</span>;
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ldbrabnvpiidrdkmjpbo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYnJhYm52cGlpZHJka21qcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDMxOTQsImV4cCI6MjA5MzUxOTE5NH0.mJZINJgMl8QD-gTSc2LLikwc8OUloCTyfqoHqRe1xZI";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// -- PROGRAM START -------------------------------------------------------------
const PROGRAM_START = "2026-05-02"; // fallback only
const getProgramStart = (sessions) => {
  if(!sessions||!sessions.length) return PROGRAM_START;
  const dates = sessions
    .filter(s=>s.completedAt)
    .map(s=>new Date(s.completedAt).toLocaleDateString("en-CA"))
    .sort();
  return dates[0] || PROGRAM_START;
};
const programWeek = (sessions=[]) => {
  // start source unchanged (earliest session date / PROGRAM_START); diff via shared helper
  const days = elapsedDaysSince(getProgramStart(sessions));
  return Math.max(1, Math.ceil((days + 1) / 7));
};
// planWeekOf is imported from ./lib/planWeek


// -- THEME ---------------------------------------------------------------------
const THEMES = {
  dark: {
    bg:"#161b22", surface:"#1e2530", card:"#252d3a", border:"#3a4456",
    accent:"#4f8ef7", neon:"#3ecf8e", red:"#f06584", gold:"#f7c948",
    blue:"#4f8ef7", green:"#3ecf8e", danger:"#f06584",
    // "ink" = accent colors used as TEXT. On dark backgrounds the vivid tokens read fine,
    // so ink == vivid here; in light mode (below) ink is darkened to meet WCAG AA on white.
    accentInk:"#66a0ff", blueInk:"#66a0ff", neonInk:"#3ecf8e", greenInk:"#3ecf8e", goldInk:"#f7c948", redInk:"#ff8099", dangerInk:"#ff8099",
    // Solid-fill button/selector colors — deep enough for white text in BOTH modes
    accentBtn:"#2b6cb0", neonBtn:"#0a7a4f",
    text:"#e8edf4", muted:"#b0bac8", faint:"#6a7585", cardText:"#f2f5fa",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#1a2130", gradTop:"linear-gradient(135deg,#4f8ef715 0%,#3ecf8e08 100%)",
  },
  light: {
    bg:"#f7f9fc", surface:"#ffffff", card:"#ffffff", border:"#e2e8f0",
    accent:"#4f8ef7", neon:"#0ea66e", red:"#e53e6a", gold:"#d4a017",
    blue:"#4f8ef7", green:"#0ea66e", danger:"#e53e6a",
    // Darkened accent text colors — all meet WCAG AA (>=4.5:1) on white; vivid tokens above
    // stay for fills/borders/buttons/glows so the UI keeps its pop.
    accentInk:"#2b6cb0", blueInk:"#2b6cb0", neonInk:"#076b42", greenInk:"#076b42", goldInk:"#8a6d0a", redInk:"#c01f4d", dangerInk:"#c01f4d",
    // Solid-fill button/selector colors — same deep shades as light (white text passes)
    accentBtn:"#2b6cb0", neonBtn:"#076b42",
    text:"#1a202c", muted:"#2d3748", faint:"#5a6a7e", cardText:"#0d1117",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#ffffff", gradTop:"linear-gradient(135deg,#4f8ef710 0%,#0ea66e08 100%)",
  }
};

// -- DEFAULT PLANS -------------------------------------------------------------
const mkId = () => `id_${Math.random().toString(36).slice(2,9)}`;

// -- AI PROXY HELPER -----------------------------------------------------------
async function callAI({action,messages,maxTokens=800}){
  const{data:{session}}=await supabase.auth.getSession();
  const token=session?.access_token;
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  let res;
  try{
    res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token||""}`},body:JSON.stringify({action,messages,max_tokens:maxTokens}),signal:ctrl.signal});
  }finally{clearTimeout(tid);}
  if(res.status===402){const err=await res.json();return{upgradeRequired:true,...err};}
  if(!res.ok)throw new Error(`AI error: ${res.status}`);
  return res.json();
}

// -- PRESET TEMPLATES ----------------------------------------------------------
const PRESET_TEMPLATES = [
  {
    id:"preset_strength", emoji:"🏋️", name:"Strength Builder", tag:"4 days . Full Body Power",
    desc:"Classic powerlifting-inspired split focused on compound lifts and progressive overload. Great for building raw strength.",
    days:[
      { label:"Upper Strength", tag:"Chest . Back . Shoulders", color:"#4f8ef7", isRest:false, exercises:[
        {name:"Bench Press",sets:"5",reps:"3-5",note:"Heavy -- focus on form",muscle:"Chest"},
        {name:"Barbell Row",sets:"5",reps:"3-5",note:"Overhand grip",muscle:"Back"},
        {name:"Overhead Press",sets:"4",reps:"5-8",note:"Standing or seated",muscle:"Shoulders"},
        {name:"Pull-Ups / Lat Pulldown",sets:"4",reps:"6-10",note:"",muscle:"Back"},
        {name:"Dips",sets:"3",reps:"8-12",note:"Add weight when easy",muscle:"Triceps"},
      ]},
      { label:"Lower Strength", tag:"Legs . Core", color:"#aa44ff", isRest:false, exercises:[
        {name:"Squat",sets:"5",reps:"3-5",note:"Knee tracking -- go to comfortable depth",muscle:"Legs"},
        {name:"Romanian Deadlift",sets:"4",reps:"6-8",note:"Hip hinge, protect lower back",muscle:"Legs"},
        {name:"Leg Press",sets:"3",reps:"8-12",note:"High foot placement",muscle:"Legs"},
        {name:"Plank",sets:"3",reps:"45-60 sec",note:"",muscle:"Abs"},
        {name:"Ab Wheel",sets:"3",reps:"10-15",note:"",muscle:"Abs"},
      ]},
      { label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {name:"Walk / Stretch",sets:"--",reps:"20-30 min",note:"",muscle:"Recovery"},
      ]},
      { label:"Upper Volume", tag:"Chest . Back . Arms", color:"#4f8ef7", isRest:false, exercises:[
        {name:"Incline DB Press",sets:"4",reps:"8-12",note:"",muscle:"Chest"},
        {name:"Cable Row",sets:"4",reps:"10-12",note:"",muscle:"Back"},
        {name:"DB Lateral Raises",sets:"3",reps:"12-15",note:"",muscle:"Shoulders"},
        {name:"Cable Curl",sets:"3",reps:"10-12",note:"",muscle:"Biceps"},
        {name:"Tricep Pressdown",sets:"3",reps:"10-12",note:"",muscle:"Triceps"},
        {name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
      ]},
      { label:"Lower Volume", tag:"Legs . Glutes", color:"#aa44ff", isRest:false, exercises:[
        {name:"Goblet Squat",sets:"4",reps:"12-15",note:"",muscle:"Legs"},
        {name:"Box Step-Ups",sets:"3",reps:"10 each",note:"Drive through heel",muscle:"Legs"},
        {name:"DB Lunge",sets:"3",reps:"10 each",note:"If knees allow",muscle:"Legs"},
        {name:"Decline Sit-Ups",sets:"3",reps:"15",note:"",muscle:"Abs"},
        {name:"Russian Twist",sets:"3",reps:"20",note:"",muscle:"Abs"},
      ]},
      { label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {name:"Rest",sets:"--",reps:"--",note:"Recovery is progress",muscle:"Recovery"},
      ]},
      { label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {name:"Cardio / Mobility",sets:"--",reps:"20 min",note:"",muscle:"Recovery"},
      ]},
    ]
  },
  {
    id:"preset_hiit", emoji:"⚡", name:"Athletic Performance", tag:"5 days . Functional + Cardio",
    desc:"Combines resistance training with metabolic conditioning. Builds muscle, burns fat, and improves cardiovascular fitness.",
    days:[
      { label:"Push + Cardio", tag:"Chest . Shoulders . Triceps", color:"#f0b429", isRest:false, exercises:[
        {name:"DB Bench Press",sets:"4",reps:"10-12",note:"",muscle:"Chest"},
        {name:"Machine Shoulder Press",sets:"3",reps:"12-15",note:"",muscle:"Shoulders"},
        {name:"Lateral Raises",sets:"3",reps:"15-20",note:"Light weight, high rep",muscle:"Shoulders"},
        {name:"Tricep Pressdown",sets:"3",reps:"12-15",note:"",muscle:"Triceps"},
        {name:"Stair Stepper / Bike",sets:"--",reps:"15 min",note:"High intensity intervals",muscle:"Cardio"},
      ]},
      { label:"Pull + Core", tag:"Back . Biceps . Abs", color:"#3d8eff", isRest:false, exercises:[
        {name:"Lat Pulldown",sets:"4",reps:"10-12",note:"",muscle:"Back"},
        {name:"Seated Cable Row",sets:"3",reps:"12-15",note:"",muscle:"Back"},
        {name:"Face Pull",sets:"3",reps:"15-20",note:"Great for shoulder health",muscle:"Shoulders"},
        {name:"Cable Curl",sets:"3",reps:"12-15",note:"",muscle:"Biceps"},
        {name:"Hanging Knee Raises",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {name:"Plank",sets:"3",reps:"45 sec",note:"",muscle:"Abs"},
      ]},
      { label:"Legs + Cardio", tag:"Full Lower Body", color:"#aa44ff", isRest:false, exercises:[
        {name:"Goblet Squat",sets:"4",reps:"15",note:"",muscle:"Legs"},
        {name:"Romanian Deadlift",sets:"3",reps:"12",note:"",muscle:"Legs"},
        {name:"Box Step-Ups",sets:"3",reps:"12 each",note:"",muscle:"Legs"},
        {name:"Calf Raises",sets:"3",reps:"20",note:"",muscle:"Legs"},
        {name:"Stair Stepper",sets:"--",reps:"10 min",note:"Moderate pace",muscle:"Cardio"},
      ]},
      { label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {name:"Light Walk / Yoga",sets:"--",reps:"20-30 min",note:"",muscle:"Recovery"},
      ]},
      { label:"Full Body Circuit", tag:"Total Body", color:"#f0b429", isRest:false, exercises:[
        {name:"DB Bench Press",sets:"3",reps:"12",note:"",muscle:"Chest"},
        {name:"DB Row",sets:"3",reps:"12",note:"",muscle:"Back"},
        {name:"Goblet Squat",sets:"3",reps:"15",note:"",muscle:"Legs"},
        {name:"Shoulder Press",sets:"3",reps:"12",note:"",muscle:"Shoulders"},
        {name:"Bicep Curl",sets:"2",reps:"15",note:"",muscle:"Biceps"},
        {name:"Tricep Extension",sets:"2",reps:"15",note:"",muscle:"Triceps"},
        {name:"Mountain Climbers",sets:"3",reps:"30 sec",note:"",muscle:"Cardio"},
      ]},
      { label:"HIIT + Core", tag:"Conditioning . Abs . Power", color:"#f06584", isRest:false, exercises:[
        {name:"Stair Stepper (HIIT)",sets:"--",reps:"10 min",note:"30 sec hard / 30 sec easy",muscle:"Cardio"},
        {name:"Kettlebell Swing",sets:"4",reps:"15",note:"Hip-hinge power, not a squat",muscle:"Legs"},
        {name:"Medicine Ball Slam",sets:"3",reps:"12",note:"Full extension overhead, explosive",muscle:"Shoulders"},
        {name:"Cable Wood Chop",sets:"3",reps:"12 each",note:"Rotational core, control the return",muscle:"Abs"},
        {name:"Dead Bug",sets:"3",reps:"10 each",note:"Opposite arm/leg, lower back stays flat",muscle:"Abs"},
        {name:"Pallof Press",sets:"3",reps:"12 each",note:"Anti-rotation, stand tall",muscle:"Abs"},
      ]},
      { label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {name:"Rest",sets:"--",reps:"--",note:"",muscle:"Recovery"},
      ]},
    ]
  },
  {
    id:"preset_beginner", emoji:"🌱", name:"Beginner Foundations", tag:"3 days . Full Body",
    desc:"Three full-body sessions per week. Perfect starting point -- teaches movement patterns, builds baseline strength, low injury risk.",
    days:[
      { label:"Full Body A", tag:"Total Body", color:"#aaff00", isRest:false, exercises:[
        {name:"Goblet Squat",sets:"3",reps:"12-15",note:"Master the pattern first",muscle:"Legs"},
        {name:"DB Bench Press",sets:"3",reps:"10-12",note:"",muscle:"Chest"},
        {name:"Lat Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {name:"DB Shoulder Press",sets:"3",reps:"10-12",note:"",muscle:"Shoulders"},
        {name:"Plank",sets:"3",reps:"30-45 sec",note:"",muscle:"Abs"},
        {name:"Stair Stepper / Walk",sets:"--",reps:"10 min",note:"",muscle:"Cardio"},
      ]},
      { label:"Rest", tag:"Active Recovery", color:"#3d8eff", isRest:true, exercises:[
        {name:"Walk or Light Stretch",sets:"--",reps:"20 min",note:"",muscle:"Recovery"},
      ]},
      { label:"Full Body B", tag:"Total Body", color:"#aaff00", isRest:false, exercises:[
        {name:"Box Step-Ups",sets:"3",reps:"10 each",note:"Build leg strength safely",muscle:"Legs"},
        {name:"Cable Row",sets:"3",reps:"12",note:"",muscle:"Back"},
        {name:"DB Incline Press",sets:"3",reps:"10-12",note:"",muscle:"Chest"},
        {name:"Cable Curl",sets:"3",reps:"12",note:"",muscle:"Biceps"},
        {name:"Tricep Pressdown",sets:"3",reps:"12",note:"",muscle:"Triceps"},
        {name:"Machine Crunch",sets:"3",reps:"15",note:"",muscle:"Abs"},
      ]},
      { label:"Rest", tag:"Active Recovery", color:"#3d8eff", isRest:true, exercises:[
        {name:"Walk or Light Stretch",sets:"--",reps:"20 min",note:"",muscle:"Recovery"},
      ]},
      { label:"Full Body C", tag:"Total Body", color:"#aaff00", isRest:false, exercises:[
        {name:"Romanian Deadlift",sets:"3",reps:"12",note:"Hip hinge -- keep back flat",muscle:"Legs"},
        {name:"Pec Deck",sets:"3",reps:"12-15",note:"Chest stretch focus",muscle:"Chest"},
        {name:"Lat Pulldown",sets:"3",reps:"12",note:"",muscle:"Back"},
        {name:"Lateral Raises",sets:"3",reps:"15",note:"",muscle:"Shoulders"},
        {name:"Decline Sit-Ups",sets:"3",reps:"15",note:"",muscle:"Abs"},
        {name:"Stair Stepper",sets:"--",reps:"10 min",note:"",muscle:"Cardio"},
      ]},
      { label:"Rest", tag:"Full Rest", color:"#3d8eff", isRest:true, exercises:[
        {name:"Rest",sets:"--",reps:"--",note:"Recover, grow, repeat",muscle:"Recovery"},
      ]},
      { label:"Rest", tag:"Full Rest", color:"#3d8eff", isRest:true, exercises:[
        {name:"Rest",sets:"--",reps:"--",note:"",muscle:"Recovery"},
      ]},
    ]
  },
  {
    id:"preset_ppl", emoji:"💪", name:"Custom PPL", tag:"5 days . Push/Pull/Legs",
    desc:"Arms built into Push/Pull days. High frequency, clean structure. Great for intermediate lifters.",
    days:[
      { name:"Monday", label:"Push", tag:"Chest . Shoulders . Triceps", color:"#4f8ef7", isRest:false, exercises:[
        {name:"Bench Press",sets:"4",reps:"6-10",note:"Primary strength move",muscle:"Chest"},
        {name:"Incline Press (DB)",sets:"3",reps:"8-12",note:"DB preferred for shoulder safety",muscle:"Chest"},
        {name:"Machine Shoulder Press",sets:"3",reps:"10-12",note:"Machine reduces joint stress",muscle:"Shoulders"},
        {name:"Dumbbell Lateral Raises",sets:"3",reps:"12-15",note:"Slow eccentric, avoid momentum",muscle:"Shoulders"},
        {name:"Incline Tricep Extension",sets:"3",reps:"10-12",note:"Elbow-friendly angle",muscle:"Triceps"},
        {name:"Cable Overhead Extension",sets:"2",reps:"12-15",note:"Long-head emphasis",muscle:"Triceps"},
        {name:"Stair Stepper",sets:"--",reps:"10-15 min",note:"Zone 2 cardio post-workout",muscle:"Cardio"},
      ]},
      { name:"Tuesday", label:"Pull", tag:"Back . Biceps . Rear Delt", color:"#3d8eff", isRest:false, exercises:[
        {name:"Reverse Grip Lat Pulldown",sets:"4",reps:"8-12",note:"Supinated grip -- easier on elbows",muscle:"Back"},
        {name:"Seated Cable Row",sets:"3",reps:"10-12",note:"Drive elbows back, hold 1 sec",muscle:"Back"},
        {name:"Rear Delt Machine",sets:"3",reps:"12-15",note:"Shoulder health -- never skip",muscle:"Shoulders"},
        {name:"Cable Curl",sets:"3",reps:"10-12",note:"Control the negative",muscle:"Biceps"},
        {name:"Concentration Curl",sets:"2",reps:"12-15",note:"Full squeeze at top, slow negative",muscle:"Biceps"},
        {name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {name:"Russian Twist",sets:"3",reps:"20 total",note:"Add plate for progression",muscle:"Abs"},
      ]},
      { name:"Wednesday", label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {name:"Walking / Yoga / Stretching",sets:"--",reps:"20-30 min",note:"Keep it easy",muscle:"Recovery"},
      ]},
      { name:"Thursday", label:"Legs", tag:"Quads . Glutes . Hamstrings . Core", color:"#aa44ff", isRest:false, exercises:[
        {name:"Goblet Squat",sets:"4",reps:"10-15",note:"Keep weight over mid-foot",muscle:"Legs"},
        {name:"DB Romanian Deadlift",sets:"3",reps:"10-12",note:"Hip hinge -- protects knees",muscle:"Legs"},
        {name:"Box Step-Ups (DB)",sets:"3",reps:"10 each leg",note:"Drive through heel, controlled step down",muscle:"Legs"},
        {name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
        {name:"Russian Twist",sets:"3",reps:"20 total",note:"",muscle:"Abs"},
        {name:"Stair Stepper",sets:"--",reps:"10 min",note:"Shorter today -- legs already worked",muscle:"Cardio"},
      ]},
      { name:"Friday", label:"Push", tag:"Chest . Shoulders . Triceps (Vol)", color:"#4f8ef7", isRest:false, exercises:[
        {name:"Incline Press (DB)",sets:"4",reps:"8-12",note:"Lead with incline today",muscle:"Chest"},
        {name:"Cable Fly / Pec Deck",sets:"3",reps:"12-15",note:"Stretch-focused, lighter load",muscle:"Chest"},
        {name:"Machine Shoulder Press",sets:"3",reps:"10-12",note:"",muscle:"Shoulders"},
        {name:"Cable Lateral Raise",sets:"3",reps:"12-15",note:"Constant tension vs DB",muscle:"Shoulders"},
        {name:"Cable Rope Pressdown",sets:"3",reps:"12-15",note:"",muscle:"Triceps"},
        {name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
      ]},
      { name:"Saturday", label:"Pull", tag:"Back . Biceps (Volume)", color:"#3d8eff", isRest:false, exercises:[
        {name:"T-Bar Row",sets:"4",reps:"8-12",note:"Neutral grip easier on elbows",muscle:"Back"},
        {name:"Reverse Grip Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {name:"Rear Delt Cable or Machine",sets:"3",reps:"12-15",note:"",muscle:"Shoulders"},
        {name:"Cable Curl",sets:"3",reps:"12-15",note:"Constant tension",muscle:"Biceps"},
        {name:"Concentration Curl",sets:"2",reps:"12-15",note:"Full squeeze at top",muscle:"Biceps"},
        {name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
        {name:"Stair Stepper",sets:"--",reps:"15 min",note:"",muscle:"Cardio"},
      ]},
      { name:"Sunday", label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {name:"Full Rest or Light Walk",sets:"--",reps:"--",note:"Recovery is where you grow",muscle:"Recovery"},
      ]},
    ]
  },
  {
    id:"preset_antagonist", emoji:"🔄", name:"Antagonist Split", tag:"5 days . Chest+Back / Arms / Legs",
    desc:"Chest/Back paired for maximum pump and efficiency. Standalone Arm day for full specialization.",
    days:[
      { name:"Monday", label:"Chest + Back", tag:"Antagonist Pair", color:"#4f8ef7", isRest:false, exercises:[
        {name:"Bench Press",sets:"4",reps:"6-10",note:"Primary push strength",muscle:"Chest"},
        {name:"T-Bar Row",sets:"4",reps:"8-12",note:"Superset option with bench",muscle:"Back"},
        {name:"Incline Press (DB)",sets:"3",reps:"8-12",note:"",muscle:"Chest"},
        {name:"Reverse Grip Lat Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {name:"Cable Fly",sets:"3",reps:"12-15",note:"Stretch focus",muscle:"Chest"},
        {name:"Seated Cable Row",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {name:"Stair Stepper",sets:"--",reps:"10-15 min",note:"",muscle:"Cardio"},
      ]},
      { name:"Tuesday", label:"Arms", tag:"Shoulders . Triceps . Biceps", color:"#f0b429", isRest:false, exercises:[
        {name:"Machine Shoulder Press",sets:"4",reps:"10-12",note:"Machine reduces joint stress",muscle:"Shoulders"},
        {name:"DB / Cable Lateral Raises",sets:"3",reps:"12-15",note:"Slow and controlled",muscle:"Shoulders"},
        {name:"Rear Delt Machine",sets:"3",reps:"12-15",note:"Critical for shoulder health",muscle:"Shoulders"},
        {name:"Incline Tricep Extension",sets:"3",reps:"10-12",note:"",muscle:"Triceps"},
        {name:"Cable Overhead Extension",sets:"2",reps:"12-15",note:"",muscle:"Triceps"},
        {name:"Cable Curl",sets:"3",reps:"10-12",note:"",muscle:"Biceps"},
        {name:"Concentration Curl",sets:"3",reps:"12-15",note:"Full squeeze, slow negative",muscle:"Biceps"},
        {name:"Russian Twist",sets:"3",reps:"20 total",note:"",muscle:"Abs"},
      ]},
      { name:"Wednesday", label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {name:"Walking / Yoga / Stretching",sets:"--",reps:"20-30 min",note:"",muscle:"Recovery"},
      ]},
      { name:"Thursday", label:"Legs", tag:"Quads . Glutes . Hamstrings . Core", color:"#aa44ff", isRest:false, exercises:[
        {name:"Goblet Squat",sets:"4",reps:"10-15",note:"Heels elevated slightly if needed",muscle:"Legs"},
        {name:"DB Romanian Deadlift",sets:"3",reps:"10-12",note:"Hip hinge -- protects knees",muscle:"Legs"},
        {name:"Box Step-Ups (DB)",sets:"3",reps:"10 each leg",note:"Drive through heel, controlled down",muscle:"Legs"},
        {name:"DB Lunges (optional)",sets:"3",reps:"10 each leg",note:"Only if knees feel good",muscle:"Legs"},
        {name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
        {name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {name:"Stair Stepper",sets:"--",reps:"10 min",note:"",muscle:"Cardio"},
      ]},
      { name:"Friday", label:"Chest + Back", tag:"Antagonist Pair (Volume)", color:"#4f8ef7", isRest:false, exercises:[
        {name:"Incline Press (DB)",sets:"4",reps:"8-12",note:"Lead with incline",muscle:"Chest"},
        {name:"Seated Row (Close Grip)",sets:"4",reps:"10-12",note:"",muscle:"Back"},
        {name:"Pec Deck / Cable Fly",sets:"3",reps:"12-15",note:"",muscle:"Chest"},
        {name:"Reverse Grip Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {name:"Rear Delt Cable",sets:"3",reps:"12-15",note:"Shoulder health",muscle:"Shoulders"},
        {name:"Russian Twist",sets:"3",reps:"20 total",note:"",muscle:"Abs"},
        {name:"Stair Stepper",sets:"--",reps:"15 min",note:"",muscle:"Cardio"},
      ]},
      { name:"Saturday", label:"Arms", tag:"Shoulders . Triceps . Biceps (Vol)", color:"#f0b429", isRest:false, exercises:[
        {name:"Machine Shoulder Press",sets:"3",reps:"10-12",note:"",muscle:"Shoulders"},
        {name:"Cable Lateral Raise",sets:"3",reps:"12-15",note:"Constant tension",muscle:"Shoulders"},
        {name:"Front Delt Raise",sets:"2",reps:"12-15",note:"",muscle:"Shoulders"},
        {name:"Cable Rope Pressdown",sets:"3",reps:"12-15",note:"",muscle:"Triceps"},
        {name:"Incline Tricep Extension",sets:"2",reps:"10-12",note:"",muscle:"Triceps"},
        {name:"Barbell / Cable Curl",sets:"3",reps:"10-12",note:"",muscle:"Biceps"},
        {name:"Concentration Curl",sets:"2",reps:"12-15",note:"",muscle:"Biceps"},
        {name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
      ]},
      { name:"Sunday", label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {name:"Full Rest",sets:"--",reps:"--",note:"Recovery is where you grow",muscle:"Recovery"},
      ]},
    ]
  }
];

// -- EXERCISE LIBRARY (200 exercises) -----------------------------------------
const EXERCISE_LIBRARY = [
  // CHEST
  {name:"Barbell Bench Press",muscle:"Chest",equipment:"Barbell",cue:"Tuck elbows 45°, touch chest, drive through full range"},
  {name:"Incline Barbell Press",muscle:"Chest",equipment:"Barbell",cue:"Set bench 30-45°, same form as flat, upper chest focus"},
  {name:"Decline Barbell Press",muscle:"Chest",equipment:"Barbell",cue:"Feet secured, natural arch, lower to lower chest"},
  {name:"Reverse Grip Bench Press",muscle:"Chest",equipment:"Barbell",cue:"Supinated grip targets upper chest, use lighter load"},
  {name:"Landmine Press",muscle:"Chest",equipment:"Barbell",cue:"Arc motion upward, shoulder-friendly chest activation"},
  {name:"Dumbbell Bench Press",muscle:"Chest",equipment:"Dumbbell",cue:"Neutral grip at bottom, rotate to pronated at top"},
  {name:"Incline Dumbbell Press",muscle:"Chest",equipment:"Dumbbell",cue:"30-45° bench, control descent, slight elbow flare"},
  {name:"Decline Dumbbell Press",muscle:"Chest",equipment:"Dumbbell",cue:"Keep wrists stacked over elbows, pause at chest"},
  {name:"Dumbbell Flye",muscle:"Chest",equipment:"Dumbbell",cue:"Maintain slight elbow bend, feel the stretch at bottom"},
  {name:"Incline Dumbbell Flye",muscle:"Chest",equipment:"Dumbbell",cue:"Stretch upper pecs fully, squeeze hard at top"},
  {name:"Dumbbell Squeeze Press",muscle:"Chest",equipment:"Dumbbell",cue:"Press DBs together throughout, maximizes peak contraction"},
  {name:"Hex Press",muscle:"Chest",equipment:"Dumbbell",cue:"Keep DBs pressed together, squeeze throughout every rep"},
  {name:"Cable Crossover",muscle:"Chest",equipment:"Cable",cue:"Lean slightly forward, bring hands together at hip level"},
  {name:"Low-to-High Cable Fly",muscle:"Chest",equipment:"Cable",cue:"Cables set low, drive hands up and together for upper chest"},
  {name:"High-to-Low Cable Fly",muscle:"Chest",equipment:"Cable",cue:"Cables overhead, sweep hands down and together"},
  {name:"Cable Flye",muscle:"Chest",equipment:"Cable",cue:"Constant tension, slight elbow bend, slow negative"},
  {name:"Cable Upper Chest Press",muscle:"Chest",equipment:"Cable",cue:"Cables set low, press at upward angle targeting upper chest"},
  {name:"Pec Deck",muscle:"Chest",equipment:"Machine",cue:"Don't go past 90° at elbows, squeeze hard at center"},
  {name:"Machine Chest Press",muscle:"Chest",equipment:"Machine",cue:"Seat at mid-chest height, full extension without locking"},
  {name:"Incline Machine Press",muscle:"Chest",equipment:"Machine",cue:"Upper chest focus, keep elbows at 45° from body"},
  {name:"Smith Machine Bench Press",muscle:"Chest",equipment:"Machine",cue:"Control the bar path precisely, pause at chest"},
  {name:"Push-Up",muscle:"Chest",equipment:"Bodyweight",cue:"Hands slightly wider than shoulders, keep core braced"},
  {name:"Wide-Grip Push-Up",muscle:"Chest",equipment:"Bodyweight",cue:"Extra chest stretch at bottom, slow the eccentric"},
  {name:"Decline Push-Up",muscle:"Chest",equipment:"Bodyweight",cue:"Feet elevated on bench, targets upper chest more"},
  {name:"Chest Dip",muscle:"Chest",equipment:"Bodyweight",cue:"Lean forward significantly, elbows flare slightly outward"},
  {name:"Svend Press",muscle:"Chest",equipment:"Bodyweight",cue:"Squeeze plate together while pressing out, pure contraction"},
  {name:"Resistance Band Press",muscle:"Chest",equipment:"Bodyweight",cue:"Band around back, variable resistance through full range"},
  {name:"Diamond Push-Up",muscle:"Chest",equipment:"Bodyweight",cue:"Hands form diamond shape, inner chest and tricep emphasis"},
  // BACK
  {name:"Barbell Deadlift",muscle:"Back",equipment:"Barbell",cue:"Hip hinge, neutral spine, drive through floor explosively"},
  {name:"Romanian Deadlift",muscle:"Back",equipment:"Barbell",cue:"Hips back, soft knees, bar stays close to the legs"},
  {name:"Bent Over Barbell Row",muscle:"Back",equipment:"Barbell",cue:"Overhand grip, row to lower chest, squeeze shoulder blades"},
  {name:"T-Bar Row",muscle:"Back",equipment:"Barbell",cue:"Neutral grip, chest on pad, drive elbows back hard"},
  {name:"Rack Pull",muscle:"Back",equipment:"Barbell",cue:"Partial deadlift from knee height, overloads upper back"},
  {name:"Seal Row",muscle:"Back",equipment:"Barbell",cue:"Chest on elevated bench, pure pull without body English"},
  {name:"Meadows Row",muscle:"Back",equipment:"Barbell",cue:"Landmine attachment, single arm, excellent for thickness"},
  {name:"Reverse Grip Barbell Row",muscle:"Back",equipment:"Barbell",cue:"Supinated grip shifts emphasis to lower lats"},
  {name:"Single Arm Dumbbell Row",muscle:"Back",equipment:"Dumbbell",cue:"Brace on bench, pull elbow straight toward ceiling"},
  {name:"Gorilla Row",muscle:"Back",equipment:"Dumbbell",cue:"Both DBs on floor, alternate rows, maintain hip hinge"},
  {name:"Dumbbell Pullover",muscle:"Back",equipment:"Dumbbell",cue:"Arms nearly straight, feel the full lat stretch overhead"},
  {name:"Wide-Grip Lat Pulldown",muscle:"Back",equipment:"Cable",cue:"Lean back slightly, pull bar to upper chest"},
  {name:"Reverse Grip Lat Pulldown",muscle:"Back",equipment:"Cable",cue:"Supinated grip reduces elbow strain, better lat engagement"},
  {name:"Close-Grip Lat Pulldown",muscle:"Back",equipment:"Cable",cue:"V-bar attachment, elbows track alongside the body"},
  {name:"Seated Cable Row",muscle:"Back",equipment:"Cable",cue:"Drive elbows behind torso, hold 1-second squeeze at peak"},
  {name:"Single Arm Cable Row",muscle:"Back",equipment:"Cable",cue:"Rotate torso slightly for full lat engagement"},
  {name:"Cable Pullover",muscle:"Back",equipment:"Cable",cue:"Kneeling or standing, same lat stretch as dumbbell version"},
  {name:"Face Pull",muscle:"Back",equipment:"Cable",cue:"High cable, rope attachment, pull to forehead with rotation"},
  {name:"Straight Arm Pulldown",muscle:"Back",equipment:"Cable",cue:"Hinge forward, arms nearly straight, engage lats throughout"},
  {name:"Rope Straight Arm Pulldown",muscle:"Back",equipment:"Cable",cue:"Same as bar version but rope allows more wrist freedom"},
  {name:"Wide Grip Seated Row",muscle:"Back",equipment:"Cable",cue:"Bar attachment, wider grip targets upper back more"},
  {name:"Kneeling Single Arm Pulldown",muscle:"Back",equipment:"Cable",cue:"Kneeling keeps body honest, isolates one side at a time"},
  {name:"Pull-Up",muscle:"Back",equipment:"Bodyweight",cue:"Dead hang to chest at bar, full scapular retraction"},
  {name:"Chin-Up",muscle:"Back",equipment:"Bodyweight",cue:"Supinated grip, biceps assist, full hang at bottom"},
  {name:"Inverted Row",muscle:"Back",equipment:"Bodyweight",cue:"Bar at hip height, body straight, pull chest to bar"},
  {name:"Hyperextension",muscle:"Back",equipment:"Bodyweight",cue:"Squeeze glutes at top, avoid hyperextending lower back"},
  {name:"Back Extension (Weighted)",muscle:"Back",equipment:"Bodyweight",cue:"Hold plate at chest, smooth movement throughout range"},
  {name:"Band Assisted Pull-Up",muscle:"Back",equipment:"Bodyweight",cue:"Band provides assistance at bottom, builds pull-up strength"},
  {name:"Machine Row",muscle:"Back",equipment:"Machine",cue:"Chest pad for stability, drive elbows back fully"},
  {name:"Assisted Pull-Up",muscle:"Back",equipment:"Machine",cue:"Use minimal assistance, full range dead hang to chin over"},
  // SHOULDERS
  {name:"Barbell Overhead Press",muscle:"Shoulders",equipment:"Barbell",cue:"Bar path in front of face, full lockout overhead"},
  {name:"Seated Dumbbell Press",muscle:"Shoulders",equipment:"Dumbbell",cue:"Neutral or pronated grip, don't let shoulders shrug"},
  {name:"Arnold Press",muscle:"Shoulders",equipment:"Dumbbell",cue:"Rotate from neutral to pronated as you press upward"},
  {name:"Push Press",muscle:"Shoulders",equipment:"Barbell",cue:"Slight knee dip to initiate drive, lock out overhead"},
  {name:"Dumbbell Lateral Raise",muscle:"Shoulders",equipment:"Dumbbell",cue:"Slight forward lean, lead with elbow, avoid momentum"},
  {name:"Leaning Lateral Raise",muscle:"Shoulders",equipment:"Dumbbell",cue:"Hold rack and lean away, full stretch at bottom position"},
  {name:"Dumbbell Front Raise",muscle:"Shoulders",equipment:"Dumbbell",cue:"Alternate arms, control descent, slight elbow bend"},
  {name:"Plate Front Raise",muscle:"Shoulders",equipment:"Bodyweight",cue:"Hold plate by edges, raise to eye level, arms nearly straight"},
  {name:"Rear Delt Flye",muscle:"Shoulders",equipment:"Dumbbell",cue:"Hinge forward, thumbs pointing down, lead with elbows"},
  {name:"Band Pull-Apart",muscle:"Shoulders",equipment:"Bodyweight",cue:"Arms straight, pull band to chest level, rear delt focus"},
  {name:"Cable Lateral Raise",muscle:"Shoulders",equipment:"Cable",cue:"Cross-body cable, constant tension through full range"},
  {name:"Rear Delt Cable Fly",muscle:"Shoulders",equipment:"Cable",cue:"High pulley, cross-body pull, finish at temple level"},
  {name:"Cable Face Pull",muscle:"Shoulders",equipment:"Cable",cue:"High cable, rope attachment, pull to forehead with rotation"},
  {name:"Upright Row (Cable)",muscle:"Shoulders",equipment:"Cable",cue:"Narrow grip, elbows flare up past wrists to ear height"},
  {name:"Y-Raise (Cable)",muscle:"Shoulders",equipment:"Cable",cue:"Low pulley, raise arms in Y shape, lower traps engaged"},
  {name:"Machine Shoulder Press",muscle:"Shoulders",equipment:"Machine",cue:"Adjust seat so handles start at ear level"},
  {name:"Machine Lateral Raise",muscle:"Shoulders",equipment:"Machine",cue:"Pause at top, slow 3-second negative for best results"},
  {name:"Rear Delt Machine",muscle:"Shoulders",equipment:"Machine",cue:"Face down or seated, never skip for shoulder health"},
  {name:"Smith Machine Shoulder Press",muscle:"Shoulders",equipment:"Machine",cue:"Controlled bar path, great for drop sets and volume"},
  {name:"Barbell Shrug",muscle:"Shoulders",equipment:"Barbell",cue:"Straight up and down, no rolling, hold squeeze at top"},
  {name:"Dumbbell Shrug",muscle:"Shoulders",equipment:"Dumbbell",cue:"Same principle as barbell, easier wrist position"},
  {name:"Upright Row (Dumbbell)",muscle:"Shoulders",equipment:"Dumbbell",cue:"Same as barbell upright row, slightly easier on wrists"},
  {name:"Bradford Press",muscle:"Shoulders",equipment:"Barbell",cue:"Alternate front and behind neck, shoulder mobility work"},
  // BICEPS
  {name:"Barbell Curl",muscle:"Biceps",equipment:"Barbell",cue:"Elbows pinned to sides, squeeze hard at top"},
  {name:"EZ-Bar Curl",muscle:"Biceps",equipment:"Barbell",cue:"Angled grip reduces wrist strain, great for volume work"},
  {name:"Preacher Curl",muscle:"Biceps",equipment:"Barbell",cue:"Don't lock out at bottom, keep constant tension on bicep"},
  {name:"Reverse Curl",muscle:"Biceps",equipment:"Barbell",cue:"Pronated grip, forearm and brachialis emphasis"},
  {name:"21s Curl",muscle:"Biceps",equipment:"Barbell",cue:"7 bottom-half, 7 top-half, 7 full reps for pump"},
  {name:"Drag Curl",muscle:"Biceps",equipment:"Barbell",cue:"Drag bar up torso, elbows travel behind body at top"},
  {name:"Wide-Grip Barbell Curl",muscle:"Biceps",equipment:"Barbell",cue:"Wider grip hits short head, full supination at top"},
  {name:"Dumbbell Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Supinate wrist at top, control the negative fully"},
  {name:"Hammer Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Neutral grip targets brachialis, builds arm thickness"},
  {name:"Incline Dumbbell Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Greater stretch at bottom, excellent for developing peak"},
  {name:"Concentration Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Elbow on inner thigh, no swinging, full squeeze at top"},
  {name:"Spider Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Chest on incline bench, arms hang down, curl straight up"},
  {name:"Cross-Body Hammer Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Curl across body, hits brachialis and brachioradialis"},
  {name:"Zottman Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Curl supinated, lower pronated, works entire arm chain"},
  {name:"Seated Alternating Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Full supination with each rep, keep upper arms still"},
  {name:"Waiter Curl",muscle:"Biceps",equipment:"Dumbbell",cue:"Hold one DB vertically, elbows close together, curl up"},
  {name:"Cable Curl",muscle:"Biceps",equipment:"Cable",cue:"Constant tension through full range, slow eccentric"},
  {name:"Rope Hammer Curl",muscle:"Biceps",equipment:"Cable",cue:"Neutral grip on rope, keep elbows pinned to sides"},
  {name:"High Cable Curl",muscle:"Biceps",equipment:"Cable",cue:"Cable at head height, focus on peak contraction"},
  {name:"Bayesian Curl",muscle:"Biceps",equipment:"Cable",cue:"Cable behind body, full stretch at bottom position"},
  {name:"Machine Curl",muscle:"Biceps",equipment:"Machine",cue:"Strict form, fully isolates bicep, excellent mind-muscle"},
  {name:"Chin-Up (Bicep Focus)",muscle:"Biceps",equipment:"Bodyweight",cue:"Supinated grip, drive elbows down to lats, squeeze at top"},
  {name:"Band Curl",muscle:"Biceps",equipment:"Bodyweight",cue:"Band under foot, constant tension from start to finish"},
  // TRICEPS
  {name:"Close-Grip Bench Press",muscle:"Triceps",equipment:"Barbell",cue:"Hands shoulder-width, elbows track close to body"},
  {name:"Skull Crusher",muscle:"Triceps",equipment:"Barbell",cue:"Lower EZ-bar to forehead, elbows fixed, press back up"},
  {name:"JM Press",muscle:"Triceps",equipment:"Barbell",cue:"Cross between skull crusher and close-grip, elbows angled"},
  {name:"Overhead Tricep Extension (DB)",muscle:"Triceps",equipment:"Dumbbell",cue:"Both hands on DB, lower behind head, feel full stretch"},
  {name:"Incline Tricep Extension",muscle:"Triceps",equipment:"Dumbbell",cue:"Elbow-friendly angle, emphasizes long head stretch"},
  {name:"Tate Press",muscle:"Triceps",equipment:"Dumbbell",cue:"Lower DBs to chest with elbows pointing upward"},
  {name:"Dumbbell Kickback",muscle:"Triceps",equipment:"Dumbbell",cue:"Elbow stays at hip height, fully extend arm behind body"},
  {name:"Floor Press",muscle:"Triceps",equipment:"Dumbbell",cue:"Floor limits range of motion, targets lockout strength"},
  {name:"Lying Tricep Extension",muscle:"Triceps",equipment:"Dumbbell",cue:"Arms perpendicular to floor, lower to temple level"},
  {name:"Cable Rope Pressdown",muscle:"Triceps",equipment:"Cable",cue:"Flare rope at bottom, full extension, elbows at sides"},
  {name:"Cable Bar Pressdown",muscle:"Triceps",equipment:"Cable",cue:"Overhand grip, lock elbows at sides throughout"},
  {name:"Reverse Grip Pressdown",muscle:"Triceps",equipment:"Cable",cue:"Underhand grip, hits lateral head from a different angle"},
  {name:"Overhead Cable Extension",muscle:"Triceps",equipment:"Cable",cue:"Face away from cable, extend fully overhead, full stretch"},
  {name:"Single Arm Overhead Extension",muscle:"Triceps",equipment:"Cable",cue:"Elbow by ear, extend fully up, feel stretch at bottom"},
  {name:"V-Bar Pressdown",muscle:"Triceps",equipment:"Cable",cue:"Fixed V-bar, elbows locked at sides, squeeze at bottom"},
  {name:"Tricep Pushdown (Straight Bar)",muscle:"Triceps",equipment:"Cable",cue:"Pronated grip, lock elbows at sides, full extension"},
  {name:"Cable Kickback",muscle:"Triceps",equipment:"Cable",cue:"Single arm, elbow pinned to side, extend fully behind"},
  {name:"Tricep Dip",muscle:"Triceps",equipment:"Bodyweight",cue:"Stay upright, elbows close to body, don't flare forward"},
  {name:"Bench Dip",muscle:"Triceps",equipment:"Bodyweight",cue:"Hands on bench, lower hips, elbows track straight back"},
  {name:"Close-Grip Push-Up",muscle:"Triceps",equipment:"Bodyweight",cue:"Hands 6-8 inches apart, elbows track backward not outward"},
  {name:"Diamond Push-Up",muscle:"Triceps",equipment:"Bodyweight",cue:"Hands form diamond, elbows flare back, tricep isolation"},
  {name:"Machine Tricep Extension",muscle:"Triceps",equipment:"Machine",cue:"Consistent arc path, excellent for high-rep pump sets"},
  // LEGS
  {name:"Barbell Back Squat",muscle:"Legs",equipment:"Barbell",cue:"Bar on traps, depth to parallel or below, knees track toes"},
  {name:"Front Squat",muscle:"Legs",equipment:"Barbell",cue:"Bar on front delts, upright torso, quad dominant pattern"},
  {name:"Romanian Deadlift (Barbell)",muscle:"Legs",equipment:"Barbell",cue:"Hip hinge, bar stays close to body throughout movement"},
  {name:"Good Morning",muscle:"Legs",equipment:"Barbell",cue:"Slight knee bend, hinge at hips, keep back flat throughout"},
  {name:"Trap Bar Deadlift",muscle:"Legs",equipment:"Barbell",cue:"Neutral grip, center of gravity over heels and midfoot"},
  {name:"Hip Thrust",muscle:"Legs",equipment:"Barbell",cue:"Shoulder blades on bench, drive hips up, squeeze glutes"},
  {name:"Goblet Squat",muscle:"Legs",equipment:"Dumbbell",cue:"DB or KB at chest, heels slightly elevated if needed"},
  {name:"Bulgarian Split Squat",muscle:"Legs",equipment:"Dumbbell",cue:"Rear foot elevated, forward knee tracks toe, stay upright"},
  {name:"DB Romanian Deadlift",muscle:"Legs",equipment:"Dumbbell",cue:"Hips back, soft knees, DBs track down along quads"},
  {name:"Box Step-Up",muscle:"Legs",equipment:"Dumbbell",cue:"Drive through the heel, controlled step-down movement"},
  {name:"Dumbbell Lunge",muscle:"Legs",equipment:"Dumbbell",cue:"Step long enough so front shin stays vertical"},
  {name:"Walking Lunge",muscle:"Legs",equipment:"Dumbbell",cue:"Continuous motion, keep posture upright, step through"},
  {name:"Sumo Goblet Squat",muscle:"Legs",equipment:"Dumbbell",cue:"Wide stance, toes angled, inner thigh and glute emphasis"},
  {name:"Side Lunge",muscle:"Legs",equipment:"Dumbbell",cue:"Wide lateral step, push hips back, drive through heel"},
  {name:"Curtsy Lunge",muscle:"Legs",equipment:"Dumbbell",cue:"Cross rear leg behind, targets glutes from a new angle"},
  {name:"Cable Pull-Through",muscle:"Legs",equipment:"Cable",cue:"Low pulley between legs, hip hinge, drive hips forward"},
  {name:"Cable Glute Kickback",muscle:"Legs",equipment:"Cable",cue:"Ankle attachment, slow controlled extension, squeeze at top"},
  {name:"Leg Press",muscle:"Legs",equipment:"Machine",cue:"High foot placement for glutes, don't lock knees fully"},
  {name:"Hack Squat",muscle:"Legs",equipment:"Machine",cue:"Keeps torso more upright than free squat, quad focused"},
  {name:"Leg Extension",muscle:"Legs",equipment:"Machine",cue:"Pause at top, don't use momentum, slow 3-second negative"},
  {name:"Lying Leg Curl",muscle:"Legs",equipment:"Machine",cue:"Don't lift hips, curl heel toward glutes smoothly"},
  {name:"Seated Leg Curl",muscle:"Legs",equipment:"Machine",cue:"Better hamstring stretch than lying version"},
  {name:"Standing Calf Raise",muscle:"Legs",equipment:"Machine",cue:"Full range, pause at top and stretch at bottom position"},
  {name:"Seated Calf Raise",muscle:"Legs",equipment:"Machine",cue:"Soleus emphasis, same pause principle, heavier loading"},
  {name:"Smith Machine Squat",muscle:"Legs",equipment:"Machine",cue:"Feet slightly forward, great for controlled technique work"},
  {name:"Pendulum Squat",muscle:"Legs",equipment:"Machine",cue:"Knees track perfectly, excellent for knee-sensitive trainees"},
  {name:"Hip Adductor Machine",muscle:"Legs",equipment:"Machine",cue:"Controlled squeeze inward, slow eccentric, avoid slamming weight"},
  {name:"Hip Abductor Machine",muscle:"Legs",equipment:"Machine",cue:"Drive knees outward against pad, hold at peak, slow return"},
  {name:"Glute Bridge",muscle:"Legs",equipment:"Bodyweight",cue:"Feet flat, push through heels, hold squeeze at top"},
  {name:"Donkey Kick",muscle:"Legs",equipment:"Bodyweight",cue:"Kick heel toward ceiling, squeeze glute fully at top"},
  {name:"Nordic Curl",muscle:"Legs",equipment:"Bodyweight",cue:"Feet anchored, lower torso slowly, pure eccentric work"},
  {name:"Sissy Squat",muscle:"Legs",equipment:"Bodyweight",cue:"Knees travel forward, deep stretch, hold support if needed"},
  {name:"Cossack Squat",muscle:"Legs",equipment:"Bodyweight",cue:"Lateral squat, great for mobility and inner thigh strength"},
  {name:"Box Jump",muscle:"Legs",equipment:"Bodyweight",cue:"Land softly with bent knees and hips, always step down"},
  // ABS
  {name:"Crunch",muscle:"Abs",equipment:"Bodyweight",cue:"Curl upper back off floor, exhale at top, don't pull neck"},
  {name:"Decline Sit-Up",muscle:"Abs",equipment:"Bodyweight",cue:"Control descent, don't hyperextend at the bottom"},
  {name:"Russian Twist",muscle:"Abs",equipment:"Bodyweight",cue:"Rotate torso not just arms, add plate for progression"},
  {name:"Bicycle Crunch",muscle:"Abs",equipment:"Bodyweight",cue:"Slow and controlled beats fast and sloppy for obliques"},
  {name:"Hanging Leg Raise",muscle:"Abs",equipment:"Bodyweight",cue:"No swinging, raise legs to 90°, lower very slowly"},
  {name:"Hanging Knee Raise",muscle:"Abs",equipment:"Bodyweight",cue:"Round lower back at top for maximum lower ab engagement"},
  {name:"Plank",muscle:"Abs",equipment:"Bodyweight",cue:"Neutral spine, squeeze glutes and abs, breathe normally"},
  {name:"Side Plank",muscle:"Abs",equipment:"Bodyweight",cue:"Hips up, straight line from feet to head, oblique focus"},
  {name:"Ab Wheel Rollout",muscle:"Abs",equipment:"Bodyweight",cue:"Brace abs before rolling out, don't let lower back sag"},
  {name:"Hollow Hold",muscle:"Abs",equipment:"Bodyweight",cue:"Lower back pressed to floor, legs and shoulders off ground"},
  {name:"V-Up",muscle:"Abs",equipment:"Bodyweight",cue:"Full body crunch, touch toes at top, control the descent"},
  {name:"Flutter Kick",muscle:"Abs",equipment:"Bodyweight",cue:"Lower back pressed down, alternate leg raises, stay controlled"},
  {name:"Dead Bug",muscle:"Abs",equipment:"Bodyweight",cue:"Opposite arm and leg extends, lower back stays flat throughout"},
  {name:"Dragon Flag",muscle:"Abs",equipment:"Bodyweight",cue:"Advanced: whole body parallel to bench, slow negative"},
  {name:"Side Crunch",muscle:"Abs",equipment:"Bodyweight",cue:"Lie on side, crunch elbow toward hip, oblique isolation"},
  {name:"Toe-to-Bar",muscle:"Abs",equipment:"Bodyweight",cue:"From dead hang, raise straight legs to touch the bar"},
  {name:"Machine Crunch",muscle:"Abs",equipment:"Machine",cue:"Cable stack enables progressive overload on abs"},
  {name:"Captain's Chair Leg Raise",muscle:"Abs",equipment:"Machine",cue:"Supported version, press lower back into pad throughout"},
  {name:"Cable Crunch",muscle:"Abs",equipment:"Cable",cue:"Round spine downward, contract abs not hip flexors"},
  {name:"Wood Chop",muscle:"Abs",equipment:"Cable",cue:"Rotational movement, core drives the motion not the arms"},
  {name:"Pallof Press",muscle:"Abs",equipment:"Cable",cue:"Anti-rotation press, resist cable pulling you sideways"},
  {name:"Landmine Twist",muscle:"Abs",equipment:"Barbell",cue:"Arc bar side to side, rotate from hips and core"},
  // CARDIO
  {name:"Stair Stepper",muscle:"Cardio",equipment:"Machine",cue:"Upright posture, don't lean on rails, steady Zone 2 pace"},
  {name:"Treadmill Walk",muscle:"Cardio",equipment:"Machine",cue:"3-4% incline, brisk pace, arms relaxed at sides"},
  {name:"Treadmill Run",muscle:"Cardio",equipment:"Machine",cue:"Midfoot strike, relaxed shoulders, breathe rhythmically"},
  {name:"Stationary Bike",muscle:"Cardio",equipment:"Machine",cue:"Seat height so knee has slight bend at bottom position"},
  {name:"Rowing Machine",muscle:"Cardio",equipment:"Machine",cue:"Legs first, then lean, then pull — reverse on recovery"},
  {name:"Elliptical",muscle:"Cardio",equipment:"Machine",cue:"Light grip on handles, upright posture, push with legs"},
  {name:"Incline Treadmill Walk",muscle:"Cardio",equipment:"Machine",cue:"Hands-free, high incline, steady Zone 2 pace for fat burn"},
  {name:"Battle Rope",muscle:"Cardio",equipment:"Machine",cue:"Hinge at hips slightly, create alternating waves"},
  {name:"Sled Push",muscle:"Cardio",equipment:"Machine",cue:"Drive from hips, stay low, push through full leg extension"},
  {name:"Assault Bike",muscle:"Cardio",equipment:"Machine",cue:"Max effort intervals or steady state, arms and legs work"},
  {name:"Jump Rope",muscle:"Cardio",equipment:"Bodyweight",cue:"Land on balls of feet, arms close to body, small jumps"},
  {name:"Burpee",muscle:"Cardio",equipment:"Bodyweight",cue:"Jump up explosively, land in plank position, controlled"},
  {name:"Mountain Climber",muscle:"Cardio",equipment:"Bodyweight",cue:"Hips level, drive knees under chest, alternate rapidly"},
  {name:"High Knees",muscle:"Cardio",equipment:"Bodyweight",cue:"Drive knees to hip height, arms pumping, stay on toes"},
  {name:"Jumping Jack",muscle:"Cardio",equipment:"Bodyweight",cue:"Full arm extension overhead, legs wide at peak position"},
  {name:"Sprint Intervals",muscle:"Cardio",equipment:"Bodyweight",cue:"Max effort 10-30 sec, full rest between, quality over quantity"},
  {name:"Jump Squat",muscle:"Cardio",equipment:"Bodyweight",cue:"Squat down then explode upward, land softly and repeat"},
  {name:"Step-Up Cardio",muscle:"Cardio",equipment:"Bodyweight",cue:"Fast-paced alternating step-ups for heart rate elevation"},
  {name:"Bear Crawl",muscle:"Cardio",equipment:"Bodyweight",cue:"Knees off ground, opposite arm and leg move together"},
  {name:"Kettlebell Swing",muscle:"Cardio",equipment:"Kettlebell",cue:"Hip hinge not squat, drive hips forward to propel bell"},
];

const DEFAULT_SETTINGS = {
  restTimer:true, restSeconds:90, prDetection:true, lastRef:true,
  deloadReminder:true, streakTracking:true, plateCalc:true,
  workoutNotes:true, aiRecs:true, appleHealth:false,
  aiAgeRange:"", aiExperience:"", aiJointNotes:"", aiGoal:"",
  ...COACHING_DEFAULTS, // showCoaching + 4 sub-toggles, all default ON
};

// Builds a trainer profile string injected into all AI prompts
function aiProfileContext(s){
  if(!s)return "";
  const parts=[];
  if(s.aiAgeRange)parts.push(`Age range: ${s.aiAgeRange}`);
  if(s.aiExperience)parts.push(`Experience: ${s.aiExperience}`);
  if(s.aiGoal)parts.push(`Goal: ${s.aiGoal}`);
  if(s.aiJointNotes)parts.push(`Notes: ${s.aiJointNotes}`);
  return parts.length?`\nTrainer profile — ${parts.join(", ")}.`:"";
}

// -- THEME CONTEXT -------------------------------------------------------------
const useTheme = (mode) => THEMES[mode] || THEMES.dark;

// -- TINY UI COMPONENTS --------------------------------------------------------
const Mono = ({children,style={}})=><span style={{fontFamily:"'SF Mono','Courier New',monospace",...style}}>{children}</span>;

function Toggle({on,onToggle,C}){
  return <div onClick={onToggle} style={{width:46,height:26,borderRadius:13,background:on?C.accent:C.faint,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
    <div style={{position:"absolute",top:3,left:on?23:3,width:20,height:20,borderRadius:10,background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.35)"}}/>
  </div>;
}

function Pill({children,color,style={}}){
  return <span style={{fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",background:color+"16",color,padding:"2px 10px 2px 8px",borderRadius:3,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,border:`1px solid ${color}40`,...style}}>{children}</span>;
}

function Btn({children,onClick,variant="primary",size="md",style={},disabled=false,C}){
  const sizes={sm:{padding:"6px 13px",fontSize:11},md:{padding:"10px 18px",fontSize:13},lg:{padding:"14px 24px",fontSize:14}};
  const bg={primary:C.accentBtn,ghost:"transparent",danger:C.danger+"22",subtle:C.card,gold:C.gold};
  const col={primary:"#fff",ghost:C.text,danger:C.dangerInk,subtle:C.text,gold:"#0b0c0e"};
  const bdr={ghost:`1px solid ${C.border}`,danger:`1px solid ${C.danger}44`,subtle:`1px solid ${C.border}`};
  return <button style={{border:bdr[variant]||"none",cursor:disabled?"not-allowed":"pointer",fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.04em",borderRadius:8,transition:"opacity .15s",opacity:disabled?.5:1,background:bg[variant]||C.accent,color:col[variant]||"#fff",...sizes[size],...style}} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Modal({children,onClose,C,showClose=true}){
  const startY=useRef(null);
  function onTouchStart(e){startY.current=e.touches[0].clientY;}
  function onTouchEnd(e){
    if(startY.current===null)return;
    const dy=e.changedTouches[0].clientY-startY.current;
    if(dy>80)onClose();
    startY.current=null;
  }
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:C.surface,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"20px 20px 40px",position:"relative"}} onClick={e=>e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div style={{width:36,height:4,borderRadius:2,background:C.border,margin:"-8px auto 12px",flexShrink:0}}/>
      {showClose&&<button onClick={onClose} style={{position:"absolute",top:12,right:14,background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:20,lineHeight:1,padding:"4px 8px",zIndex:1}}>✕</button>}
      {children}
    </div>
  </div>;
}

function SectionLabel({children,C}){
  return <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.14em",textTransform:"uppercase",display:"block",marginBottom:10,fontWeight:600}}>{children}</Mono>;
}

function RestTimer({seconds,onDone,onSkip,C}){
  const startTs=useRef(Date.now());
  const [rem,setRem]=useState(seconds);
  useEffect(()=>{
    if(rem<=0){onDone();return;}
    const t=setTimeout(()=>{
      const elapsed=Math.floor((Date.now()-startTs.current)/1000);
      setRem(Math.max(0,seconds-elapsed));
    },1000);
    return()=>clearTimeout(t);
  },[rem]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
    <Mono style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",flexShrink:0}}>REST</Mono>
    <div style={{fontSize:20,fontFamily:"'SF Mono','Courier New',monospace",color:rem<10?C.redInk:C.neonInk,fontWeight:700,minWidth:42}}>
      {Math.floor(rem/60)}:{String(rem%60).padStart(2,"0")}
    </div>
    <div style={{flex:1,height:3,background:C.border,borderRadius:2}}>
      <div style={{height:"100%",background:C.neon,borderRadius:2,width:`${(rem/seconds)*100}%`,transition:"width 1s linear"}}/>
    </div>
    <Btn onClick={onSkip} variant="ghost" size="sm" C={C} style={{fontSize:10,padding:"4px 8px"}}>Skip</Btn>
  </div>;
}

function PlateCalc({weight,C}){
  if(!weight||isNaN(parseFloat(weight)))return null;
  const bar=45,plates=[45,35,25,10,5,2.5];
  let rem=(parseFloat(weight)-bar)/2;
  const res=[];
  for(const p of plates){const c=Math.floor(rem/p);if(c>0){res.push(`${c}×${p}`);rem-=c*p;}}
  return <Mono style={{fontSize:11,color:C.neonInk,marginTop:3,display:"block"}}>⚖ Each side: {res.length?res.join(" + "):"bar only"}{rem>0.1?<span style={{color:C.muted}}> (+{rem.toFixed(1)})</span>:null}</Mono>;
}

// -- PROGRESSIVE OVERLOAD CALCULATOR ------------------------------------------
function OverloadCalc({C}){
  const [w,setW]=useState("");
  const weight=parseFloat(w);
  const p25=weight?Math.round(weight*1.025*4)/4:null;
  const p5=weight?Math.round(weight*1.05*4)/4:null;
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:12,padding:"16px"}}>
    <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Progressive Overload Calculator</div>
    <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:12}}>Enter your current max weight -- see your next target</Mono>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
      <input type="number" placeholder="Current weight (lbs)" value={w} onChange={e=>setW(e.target.value)}
        style={{flex:1,padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      <Mono style={{fontSize:12,color:C.muted}}>lbs</Mono>
    </div>
    {weight>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <div style={{background:C.surface,border:`1px solid ${C.gold}66`,borderRadius:6,padding:"12px",textAlign:"center"}}>
        <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",display:"block",marginBottom:4}}>+2.5% NEXT</Mono>
        <div style={{fontSize:24,fontWeight:600,fontFamily:"'SF Mono','Courier New',monospace",color:C.goldInk}}>{p25}</div>
        <Mono style={{fontSize:10,color:C.muted}}>lbs</Mono>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.gold}88`,borderRadius:6,padding:"12px",textAlign:"center"}}>
        <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",display:"block",marginBottom:4}}>+5% NEXT</Mono>
        <div style={{fontSize:24,fontWeight:600,fontFamily:"'SF Mono','Courier New',monospace",color:C.goldInk}}>{p5}</div>
        <Mono style={{fontSize:10,color:C.muted}}>lbs</Mono>
      </div>
    </div>}
    {weight>0&&<PlateCalc weight={p25} C={C}/>}
  </div>;
}


// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
function AuthScreen({C,onAuth,themeMode,toggleTheme}){
  const [mode,setMode]=useState("login"); // login | signup | reset
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function handleSubmit(){
    setError("");setMessage("");
    if(!email||(!password&&mode!=="reset")){setError("Please fill in all fields.");return;}
    if(mode==="signup"&&password.length<6){setError("Password must be at least 6 characters.");return;}
    setLoading(true);
    try{
      if(mode==="login"){
        const {data,error:e}=await supabase.auth.signInWithPassword({email,password});
        if(e)throw e;
        onAuth(data.user);
      } else if(mode==="signup"){
        const {data,error:e}=await supabase.auth.signUp({
          email,password,
          options:{data:{display_name:name||email.split("@")[0]}}
        });
        if(e)throw e;
        if(data.user&&data.session){
          onAuth(data.user);
        } else {
          setMessage("Account created! Check your email to confirm, then sign in.");
          setMode("login");
        }
      } else if(mode==="reset"){
        const {error:e}=await supabase.auth.resetPasswordForEmail(email,{
          redirectTo:window.location.origin
        });
        if(e)throw e;
        setMessage("Password reset email sent. Check your inbox.");
        setMode("login");
      }
    }catch(e){
      setError(e.message||"Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  // ── mockup-auth design tokens (from mockup-auth.html — do not substitute) ──
  const GOLD="#f7c948", GOLD2="#e8b82e", BASE="#07090c";
  const isReset=mode==="reset";
  const submitLabel=mode==="login"?"SIGN IN":mode==="signup"?"CREATE ACCOUNT":"SEND RESET EMAIL";
  const clear=()=>{setError("");setMessage("");};
  const labelStyle={display:"block",fontSize:11,color:"rgba(255,255,255,0.62)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:6,fontWeight:600};
  const inputStyle={width:"100%",padding:"15px 16px",background:"rgba(255,255,255,0.055)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:12,color:"#fff",fontSize:16,outline:"none",fontFamily:"inherit",boxSizing:"border-box",WebkitBackdropFilter:"blur(12px)",backdropFilter:"blur(12px)",transition:"border-color .2s, background .2s",WebkitAppearance:"none"};
  const tabStyle=(active)=>({flex:1,position:"relative",textAlign:"center",paddingBottom:11,fontSize:13,fontWeight:600,letterSpacing:"0.03em",cursor:"pointer",color:active?"#fff":"rgba(255,255,255,0.30)",background:"transparent",border:"none",fontFamily:"inherit"});
  const ulineStyle={position:"absolute",bottom:-1,left:"20%",right:"20%",height:2,background:GOLD,borderRadius:"2px 2px 0 0",boxShadow:"0 0 8px rgba(247,201,72,0.5)"};
  const footerLinkStyle={background:"transparent",border:"none",fontFamily:"inherit",fontSize:13,color:"rgba(255,255,255,0.58)",cursor:"pointer",letterSpacing:"0.02em",padding:"4px 6px"};

  return <div className="iron-auth" style={{position:"relative",minHeight:"100dvh",background:BASE,overflowX:"hidden",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
    <style>{`
      .iron-auth input::placeholder{color:rgba(255,255,255,0.16);}
      .iron-auth input:focus{border-color:rgba(247,201,72,0.5);background:rgba(255,255,255,0.082);box-shadow:0 0 0 3px rgba(247,201,72,0.08);}
      .iron-auth input:-webkit-autofill,.iron-auth input:-webkit-autofill:hover,.iron-auth input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px #15161a inset;-webkit-text-fill-color:#fff;caret-color:#fff;transition:background-color 9999s ease-in-out 0s;}
      .iron-auth button:focus-visible{outline:2px solid ${GOLD};outline-offset:2px;}
      .iron-auth .footer-link:hover{color:rgba(255,255,255,0.85);}
      @media (prefers-reduced-motion: no-preference){.iron-auth .ent{animation:ironAuthUp .4s ease-out both;}}
      @keyframes ironAuthUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
    `}</style>

    {/* Background layers (clipped to viewport; decorative) */}
    <div style={{position:"absolute",inset:0,overflow:"hidden",zIndex:0}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 15% 8%, #1a2d4a 0%, transparent 55%),radial-gradient(ellipse 60% 50% at 95% 15%, #0f1e32 0%, transparent 50%),radial-gradient(ellipse 70% 55% at 50% 38%, #1c1505 0%, transparent 55%),radial-gradient(ellipse 90% 40% at 10% 70%, #0a1520 0%, transparent 55%),radial-gradient(ellipse 50% 60% at 88% 55%, #12101a 0%, transparent 50%),radial-gradient(ellipse 80% 50% at 50% 100%, #080608 0%, transparent 60%)"}}/>
      <div style={{position:"absolute",top:"6%",left:"50%",transform:"translateX(-50%)",width:340,height:300,pointerEvents:"none",background:"radial-gradient(ellipse 60% 55% at 50% 45%, rgba(247,201,72,0.13) 0%, rgba(200,140,40,0.06) 45%, transparent 72%)"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(-52deg, rgba(255,255,255,0.013) 0px, rgba(255,255,255,0.013) 1px, transparent 1px, transparent 28px)",WebkitMaskImage:"linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 20%, rgba(0,0,0,0.5) 55%, transparent 80%)",maskImage:"linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 20%, rgba(0,0,0,0.5) 55%, transparent 80%)"}}/>
      <div style={{position:"absolute",top:-80,right:-60,width:260,height:260,border:"1px solid rgba(255,255,255,0.028)",transform:"rotate(22deg)",borderRadius:6,pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:-40,right:-20,width:160,height:160,border:"1px solid rgba(255,255,255,0.018)",transform:"rotate(22deg)",borderRadius:4,pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,opacity:0.45,pointerEvents:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.09'/%3E%3C/svg%3E\")",backgroundSize:"200px 200px",mixBlendMode:"overlay"}}/>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"linear-gradient(to bottom, transparent 18%, rgba(7,9,12,0.25) 38%, rgba(7,9,12,0.70) 55%, rgba(7,9,12,0.93) 70%, #07090c 82%)"}}/>
    </div>

    {/* Content */}
    <div style={{position:"relative",zIndex:1,minHeight:"100dvh",display:"flex",flexDirection:"column",width:"100%",maxWidth:430,margin:"0 auto",paddingTop:"env(safe-area-inset-top)"}}>

      {/* Brand */}
      <div style={{flex:"1 1 auto",minHeight:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px 0"}}>
        <div style={{fontSize:88,fontWeight:900,letterSpacing:"-0.04em",color:"#fff",lineHeight:0.92,textAlign:"center",textShadow:"0 0 60px rgba(247,201,72,0.20), 0 0 120px rgba(247,201,72,0.09), 0 2px 20px rgba(0,0,0,0.6)"}}>IRON</div>
        <div style={{width:44,height:3,background:GOLD,borderRadius:2,margin:"16px auto",boxShadow:"0 0 14px rgba(247,201,72,0.7), 0 0 28px rgba(247,201,72,0.3)"}}/>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.30)",letterSpacing:"0.24em",textTransform:"uppercase",fontWeight:500,textAlign:"center"}}>Training Intelligence</div>
      </div>

      {/* Form */}
      <form className="ent" onSubmit={e=>{e.preventDefault();handleSubmit();}} style={{flex:"0 0 auto",padding:"0 24px calc(36px + env(safe-area-inset-bottom))",display:"flex",flexDirection:"column"}}>

        {!isReset
          ? <div role="tablist" style={{display:"flex",marginBottom:22,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              <button type="button" role="tab" aria-selected={mode==="login"} onClick={()=>{setMode("login");clear();}} style={tabStyle(mode==="login")}>Sign In{mode==="login"&&<span style={ulineStyle}/>}</button>
              <button type="button" role="tab" aria-selected={mode==="signup"} onClick={()=>{setMode("signup");clear();}} style={tabStyle(mode==="signup")}>Create Account{mode==="signup"&&<span style={ulineStyle}/>}</button>
            </div>
          : <div style={{marginBottom:20,paddingBottom:11,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>Reset password</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.40)"}}>We'll email you a reset link.</div>
            </div>}

        {mode==="signup"&&<div style={{marginBottom:13}}>
          <span style={labelStyle}>Name (optional)</span>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={inputStyle} autoComplete="name"/>
        </div>}

        <div style={{marginBottom:13}}>
          <span style={labelStyle}>Email</span>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoComplete="email"/>
        </div>

        {!isReset&&<div style={{marginBottom:13}}>
          <span style={labelStyle}>Password</span>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="signup"?"At least 6 characters":"Your password"} style={inputStyle} autoComplete={mode==="signup"?"new-password":"current-password"}/>
        </div>}

        {error&&<div style={{margin:"4px 0 12px",padding:"10px 12px",borderRadius:"0 8px 8px 0",borderLeft:"2px solid #f06584",background:"rgba(240,101,132,0.08)",fontSize:13,color:"#ffb3c0"}}>{error}</div>}
        {message&&<div style={{margin:"4px 0 12px",padding:"10px 12px",borderRadius:"0 8px 8px 0",borderLeft:"2px solid "+GOLD,background:"rgba(247,201,72,0.08)",fontSize:13,color:"#f3d68a"}}>{message}</div>}

        <button type="submit" disabled={loading} style={{width:"100%",padding:17,background:"linear-gradient(135deg, "+GOLD+" 0%, "+GOLD2+" 100%)",border:"none",borderRadius:13,color:BASE,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:800,letterSpacing:"0.14em",cursor:loading?"default":"pointer",opacity:loading?0.6:1,marginTop:8,marginBottom:16,boxShadow:"0 4px 24px rgba(247,201,72,0.35), 0 1px 0 rgba(255,255,255,0.15) inset"}}>{loading?"...":submitLabel}</button>

        <div style={{display:"flex",justifyContent:"center"}}>
          {mode==="login"&&<button type="button" className="footer-link" onClick={()=>{setMode("reset");clear();}} style={footerLinkStyle}>Forgot password?</button>}
          {isReset&&<button type="button" className="footer-link" onClick={()=>{setMode("login");clear();}} style={footerLinkStyle}>← Back to sign in</button>}
        </div>
      </form>
    </div>
  </div>;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function ForgeApp(){
  const [plans,setPlans]=useState({});
  const [activePlanKey,setActivePlanKey]=useState(null);
  const [settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [sessions,setSessions]=useState([]);
  const [programStart,setProgramStart]=useState(null); // user's TRUE earliest completed-session date (full history), for the program-week fallback
  const [prs,setPrs]=useState({});
  const [themeMode,setThemeMode]=useState("dark");
  const [loading,setLoading]=useState(true);
  const [authUser,setAuthUser]=useState(null);
  const [authChecked,setAuthChecked]=useState(false);
  const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [bodyStatsGlobal,setBodyStatsGlobal]=useState([]);
  const [tab,setTab]=useState("today");
  const [activeWorkout,setActiveWorkout]=useState(null);
  const [workoutDraft,setWorkoutDraft]=useState(null);
  const [minimizedWorkout,setMinimizedWorkout]=useState(null);
  const [bannerElapsed,setBannerElapsed]=useState(0);
  const minimizeTimeRef=useRef(null);
  const [deloadDismissedAt,setDeloadDismissedAt]=useState(null); // local override (ISO) for immediate hide; persisted to user_metadata.deload_dismissed_at
  const [longestStreak,setLongestStreak]=useState(0); // longest consecutive-weeks-with-a-workout, over FULL uncapped history
  const [workoutSummary,setWorkoutSummary]=useState(null);
  const C=useTheme(themeMode);

  const savePlans=async(p)=>{
    setPlans(p);
    try{
      const {data:{user:u}}=await supabase.auth.getUser();
      if(!u)return;
      const patchedPlans={...p};
      let patched=false;
      for(const[key,plan]of Object.entries(p)){
        const base={user_id:u.id,plan_key:key,name:plan.name,subtitle:plan.subtitle,description:plan.description,days_json:plan.days||[]};
        const full={...base,start_date:plan.startDate||null,duration_weeks:plan.durationWeeks||10};
        if(plan.supabaseId){
          // existing row — update by primary key, no unique constraint needed
          const{error}=await supabase.from("plans").update(full).eq("id",plan.supabaseId);
          if(error?.code==="42703"||error?.code==="PGRST204"){
            const{error:e2}=await supabase.from("plans").update(base).eq("id",plan.supabaseId);
            if(e2)console.error("savePlans:",e2);
          }else if(error)console.error("savePlans:",error);
        }else{
          // new row — insert and capture generated id for future updates
          const{data:ins,error}=await supabase.from("plans").insert(full).select("id").single();
          if(error?.code==="42703"||error?.code==="PGRST204"){
            const{data:ins2,error:e2}=await supabase.from("plans").insert(base).select("id").single();
            if(e2)console.error("savePlans:",e2);
            else if(ins2?.id){patchedPlans[key]={...plan,supabaseId:ins2.id};patched=true;}
          }else if(error)console.error("savePlans:",error);
          else if(ins?.id){patchedPlans[key]={...plan,supabaseId:ins.id};patched=true;}
        }
      }
      if(patched)setPlans(patchedPlans);
    }catch(e){console.error("savePlans:",e);}
  };

  const persistActivePlanKey=(k)=>{
    setActivePlanKey(k);
    supabase.auth.updateUser({data:{active_plan_key:k}}).catch(e=>console.error("persistActivePlanKey:",e));
  };

  const saveSettings=async(s)=>{
    setSettings(s);
    try{
    const {data:{user:u}}=await supabase.auth.getUser();
    if(!u)return;
    await supabase.from("user_settings").upsert({
      user_id:u.id,
      rest_timer:s.restTimer, rest_seconds:s.restSeconds,
      pr_detection:s.prDetection, last_ref:s.lastRef,
      deload_reminder:s.deloadReminder, streak_tracking:s.streakTracking,
      plate_calc:s.plateCalc, workout_notes:s.workoutNotes,
      ai_recs:s.aiRecs, theme_mode:themeMode,
      apple_health:s.appleHealth||false,
      ai_age_range:s.aiAgeRange||"", ai_experience:s.aiExperience||"",
      ai_joint_notes:s.aiJointNotes||"", ai_goal:s.aiGoal||"",
      ...coachingToRow(s) // show_coaching + 4 sub-toggles
    },{onConflict:"user_id"});
    }catch(e){ console.error("saveSettings:",e); }
  };

  const saveSessions=async(s)=>{
    if(!Array.isArray(s))return false;
    try{
      const{data:{session:_sess}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));
      const u=_sess?.user||authUser;
      const uid=u?.id;
      const latest=s[s.length-1];
      if(latest&&!latest.supabaseId){
        // New session — all DB writes must succeed before updating local state
        if(!uid)return false;
        const{data,error}=await supabase.from("workout_sessions").insert({
          user_id:uid,day_label:latest.dayLabel,day_id:null,
          started_at:latest.startedAt,completed_at:latest.completedAt,
          notes:latest.notes||"",sets_data:latest.sets||{},
          exercise_order:Object.keys(latest.sets||{}),
          partial:latest.partial||false
        }).select("id");
        if(error){console.error("saveSessions insert error:",JSON.stringify(error));return false;}
        const insertedId=data?.[0]?.id;
        const confirmedSessions=insertedId?s.map(sess=>sess===latest?{...sess,supabaseId:insertedId}:sess):s;
        setSessions(confirmedSessions);
        if(insertedId&&(latest.setsArr||[]).length>0){
          const setRows=(latest.setsArr||[]).map(x=>({
            session_id:insertedId,user_id:uid,
            exercise_name:x.exName,set_number:x.setNum,
            weight:parseFloat(x.weight)||null,
            reps:x.minutes?(parseInt(x.level)||null):(parseInt(x.reps)||null),
            minutes:parseFloat(x.minutes)||null,
            is_pr:x.isPR||false,set_type:x.type||"working"
          }));
          const{error:setsErr}=await supabase.from("logged_sets").insert(setRows);
          if(setsErr){console.error("saveSessions logged_sets error:",JSON.stringify(setsErr));return"partial";}
        }
      }else{
        // No new session to insert (e.g. after delete) — state update only
        setSessions(s);
      }
      return true;
    }catch(e){console.error("saveSessions exception:",JSON.stringify(e));return false;}
  };

  const savePRs=async(p)=>{
    setPrs(p);
    try{
      const {data:{user:u}}=await supabase.auth.getUser();
      if(!u)return;
      for(const[name,pr]of Object.entries(p)){
        const {error}=await supabase.from("personal_records").upsert({
          user_id:u.id, exercise_name:name,
          max_weight:pr.weight, achieved_at:pr.date
        },{onConflict:"user_id,exercise_name"});
        if(error) console.error("savePRs error:",name,error);
      }
    }catch(e){ console.error("savePRs exception:",e); }
  };

  const toggleTheme=(n)=>{
    const mode=(typeof n==="string")?n:(themeMode==="dark"?"light":"dark");
    setThemeMode(mode);
    saveSettings({...settings,theme_mode:mode});
  };

  // One-time migration: recompute is_pr across ALL of a user's logged sets using the
  // weight-level running-max rule. Older rows were flagged against the prior best for
  // every set, which over-flagged repeated top-weight sets (e.g. 3×85 above 80 = 3
  // PRs instead of 1). Guarded by a versioned flag in auth metadata so it runs at
  // most once per user. personal_records (max per exercise) is unaffected.
  const backfillPRFlagsV2=async(u)=>{
    if(!u||u.user_metadata?.pr_flags_v2)return;
    try{
      const[{data:sessRows,error:se},{data:setRows,error:le}]=await Promise.all([
        supabase.from("workout_sessions").select("id,completed_at").eq("user_id",u.id),
        supabase.from("logged_sets").select("id,session_id,exercise_name,set_number,weight,set_type,is_pr").eq("user_id",u.id),
      ]);
      if(se||le){console.error("backfillPRFlagsV2 fetch:",se||le);return;}
      const when=Object.fromEntries((sessRows||[]).map(s=>[s.id,s.completed_at||""]));
      const byEx={};
      for(const r of (setRows||[])){(byEx[r.exercise_name]||(byEx[r.exercise_name]=[])).push(r);}
      const idsTrue=[],idsFalse=[],correctMap={};
      for(const[exName,rows]of Object.entries(byEx)){
        // Chronological by session, then performed order within a session.
        rows.sort((a,b)=>{const ta=when[a.session_id]||"",tb=when[b.session_id]||"";if(ta!==tb)return ta<tb?-1:1;return (a.set_number||0)-(b.set_number||0);});
        const flags=flagPRs(rows.map(r=>({weight:parseFloat(r.weight)||0,warmup:r.set_type==="warmup"})),0);
        rows.forEach((r,i)=>{
          const want=flags[i];
          correctMap[`${r.session_id}|${exName}|${r.set_number}`]=want;
          if(want!==!!r.is_pr)(want?idsTrue:idsFalse).push(r.id);
        });
      }
      const chunk=(arr,n)=>{const out=[];for(let i=0;i<arr.length;i+=n)out.push(arr.slice(i,i+n));return out;};
      for(const ids of chunk(idsTrue,100)){const{error}=await supabase.from("logged_sets").update({is_pr:true}).in("id",ids);if(error)console.error("backfill true:",error);}
      for(const ids of chunk(idsFalse,100)){const{error}=await supabase.from("logged_sets").update({is_pr:false}).in("id",ids);if(error)console.error("backfill false:",error);}
      const corrected=idsTrue.length+idsFalse.length;
      console.warn(`[pr_flags_v2] recomputed PR flags: ${corrected} row(s) corrected`);
      if(corrected>0)setSessions(prev=>prev.map(s=>({...s,setsArr:(s.setsArr||[]).map(x=>{const k=`${s.supabaseId}|${x.exName}|${x.setNum}`;return k in correctMap?{...x,isPR:correctMap[k]}:x;})})));
      await supabase.auth.updateUser({data:{pr_flags_v2:true}}).catch(e=>console.error("backfill flag:",e));
    }catch(e){console.error("backfillPRFlagsV2:",e);}
  };

  // Load user data from Supabase on auth
  useEffect(()=>{
    const loadUserData=async(u)=>{
      if(!u)return;
      setLoading(true);
      // Load settings
      const {data:sett}=await supabase.from("user_settings").select("*").eq("user_id",u.id).single();
      if(sett){
        setSettings({
          restTimer:sett.rest_timer, restSeconds:sett.rest_seconds,
          prDetection:sett.pr_detection, lastRef:sett.last_ref,
          deloadReminder:sett.deload_reminder, streakTracking:sett.streak_tracking,
          plateCalc:sett.plate_calc, workoutNotes:sett.workout_notes,
          aiRecs:sett.ai_recs,
          appleHealth:sett.apple_health||false,
          aiAgeRange:sett.ai_age_range||"", aiExperience:sett.ai_experience||"",
          aiJointNotes:sett.ai_joint_notes||"", aiGoal:sett.ai_goal||"",
          ...coachingFromRow(sett) // show_* → camelCase, ?? true so pre-column rows stay visible
        });
        if(sett.theme_mode)setThemeMode(sett.theme_mode);
      }
      // Load sessions
      const {data:sessData,error:sessErr}=await supabase.from("workout_sessions")
        .select("*, logged_sets(*)")
        .eq("user_id",u.id)
        .order("completed_at",{ascending:false})
        .limit(100);
      if(sessErr) console.error("loadUserData sessions error:",sessErr);
      if(sessData){
        const mapped=sessData.map(mapSessionRow);
        setSessions(mapped);
      }
      // Program-week anchor: the user's TRUE earliest completed session (full history, not the
      // capped load). Targeted 1-row query; best-effort — on error leave it null so the
      // program-week fallback keeps its existing (capped) behavior.
      try{
        const {data:firstRows,error:firstErr}=await supabase.from("workout_sessions")
          .select("completed_at").eq("user_id",u.id)
          .not("completed_at","is",null)
          .order("completed_at",{ascending:true}).limit(1);
        if(!firstErr&&firstRows&&firstRows[0]?.completed_at){
          setProgramStart(new Date(firstRows[0].completed_at).toLocaleDateString("en-CA"));
        }
      }catch(e){console.error("loadUserData earliest session:",e);}
      // Load PRs
      const {data:prData}=await supabase.from("personal_records").select("*").eq("user_id",u.id);
      if(prData){
        const prMap={};
        prData.forEach(r=>{prMap[r.exercise_name]={weight:r.max_weight,date:r.achieved_at};});
        setPrs(prMap);
      }
      // Load plans — cascading fallback for schema migrations
      let planRows=null;
      {
        const {data,error}=await supabase.from("plans").select("plan_key,name,subtitle,description,days_json,id,start_date,duration_weeks").eq("user_id",u.id);
        if(error?.code==="42703"||error?.code==="PGRST204"){
          const {data:d2,error:e2}=await supabase.from("plans").select("plan_key,name,subtitle,description,days_json,id").eq("user_id",u.id);
          if(e2)console.error("loadPlans:",e2);else planRows=d2;
        }else if(error){console.error("loadPlans:",error);}else{planRows=data;}
      }
      let mergedPlans={};
      if(planRows&&planRows.length>0){
        planRows.forEach(r=>{
          if(r.plan_key&&Array.isArray(r.days_json)&&r.days_json.length>0){
            mergedPlans[r.plan_key]={name:r.name,subtitle:r.subtitle||"",description:r.description||"",supabaseId:r.id,days:r.days_json,startDate:r.start_date||null,durationWeeks:r.duration_weeks||10};
          }
        });
        setPlans(mergedPlans);
      }
      // Load profile (body stats + active plan key)
      const {data:prof}=await supabase.from("profiles").select("*").eq("id",u.id).single();
      if(prof?.raw_user_meta_data?.body_stats){
        try{ setBodyStatsGlobal(JSON.parse(prof.raw_user_meta_data.body_stats||"[]")); }catch{}
      }
      // Single-source the active plan on user_metadata — the store EVERY write targets
      // (persistActivePlanKey, switch/create/clone/preset, the self-correct below). profiles.active_plan_key
      // is a frozen, never-client-written pointer to the retired A/B-era "B" plan; trusting it let a
      // stale key override the real choice once it became valid again (multi-plan re-arm). See lib/activePlan.
      const savedPlanKey=u.user_metadata?.active_plan_key;
      const planKeys=Object.keys(mergedPlans);
      const resolvedKey=resolveActivePlanKey(savedPlanKey,planKeys);
      if(resolvedKey){
        setActivePlanKey(resolvedKey);
        if(resolvedKey!==savedPlanKey)supabase.auth.updateUser({data:{active_plan_key:resolvedKey}}).catch(e=>console.error("persistKey:",e));
      }
      // Load workout draft
      try{
        const{data:draft,error:draftErr}=await supabase.from("workout_drafts")
          .select("*").eq("user_id",u.id).single();
        if(draftErr&&draftErr.code!=="PGRST116")console.error("loadUserData draft:",draftErr);
        if(draft){
          const ageSeconds=Math.floor((Date.now()-new Date(draft.started_at).getTime())/1000);
          if(ageSeconds>10800){
            // Expired — save as a session then delete
            const{data:savedSession,error:draftSaveErr}=await supabase.from("workout_sessions").insert({
              user_id:u.id, day_label:draft.day_label, day_id:null,
              started_at:draft.started_at,
              completed_at:draft.updated_at||new Date().toISOString(),
              notes:"Session auto-saved after timeout",
              sets_data:draft.logged_sets||{},
              exercise_order:Object.keys(draft.logged_sets||{})
            }).select("id").single();
            if(draftSaveErr){console.error("draft expired save:",draftSaveErr);return;}
            const savedId=savedSession?.id;
            if(savedId&&draft.logged_sets){
              const setRows=[];
              for(const[exName,sets]of Object.entries(draft.logged_sets)){
                for(const[n,v]of Object.entries(sets)){
                  const num=parseInt(n);
                  // keep confirmed sets only: skip prepop suggestions + empty rows.
                  // strength sets have weight (no `done` flag); cardio sets have minutes.
                  if(!Number.isFinite(num)||v.prepop||(!v.weight&&!v.minutes))continue;
                  setRows.push({session_id:savedId,user_id:u.id,exercise_name:exName,set_number:num,
                    weight:parseFloat(v.weight)||null,
                    reps:v.minutes?(parseInt(v.level)||null):(parseInt(v.reps)||null),
                    minutes:parseFloat(v.minutes)||null,
                    is_pr:false,set_type:"working"});
                }
              }
              if(setRows.length>0){
                const{error:setsErr}=await supabase.from("logged_sets").insert(setRows);
                if(setsErr)console.error("draft expired logged_sets:",setsErr);
              }
            }
            await supabase.from("workout_drafts").delete().eq("user_id",u.id);
          }else{
            // Within 3 hours — restore workout
            const allDays=Object.values(mergedPlans).flatMap(p=>p.days||[]);
            const matchDay=allDays.find(d=>d.id===draft.day_id)||allDays.find(d=>d.label===draft.day_label);
            if(matchDay){
              const secsSinceUpdate=Math.floor((Date.now()-new Date(draft.updated_at).getTime())/1000);
              const restoredElapsed=(draft.elapsed_seconds||0)+secsSinceUpdate;
              const derivedCompletedExIds=(draft.exercises_json||[]).filter(ex=>{
                const m=draft.logged_sets?.[ex.name]||{};
                const isCardio=ex.muscle==="Cardio"||ex.muscle==="Recovery";
                if(isCardio)return Object.values(m).some(v=>v.done&&(v.minutes||v.reps));
                const numSets=parseInt(ex.sets)||3;
                // strength confirmed sets carry no `done` flag — they're !prepop with weight+reps
                return Object.values(m).filter(v=>!v.prepop&&v.weight&&v.reps).length>=numSets;
              }).map(ex=>ex.id);
              setWorkoutDraft({loggedSets:draft.logged_sets||{},elapsed:restoredElapsed,startedAt:draft.started_at,workout:matchDay,exercises:draft.exercises_json||null,completedExIds:derivedCompletedExIds});
              setActiveWorkout(matchDay);
              await supabase.from("workout_drafts").delete().eq("user_id",u.id);
            }
          }
        }
      }catch(e){console.error("loadUserData draft:",e);}
      setLoading(false);
      // Fire-and-forget once-per-user correction of historical PR flags.
      backfillPRFlagsV2(u);
    };
    supabase.auth.getSession().then(({data:{session}})=>{
      setAuthUser(session?.user||null);
      setAuthChecked(true);
      if(session?.user)loadUserData(session.user);
      else setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      setAuthUser(session?.user||null);
      if(event==="SIGNED_IN"&&session?.user){loadUserData(session.user);}
      else if(!session?.user){setSessions([]);setProgramStart(null);setPrs({});setPlans({});setSettings(DEFAULT_SETTINGS);setActivePlanKey(null);setLoading(false);}
    });
    return()=>subscription.unsubscribe();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  // Longest weekly consistency streak — computed over FULL UNCAPPED history (the capped `sessions`
  // prop would miss a run older than the most-recent 100). Completed non-partial only (same basis as
  // current streak). Best-effort: on error keep the prior value. Refetches when a workout is
  // logged/removed (sessions.length) so it stays live without persisting a "best".
  useEffect(()=>{
    if(!authUser){setLongestStreak(0);return;}
    let cancelled=false;
    (async()=>{
      try{
        const {data,error}=await supabase.from("workout_sessions")
          .select("completed_at,partial").eq("user_id",authUser.id).not("completed_at","is",null);
        if(error||!data)return; // fail-safe: leave the prior value
        const dates=data.filter(r=>!r.partial).map(r=>new Date(r.completed_at).toLocaleDateString("en-CA"));
        if(!cancelled)setLongestStreak(longestWeeklyStreak(dates));
      }catch(e){console.error("longestStreak fetch:",e);}
    })();
    return()=>{cancelled=true;};
  },[authUser, sessions.length]);// eslint-disable-line react-hooks/exhaustive-deps

  // Online/offline detection
  useEffect(()=>{
    const goOnline=()=>{
      setIsOnline(true);
    };
    const goOffline=()=>setIsOnline(false);
    window.addEventListener("online",goOnline);
    window.addEventListener("offline",goOffline);
    return()=>{window.removeEventListener("online",goOnline);window.removeEventListener("offline",goOffline);};
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  // Banner timer — ticks while a workout is minimized
  useEffect(()=>{
    if(!minimizedWorkout)return;
    const t=setInterval(()=>{
      setBannerElapsed((minimizedWorkout.elapsed||0)+Math.floor((Date.now()-minimizeTimeRef.current)/1000));
    },1000);
    return()=>clearInterval(t);
  },[minimizedWorkout]);// eslint-disable-line react-hooks/exhaustive-deps

  // Data persisted to Supabase automatically

  const activePlan=plans[activePlanKey];


  // Compliance streak -- consecutive WORKOUT days completed (rest days ignored, don't count toward number)
  const complianceStreak=(()=>{
    if(!settings.streakTracking)return 0;
    const completed=sessions.filter(s=>s.completedAt&&!s.partial);
    if(!completed.length)return 0;
    const planDays=(plans[activePlanKey]?.days||[]);
    const numDays=planDays.length;
    const toLD=d=>d.toLocaleDateString("en-CA");
    const progStart=(()=>{
      const dates=sessions.filter(s=>s.completedAt).map(s=>toLD(new Date(s.completedAt))).sort();
      return dates[0]||PROGRAM_START;
    })();
    const today=new Date();
    today.setHours(12,0,0,0);
    const todayStr=toLD(today);
    // Use position-based slot (same logic as TodayTab) when plan has a startDate
    const planStartDate=plans[activePlanKey]?.startDate;
    let count=0;
    for(let i=0;i<=730;i++){
      const d=new Date(today);
      d.setDate(today.getDate()-i);
      const dateStr=toLD(d);
      if(dateStr<progStart)break;
      let planDay=null;
      if(planStartDate&&numDays>0){
        const elapsed=elapsedDaysSince(planStartDate, d);
        if(elapsed>=0){planDay=planDays[elapsed%numDays];}
      } else if(numDays>0){
        // Fallback for plans without a startDate: use weekday-name map
        const dowName=DOW[d.getDay()];
        const planDayMap={};
        for(const pd of planDays){if(pd.name)planDayMap[pd.name]=pd;}
        planDay=planDayMap[dowName];
      }
      if(!planDay||planDay.isRest){continue;}
      // Any completed session on this date counts (position-based plans don't fix labels to weekdays)
      const done=completed.some(s=>toLD(new Date(s.completedAt))===dateStr);
      if(done){count++;}
      else if(dateStr===todayStr){continue;}
      else{break;}
    }
    return count;
  })();

  const streak=complianceStreak;

  const deloadDue=(()=>{
    if(!settings.deloadReminder)return false;
    const completed=sessions.filter(s=>s.completedAt).sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt));
    // Need at least 12 sessions (roughly 6 weeks of 2x/week) before suggesting deload
    if(completed.length<12)return false;
    // Span must be at least 42 days from first to most recent session
    const firstDate=new Date(completed[0].completedAt);
    const lastDate=new Date(completed[completed.length-1].completedAt);
    const spanDays=(lastDate-firstDate)/86400000;
    if(spanDays<42)return false;
    // Must have trained consistently -- at least 10 sessions in that span
    const recentSessions=completed.filter(s=>(lastDate-new Date(s.completedAt))/86400000<=42);
    return recentSessions.length>=10;
  })();

  const tabs=[
    {key:"today",Icon:Dumbbell,label:"Workout"},
    {key:"plan",Icon:CalendarDays,label:"Plan"},
    {key:"log",Icon:HistoryIcon,label:"History"},
    {key:"stats",Icon:TrendingUp,label:"Stats"},
    {key:"more",Icon:SettingsIcon,label:"Settings"},
  ];

  // Show loading spinner while checking auth
  if(!authChecked){
    return <div style={{minHeight:"100vh",background:"#161b22",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:20,fontFamily:"'SF Mono','Courier New',monospace",color:"#3ecf8e",letterSpacing:"0.4em",fontWeight:900,marginBottom:24,textShadow:"0 0 20px rgba(62,207,142,0.5)"}}>IRON</div>
        <div style={{width:32,height:32,border:"2px solid #2e333d",borderTop:"2px solid #4f8ef7",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>;
  }

  // Show auth screen if not logged in
  if(!authUser){
    return <AuthScreen C={C} onAuth={u=>{setAuthUser(u);}} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  }

  if(workoutSummary){
    return <WorkoutSummary session={workoutSummary.session} newPRs={workoutSummary.newPRs} previousPRs={workoutSummary.previousPRs} complianceStreak={complianceStreak} setsWarning={workoutSummary.setsWarning||false} onClose={()=>{setWorkoutSummary(null);setActiveWorkout(null);}} C={C}/>;
  }

  if(activeWorkout){
    return <WorkoutSession workout={activeWorkout} settings={settings} prs={prs} sessions={sessions}
      plans={plans} activePlanKey={activePlanKey} savePlans={savePlans} authUser={authUser}
      workoutDraft={workoutDraft}
      onMinimize={(data)=>{minimizeTimeRef.current=Date.now();setBannerElapsed(data.elapsed);setMinimizedWorkout(data);setWorkoutDraft(null);setActiveWorkout(null);}}
      onFinish={async(sess,newPRs)=>{const ok=await saveSessions([...sessions,sess]);if(ok){const prevPRs={...prs};setWorkoutDraft(null);setMinimizedWorkout(null);savePRs({...prs,...newPRs});if(!sess.partial){setWorkoutSummary({session:sess,newPRs,previousPRs:prevPRs,setsWarning:ok==="partial"});}else{setActiveWorkout(null);}}return ok;}}
      onCancel={()=>{setWorkoutDraft(null);setMinimizedWorkout(null);setActiveWorkout(null);}} C={C}/>;
  }

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.serif,paddingBottom:72,userSelect:"none",scrollBehavior:"smooth"}}>
    {!isOnline&&<div style={{background:"#f7c948",color:"#1a202c",padding:"8px 18px",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"center",letterSpacing:"0.04em"}}>
      ⚠ Offline — workouts will sync when connection is restored
    </div>}
    {minimizedWorkout&&<div onClick={()=>{setWorkoutDraft({loggedSets:minimizedWorkout.loggedSets,elapsed:bannerElapsed,startedAt:minimizedWorkout.startedAt,workout:minimizedWorkout.workout,exercises:minimizedWorkout.exercises,completedExIds:minimizedWorkout.completedExIds});setActiveWorkout(minimizedWorkout.workout);setMinimizedWorkout(null);}} style={{position:"fixed",top:"env(safe-area-inset-top,0px)",left:0,right:0,zIndex:100,background:C.neon,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",minHeight:44,cursor:"pointer",userSelect:"none"}}>
      <Mono style={{fontSize:12,color:"#0b0c0e",fontWeight:700}}>🔴 {minimizedWorkout.workout.label} in progress · {Math.floor(bannerElapsed/60)}:{String(bannerElapsed%60).padStart(2,"0")}</Mono>
      <Mono style={{fontSize:12,color:"#0b0c0e",fontWeight:700}}>View →</Mono>
    </div>}
    {minimizedWorkout&&<div style={{height:44}}/>}
    {tab==="today"&&<TodayTab plan={activePlan} plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={persistActivePlanKey}
      settings={settings} sessions={sessions} programStart={programStart} streak={streak} complianceStreak={complianceStreak} deloadDue={deloadVisible(deloadDue, deloadDismissedAt ?? authUser?.user_metadata?.deload_dismissed_at ?? null, new Date())}
      onDeloadDismiss={()=>{const iso=new Date().toISOString();setDeloadDismissedAt(iso);supabase.auth.updateUser({data:{deload_dismissed_at:iso}}).catch(e=>console.error("deload dismiss:",e));}}
      onStart={day=>{setWorkoutDraft(null);setActiveWorkout(day);}} C={C} toggleTheme={toggleTheme} themeMode={themeMode} longestStreak={longestStreak}
      authUser={authUser} todayDay={(()=>{const days=activePlan?.days||[];if(!activePlan?.startDate||!days.length)return undefined;const elapsed=elapsedDaysSince(activePlan.startDate);if(elapsed<0)return undefined;const slot=days[elapsed%days.length];return slot?.isRest?undefined:slot;})()}
      onGoToPlan={()=>setTab("plan")}/>}
    {tab==="plan"&&<PlanErrorBoundary C={C}><PlanTab plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={persistActivePlanKey}
      savePlans={savePlans} settings={settings} C={C} toggleTheme={toggleTheme} themeMode={themeMode}/></PlanErrorBoundary>}
    {tab==="log"&&<HistoryTab sessions={sessions} saveSessions={saveSessions} setSessions={setSessions} savePRs={savePRs} prs={prs} plans={plans} C={C} toggleTheme={toggleTheme} themeMode={themeMode} onRerun={sess=>{
      const day=(activePlan?.days||[]).find(d=>d.id===sess.dayId)||{...sess,exercises:Object.keys(sess.sets||{}).map(name=>({id:name,name,sets:"3",reps:"",muscle:"",note:""})),label:sess.dayLabel||"Workout"};
      setActiveWorkout({...day,_rerunSets:sess.sets});
      setTab("today");
    }}/>}
    {tab==="stats"&&<StatsTab sessions={sessions} programStart={programStart} prs={prs} settings={settings} C={C} activePlan={activePlan} toggleTheme={toggleTheme} themeMode={themeMode} complianceStreak={complianceStreak} deloadDue={deloadVisible(deloadDue, deloadDismissedAt ?? authUser?.user_metadata?.deload_dismissed_at ?? null, new Date())} bodyStatsInit={bodyStatsGlobal} onBodyStatsChange={async(stats)=>{
      setBodyStatsGlobal(stats);
      const {data:{user:u}}=await supabase.auth.getUser().catch(()=>({data:{user:null}}));
      if(u)await supabase.auth.updateUser({data:{body_stats:JSON.stringify(stats)}}).catch(()=>{});
    }}/>}
    {tab==="more"&&<MoreTab settings={settings} saveSettings={saveSettings} plans={plans} sessions={sessions} prs={prs} C={C} toggleTheme={toggleTheme} themeMode={themeMode} authUser={authUser}/>}
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"10px 4px 8px",background:"none",border:"none",color:tab===t.key?(themeMode==="dark"?C.goldInk:C.accentInk):C.muted,cursor:"pointer",fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <t.Icon size={ICON.md} strokeWidth={1.75} style={{flexShrink:0}}/>
          {t.label}
        </button>
      ))}
    </nav>
  </div>;
}

function getDayColor(day){
  if(!day)return "#4f8ef7";
  if(day.isRest)return "#3ecf8e";
  const lbl=(day.label||"").toLowerCase();
  if(lbl.startsWith("push"))return "#4f8ef7";
  if(lbl.startsWith("pull"))return "#f06584";
  if(lbl.startsWith("legs")||lbl.startsWith("lower"))return "#aa44ff";
  return day.color||"#4f8ef7";
}

// -- TODAY ---------------------------------------------------------------------
function TodayTab({plan,plans,activePlanKey,setActivePlanKey,settings,sessions,programStart,streak,complianceStreak,deloadDue,onDeloadDismiss,onStart,C,toggleTheme,themeMode,authUser,todayDay,onGoToPlan,longestStreak=0}){
  const rawDays=plan?.days||[];
  const numDays=rawDays.length;
  const toLocalDateStr=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  // Position-based scheduling: slot = daysSinceStart % numDays
  const todayMidnightRef=new Date();todayMidnightRef.setHours(12,0,0,0);
  const startDate=parsePlanDate(plan?.startDate);
  const elapsedDays=elapsedDaysSince(plan?.startDate,todayMidnightRef);
  const isFutureStart=elapsedDays!==null&&elapsedDays<0;
  const daysUntilStart=isFutureStart?-elapsedDays:0;
  const todaySlot=(elapsedDays!==null&&elapsedDays>=0&&numDays>0)?elapsedDays%numDays:null;
  const orderedDays=(()=>{
    if(todaySlot===null)return rawDays;
    return[...rawDays.slice(todaySlot),...rawDays.slice(0,todaySlot)];
  })();

  const userName = authUser?.user_metadata?.display_name || authUser?.email?.split("@")[0] || "there";
  const wkNum = planWeekOf(plan);
  const wkTotal = plan?.durationWeeks || 10;
  const isProgramComplete = !!wkNum && wkNum > wkTotal;
  const [dismissedComplete,setDismissedComplete]=useState(false);

  return <div>
    <div style={{background:C.bg,borderBottom:`1px solid ${C.border}`,padding:"16px 14px 14px"}}>
      {/* Row 1: greeting / day / date — theme toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,position:"relative"}}>
        <div>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Hello, <span style={{fontWeight:600}}>{userName}</span></div>
          <div style={{fontSize:22,letterSpacing:"-0.03em",fontWeight:800}}>{new Date().toLocaleDateString("en",{weekday:"long"})}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:1}}>{new Date().toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}</div>
        </div>
        <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 11px",fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em",marginTop:2,display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          {themeMode==="dark"?<Moon size={ICON.md} strokeWidth={1.75}/>:<Sun size={ICON.md} strokeWidth={1.75}/>}{themeMode==="dark"?"DARK":"LIGHT"}
        </button>
      </div>
    </div>
    <div style={{padding:"14px 18px"}}>
      {!plan&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:18,marginBottom:8}}>💪</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>No plan set up yet</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Pick a template to get started or build a custom plan.</div>
        <button onClick={onGoToPlan} style={{padding:"10px 20px",borderRadius:8,border:"none",background:C.accentBtn,color:"#fff",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,cursor:"pointer",letterSpacing:"0.04em"}}>Browse Templates</button>
      </div>}
      {deloadDue&&<div style={{background:C.gold+"15",border:`1px solid ${C.gold}55`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:C.goldInk,fontWeight:700,marginBottom:4}}>⚠ Deload Week Recommended</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              You've logged 10+ sessions over 6+ weeks of consistent training. A deload week lets joints recover and consolidates strength gains.
            </div>
            <div style={{fontSize:11,color:C.goldInk,marginTop:6,lineHeight:1.6}}>
              This week: drop all weights to 60%, keep same exercises and sets. Resume normal load next week.
            </div>
          </div>
          <button onClick={onDeloadDismiss} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:"0 0 0 12px",flexShrink:0,lineHeight:1}}>✕</button>
        </div>
      </div>}
      {isProgramComplete&&!dismissedComplete&&<div style={{background:C.gold+"15",border:`1px solid ${C.gold}55`,borderRadius:10,padding:"14px",marginBottom:14}}>
        <div style={{fontSize:13,color:C.goldInk,fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:6}}><Trophy size={ICON.sm} strokeWidth={1.75}/>PROGRAM COMPLETE · WEEK {wkTotal} OF {wkTotal}</div>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:10}}>You've completed your {wkTotal}-week program. What's next?</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setDismissedComplete(true)} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer"}}>Continue As Is</button>
          <button onClick={onGoToPlan} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:C.gold,color:"#1a202c",fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,cursor:"pointer"}}>Start New Plan</button>
        </div>
      </div>}
      {plan&&isFutureStart&&<div style={{background:C.accent+"15",border:`1px solid ${C.accent}40`,borderRadius:10,padding:"14px",marginBottom:14}}>
        <Mono style={{fontSize:10,color:C.accentInk,letterSpacing:"0.1em",display:"block",marginBottom:6}}>STARTS IN {daysUntilStart} DAY{daysUntilStart!==1?"S":""} · {startDate.toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"})}</Mono>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Upcoming rotation</div>
        {rawDays.map((d,i)=>{
          const slotDate=new Date(startDate);slotDate.setDate(startDate.getDate()+i);
          return<div key={d.id||i} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}40`}}>
            <div style={{width:8,height:8,borderRadius:4,background:getDayColor(d),flexShrink:0}}/>
            <Mono style={{fontSize:11,color:C.muted,width:90,flexShrink:0}}>{slotDate.toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}</Mono>
            <div style={{fontSize:12,color:d.isRest?C.muted:C.text,fontStyle:d.isRest?"italic":"normal",flex:1}}>{d.label}</div>
          </div>;
        })}
      </div>}
      <SectionLabel C={C}>{isFutureStart?"Preview":"This Week"}</SectionLabel>
      {orderedDays.map((day,i)=>{
        const origSlotIdx=rawDays.findIndex(d=>d.id===day.id);
        const isToday=todaySlot!==null&&origSlotIdx===todaySlot;
        const slotOffset=todaySlot!==null?origSlotIdx-todaySlot:null;

        // Calendar date for this slot — position-based from today
        const calDate=new Date(todayMidnightRef);
        if(slotOffset!==null)calDate.setDate(todayMidnightRef.getDate()+slotOffset);
        else if(isFutureStart&&startDate)calDate.setTime(new Date(startDate).setDate(startDate.getDate()+origSlotIdx));
        const calDateStr=toLocalDateStr(calDate);
        const calDateDisplay=calDate.toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"});

        // ── Step 2: Match history sessions on BOTH date AND workout label ──
        // Use local date strings to avoid UTC midnight mismatch after ~7pm in US timezones
        const matchedSessions=sessions.filter(s=>
          s.completedAt&&
          toLocalDateStr(new Date(s.completedAt))===calDateStr&&
          s.dayLabel===day.label
        );
        const doneSess=matchedSessions.length>0;
        const quotes=["The body achieves what the mind believes.","Rest is not quitting — it's the fuel for your comeback.","Champions are built in moments they want to quit.","Progress is progress, no matter how small.","Every rep is a promise kept to yourself.","Strong is earned, not given.","Your only competition is who you were yesterday.","The pain you feel today is the strength you feel tomorrow.","Discipline is choosing between what you want now and what you want most.","It never gets easier — you just get stronger.","One more rep. One more set. One more day.","The gym is proof that effort always pays off.","Show up. Do the work. Trust the process.","What you do today can improve all of your tomorrows.","Strive for progress, not perfection.","Push yourself because no one else is going to do it for you.","Small steps every day lead to big results.","Recovery is where the gains are made.","Rest today. Dominate tomorrow.","Your body can do it. It's your mind you have to convince.","Fall in love with the process and the results will come.","You don't find the will to win. You build it.","The only bad workout is the one that didn't happen.","Make yourself proud.","Earn it.","Sore today, strong tomorrow.","Suffer the pain of discipline or suffer the pain of regret.","Your future self is watching you right now.","Consistency over intensity. Every time.","One rep at a time. One day at a time.","Do something today your future self will thank you for.","Be stronger than your excuses.","The hardest lift is lifting yourself off the couch.","Train insane or remain the same.","Success starts with self-discipline.","You are one workout away from a good mood.","Sweat is just fat crying.","Wake up. Work out. Kick ass. Repeat.","Your health is an investment, not an expense.","The difference between try and triumph is a little umph.","Strength does not come from the body. It comes from the will.","Don't stop when you're tired. Stop when you're done.","When your legs get tired, run with your heart.","You didn't come this far to only come this far.","The clock is ticking. Are you becoming the person you want to be?","Motivation gets you started. Habit keeps you going.","Greatness is earned, never given.","You have to believe in yourself when no one else does.","Work hard in silence. Let success make the noise.","The body is capable of almost anything. Train the mind first.","Every champion was once a contender that refused to give up.","Believe you can and you're halfway there.","Results happen over time, not overnight. Stay consistent.","You are stronger than you think.","Set goals. Smash them. Repeat.","Take care of your body. It's the only place you have to live.","Train like a beast. Look like a beauty.","The best project you'll ever work on is you.","Doubt kills more dreams than failure ever will.","Excuses don't burn calories.","It always seems impossible until it's done.","Hard work beats talent when talent doesn't work hard.","If it doesn't challenge you, it doesn't change you.","Your only limit is your mind.","Becoming takes time. Give it time.","Hustle for that muscle.","You're not tired. You're uninspired. Find your why.","No shortcuts. No excuses. No regrets.","Show up every day and you will get better. That's a promise.","Commit to being uncomfortable.","Tough times never last. Tough people do.","Pain is temporary. Pride is forever.","You are what you do, not what you say you'll do.","Mental strength is just as important as physical strength.","Fitness is not about being better than someone else. It's about being better than you used to be.","Don't limit your challenges. Challenge your limits.","Do it now. Sometimes 'later' becomes 'never'.","Don't wish for it. Work for it.","Champions keep going when they don't have anything left.","Nothing worth having comes easy.","The hardest step is always the first one. Take it.","Strength is built in the moments you want to stop.","Eat clean. Train mean. Stay lean.","You don't have to be extreme. Just consistent.","A little progress each day adds up to big results.","Rest is part of the plan. So is showing back up.","Iron sharpens iron.","The grind never lies.","When in doubt, work out.","Your body hears everything your mind says. Be kind and be strong.","Legs are the foundation of everything. Never skip them.","The mirror doesn't lie. Neither does the gym.","Put in the reps. The results will follow.","Today is another chance to get stronger.","Every workout builds the person you're becoming.","Sleep. Eat. Train. Repeat.","Rest hard so you can train hard.","You are a work in progress, and that is something to be proud of.","One day or day one. You decide.","Prove yourself to yourself."];
        const dayOfYear=(d=>Math.floor((d-new Date(d.getFullYear(),0,0))/86400000))(new Date());
        const cycleSize=100;
        const cycleNum=Math.floor(dayOfYear/cycleSize);
        const posInCycle=dayOfYear%cycleSize;
        const shuffled=[...quotes].sort((a,b)=>{const h=(s,n)=>{let v=n;for(let i=0;i<s.length;i++)v=((v<<5)-v)+s.charCodeAt(i);return v&v;};return h(a,cycleNum)-h(b,cycleNum);});
        const quote=shuffled[posInCycle%shuffled.length];
        // ── Step 3: Calculate volume from matched sessions ──
        const dayVol=doneSess?(()=>{
          const vol=matchedSessions.reduce((a,s)=>(a+(s.setsArr||[]).filter(x=>x.type!=="warmup").reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);
          const sets=matchedSessions.reduce((a,s)=>(a+(s.setsArr||[]).filter(x=>x.type!=="warmup").length),0);
          return {vol,sets};
        })():null;
        const isPast=slotOffset!==null&&slotOffset<0;
        return <div key={day.id} style={{background:isToday?C.neon+"0d":C.card,border:`2px solid ${isToday?C.neon:C.border}`,borderRadius:10,padding:"13px 14px",marginBottom:8,opacity:isToday?1:day.isRest?.65:isPast?.7:1,boxShadow:isToday?`0 0 12px ${C.neon}33`:"none",transition:"all .2s"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                <span style={{fontSize:15,fontWeight:600,color:C.cardText||C.text}}>{day.label}</span>
                {isToday&&!doneSess&&<Pill color={C.neonInk}>Today</Pill>}
                {(doneSess||(day.isRest&&isPast))&&<Pill color={C.neonInk}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><Check size={ICON.sm} strokeWidth={1.75}/>Done</span></Pill>}
              </div>
              <div style={{fontSize:11,color:C.muted}}>{calDateDisplay} · {day.tag}</div>
              {!day.isRest&&!doneSess&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{day.exercises.length} exercises</div>}
              {doneSess&&dayVol&&dayVol.sets>0&&<Mono style={{fontSize:11,color:C.neonInk,display:"block",marginTop:4}}>{dayVol.sets} sets · {dayVol.vol>0?`${Math.round(dayVol.vol).toLocaleString()} lbs`:"logged"}</Mono>}
              {day.isRest&&isToday&&<div style={{fontSize:12,color:C.neonInk,fontStyle:"italic",marginTop:6,lineHeight:1.5}}>"{quote}"</div>}
            </div>
            {!isToday&&!day.isRest&&!doneSess&&!isFutureStart&&<Btn onClick={()=>onStart(day)} size="sm" C={C} style={{marginLeft:10,background:C.neonBtn,color:"#fff",fontWeight:700,letterSpacing:"0.1em"}}>START</Btn>}
            {!day.isRest&&doneSess&&!isToday&&<Btn onClick={()=>onStart(day)} size="sm" variant="ghost" C={C} style={{marginLeft:10,fontSize:10,color:C.muted,borderColor:C.border}}>↺ Again</Btn>}
          </div>
          {isToday&&!doneSess&&!day.isRest&&!isFutureStart&&<button onClick={()=>onStart(day)} style={{width:"100%",padding:"11px",background:themeMode==="dark"?"#f7c948":"#d4a017",border:"none",borderRadius:10,color:"#1a202c",fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:800,letterSpacing:"0.08em",cursor:"pointer",marginTop:12,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>START {day.label.toUpperCase()}</button>}
        </div>;
      })}
    </div>
  </div>;
}

// -- APPLE HEALTH WRITE -------------------------------------------------------
async function writeToAppleHealth(startTime, endTime, totalVolume) {
  try {
    if (!window.navigator.health) return;
    const calories = Math.round(totalVolume * 0.0003);
    await window.navigator.health.addWorkout?.({
      workoutActivityType: "traditionalStrengthTraining",
      startDate: new Date(startTime),
      endDate: new Date(endTime),
      totalEnergyBurned: {value: calories, unit: "kcal"},
      metadata: {totalVolumeLbs: Math.round(totalVolume)},
    });
  } catch { /* silent — API unavailable or permission denied */ }
}

// -- EXERCISE LIBRARY MODAL ---------------------------------------------------
function ExerciseLibraryModal({onSelect,onClose,C}){
  const [query,setQuery]=useState("");
  const [muscleFilter,setMuscleFilter]=useState(null);
  const [tab,setTab]=useState("library");
  const [custom,setCustom]=useState({name:"",sets:"3",reps:"10-12",note:"",muscle:""});
  const muscles=["Chest","Back","Shoulders","Biceps","Triceps","Legs","Abs","Cardio"];
  const equipColor={"Barbell":C.accent,"Dumbbell":C.neon,"Cable":C.gold,"Machine":C.muted,"Bodyweight":C.green,"Kettlebell":C.red};
  const filtered=EXERCISE_LIBRARY.filter(e=>
    (!muscleFilter||e.muscle===muscleFilter)&&
    (!query||e.name.toLowerCase().includes(query.toLowerCase()))
  );
  return <Modal onClose={onClose} C={C} showClose={false}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:16,fontWeight:700}}>Add Exercise</div>
      <Btn variant="ghost" size="sm" onClick={onClose} C={C}>✕</Btn>
    </div>
    <div style={{display:"flex",gap:4,background:C.card,padding:3,borderRadius:8,marginBottom:12}}>
      {[["library","Browse Library"],["custom","Custom"]].map(([k,label])=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:tab===k?C.accentBtn:"transparent",color:tab===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:"0.04em"}}>{label}</button>
      ))}
    </div>
    {tab==="library"&&<div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search 200+ exercises..."
        autoFocus
        style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",marginBottom:10,outline:"none"}}/>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        <button onClick={()=>setMuscleFilter(null)} style={{padding:"5px 9px",borderRadius:5,border:`1px solid ${muscleFilter===null?C.accent+"66":C.border}`,background:muscleFilter===null?C.accent+"20":"transparent",color:muscleFilter===null?C.accentInk:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>ALL</button>
        {muscles.map(m=>(
          <button key={m} onClick={()=>setMuscleFilter(muscleFilter===m?null:m)} style={{padding:"5px 9px",borderRadius:5,border:`1px solid ${muscleFilter===m?C.accent+"66":C.border}`,background:muscleFilter===m?C.accent+"20":"transparent",color:muscleFilter===m?C.accentInk:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>{m.toUpperCase()}</button>
        ))}
      </div>
      <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:8,letterSpacing:"0.08em"}}>{filtered.length} EXERCISES</Mono>
      {filtered.map((ex,i)=>(
        <div key={i} onClick={()=>onSelect({name:ex.name,muscle:ex.muscle,sets:ex.muscle==="Cardio"?"--":"3",reps:ex.muscle==="Cardio"?"30 min":"10-12",note:ex.cue})}
          style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:6,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{ex.name}</div>
              <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:5,lineHeight:1.4}}>{ex.cue}</Mono>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                <Pill color={C.accentInk}>{ex.muscle}</Pill>
                <Pill color={equipColor[ex.equipment]||C.faint}>{ex.equipment}</Pill>
              </div>
            </div>
            <div style={{color:C.neonInk,fontSize:20,fontWeight:300,flexShrink:0,paddingTop:2}}>+</div>
          </div>
        </div>
      ))}
    </div>}
    {tab==="custom"&&<div>
      {[["Exercise Name","name"],["Sets","sets"],["Reps","reps"],["Muscle Group","muscle"],["Note / Cue","note"]].map(([label,key])=>(
        <div key={key} style={{marginBottom:10}}>
          <SectionLabel C={C}>{label}</SectionLabel>
          <input value={custom[key]||""} onChange={e=>setCustom(p=>({...p,[key]:e.target.value}))}
            style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
        </div>
      ))}
      <Btn style={{width:"100%",marginTop:6}} C={C} onClick={()=>{if(custom.name.trim())onSelect(custom);}} disabled={!custom.name.trim()}>Add Exercise</Btn>
    </div>}
  </Modal>;
}

// -- WORKOUT SESSION -----------------------------------------------------------
function WorkoutSession({workout,settings,prs,sessions,plans,activePlanKey,savePlans,authUser,workoutDraft,onMinimize,onFinish,onCancel,C}){
  const [exercises,setExercises]=useState(workoutDraft?.exercises||workout.exercises||[]);
  const [loggedSets,setLoggedSets]=useState(()=>{
    // If restoring from a saved draft, use draft data AS-IS — preserve prepop flags
    // so untouched suggestions stay "suggested" and don't appear as entered values
    if(workoutDraft?.loggedSets&&Object.keys(workoutDraft.loggedSets).length){
      const restored={};
      for(const[ex,sets] of Object.entries(workoutDraft.loggedSets)){
        restored[ex]={};
        for(const[n,vals] of Object.entries(sets)){
          restored[ex][n]={...vals};
        }
      }
      return restored;
    }
    // Otherwise pre-populate from last session for this day
    // Match by dayId (post-fix sessions) OR dayLabel (pre-fix sessions where day_id was null)
    const lastSess=sessions.filter(s=>(s.dayId===workout.id||s.dayLabel===workout.label)&&s.completedAt&&!s.partial).sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))[0];
    const last=lastSess?.sets||{};
    const init={};
    for(const ex of(workout.exercises||[])){
      const prev=last[ex.name];
      if(!prev)continue;
      const isC=ex.muscle==="Cardio"||ex.muscle==="Recovery";
      if(isC){
        if(prev[1]?.minutes)init[ex.name]={1:{minutes:prev[1].minutes,level:prev[1].level||"",prepop:true}};
      } else {
        const ns=parseInt(ex.sets)||3;
        const exS={};
        for(let n=1;n<=ns;n++){if(prev[n]?.weight)exS[n]={weight:prev[n].weight,reps:prev[n].reps||"",prepop:true};}
        if(Object.keys(exS).length)init[ex.name]=exS;
      }
    }
    return init;
  });
  const [completedExIds,setCompletedExIds]=useState(()=>new Set(workoutDraft?.completedExIds||[]));
  const [showRest,setShowRest]=useState(false);
  const [restKey,setRestKey]=useState(0);
  const [notes,setNotes]=useState("");
  const [startTime]=useState(workoutDraft?.startedAt||new Date().toISOString());
  const startMs=useRef(workoutDraft?.elapsed ? Date.now()-(workoutDraft.elapsed*1000) : Date.now());
  const [aiModal,setAiModal]=useState(null);
  const [elapsed,setElapsed]=useState(workoutDraft?.elapsed||0);
  const [swapModal,setSwapModal]=useState(null);
  const [swapCache,setSwapCache]=useState({});
  const [addExModal,setAddExModal]=useState(false);
  const [editExModal,setEditExModal]=useState(null);
  const [setTypes,setSetTypes]=useState({});
  const [setError,setSetError]=useState({});
  const [extraSets,setExtraSets]=useState({});
  const [setStates,setSetStates]=useState(()=>{
    // On restore, mark genuinely-entered sets (have a value and not a prepop suggestion)
    // as "confirmed" so the green check state survives minimize/reopen
    const st={};
    if(workoutDraft?.loggedSets){
      const idByName=Object.fromEntries((workoutDraft?.exercises||workout.exercises||[]).map(e=>[e.name,e.id]));
      for(const[exName,sets] of Object.entries(workoutDraft.loggedSets)){
        const exId=idByName[exName];
        if(!exId)continue;
        for(const[n,vals] of Object.entries(sets)){
          const hasVal=vals.minutes?!!vals.minutes:!!(vals.weight&&vals.reps);
          if(hasVal&&!vals.prepop)st[`${exId}-${n}`]="confirmed";
        }
      }
    }
    return st;
  });
  const [showEndMenu,setShowEndMenu]=useState(false);
  const [showAbandonConfirm,setShowAbandonConfirm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(null);
  const [autoSaveToast,setAutoSaveToast]=useState(false);
  const autoSavedRef=useRef(false);
  const finishCalledRef=useRef(false);
  const [autoFinishCountdown,setAutoFinishCountdown]=useState(null);
  const topRef=useRef(null);
  const restAnchorRef=useRef(null);
  const lastActiveExRef=useRef(null);
  const saveDraftRef=useRef(null);
  const dragStartYRef=useRef(null);
  const [dragDelta,setDragDelta]=useState(0);

  useEffect(()=>{const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startMs.current)/1000)),1000);return()=>clearInterval(t);},[]);// eslint-disable-line

  // Auto-save as partial session after 3 hours (10800 seconds)
  useEffect(()=>{
    if(elapsed<10800||autoSavedRef.current)return;
    autoSavedRef.current=true;
    setAutoSaveToast(true);
    const t=setTimeout(()=>savePartialAndExit(),3000);
    return()=>clearTimeout(t);
  },[elapsed]);// eslint-disable-line

  // Auto-finish countdown when all exercises are done
  useEffect(()=>{
    if(autoFinishCountdown===null)return;
    if(autoFinishCountdown===0){finish();return;}
    const t=setTimeout(()=>setAutoFinishCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[autoFinishCountdown]);// eslint-disable-line

  // Heartbeat: persist draft every 30s as a backstop against iOS app kill.
  // Call through saveDraftRef so the interval always invokes the LATEST saveDraft
  // (its closure has current loggedSets/elapsed) — a bare saveDraft() here would
  // capture first-render state and clobber the draft with empty mount data.
  useEffect(()=>{
    const t=setInterval(()=>{saveDraftRef.current&&saveDraftRef.current();},30000);
    return()=>clearInterval(t);
  },[]);// eslint-disable-line

  const lastSessionForDay=sessions.filter(s=>s.dayId===workout.id&&s.completedAt).sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))[0];
  const lastSets=lastSessionForDay?.sets||{};

  function logSet(exName,setNum,field,value){
    lastActiveExRef.current=exName;
    setLoggedSets(prev=>({...prev,[exName]:{...(prev[exName]||{}),[setNum]:{...(prev[exName]?.[setNum]||{}),[field]:value,prepop:false}}}));
  }

  async function saveDraft(setsSnapshot){
    if(!authUser)return;
    try{
      const{error}=await supabase.from("workout_drafts").upsert({
        user_id:authUser.id,
        day_label:workout.label,
        day_id:workout.id||null,
        started_at:startTime,
        logged_sets:setsSnapshot||loggedSets,
        elapsed_seconds:elapsed,
        updated_at:new Date().toISOString(),
        exercises_json:exercises
      },{onConflict:"user_id"});
      if(error)console.error("saveDraft:",error);
    }catch(e){console.error("saveDraft:",e);}
  }
  saveDraftRef.current=saveDraft;// keep heartbeat pointed at the latest closure

  async function deleteDraft(){
    if(!authUser)return;
    try{
      const{error}=await supabase.from("workout_drafts").delete().eq("user_id",authUser.id);
      if(error)console.error("deleteDraft:",error);
    }catch(e){console.error("deleteDraft:",e);}
  }

  async function savePartialAndExit(){
    if(saving)return;
    setSaving(true);setSaveError(null);
    const setsArr=[];
    for(const[exName,sets]of Object.entries(loggedSets)){
      for(const[sn,vals]of Object.entries(sets)){
        if(!vals.prepop&&(vals.weight||vals.reps||vals.minutes)){
          const typ=(setTypes[exName]?.[parseInt(sn)])||"working";
          setsArr.push({exName,setNum:parseInt(sn),weight:vals.weight||"",reps:vals.reps||"",minutes:vals.minutes||"",level:vals.level||"",isPR:false,type:typ});
        }
      }
    }
    const cleanSets={};
    for(const[ex,exSets]of Object.entries(loggedSets)){const c={};for(const[n,v]of Object.entries(exSets)){if(!v.prepop)c[n]={weight:v.weight||"",reps:v.reps||"",minutes:v.minutes||"",level:v.level||""};}if(Object.keys(c).length)cleanSets[ex]=c;}
    const ok=await onFinish({id:Date.now().toString(),dayId:workout.id,dayLabel:workout.label,startedAt:startTime,completedAt:new Date().toISOString(),notes,sets:cleanSets,setsArr,partial:true},{});
    if(ok){await deleteDraft();}else{setSaving(false);setSaveError("Could not save — check connection and try again.");}
  }

  async function abandonWorkout(){
    await deleteDraft();
    onCancel();
  }

  function cycleSetType(exName,setNum){
    setSetTypes(prev=>{
      const cur=(prev[exName]?.[setNum])||"working";
      const next=cur==="working"?"warmup":cur==="warmup"?"drop":cur==="drop"?"failure":"working";
      return {...prev,[exName]:{...(prev[exName]||{}),[setNum]:next}};
    });
  }

  // When all sets for an exercise are ticked, move it to the bottom
  function markExerciseDone(exId,exName,withRest=true){
    const isLastExercise=exercises.filter(e=>!completedExIds.has(e.id)).length===1;
    if(withRest&&!isLastExercise){setShowRest(true);setRestKey(k=>k+1);}
    else if(!withRest){setShowRest(false);}
    setCompletedExIds(prev=>{
      const next=new Set(prev);
      next.add(exId);
      return next;
    });
    // Reorder: move this exercise to end of list
    setExercises(prev=>{
      const idx=prev.findIndex(e=>e.id===exId);
      if(idx===-1)return prev;
      const reordered=[...prev.slice(0,idx),...prev.slice(idx+1),prev[idx]];
      return reordered;
    });
    if(isLastExercise){setAutoFinishCountdown(5);}
    // Smooth scroll so the rest timer + next active exercise are both in view
    setTimeout(()=>{
      (restAnchorRef.current||topRef.current)?.scrollIntoView({behavior:"smooth",block:"start"});
    },100);
  }

  // Persist exercise changes back to the plan
  function persistToPlan(updatedExercises){
    if(!plans||!activePlanKey||!savePlans)return;
    const plan=plans[activePlanKey];
    if(!plan)return;
    // Match by id first, fall back to label+name match for resilience
    const updatedDays=plan.days.map(d=>{
      const match=d.id===workout.id||(d.label===workout.label&&d.name===workout.name);
      return match?{...d,exercises:updatedExercises}:d;
    });
    savePlans({...plans,[activePlanKey]:{...plan,days:updatedDays}});
  }

  function swapExercise(oldEx,newExData){
    // Transfer any logged sets from old name to new name
    const updatedLog={...loggedSets};
    if(updatedLog[oldEx.name]){
      updatedLog[newExData.name]=updatedLog[oldEx.name];
      delete updatedLog[oldEx.name];
    }
    setLoggedSets(updatedLog);
    const updated=exercises.map(e=>e.id===oldEx.id?{...oldEx,...newExData,id:oldEx.id}:e);
    setExercises(updated);
    persistToPlan(updated);
    setSwapModal(null);
  }

  function addExercise(exData){
    const newEx={...exData,id:mkId()};
    const updated=[...exercises,newEx];
    setExercises(updated);
    persistToPlan(updated);
    setAddExModal(false);
  }

  function removeExercise(exId){
    const removing=exercises.find(e=>e.id===exId);
    const updated=exercises.filter(e=>e.id!==exId);
    setExercises(updated);
    persistToPlan(updated);
    // Clean up any logged sets for removed exercise
    if(removing){
      setLoggedSets(prev=>{
        const next={...prev};
        delete next[removing.name];
        return next;
      });
    }
    // If removing this exercise leaves all remaining exercises done, start auto-complete
    const remaining=updated.filter(e=>!completedExIds.has(e.id));
    if(updated.length>0&&remaining.length===0){setAutoFinishCountdown(5);}
  }

  function updateExercise(exId,data){
    const old=exercises.find(e=>e.id===exId);
    // rename logged sets if name changed
    if(old&&old.name!==data.name&&loggedSets[old.name]){
      const updatedLog={...loggedSets,[data.name]:loggedSets[old.name]};
      delete updatedLog[old.name];
      setLoggedSets(updatedLog);
    }
    const updated=exercises.map(e=>e.id===exId?{...e,...data}:e);
    setExercises(updated);
    persistToPlan(updated);
    setEditExModal(null);
  }

  async function finish(){
    if(saving||finishCalledRef.current)return;
    finishCalledRef.current=true;
    setSaving(true);setSaveError(null);
    const newPRs={};
    const setsArr=[];
    // Sort by plan exercise order so History always shows the same sequence as the workout plan
    const exOrder=Object.fromEntries((workout.exercises||[]).map((e,i)=>[e.name,i]));
    const sortedLogEntries=Object.entries(loggedSets).sort(([a],[b])=>(exOrder[a]??999)-(exOrder[b]??999));
    for(const[exName,sets]of sortedLogEntries){
      // Qualifying sets for this exercise, in performed (set-number) order.
      const rows=Object.entries(sets)
        .filter(([,vals])=>!vals.prepop&&(vals.weight||vals.reps||vals.minutes))
        .map(([sn,vals])=>({sn:parseInt(sn),vals,typ:(setTypes[exName]?.[parseInt(sn)])||"working"}))
        .sort((a,b)=>a.sn-b.sn);
      // Weight-level PR flags: strict running max over the prior best. Cardio sets
      // carry no weight; warmups are never PRs. Respects the PR-detection setting.
      const priorBest=prs[exName]?.weight||0;
      const flags=settings.prDetection
        ? flagPRs(rows.map(r=>({weight:r.vals.minutes?0:(parseFloat(r.vals.weight)||0),warmup:r.typ==="warmup"})),priorBest)
        : rows.map(()=>false);
      rows.forEach((r,i)=>{
        const isPR=flags[i];
        const w=parseFloat(r.vals.weight)||0;
        if(isPR&&(!newPRs[exName]||w>newPRs[exName].weight))newPRs[exName]={weight:w,date:new Date().toISOString()};
        setsArr.push({exName,setNum:r.sn,weight:r.vals.weight||"",reps:r.vals.reps||"",minutes:r.vals.minutes||"",level:r.vals.level||"",isPR,type:r.typ});
      });
    }
    if(settings.appleHealth){
      const vol=setsArr.filter(x=>x.type!=="warmup").reduce((s,x)=>(s+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0);
      writeToAppleHealth(startTime,new Date().toISOString(),vol);
    }
    const cleanSets={};
    for(const[ex,exSets]of sortedLogEntries){const c={};for(const[n,v]of Object.entries(exSets)){if(!v.prepop)c[n]={weight:v.weight||"",reps:v.reps||"",minutes:v.minutes||"",level:v.level||""};}if(Object.keys(c).length)cleanSets[ex]=c;}
    const ok=await onFinish({id:Date.now().toString(),dayId:workout.id,dayLabel:workout.label,startedAt:startTime,completedAt:new Date().toISOString(),notes,sets:cleanSets,setsArr,partial:false},newPRs);
    if(ok){await deleteDraft();}else{finishCalledRef.current=false;setSaving(false);setSaveError("Workout not saved — check connection and tap Retry.");}
  }

  const inputStyle={padding:"9px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"};


  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.serif,paddingBottom:100,scrollBehavior:"smooth"}}>
    <div onPointerDown={e=>{dragStartYRef.current=e.clientY;setDragDelta(0);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(dragStartYRef.current===null)return;const d=e.clientY-dragStartYRef.current;setDragDelta(d>0?d:0);}} onPointerUp={async e=>{const d=dragStartYRef.current!==null?e.clientY-dragStartYRef.current:0;dragStartYRef.current=null;setDragDelta(0);if(d>80){await saveDraft();onMinimize({workout,loggedSets,elapsed,startedAt:startTime,exercises,completedExIds:[...completedExIds]});}}} onPointerCancel={()=>{dragStartYRef.current=null;setDragDelta(0);}} style={{height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"grab",touchAction:"none",background:C.bg}}>
      <div style={{width:40,height:4,borderRadius:2,background:dragDelta>60?C.neon:C.border,transition:"background 0.15s"}}/>
    </div>
    <div style={{background:C.bg,borderBottom:`2px solid ${C.neon}`,padding:"14px 18px",position:"sticky",top:0,zIndex:50,marginTop:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{workout.label}</div>
          <Mono style={{fontSize:11,color:C.muted}}>{exercises.length} exercises</Mono>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Mono style={{fontSize:13,color:C.neonInk,fontWeight:700}}>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</Mono>
          <Btn onClick={()=>setAddExModal(true)} variant="ghost" size="sm" C={C} style={{fontSize:11,color:C.neonInk,borderColor:C.neon+"44"}}>+ Add</Btn>
          <Btn onClick={()=>setShowEndMenu(true)} variant="ghost" size="sm" C={C} style={{fontSize:16,letterSpacing:"0.1em",padding:"5px 8px"}}>⋯</Btn>
          <Btn onClick={async()=>{await saveDraft();onMinimize({workout,loggedSets,elapsed,startedAt:startTime,exercises,completedExIds:[...completedExIds]});}} variant="ghost" size="sm" C={C}>✕</Btn>
        </div>
      </div>
    </div>
    {autoSaveToast&&<div style={{background:C.gold,padding:"10px 18px",textAlign:"center"}}>
      <Mono style={{fontSize:12,color:"#0b0c0e",fontWeight:700}}>Workout auto-saved after 3 hours</Mono>
    </div>}
    {autoFinishCountdown!==null&&<div style={{background:C.neon,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Mono style={{fontSize:12,color:"#0b0c0e",fontWeight:700}}>All done! Completing in {autoFinishCountdown}s…</Mono>
      <Btn onClick={()=>setAutoFinishCountdown(null)} variant="ghost" size="sm" C={C} style={{fontSize:11,color:"#0b0c0e",borderColor:"#0b0c0e44",padding:"3px 10px"}}>CANCEL</Btn>
    </div>}
    <div style={{padding:"14px 18px"}}>
      {/* Scroll target so set-confirm brings the rest timer + active exercise into view */}
      <div ref={restAnchorRef} style={{scrollMarginTop:80}}/>
      {showRest&&settings.restTimer&&<RestTimer key={restKey} seconds={settings.restSeconds||90} onDone={()=>setShowRest(false)} onSkip={()=>setShowRest(false)} C={C}/>}

      <div ref={topRef}/>
      {[...exercises].sort((a,b)=>{
        const s=ex=>{
          if(completedExIds.has(ex.id))return 2;
          const ml=loggedSets[ex.name]||{};
          const isC=ex.muscle==="Cardio"||ex.muscle==="Recovery";
          return(isC?(ml[1]?.minutes&&!ml[1]?.prepop):Object.values(ml).some(v=>(v.weight||v.reps)&&!v.prepop))?0:1;
        };
        const sa=s(a),sb=s(b);
        if(sa!==sb)return sa-sb;
        if(sa===0){if(a.name===lastActiveExRef.current)return -1;if(b.name===lastActiveExRef.current)return 1;}
        return 0;
      }).map((ex,exIdx)=>{
        const isCardio=ex.muscle==="Cardio"||ex.muscle==="Recovery";
        const myLog=loggedSets[ex.name]||{};
        const last=settings.lastRef?lastSets[ex.name]:null;
        const myPR=(!isCardio&&settings.prDetection)?prs[ex.name]:null;
        const w0=myLog[1]?.weight;
        const isPRNow=myPR&&w0&&parseFloat(w0)>myPR.weight;

        const isDone=completedExIds.has(ex.id);
        const numSets=(parseInt(ex.sets)||3)+(extraSets[ex.name]||0);
        const intervalKeys=isCardio?Object.keys(myLog).map(n=>parseInt(n)).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b):[];
        if(isCardio&&intervalKeys.length===0)intervalKeys.push(1);
        const hasAnyLog=isCardio?intervalKeys.some(n=>myLog[n]?.minutes&&!myLog[n]?.prepop):Object.values(myLog).some(v=>(v.weight||v.reps)&&!v.prepop);
        return <div key={ex.id} style={{background:isDone?C.surface:C.card,border:`1px solid ${isDone?C.faint:hasAnyLog?C.neon+"44":C.border}`,borderLeft:`3px solid ${isDone?C.faint:isCardio?C.green:hasAnyLog?C.neon:C.accent}`,borderRadius:10,padding:"14px",marginBottom:10,transition:"all .3s",opacity:isDone?0.55:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                {ex.name}
                {isCardio&&<Pill color={C.greenInk}>Cardio</Pill>}
                {isPRNow&&<PRMark C={C}/>}
                {hasAnyLog&&<span style={{fontSize:9,color:C.neonInk,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em"}}>LOGGED</span>}
              </div>
              <Mono style={{fontSize:11,color:C.muted}}>{isCardio?"Duration goal:":ex.sets+" sets ."} {ex.reps}{!isCardio&&ex.muscle?` . ${ex.muscle}`:""}</Mono>
              {ex.note&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{ex.note}</div>}
              {!isCardio&&last&&<Mono style={{fontSize:11,color:C.muted,display:"block",marginTop:2}}>Last: {last[1]?.weight||"--"}lbs × {last[1]?.reps||"--"}</Mono>}
              {isCardio&&last&&last[1]?.minutes&&<Mono style={{fontSize:11,color:C.muted,display:"block",marginTop:2}}>Last: {last[1].minutes} min</Mono>}
              {myPR&&<Mono style={{fontSize:11,color:C.redInk,display:"block"}}>PR: {myPR.weight}lbs</Mono>}
              {!isCardio&&settings.plateCalc&&w0&&<PlateCalc weight={w0} C={C}/>}
            </div>
            <div style={{display:"flex",gap:4,marginLeft:8,flexShrink:0}}>
              {!isCardio&&settings.aiRecs&&<Btn onClick={()=>setAiModal(ex)} variant="ghost" size="sm" C={C} style={{fontSize:12,padding:"5px 8px"}}>✦</Btn>}
              <Btn onClick={()=>setEditExModal(ex)} variant="ghost" size="sm" C={C} style={{fontSize:12,padding:"5px 8px"}}>✎</Btn>
              {!isCardio&&<Btn onClick={()=>setSwapModal(ex)} variant="ghost" size="sm" C={C} style={{fontSize:12,padding:"5px 8px",color:C.goldInk,borderColor:C.gold+"44"}}>⇄</Btn>}
              <Btn onClick={()=>removeExercise(ex.id)} variant="danger" size="sm" C={C} style={{fontSize:12,padding:"5px 8px"}}>✕</Btn>
            </div>
          </div>

          {/* CARDIO: minutes + optional level — multiple intervals, 3 states */}
          {isCardio&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {intervalKeys.map(n=>{
              const rowKey=ex.id+"-"+n;
              const rowLog=myLog[n]||{};
              const isPrepop=!!rowLog.prepop;
              const isConfirmed=setStates[rowKey]==="confirmed";
              const hasVal=!!rowLog.minutes;
              const setRowState=isConfirmed?"confirmed":isPrepop?"suggested":hasVal?"inprogress":"suggested";
              if(isConfirmed){
                return <div key={n} onClick={()=>{setSetStates(prev=>{const u={...prev};delete u[rowKey];return u;});}} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:C.neon+"12",border:`1px solid ${C.neon}22`,borderRadius:8,padding:"10px 12px"}}>
                  <span style={{color:C.neonInk,display:"inline-flex",alignItems:"center"}}><Check size={ICON.sm} strokeWidth={1.75}/></span>
                  <Mono style={{color:C.neonInk,fontSize:12,fontWeight:700}}>Interval {n}</Mono>
                  <Mono style={{color:C.text,fontSize:14,fontWeight:700}}>{rowLog.minutes} min{rowLog.level?` · L${rowLog.level}`:""}</Mono>
                  <Mono style={{color:C.muted,fontSize:11,marginLeft:"auto"}}>tap to edit</Mono>
                </div>;
              }
              return <div key={n} style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="number" placeholder={(ex.reps||"").match(/\d+/)?.[0]||"0"}
                  value={rowLog.minutes||""}
                  onChange={e=>logSet(ex.name,n,"minutes",e.target.value)}
                  onFocus={()=>{if(isPrepop)setLoggedSets(prev=>({...prev,[ex.name]:{...prev[ex.name],[n]:{...prev[ex.name]?.[n],prepop:false}}}));}}
                  style={{...inputStyle,flex:2,fontSize:20,fontWeight:700,textAlign:"center",color:setRowState==="suggested"?C.muted:C.text,fontStyle:setRowState==="suggested"?"italic":"normal",background:setRowState==="inprogress"?C.accent+"12":C.surface}}/>
                <Mono style={{fontSize:12,color:C.muted}}>min</Mono>
                <input type="number" placeholder="lvl"
                  value={rowLog.level||""}
                  onChange={e=>logSet(ex.name,n,"level",e.target.value)}
                  onFocus={()=>{if(isPrepop)setLoggedSets(prev=>({...prev,[ex.name]:{...prev[ex.name],[n]:{...prev[ex.name]?.[n],prepop:false}}}));}}
                  style={{...inputStyle,flex:1,fontSize:16,fontWeight:600,textAlign:"center",color:setRowState==="suggested"?C.muted:C.text,fontStyle:setRowState==="suggested"?"italic":"normal",background:setRowState==="inprogress"?C.accent+"12":C.surface}}/>
                <Mono style={{fontSize:12,color:C.muted}}>lvl</Mono>
                {intervalKeys.length>1&&<button onClick={()=>{
                  setLoggedSets(prev=>{
                    const updated={...prev};
                    if(updated[ex.name]){const row={...updated[ex.name]};delete row[n];updated[ex.name]=row;}
                    return updated;
                  });
                  setSetStates(prev=>{const next={...prev};delete next[rowKey];return next;});
                }} style={{padding:"8px 10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,cursor:"pointer",fontSize:14,fontWeight:700}}>
                  ✕
                </button>}
                <button onClick={()=>{
                  const placeholderMins=(ex.reps||"").match(/\d+/)?.[0]||"";
                  const effectiveMins=rowLog.minutes||placeholderMins;
                  if(!effectiveMins){setSetError(prev=>({...prev,[ex.name]:"Enter minutes first"}));return;}
                  setSetError(prev=>({...prev,[ex.name]:""}));
                  setLoggedSets(prev=>({...prev,[ex.name]:{...(prev[ex.name]||{}),[n]:{...prev[ex.name]?.[n],minutes:effectiveMins,level:rowLog.level||"",done:true,prepop:false}}}));
                  setSetStates(prev=>({...prev,[rowKey]:"confirmed"}));
                  const draftSets={...loggedSets,[ex.name]:{...(loggedSets[ex.name]||{}),[n]:{...loggedSets[ex.name]?.[n],minutes:effectiveMins,level:rowLog.level||"",done:true,prepop:false}}};
                  saveDraft(draftSets);
                  const allConfirmed=intervalKeys.every(k=>{const rk=ex.id+"-"+k;return rk===rowKey||setStates[rk]==="confirmed";});
                  if(allConfirmed)markExerciseDone(ex.id,ex.name,false);
                }} aria-label="Confirm interval" style={{padding:"9px 14px",background:"transparent",border:`1px solid ${C.neon}44`,borderRadius:7,color:C.neonInk,cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={ICON.md} strokeWidth={1.75}/></button>
              </div>;
            })}
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <Btn size="sm" variant="ghost" C={C} onClick={()=>{
                const nextNum=Math.max(0,...intervalKeys)+1;
                setLoggedSets(prev=>({...prev,[ex.name]:{...(prev[ex.name]||{}),[nextNum]:{minutes:"",level:"",prepop:false}}}));
              }} style={{fontSize:11,color:C.neonInk,borderColor:C.neon+"44"}}>+ Add Interval</Btn>
            </div>
          </div>}

          {/* STRENGTH: sets × weight × reps */}
          {!isCardio&&<div style={{display:"grid",gridTemplateColumns:"28px 24px 1fr 1fr 34px",gap:"4px 8px",alignItems:"center"}}>
            <div/>
            <Mono style={{fontSize:9,color:C.muted}}>#</Mono>
            <Mono style={{fontSize:9,color:C.muted}}>WEIGHT</Mono>
            <Mono style={{fontSize:9,color:C.muted}}>REPS</Mono>
            <div/>
            {Array.from({length:numSets},(_,i)=>i+1).map(n=>{
              const typ=(setTypes[ex.name]?.[n])||"working";
              const typeLabel=typ==="warmup"?"W":typ==="working"?"S":typ==="drop"?"D":"F";
              const typeColor=typ==="warmup"?C.muted:typ==="working"?C.accent:typ==="drop"?C.gold:C.red;
              const isPrepop=!!myLog[n]?.prepop;
              const stateKey=ex.id+"-"+n;
              const isConfirmed=setStates[stateKey]==="confirmed";
              const hasVal=!!(myLog[n]?.weight||myLog[n]?.reps);
              const setRowState=isConfirmed?"confirmed":isPrepop?"suggested":hasVal?"inprogress":"suggested";
              return [
                <button key={`t${n}`} onClick={()=>cycleSetType(ex.name,n)} style={{padding:"3px 0",background:typeColor+"22",border:"none",borderRadius:4,color:typeColor,fontSize:9,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"center",letterSpacing:"0.05em"}}>{typeLabel}</button>,
                ...(isConfirmed
                  ?[<div key={`confirmed${n}`} onClick={()=>{setSetStates(prev=>{const u={...prev};delete u[stateKey];return u;});}} style={{gridColumn:"span 4",background:C.neon+"12",border:`1px solid ${C.neon}22`,borderRadius:6,display:"flex",alignItems:"center",gap:8,padding:"8px 10px",cursor:"pointer"}}>
                      <span style={{color:C.neonInk,display:"inline-flex",alignItems:"center"}}><Check size={ICON.sm} strokeWidth={1.75}/></span>
                      <Mono style={{color:C.neonInk,fontSize:12,fontWeight:700}}>{n}</Mono>
                      <Mono style={{color:C.text,fontSize:13,fontWeight:600,flex:1}}>{myLog[n]?.weight} lbs × {myLog[n]?.reps}</Mono>
                      <Mono style={{color:C.muted,fontSize:11}}>tap to edit</Mono>
                    </div>]
                  :[
                    <Mono key={`n${n}`} style={{fontSize:12,color:setRowState==="inprogress"?C.text:C.muted,textAlign:"center",fontWeight:setRowState==="inprogress"?700:400}}>{n}</Mono>,
                    <input key={`w${n}`} type="number" placeholder={last?.[n]?.weight||"lbs"} value={myLog[n]?.weight||""} onChange={e=>logSet(ex.name,n,"weight",e.target.value)} onFocus={()=>{if(isPrepop)setLoggedSets(prev=>({...prev,[ex.name]:{...prev[ex.name],[n]:{...prev[ex.name]?.[n],prepop:false}}}));}} style={{...inputStyle,color:setRowState==="suggested"?C.muted:C.text,fontStyle:setRowState==="suggested"?"italic":"normal",background:setRowState==="inprogress"?C.accent+"12":C.surface}}/>,
                    <input key={`r${n}`} type="number" placeholder={last?.[n]?.reps||"reps"} value={myLog[n]?.reps||""} onChange={e=>logSet(ex.name,n,"reps",e.target.value)} onFocus={()=>{if(isPrepop)setLoggedSets(prev=>({...prev,[ex.name]:{...prev[ex.name],[n]:{...prev[ex.name]?.[n],prepop:false}}}));}} style={{...inputStyle,color:setRowState==="suggested"?C.muted:C.text,fontStyle:setRowState==="suggested"?"italic":"normal",background:setRowState==="inprogress"?C.accent+"12":C.surface}}/>,
                    <button key={`d${n}`} onClick={()=>{
                      const w=myLog[n]?.weight;
                      const r=myLog[n]?.reps;
                      if(!w||!r){setSetError(prev=>({...prev,[ex.name]:"Enter weight and reps first"}));return;}
                      setSetError(prev=>({...prev,[ex.name]:""}));
                      lastActiveExRef.current=ex.name;
                      const isWarmup=typ==="warmup";
                      const draftSets={...loggedSets,[ex.name]:{...loggedSets[ex.name],[n]:{weight:w,reps:r,prepop:false}}};
                      saveDraft(draftSets);
                      setLoggedSets(prev=>{
                        const cur=prev[ex.name]||{};
                        const updated={...cur,[n]:{...cur[n],prepop:false}};
                        for(let i=n+1;i<=numSets;i++){if(cur[i]?.prepop){updated[i]={...cur[i],weight:w,reps:r};}else if(!cur[i]?.weight&&!cur[i]?.reps){updated[i]={weight:w,reps:r,prepop:true};}}
                        return {...prev,[ex.name]:updated};
                      });
                      setSetStates(prev=>({...prev,[stateKey]:"confirmed"}));
                      const myL=draftSets[ex.name]||{};
                      const allFilled=Array.from({length:numSets},(_,i)=>i+1).every(s=>myL[s]?.weight&&myL[s]?.reps);
                      if(n===numSets&&allFilled){markExerciseDone(ex.id,ex.name,!isWarmup);}
                      // REST TIMER: only triggered here, on explicit set confirmation
                      else if(!isWarmup){setShowRest(true);setRestKey(k=>k+1);setTimeout(()=>restAnchorRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);}
                    }} aria-label="Confirm set" style={{padding:"9px 4px",background:"transparent",border:`1px solid ${C.neon}44`,borderRadius:7,color:C.neonInk,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={ICON.md} strokeWidth={1.75}/></button>
                  ])
              ];
            })}
          </div>}
          {!isCardio&&<button onClick={()=>setExtraSets(prev=>({...prev,[ex.name]:(prev[ex.name]||0)+1}))} style={{marginTop:6,padding:"5px 10px",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:6,color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>+ SET</button>}
          {setError[ex.name]&&<Mono style={{fontSize:11,color:C.redInk,display:"block",marginTop:4}}>{setError[ex.name]}</Mono>}
        </div>;
      })}

      {/* Add exercise inline button */}
      <button onClick={()=>setAddExModal(true)} style={{width:"100%",padding:"12px",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:10,color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12,cursor:"pointer",marginBottom:10,letterSpacing:"0.08em"}}>
        + ADD EXERCISE
      </button>

      {settings.workoutNotes&&<div style={{marginTop:4}}>
        <SectionLabel C={C}>Session Notes</SectionLabel>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Energy, joints, anything notable..."
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:16,fontFamily:C.serif,height:72,resize:"none",boxSizing:"border-box"}}/>
      </div>}
      {saveError&&<div style={{background:"#f06584",padding:"12px 14px",borderRadius:8,marginTop:14}}>
        <Mono style={{fontSize:12,color:"#fff",fontWeight:700,display:"block",marginBottom:8}}>⚠ {saveError}</Mono>
        <Btn onClick={finish} size="sm" C={C} style={{background:"rgba(255,255,255,0.25)",color:"#fff",border:"1px solid rgba(255,255,255,0.5)",width:"100%"}}>Retry</Btn>
      </div>}
      <Btn onClick={finish} disabled={saving} size="lg" C={C} style={{width:"100%",marginTop:14,background:saving?C.card:C.neon,color:saving?C.muted:"#fff",fontWeight:800,letterSpacing:"0.1em",fontSize:15}}>{saving?"SAVING...":<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}>COMPLETE WORKOUT <Check size={ICON.md} strokeWidth={1.75}/></span>}</Btn>
    </div>

    {/* Swap exercise modal */}
    {showEndMenu&&<div onClick={()=>setShowEndMenu(false)} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"16px 16px 0 0",padding:"20px 18px calc(32px + env(safe-area-inset-bottom,0px)) 18px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{width:36,height:4,borderRadius:2,background:C.border,alignSelf:"center",marginTop:-8,marginBottom:4}}/>
        <Mono style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>END WORKOUT</Mono>
        <button onClick={()=>{setShowEndMenu(false);finish();}} disabled={saving} style={{width:"100%",padding:"13px 16px",background:C.neon+"22",border:`1px solid ${C.neon}44`,borderRadius:10,color:C.neonInk,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:saving?"not-allowed":"pointer",textAlign:"left",letterSpacing:"0.04em",opacity:saving?0.5:1}}><span style={{display:"inline-flex",alignItems:"center",gap:8}}><Check size={ICON.md} strokeWidth={1.75}/>Complete Workout</span></button>
        <button onClick={()=>{setShowEndMenu(false);savePartialAndExit();}} disabled={saving} style={{width:"100%",padding:"13px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:saving?"not-allowed":"pointer",textAlign:"left",letterSpacing:"0.04em",opacity:saving?0.5:1}}>↓ Save & Exit</button>
        <button onClick={()=>{setShowEndMenu(false);setShowAbandonConfirm(true);}} style={{width:"100%",padding:"13px 16px",background:C.red+"11",border:`1px solid ${C.red}44`,borderRadius:10,color:C.redInk,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}>✕ Abandon</button>
        <button onClick={()=>setShowEndMenu(false)} style={{width:"100%",padding:"11px 16px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",letterSpacing:"0.04em",marginTop:2}}>Cancel</button>
      </div>
    </div>}

    {showAbandonConfirm&&<div onClick={()=>setShowAbandonConfirm(false)} style={{position:"fixed",inset:0,zIndex:201,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,padding:"24px 20px",width:"100%",maxWidth:320}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Abandon workout?</div>
        <Mono style={{fontSize:13,color:C.muted,display:"block",marginBottom:20,lineHeight:1.6}}>All logged sets will be lost.</Mono>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>setShowAbandonConfirm(false)} variant="ghost" C={C} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={abandonWorkout} variant="danger" C={C} style={{flex:1,background:C.red,color:"#fff",fontWeight:800}}>Abandon</Btn>
        </div>
      </div>
    </div>}

    {swapModal&&<SwapExerciseModal exercise={swapModal} settings={settings} onSwap={(newData)=>swapExercise(swapModal,newData)} onClose={()=>setSwapModal(null)} cachedSuggestions={swapCache[swapModal.name]||null} onCacheSuggestions={(name,data)=>setSwapCache(prev=>({...prev,[name]:data}))} C={C}/>}

    {/* Add exercise modal */}
    {addExModal&&<ExerciseLibraryModal onSelect={addExercise} onClose={()=>setAddExModal(false)} C={C}/>}

    {/* Edit exercise modal */}
    {editExModal&&<Modal onClose={()=>setEditExModal(null)} C={C}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Edit Exercise</div>
      <ExerciseForm title="" initial={editExModal}
        onSave={(data)=>updateExercise(editExModal.id,data)} onClose={()=>setEditExModal(null)} C={C}/>
    </Modal>}

    {aiModal&&<AIModal exercise={aiModal} settings={settings} onClose={()=>setAiModal(null)} C={C}/>}
  </div>;
}

// -- UPGRADE PROMPT ------------------------------------------------------------
const AI_ACTION_NAMES={exercise_swap:"Exercise Swaps",sequence_opt:"AI Sequences",plan_builder:"AI Plan Builds",coach_insight:"AI Coach Insights"};
function UpgradePrompt({action,used,limit,C}){
  const name=AI_ACTION_NAMES[action]||"AI uses";
  return<div style={{background:C.gold+"18",border:`1px solid ${C.gold}40`,borderRadius:10,padding:"20px",textAlign:"center"}}>
    <div style={{fontSize:24,marginBottom:8}}>⭐</div>
    <div style={{fontSize:14,fontWeight:700,marginBottom:6,color:C.text}}>Free limit reached</div>
    <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:8}}>{used}/{limit} {name} used this month</Mono>
    <Mono style={{fontSize:12,color:C.text,display:"block",marginBottom:4}}>Upgrade to Pro for unlimited AI</Mono>
    <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>$2.99/mo · $19.99/yr · $49.99 lifetime</Mono>
    <Mono style={{fontSize:10,color:C.muted,display:"block",marginTop:8}}>Subscriptions launching soon</Mono>
  </div>;
}

// -- SWAP EXERCISE MODAL -------------------------------------------------------
function SwapExerciseModal({exercise,settings,onSwap,onClose,cachedSuggestions,onCacheSuggestions,C}){
  const [query,setQuery]=useState("");
  const [aiSuggestions,setAiSuggestions]=useState(cachedSuggestions||[]);
  const [loadingAI,setLoadingAI]=useState(false);
  const [swapUpgrade,setSwapUpgrade]=useState(null);
  const [custom,setCustom]=useState({name:"",sets:exercise.sets,reps:exercise.reps,note:"",muscle:exercise.muscle||""});
  const [tab,setTab]=useState("ai"); // ai | custom

  useEffect(()=>{ if(!cachedSuggestions)loadAISuggestions(); },[]);// eslint-disable-line react-hooks/exhaustive-deps

  async function loadAISuggestions(){
    setLoadingAI(true);
    const prompt=`You are a personal trainer. Suggest 6 alternative exercises to swap for "${exercise.name}" (muscle: ${exercise.muscle||"unknown"}).${aiProfileContext(settings)}
Requirements: joint-friendly, similar muscle group, gym equipment available.
Return ONLY a JSON array of objects: [{"name":"Exercise Name","sets":"3","reps":"10-12","note":"brief reason","muscle":"${exercise.muscle||""}"}]
No markdown, no explanation, just the array.`;
    try{
      const data=await callAI({action:"exercise_swap",messages:[{role:"user",content:prompt}],maxTokens:600});
      if(data.upgradeRequired){setSwapUpgrade(data);setLoadingAI(false);return;}
      const text=data.content?.find(b=>b.type==="text")?.text||"[]";
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      setAiSuggestions(parsed);
      if(onCacheSuggestions)onCacheSuggestions(exercise.name,parsed);
    }catch{
      setAiSuggestions([
        {name:"Cable Lateral Raise",sets:exercise.sets,reps:exercise.reps,note:"Constant tension, joint-friendly",muscle:exercise.muscle||""},
        {name:"Machine Fly",sets:exercise.sets,reps:exercise.reps,note:"Great isolation, easy on shoulders",muscle:exercise.muscle||""},
        {name:"Face Pull",sets:exercise.sets,reps:exercise.reps,note:"Excellent shoulder health move",muscle:exercise.muscle||""},
      ]);
    }
    setLoadingAI(false);
  }

  const filtered=aiSuggestions.filter(s=>!query||s.name.toLowerCase().includes(query.toLowerCase()));

  return <Modal onClose={onClose} C={C} showClose={false}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>⇄ Swap Exercise</div>
        <Mono style={{fontSize:11,color:C.muted}}>Replacing: {exercise.name}</Mono>
      </div>
      <Btn variant="ghost" size="sm" onClick={onClose} C={C}>✕</Btn>
    </div>

    {/* Tab switcher */}
    <div style={{display:"flex",gap:6,background:C.card,padding:4,borderRadius:8,marginBottom:14}}>
      {[["ai","✦ AI Suggestions"],["custom","Custom"]].map(([k,label])=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:tab===k?C.accentBtn:"transparent",color:tab===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer"}}>
          {label}
        </button>
      ))}
    </div>

    {tab==="ai"&&<div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter suggestions..."
        style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",marginBottom:10}}/>
      {swapUpgrade?<UpgradePrompt {...swapUpgrade} C={C}/>
        :loadingAI?<div style={{textAlign:"center",padding:"24px",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Finding alternatives...</div>
        :filtered.map((s,i)=>(
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px",marginBottom:8,cursor:"pointer"}} onClick={()=>onSwap(s)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{s.name}</div>
                <Mono style={{fontSize:11,color:C.muted}}>{s.sets} sets . {s.reps}{s.muscle?` . ${s.muscle}`:""}</Mono>
                {s.note&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{s.note}</div>}
              </div>
              <Btn size="sm" C={C} style={{marginLeft:10,flexShrink:0}} onClick={(e)=>{e.stopPropagation();onSwap(s);}}>Swap</Btn>
            </div>
          </div>
        ))}
    </div>}

    {tab==="custom"&&<div>
      {[["Exercise Name","name","text"],["Sets","sets","text"],["Reps","reps","text"],["Muscle Group","muscle","text"],["Note","note","text"]].map(([label,key])=>(
        <div key={key} style={{marginBottom:10}}>
          <SectionLabel C={C}>{label}</SectionLabel>
          <input value={custom[key]||""} onChange={e=>setCustom(p=>({...p,[key]:e.target.value}))}
            style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
        </div>
      ))}
      <Btn style={{width:"100%",marginTop:6}} C={C} onClick={()=>onSwap(custom)} disabled={!custom.name.trim()}>Swap In</Btn>
    </div>}
  </Modal>;
}

// -- PLAN ERROR BOUNDARY -------------------------------------------------------
class PlanErrorBoundary extends Component{
  constructor(p){super(p);this.state={hasError:false};}
  static getDerivedStateFromError(){return{hasError:true};}
  componentDidCatch(e,info){console.error("PlanTab error:",e,info);}
  render(){
    if(this.state.hasError){
      const C=this.props.C;
      return <div style={{padding:"40px 20px",textAlign:"center"}}>
        <div style={{fontSize:15,fontWeight:700,color:C.redInk,marginBottom:8}}>Plan editor error</div>
        <Mono style={{fontSize:12,color:C.muted,display:"block",marginBottom:16}}>Something went wrong. Tap Retry to reload the editor.</Mono>
        <button onClick={()=>this.setState({hasError:false})} style={{padding:"10px 20px",borderRadius:8,border:"none",background:C.accentBtn,color:"#fff",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",fontWeight:700}}>Retry</button>
      </div>;
    }
    return this.props.children;
  }
}

// -- PLAN TAB ------------------------------------------------------------------
function PlanAnalysisView({plan,goalRaw,C,onBack}){
  const [openGroups,setOpenGroups]=useState({});
  const [showSources,setShowSources]=useState(false);
  const a=analyzePlan(plan,{goal:goalRaw});
  const mono="'SF Mono','Courier New',monospace";
  const byGroup={}; a.perGroup.forEach(g=>{byGroup[g.group]=g;});
  const STATUS={under:{t:"under",c:C.dangerInk},maintenance:{t:"maintenance",c:C.muted},in_range:{t:"in range",c:C.neonInk},high:{t:"high",c:C.goldInk},mixed:{t:"mixed",c:C.blueInk}};
  const Chip=({status})=>{const s=STATUS[status]||STATUS.in_range;return <span style={{fontFamily:mono,fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:s.c,border:`1px solid ${s.c}55`,borderRadius:999,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0}}>{s.t}</span>;};
  const band=(b)=>`${b[0]}–${b[1]}`;
  // Group headline is qualitative (status is evidence-gated, no summed-band target); the
  // actionable / evidence-tier copy lives at the fine level on expand.
  const groupLines=(row)=>{const out=[];
    if(row.status==="under")out.push("Below the productive range on a key muscle — expand for which and how much.");
    else if(row.status==="high")out.push("Over the productive range on a key muscle — added volume gives diminishing returns; watch recovery.");
    else if(row.status==="mixed"){
      const lo=row.fineMuscles.filter(m=>m.evidenceTier!=="low"&&(m.status==="under"||m.status==="maintenance")).map(m=>m.muscle);
      const hi=row.fineMuscles.filter(m=>m.evidenceTier!=="low"&&m.status==="high").map(m=>m.muscle);
      out.push(`${lo.join(" & ")} ${lo.length>1?"are":"is"} below range and ${hi.join(" & ")} ${hi.length>1?"are":"is"} above — expand for detail.`);
    }
    else if(row.status==="in_range")out.push("In range.");
    if(row.frequencyFlag)out.push("Hitting volume in one day — splitting across 2 days usually works better.");
    if(row.sessionFlag)out.push("High single-session load — consider redistributing.");
    return out;
  };
  const fineLines=(m)=>{const out=[];
    if(m.status==="under"||m.status==="maintenance"){
      if(m.evidenceTier==="low")out.push("Below typical range, though the evidence here is limited.");
      else{const add=Math.min(4,Math.max(2,Math.ceil(m.band[0]-m.weeklySets)));out.push(`~${add} more sets/week or a second day would close it.`);}
    }else if(m.status==="high")out.push("Above the productive range — watch recovery.");
    return out;
  };
  const balanced=a.summary.underCount===0&&a.summary.highCount===0&&a.summary.flagged.length===0;
  const Header=(
    <div style={{background:C.bg,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px 14px"}}>
      <button onClick={onBack} aria-label="Back to plan" style={{display:"inline-flex",alignItems:"center",gap:5,background:"transparent",border:"none",color:C.accentInk,fontFamily:mono,fontSize:13,fontWeight:600,cursor:"pointer",padding:0,marginBottom:10}}><ChevronLeft size={ICON.sm} strokeWidth={1.75}/>Plan</button>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em",marginBottom:4}}>Plan Analysis</div>
      <Mono style={{fontSize:11,color:C.muted,display:"block",lineHeight:1.5}}>Planned weekly working sets vs. evidence-based ranges.{a.goalDefaulted?" Assuming a hypertrophy goal.":""}</Mono>
    </div>
  );
  // STRENGTH — coarse, lift-driven guidance (no per-muscle bands).
  if(a.goal==="strength"){
    return <div>
      {Header}
      <div style={{padding:"14px 18px"}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:14}}>
          <SectionLabel C={C}>Strength goal — coarse guidance</SectionLabel>
          <Mono style={{fontSize:12,color:C.muted,lineHeight:1.7,display:"block"}}>Strength is lift-specific: train your key lifts 2–3×/week, keep most sets heavy and 1–2 reps from failure, and aim ~6–12 working sets on the primary movers. Per-muscle set totals matter far less than for hypertrophy — don't over-index on them.</Mono>
        </div>
        <SectionLabel C={C}>Planned weekly sets by group</SectionLabel>
        {DISPLAY_GROUPS.map(group=>{const g=byGroup[group];return <div key={group} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 2px",borderBottom:`1px solid ${C.border}`}}>
          <Mono style={{fontSize:12,color:g?C.text:C.faint}}>{group}</Mono>
          <Mono style={{fontSize:11,color:g?C.muted:C.faint}}>{g?`${g.weeklySets} sets`:"— not in plan"}</Mono>
        </div>;})}
        <Mono style={{fontSize:10,color:C.faint,display:"block",marginTop:12,lineHeight:1.6}}>Working-set proxy: counts planned non-warmup sets, not RIR-verified hard sets.</Mono>
      </div>
    </div>;
  }
  // HYPERTROPHY — per-group bands, expandable to fine muscles.
  return <div>
    {Header}
    <div style={{padding:"14px 18px"}}>
      {balanced&&<div style={{background:C.neon+"12",border:`1px solid ${C.neon}40`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
        <Mono style={{fontSize:12,color:C.neonInk,fontWeight:700}}>Balanced — no volume changes suggested.</Mono>
      </div>}
      {DISPLAY_GROUPS.map(group=>{
        const g=byGroup[group];
        if(!g)return <div key={group} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 2px",borderBottom:`1px solid ${C.border}`}}>
          <Mono style={{fontSize:13,color:C.faint}}>{group}</Mono><Mono style={{fontSize:10,color:C.faint}}>not in plan</Mono>
        </div>;
        const expanded=!!openGroups[group];
        return <div key={group} style={{borderBottom:`1px solid ${C.border}`,padding:"10px 0"}}>
          <div onClick={()=>setOpenGroups(p=>({...p,[group]:!p[group]}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
            <span style={{color:C.faint,display:"inline-flex",flexShrink:0}}>{expanded?<ChevronDown size={ICON.sm} strokeWidth={1.75}/>:<ChevronRight size={ICON.sm} strokeWidth={1.75}/>}</span>
            <Mono style={{fontSize:13,color:C.text,fontWeight:600,flex:1}}>{group}</Mono>
            <Mono style={{fontSize:11,color:C.muted}}>{g.weeklySets} sets</Mono>
            <button onClick={e=>{e.stopPropagation();setShowSources(true);}} aria-label="See sources" style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontFamily:mono,fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",padding:"2px 7px",cursor:"pointer",flexShrink:0}}>sources</button>
            <Chip status={g.status}/>
          </div>
          {groupLines(g).map((ln,i)=><Mono key={i} style={{fontSize:11,color:C.muted,display:"block",marginTop:5,marginLeft:24,lineHeight:1.5}}>{ln}</Mono>)}
          {expanded&&<div style={{marginLeft:24,marginTop:8}}>
            {g.fineMuscles.map(m=><div key={m.muscle} style={{padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Mono style={{fontSize:11,color:C.muted,flex:1}}>{m.muscle}{m.evidenceTier==="low"?" · limited evidence":""}</Mono>
                <Mono style={{fontSize:10,color:C.faint}}>{m.weeklySets} · {band(m.band)}</Mono>
                <Chip status={m.status}/>
              </div>
              {fineLines(m).map((ln,i)=><Mono key={i} style={{fontSize:10,color:C.faint,display:"block",marginTop:3,lineHeight:1.5}}>{ln}</Mono>)}
            </div>)}
          </div>}
        </div>;
      })}
      <Mono style={{fontSize:10,color:C.faint,display:"block",marginTop:14,lineHeight:1.6}}>Working-set proxy: counts planned non-warmup sets, not RIR-verified hard sets; ranges assume sets ~0–3 reps from failure. Ranges are per muscle (on expand); tap “sources” for citations.</Mono>
    </div>
    {showSources&&<Modal onClose={()=>setShowSources(false)} C={C}>
      <SectionLabel C={C}>Sources</SectionLabel>
      {volumeGuidelines.citations.map(c=><div key={c.id} style={{marginBottom:10}}>
        <Mono style={{fontSize:11,color:C.text,display:"block",lineHeight:1.5}}>{c.ref}</Mono>
        <Mono style={{fontSize:10,color:C.accentInk,display:"block",marginTop:2}}>{c.tier}</Mono>
      </div>)}
      <Mono style={{fontSize:10,color:C.muted,display:"block",marginTop:8,lineHeight:1.6}}>Evidence tiers: high (peer-reviewed), moderate, low (practitioner extrapolation — softer copy). The 0.5 secondary-muscle factor is a modeling convention, not a measured value.</Mono>
    </Modal>}
  </div>;
}

function PlanTab({plans,activePlanKey,setActivePlanKey,savePlans,settings,C,toggleTheme,themeMode}){
  const [view,setView]=useState("mine"); // mine | presets | ai
  const [expandedDay,setExpandedDay]=useState(null);
  const [editEx,setEditEx]=useState(null);
  const [addExDay,setAddExDay]=useState(null);
  const [addDayModal,setAddDayModal]=useState(false);
  const [aiModal,setAiModal]=useState(null);
  const [deletingDay,setDeletingDay]=useState(null);
  const [presetPreview,setPresetPreview]=useState(null);
  const [goalModal,setGoalModal]=useState(false);
  const [sequencingDay,setSequencingDay]=useState(null); // dayId being AI-sequenced
  const [sequenceUpgrade,setSequenceUpgrade]=useState(null);
  const [dayReorderMode,setDayReorderMode]=useState(false);
  const [reorderMode,setReorderMode]=useState(null); // dayId in manual reorder mode
  const [saveSheet,setSaveSheet]=useState(null); // dayId while save options sheet is open
  const [saveToast,setSaveToast]=useState("");
  const [newPlanSheet,setNewPlanSheet]=useState(false); // true when showing name-input step
  const [newPlanName,setNewPlanName]=useState("");
  const [startPlanModal,setStartPlanModal]=useState(null);
  const [modalStartDate,setModalStartDate]=useState("");
  const [modalDuration,setModalDuration]=useState(10);
  const [analysisOpen,setAnalysisOpen]=useState(false);

  const plan=plans[activePlanKey];
  const days=plan?.days||[];
  const startDOW=parsePlanDate(plan?.startDate)?.getDay()??null;
  const slotWeekday=i=>startDOW!==null?DOW[(startDOW+i)%7]:null;

  function updatePlan(updatedDays){savePlans({...plans,[activePlanKey]:{...plan,days:updatedDays}});}
  function saveExercise(dayId,ex){updatePlan(days.map(d=>d.id!==dayId?d:{...d,exercises:d.exercises.map(e=>e.id===ex.id?ex:e)}));}
  function deleteExercise(dayId,exId,exName){
    updatePlan(days.map(d=>{
      if(d.id!==dayId)return d;
      const filtered=d.exercises.filter(e=>e.id!==exId&&e.name!==exName);
      // If nothing was removed by id, try name-only match as fallback
      return {...d,exercises:filtered.length<d.exercises.length?filtered:d.exercises.filter(e=>e.name!==exName)};
    }));
  }
  function addExercise(dayId,ex){updatePlan(days.map(d=>d.id!==dayId?d:{...d,exercises:[...d.exercises,{...ex,id:mkId()}]}));}
  function deleteDay(dayId){updatePlan(days.filter(d=>d.id!==dayId));setDeletingDay(null);setExpandedDay(null);}
  function addDay(data){updatePlan([...days,{...data,id:mkId(),exercises:[]}]);setAddDayModal(false);}

  function reorderExercises(dayId,fromIdx,toIdx){
    const day=days.find(d=>d.id===dayId);
    if(!day)return;
    const exs=[...day.exercises];
    const [moved]=exs.splice(fromIdx,1);
    exs.splice(toIdx,0,moved);
    updatePlan(days.map(d=>d.id!==dayId?d:{...d,exercises:exs}));
  }

  function reorderDay(fromIdx,toIdx){
    if(toIdx<0||toIdx>=days.length)return;
    const nd=[...days];
    const[moved]=nd.splice(fromIdx,1);
    nd.splice(toIdx,0,moved);
    updatePlan(nd);
  }

  async function aiSequenceDay(day){
    setSequencingDay(day.id);
    const prompt=`You are an expert personal trainer. Reorder these exercises for optimal workout sequencing -- compound lifts first, isolation second, abs and cardio last. Consider muscle fatigue, joint stress, and training science.
Exercises: ${day.exercises.map((e,i)=>`${i+1}. ${e.name} (${e.muscle||"unknown"})`).join(", ")}
Return ONLY a JSON array of exercise names in the optimal order. Example: ["Bench Press","Incline Press","Cable Fly","Machine Crunch"]
No explanation, no markdown, just the JSON array.`;
    try{
      const data=await callAI({action:"sequence_opt",messages:[{role:"user",content:prompt}],maxTokens:300});
      if(data.upgradeRequired){setSequenceUpgrade(data);setSequencingDay(null);return;}
      const text=data.content?.find(b=>b.type==="text")?.text||"[]";
      const ordered=JSON.parse(text.replace(/```json|```/g,"").trim());
      const reordered=[];
      for(const name of ordered){
        const found=day.exercises.find(e=>e.name===name);
        if(found)reordered.push(found);
      }
      // append any not matched
      for(const e of day.exercises){ if(!reordered.find(r=>r.id===e.id))reordered.push(e); }
      updatePlan(days.map(d=>d.id!==day.id?d:{...d,exercises:reordered}));
    }catch(e){
      // fallback: basic muscle-group sort
      const order=["Chest","Back","Legs","Shoulders","Biceps","Triceps","Abs","Cardio","Recovery"];
      const sorted=[...day.exercises].sort((a,b)=>{
        const ai=order.indexOf(a.muscle||"");
        const bi=order.indexOf(b.muscle||"");
        return(ai===-1?99:ai)-(bi===-1?99:bi);
      });
      updatePlan(days.map(d=>d.id!==day.id?d:{...d,exercises:sorted}));
    }
    setSequencingDay(null);
  }

  function loadPreset(template,startDate,durationWeeks){
    const newKey=`preset_${Date.now()}`;
    const newPlan={
      key:newKey, name:template.name, subtitle:template.tag, description:template.desc,
      startDate:startDate||new Date().toLocaleDateString("en-CA"),
      durationWeeks:durationWeeks||10,
      days:template.days.map((d,i)=>({...d,id:mkId(),exercises:(d.exercises||[]).map(e=>({...e,id:mkId()}))}))
    };
    savePlans({...plans,[newKey]:newPlan});
    setActivePlanKey(newKey);
    setView("mine");
    setPresetPreview(null);
    setStartPlanModal(null);
  }

  function addAIPlan(generatedPlan){
    const newKey=`ai_${Date.now()}`;
    const today=new Date().toLocaleDateString("en-CA");
    savePlans({...plans,[newKey]:{...generatedPlan,startDate:today,durationWeeks:10}});
    setActivePlanKey(newKey);
    setView("mine");
    setGoalModal(false);
  }

  function saveAsNewPlan(){
    const name=(newPlanName.trim())||("Custom - "+(plan?.name||"Plan")+" (modified)");
    const newKey=`custom_${Date.now()}`;
    const newPlan={
      key:newKey, name, subtitle:plan?.subtitle||"", description:plan?.description||"",
      startDate:plan?.startDate||new Date().toLocaleDateString("en-CA"),
      durationWeeks:plan?.durationWeeks||10,
      days:days.map(d=>({...d,exercises:d.exercises.map(e=>({...e,id:mkId()}))}))
    };
    savePlans({...plans,[newKey]:newPlan});
    setActivePlanKey(newKey);
    setSaveToast(`New plan "${name}" created and activated`);
    setTimeout(()=>setSaveToast(""),3000);
    setSaveSheet(null);
    setNewPlanSheet(false);
    setNewPlanName("");
    setExpandedDay(null);
  }

  if(analysisOpen&&plan&&settings.showPlanAnalysis&&settings.showCoaching)return <PlanAnalysisView plan={plan} goalRaw={(settings.aiGoal||"").toLowerCase()} C={C} onBack={()=>setAnalysisOpen(false)}/>;

  return <div>
    <div style={{background:C.bg,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Plan Editor</div>
        <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 11px",fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>{themeMode==="dark"?<Moon size={ICON.md} strokeWidth={1.75}/>:<Sun size={ICON.md} strokeWidth={1.75}/>}{themeMode==="dark"?"DARK":"LIGHT"}</button>
      </div>
      {/* View switcher */}
      <div style={{display:"flex",gap:6,marginBottom:10,background:C.card,padding:4,borderRadius:10}}>
        {[["mine","My Plans"],["presets","Templates"],["ai","✦ AI Builder"]].map(([k,label])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:view===k?C.accentBtn:"transparent",color:view===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:"0.04em"}}>
            {label}
          </button>
        ))}
      </div>
      {view==="mine"&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.keys(plans).map(k=>(
          <button key={k} onClick={()=>setActivePlanKey(k)} style={{padding:"5px 11px",borderRadius:6,fontFamily:"'SF Mono','Courier New',monospace",fontSize:10,cursor:"pointer",border:activePlanKey===k?"none":`1px solid ${C.border}`,background:activePlanKey===k?C.accentBtn:"transparent",color:activePlanKey===k?"#fff":C.muted}}>
            {plans[k]?.name||plans[k]?.name?.slice(0,18)}
          </button>
        ))}
      </div>}
    </div>

    {saveToast&&<div style={{background:C.neon,padding:"10px 18px",textAlign:"center"}}>
      <Mono style={{fontSize:12,color:"#0b0c0e",fontWeight:700}}>{saveToast}</Mono>
    </div>}
    {/* MY PLANS */}
    {view==="mine"&&<div style={{padding:"14px 18px"}}>
      {!plan&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>No plan yet</div>
        <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:14}}>Go to Templates to pick a plan and get started.</Mono>
        <button onClick={()=>setView("presets")} style={{padding:"10px 20px",borderRadius:8,border:"none",background:C.accentBtn,color:"#fff",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,cursor:"pointer"}}>Browse Templates</button>
      </div>}
      {plan&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em"}}>PLAN SCHEDULE</Mono>
          {(()=>{const wk=planWeekOf(plan);const tot=plan?.durationWeeks||10;return wk?<Mono style={{fontSize:10,color:wk>tot?C.goldInk:C.accentInk,fontWeight:700}}>{wk>tot?`COMPLETE`:`WEEK ${wk} OF ${tot}`}</Mono>:null;})()}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>
            <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4}}>START DATE</Mono>
            <div style={{position:"relative"}}>
              <div style={{padding:"9px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",color:plan?.startDate?C.text:C.faint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"pointer",userSelect:"none"}}>
                {plan?.startDate?(()=>{const[y,m,d]=plan.startDate.split("-");return new Date(+y,+m-1,+d).toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"});})():"Tap to set"}
              </div>
              <input type="date" value={plan?.startDate||""} onChange={e=>savePlans({...plans,[activePlanKey]:{...plan,startDate:e.target.value}})}
                style={{position:"absolute",inset:0,opacity:0,width:"100%",height:"100%",cursor:"pointer",zIndex:1}}/>
            </div>
          </div>
          <div style={{flexShrink:0}}>
            <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4}}>DURATION</Mono>
            <div style={{display:"flex",gap:4}}>
              {[8,10,12].map(w=>(
                <button key={w} onClick={()=>savePlans({...plans,[activePlanKey]:{...plan,durationWeeks:w}})}
                  style={{padding:"9px 12px",borderRadius:7,border:(plan?.durationWeeks||10)===w?"none":`1px solid ${C.border}`,background:(plan?.durationWeeks||10)===w?C.accentBtn:"transparent",color:(plan?.durationWeeks||10)===w?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {w}W
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>}
      {plan&&days.length>0&&settings.showPlanAnalysis&&settings.showCoaching&&<button onClick={()=>setAnalysisOpen(true)} style={{width:"100%",padding:"11px",marginBottom:12,borderRadius:10,border:`1px solid ${C.accent}55`,background:C.accent+"12",color:C.accentInk,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer"}}>Analyze plan</button>}
      {days.map((day,i)=>(
        <div key={day.id} style={{marginBottom:8}}>
          <div onClick={dayReorderMode?undefined:()=>setExpandedDay(expandedDay===i?null:i)}
            style={{background:C.card,border:`1px solid ${dayReorderMode?C.neon+"33":expandedDay===i?getDayColor(day)+"55":C.border}`,borderLeft:`3px solid ${getDayColor(day)}`,borderRadius:(!dayReorderMode&&expandedDay===i)?"10px 10px 0 0":10,padding:"13px 14px",cursor:dayReorderMode?"default":"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600}}>{slotWeekday(i)||day.name||`Day ${i+1}`} — {day.label}</div>
                <Mono style={{fontSize:11,color:C.muted}}>{day.tag} · {day.exercises.length} exercises</Mono>
              </div>
              {dayReorderMode
                ?<div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
                  <button onClick={e=>{e.stopPropagation();reorderDay(i,i-1);}} disabled={i===0}
                    style={{padding:"3px 8px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:i===0?C.faint:C.neonInk,cursor:i===0?"default":"pointer",fontSize:12,lineHeight:1}}>↑</button>
                  <button onClick={e=>{e.stopPropagation();reorderDay(i,i+1);}} disabled={i===days.length-1}
                    style={{padding:"3px 8px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:i===days.length-1?C.faint:C.neonInk,cursor:i===days.length-1?"default":"pointer",fontSize:12,lineHeight:1}}>↓</button>
                </div>
                :<Mono style={{color:C.muted,fontSize:12,flexShrink:0}}>{expandedDay===i?"▲":"▼"}</Mono>
              }
            </div>
          </div>
          {expandedDay===i&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:"8px 14px 14px"}}>
            {/* Reorder mode header */}
            {reorderMode===day.id&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0 10px",borderBottom:`1px solid ${C.neon}44`,marginBottom:4}}>
              <Mono style={{fontSize:10,color:C.neonInk,letterSpacing:"0.12em"}}>DRAG MODE -- USE ARROWS TO REORDER</Mono>
              <Btn size="sm" variant="ghost" style={{color:C.neonInk,borderColor:C.neon+"55"}} onClick={()=>setReorderMode(null)} C={C}>Done</Btn>
            </div>}
            {day.exercises.map((ex,exIdx)=>(
              <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`,background:reorderMode===day.id?"transparent":"transparent",transition:"background .15s"}}>
                {/* Reorder arrows */}
                {reorderMode===day.id&&<div style={{display:"flex",flexDirection:"column",gap:1,marginRight:8,flexShrink:0}}>
                  <button onClick={()=>exIdx>0&&reorderExercises(day.id,exIdx,exIdx-1)}
                    disabled={exIdx===0}
                    aria-label="Move exercise up" style={{padding:"2px 7px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:exIdx===0?C.faint:C.neonInk,cursor:exIdx===0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronUp size={ICON.sm} strokeWidth={1.75}/></button>
                  <button onClick={()=>exIdx<day.exercises.length-1&&reorderExercises(day.id,exIdx,exIdx+1)}
                    disabled={exIdx===day.exercises.length-1}
                    aria-label="Move exercise down" style={{padding:"2px 7px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:exIdx===day.exercises.length-1?C.faint:C.neonInk,cursor:exIdx===day.exercises.length-1?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronDown size={ICON.sm} strokeWidth={1.75}/></button>
                </div>}
                {/* Position badge in reorder mode */}
                {reorderMode===day.id&&<Mono style={{fontSize:11,color:C.muted,width:18,flexShrink:0,textAlign:"center"}}>{exIdx+1}</Mono>}
                <div style={{flex:1,marginLeft:reorderMode===day.id?8:0}}>
                  <div style={{fontSize:13}}>{ex.name}</div>
                  <Mono style={{fontSize:11,color:C.muted}}>{ex.sets}×{ex.reps}{ex.muscle?` . ${ex.muscle}`:""}</Mono>
                </div>
                {reorderMode!==day.id&&<div style={{display:"flex",gap:6,marginLeft:8}}>
                  <Btn size="sm" variant="ghost" onClick={()=>setEditEx({dayId:day.id,ex})} C={C}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>deleteExercise(day.id,ex.id,ex.name)} C={C}>✕</Btn>
                </div>}
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
              <Btn size="sm" variant="subtle" onClick={()=>setAddExDay(day.id)} C={C}>+ Exercise</Btn>
              <Btn size="sm" variant="ghost" style={{color:reorderMode===day.id?C.neonInk:C.muted,borderColor:reorderMode===day.id?C.neon+"55":C.border}} onClick={()=>setReorderMode(reorderMode===day.id?null:day.id)} C={C}>
                {reorderMode===day.id?<span style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={ICON.sm} strokeWidth={1.75}/>Done</span>:<span style={{display:"inline-flex",alignItems:"center",gap:5}}><GripVertical size={ICON.sm} strokeWidth={1.75}/>Reorder</span>}
              </Btn>
              {settings.aiRecs&&<Btn size="sm" variant="ghost" style={{color:C.accentInk}} onClick={()=>{if(sequencingDay!==day.id)aiSequenceDay(day);}} C={C}>
                {sequencingDay===day.id?"Sequencing...":"✦ AI Sequence"}
              </Btn>}
              {settings.aiRecs&&<Btn size="sm" variant="ghost" style={{color:C.muted}} onClick={()=>setAiModal({type:"day",day})} C={C}>✦ Analyze</Btn>}
              <Btn size="sm" variant="danger" onClick={()=>setDeletingDay(day.id)} C={C}>Delete Day</Btn>
            </div>
            <Btn onClick={()=>setSaveSheet(day.id)} C={C} style={{width:"100%",marginTop:10,background:C.neon,color:"#0b0c0e",fontWeight:800,letterSpacing:"0.08em",fontSize:13,borderColor:C.neon}}>Save Day</Btn>
          </div>}
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:6}}>
        <Btn variant="ghost" style={{flex:1}} onClick={()=>setAddDayModal(true)} C={C}>+ Add Day</Btn>
        {days.length>1&&<Btn variant="ghost" style={{flex:1,color:dayReorderMode?C.neonInk:C.muted,borderColor:dayReorderMode?C.neon+"55":C.border}} onClick={()=>{const next=!dayReorderMode;setDayReorderMode(next);setExpandedDay(null);if(!next){setSaveToast("Day order saved");setTimeout(()=>setSaveToast(""),2500);}}} C={C}>
          {dayReorderMode?<span style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={ICON.sm} strokeWidth={1.75}/>Done Reordering</span>:<span style={{display:"inline-flex",alignItems:"center",gap:5}}><GripVertical size={ICON.sm} strokeWidth={1.75}/>Reorder Days</span>}
        </Btn>}
      </div>
    </div>}

    {/* PRESET TEMPLATES */}
    {view==="presets"&&<div style={{padding:"14px 18px"}}>
      <SectionLabel C={C}>Popular Programs</SectionLabel>
      {PRESET_TEMPLATES.map(t=>(
        <div key={t.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{fontSize:16}}>{t.emoji} <span style={{fontWeight:700,fontSize:15}}>{t.name}</span></div>
              <Pill color={C.accentInk}>{t.tag}</Pill>
            </div>
          </div>
          <div style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:12}}>{t.desc}</div>
          <div style={{marginBottom:12}}>
            {t.days.filter(d=>!d.isRest).map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{width:8,height:8,borderRadius:4,background:getDayColor(d),flexShrink:0}}/>
                <Mono style={{fontSize:11,color:C.muted,flex:1}}>{d.label}</Mono>
                <Mono style={{fontSize:10,color:C.muted}}>{d.exercises.length} ex</Mono>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn size="sm" variant="ghost" onClick={()=>setPresetPreview(t)} C={C}>Preview</Btn>
            <Btn size="sm" onClick={()=>{setModalStartDate(new Date().toLocaleDateString("en-CA"));setModalDuration(10);setStartPlanModal(t);}} C={C}>Use This Plan</Btn>
          </div>
        </div>
      ))}
    </div>}

    {/* AI BUILDER */}
    {view==="ai"&&<div style={{padding:"14px 18px"}}>
      <div style={{background:`linear-gradient(135deg,${C.accent}18,${C.gold}10)`,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"18px",marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:24,marginBottom:6}}>✦</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>AI Custom Plan Builder</div>
        <div style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:16}}>Answer a few questions and get a personalized workout plan built for your exact goals, schedule, and limitations.</div>
        <Btn size="lg" onClick={()=>setGoalModal(true)} C={C} style={{background:`linear-gradient(135deg,${C.accent},${C.gold})`,border:"none"}}>Build My Plan ✦</Btn>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,borderRadius:6,padding:"14px"}}>
        <SectionLabel C={C}>What the AI considers</SectionLabel>
        {["Your primary goal (strength, size, fat loss, athletic)","Days per week available","Session length preference","Any injuries or joint issues","Experience level","Equipment available"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<5?`1px solid ${C.border}`:"none",alignItems:"center"}}>
            <div style={{width:6,height:6,borderRadius:3,background:C.accent,flexShrink:0}}/>
            <div style={{fontSize:13,color:C.muted}}>{item}</div>
          </div>
        ))}
      </div>
    </div>}

    {/* MODALS */}
    {saveSheet&&<div onClick={()=>{setSaveSheet(null);setNewPlanSheet(false);}} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"16px 16px 0 0",padding:"20px 18px calc(32px + env(safe-area-inset-bottom,0px)) 18px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{width:36,height:4,borderRadius:2,background:C.border,alignSelf:"center",marginTop:-8,marginBottom:4}}/>
        {!newPlanSheet?<>
          <Mono style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>SAVE DAY CHANGES</Mono>
          <button onClick={()=>{updatePlan(days);setSaveSheet(null);setExpandedDay(null);setSaveToast("Plan updated");setTimeout(()=>setSaveToast(""),2500);}} style={{width:"100%",padding:"13px 16px",background:C.neon+"22",border:`1px solid ${C.neon}44`,borderRadius:10,color:C.neonInk,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}><span style={{display:"inline-flex",alignItems:"center",gap:8}}><Check size={ICON.md} strokeWidth={1.75}/>Update Current Plan</span></button>
          <button onClick={()=>{setNewPlanSheet(true);setNewPlanName("Custom - "+(plan?.name||"Plan")+" (modified)");}} style={{width:"100%",padding:"13px 16px",background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:10,color:C.accentInk,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}>+ Save as New Plan</button>
          <button onClick={()=>setSaveSheet(null)} style={{width:"100%",padding:"11px 16px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",letterSpacing:"0.04em",marginTop:2}}>Cancel</button>
        </>:<>
          <Mono style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>NAME YOUR NEW PLAN</Mono>
          <input type="text" value={newPlanName} onChange={e=>setNewPlanName(e.target.value)} autoFocus style={{padding:"11px 12px",background:C.card,border:`1px solid ${C.accent}44`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"}}/>
          <button onClick={saveAsNewPlan} style={{width:"100%",padding:"13px 16px",background:C.neon+"22",border:`1px solid ${C.neon}44`,borderRadius:10,color:C.neonInk,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}><span style={{display:"inline-flex",alignItems:"center",gap:8}}><Check size={ICON.md} strokeWidth={1.75}/>Create &amp; Activate</span></button>
          <button onClick={()=>setNewPlanSheet(false)} style={{width:"100%",padding:"11px 16px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",letterSpacing:"0.04em",marginTop:2}}>← Back</button>
        </>}
      </div>
    </div>}
    {editEx&&<Modal onClose={()=>setEditEx(null)} C={C}><ExerciseForm title="Edit Exercise" initial={editEx.ex} onSave={ex=>{saveExercise(editEx.dayId,ex);setEditEx(null);}} onClose={()=>setEditEx(null)} C={C}/></Modal>}
    {addExDay&&<ExerciseLibraryModal onSelect={ex=>{addExercise(addExDay,ex);setAddExDay(null);}} onClose={()=>setAddExDay(null)} C={C}/>}
    {addDayModal&&<Modal onClose={()=>setAddDayModal(false)} C={C}><DayForm onSave={addDay} onClose={()=>setAddDayModal(false)} C={C}/></Modal>}
    {deletingDay&&<Modal onClose={()=>setDeletingDay(null)} C={C}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Delete this day?</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>This removes the day and all its exercises.</div>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="danger" style={{flex:1}} onClick={()=>deleteDay(deletingDay)} C={C}>Delete</Btn>
          <Btn variant="ghost" style={{flex:1}} onClick={()=>setDeletingDay(null)} C={C}>Cancel</Btn>
        </div>
      </div>
    </Modal>}
    {presetPreview&&<Modal onClose={()=>setPresetPreview(null)} C={C}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{presetPreview.emoji} {presetPreview.name}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{presetPreview.desc}</div>
      {presetPreview.days.map((d,i)=>(
        <div key={i} style={{borderBottom:`1px solid ${C.border}`,padding:"10px 0"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
            <div style={{width:8,height:8,borderRadius:4,background:getDayColor(d)}}/>
            <div style={{fontSize:13,fontWeight:600}}>{d.label}</div>
            <Mono style={{fontSize:11,color:C.muted}}>{d.tag}</Mono>
          </div>
          {!d.isRest&&d.exercises.map((e,j)=>(
            <Mono key={j} style={{fontSize:11,color:C.muted,display:"block",marginLeft:16,marginBottom:2}}>. {e.name} -- {e.sets}×{e.reps}</Mono>
          ))}
        </div>
      ))}
      <Btn style={{width:"100%",marginTop:16}} onClick={()=>{setModalStartDate(new Date().toLocaleDateString("en-CA"));setModalDuration(10);setStartPlanModal(presetPreview);setPresetPreview(null);}} C={C}>Use This Plan</Btn>
    </Modal>}
    {goalModal&&<GoalBuilderModal onAdd={addAIPlan} onClose={()=>setGoalModal(false)} C={C}/>}
    {sequenceUpgrade&&<Modal onClose={()=>setSequenceUpgrade(null)} C={C}><UpgradePrompt {...sequenceUpgrade} C={C}/><Btn style={{width:"100%",marginTop:16}} onClick={()=>setSequenceUpgrade(null)} C={C}>OK</Btn></Modal>}
    {aiModal&&<AIModal exercise={null} day={aiModal.day} settings={settings} onClose={()=>setAiModal(null)} C={C}/>}
    {startPlanModal&&<Modal onClose={()=>setStartPlanModal(null)} C={C}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{startPlanModal.emoji} {startPlanModal.name}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:18}}>Set a start date and duration for your plan.</div>
      <div style={{marginBottom:14}}>
        <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",display:"block",marginBottom:6}}>START DATE</Mono>
        <input type="date" value={modalStartDate} onChange={e=>setModalStartDate(e.target.value)}
          style={{width:"100%",padding:"9px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>
      <div style={{marginBottom:22}}>
        <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",display:"block",marginBottom:6}}>DURATION</Mono>
        <div style={{display:"flex",gap:8}}>
          {[8,10,12].map(w=>(
            <button key={w} onClick={()=>setModalDuration(w)}
              style={{flex:1,padding:"11px",borderRadius:8,border:modalDuration===w?"none":`1px solid ${C.border}`,background:modalDuration===w?C.accentBtn:"transparent",color:modalDuration===w?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {w} WK
            </button>
          ))}
        </div>
      </div>
      <Btn style={{width:"100%"}} onClick={()=>loadPreset(startPlanModal,modalStartDate,modalDuration)} C={C}>Start Plan</Btn>
    </Modal>}
  </div>;
}

// -- GOAL BUILDER MODAL --------------------------------------------------------
function GoalBuilderModal({onAdd,onClose,C}){
  const [step,setStep]=useState(0);
  const [answers,setAnswers]=useState({});
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);

  const questions=[
    {key:"goal",q:"What's your primary goal?",opts:["Build muscle / hypertrophy","Increase strength","Lose fat / tone up","Athletic performance","General fitness"]},
    {key:"days",q:"How many days per week can you train?",opts:["3 days","4 days","5 days","6 days"]},
    {key:"duration",q:"How long per session?",opts:["30-45 minutes","45-60 minutes","60-75 minutes","75-90 minutes"]},
    {key:"experience",q:"Your experience level?",opts:["Beginner (< 1 year)","Intermediate (1-3 years)","Advanced (3+ years)"]},
    {key:"limitations",q:"Any physical limitations?",opts:["None","Sensitive knees","Shoulder issues","Lower back issues","Multiple issues"]},
    {key:"equipment",q:"Equipment available?",opts:["Full gym","Dumbbells + cables","Home gym (limited)","Bodyweight only"]},
  ];

  function answer(key,val){
    const next={...answers,[key]:val};
    setAnswers(next);
    if(step<questions.length-1){setStep(s=>s+1);}
    else{buildPlan(next);}
  }

  async function buildPlan(ans){
    setLoading(true);
    const prompt=`You are an expert personal trainer. Create a custom workout plan based on these answers:
Goal: ${ans.goal}
Days/week: ${ans.days}
Session length: ${ans.duration}
Experience: ${ans.experience}
Limitations: ${ans.limitations}
Equipment: ${ans.equipment}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "name": "Plan name",
  "subtitle": "Brief subtitle",
  "description": "2-sentence description",
  "days": [
    {
      "name": "Monday",
      "label": "Push",
      "tag": "Chest . Shoulders . Triceps",
      "color": "#f7c948",
      "isRest": false,
      "exercises": [
        {"name": "Bench Press", "sets": "4", "reps": "8-12", "note": "brief tip", "muscle": "Chest"}
      ]
    }
  ]
}
Use 7 days total (fill rest days with isRest:true and minimal exercises array with one recovery item). Colors: use only these hex values: #f7c948, #3d9bff, #b06aff, #00d4aa, #ffb830. Make the plan practical and appropriate for the stated limitations.`;

    try{
      const data=await callAI({action:"plan_builder",messages:[{role:"user",content:prompt}],maxTokens:2000});
      if(data.upgradeRequired){setResult({upgradeRequired:true,...data});setLoading(false);return;}
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      const clean=text.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      const withIds={
        key:`ai_${Date.now()}`,
        name:parsed.name, subtitle:parsed.subtitle, description:parsed.description,
        days:(parsed.days||[]).map(d=>({...d,id:mkId(),exercises:(d.exercises||[]).map(e=>({...e,id:mkId()}))}))
      };
      setResult(withIds);
    }catch(e){
      setResult({error:"AI plan generation failed — check your connection and try again. Or choose a preset template below."});
    }
    setLoading(false);
  }

  const q=questions[step];

  return <Modal onClose={onClose} C={C}>
    {!loading&&!result&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:16,fontWeight:700}}>✦ Build My Plan</div>
        <Mono style={{fontSize:11,color:C.muted}}>{step+1}/{questions.length}</Mono>
      </div>
      {/* Progress bar */}
      <div style={{height:3,background:C.border,borderRadius:2,marginBottom:20}}>
        <div style={{height:"100%",background:C.accent,borderRadius:2,width:`${((step+1)/questions.length)*100}%`,transition:"width .3s"}}/>
      </div>
      <div style={{fontSize:15,fontWeight:600,marginBottom:16}}>{q.q}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {q.opts.map(opt=>(
          <button key={opt} onClick={()=>answer(q.key,opt)} style={{padding:"13px 16px",background:answers[q.key]===opt?C.accentBtn:C.card,border:`1px solid ${answers[q.key]===opt?C.accent:C.border}`,borderRadius:10,color:answers[q.key]===opt?"#fff":C.text,textAlign:"left",fontSize:14,cursor:"pointer",fontFamily:C.serif,transition:"all .15s"}}>
            {opt}
          </button>
        ))}
      </div>
      {step>0&&<Btn variant="ghost" size="sm" onClick={()=>setStep(s=>s-1)} C={C} style={{marginTop:16}}>← Back</Btn>}
    </div>}

    {loading&&<div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:32,marginBottom:16}}>✦</div>
      <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>Building your plan...</div>
      <Mono style={{fontSize:12,color:C.muted}}>Analyzing your goals and creating a custom program</Mono>
    </div>}

    {result&&!result.error&&<div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>✦ {result.name}</div>
      <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:8}}>{result.subtitle}</Mono>
      <div style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.6}}>{result.description}</div>
      {(result.days||[]).filter(d=>!d.isRest).map((d,i)=>(
        <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
            <div style={{width:8,height:8,borderRadius:4,background:getDayColor(d)}}/>
            <div style={{fontSize:13,fontWeight:600}}>{d.label}</div>
          </div>
          {(d.exercises||[]).slice(0,3).map((e,j)=>(
            <Mono key={j} style={{fontSize:11,color:C.muted,display:"block",marginLeft:16,marginBottom:1}}>. {e.name}</Mono>
          ))}
          {(d.exercises||[]).length>3&&<Mono style={{fontSize:10,color:C.muted,marginLeft:16}}>+{d.exercises.length-3} more</Mono>}
        </div>
      ))}
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <Btn style={{flex:1}} onClick={()=>onAdd(result)} C={C}>Add to My Plans</Btn>
        <Btn variant="ghost" style={{flex:1}} onClick={onClose} C={C}>Discard</Btn>
      </div>
    </div>}

    {result?.upgradeRequired&&<div style={{padding:"8px 0"}}><UpgradePrompt {...result} C={C}/><Btn style={{width:"100%",marginTop:16}} onClick={onClose} C={C}>OK</Btn></div>}
    {result?.error&&!result?.upgradeRequired&&<div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.6}}>{result.error}</div>
      <Btn onClick={onClose} C={C}>Got it</Btn>
    </div>}
  </Modal>;
}

function ExerciseForm({title,initial,onSave,onClose,isNew,C}){
  const [ex,setEx]=useState({...initial});
  return <div>
    <div style={{fontSize:16,fontWeight:600,marginBottom:18}}>{title}</div>
    {[["Exercise Name","name"],["Sets","sets"],["Reps","reps"],["Muscle Group","muscle"],["Note","note"]].map(([label,key])=>(
      <div key={key} style={{marginBottom:12}}>
        <SectionLabel C={C}>{label}</SectionLabel>
        <input value={ex[key]||""} onChange={e=>setEx(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>
    ))}
    <div style={{display:"flex",gap:10,marginTop:16}}>
      <Btn style={{flex:1}} onClick={()=>onSave(ex)} C={C}>Save</Btn>
      <Btn variant="ghost" style={{flex:1}} onClick={onClose} C={C}>Cancel</Btn>
    </div>
  </div>;
}

function DayForm({onSave,onClose,C}){
  const [d,setD]=useState({name:"",label:"",tag:"",color:"#4f8ef7",isRest:false});
  const colors=["#f06584","#3d9bff","#b06aff","#00d4aa","#ffb830"];
  return <div>
    <div style={{fontSize:16,fontWeight:600,marginBottom:18}}>Add Day</div>
    {[["Day Name (e.g. Monday)","name"],["Label (e.g. Push)","label"],["Tag (e.g. Chest . Back)","tag"]].map(([label,key])=>(
      <div key={key} style={{marginBottom:12}}>
        <SectionLabel C={C}>{label}</SectionLabel>
        <input value={d[key]||""} onChange={e=>setD(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>
    ))}
    <div style={{marginBottom:16}}>
      <SectionLabel C={C}>Color</SectionLabel>
      <div style={{display:"flex",gap:10}}>
        {colors.map(c=><div key={c} onClick={()=>setD(p=>({...p,color:c}))} style={{width:32,height:32,borderRadius:16,background:c,cursor:"pointer",boxSizing:"border-box",border:d.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
      </div>
    </div>
    <div style={{display:"flex",gap:10}}>
      <Btn style={{flex:1}} onClick={()=>onSave(d)} C={C}>Add Day</Btn>
      <Btn variant="ghost" style={{flex:1}} onClick={onClose} C={C}>Cancel</Btn>
    </div>
  </div>;
}

// renameSetsData (merge-aware key rename) + setsToArr (sets_data → set rows) live in
// ./lib/renameExercise so the across-history rename is unit-tested and operates uncapped.

// -- HISTORY -------------------------------------------------------------------
function HistoryTab({sessions,saveSessions,setSessions,savePRs,prs,plans,C,toggleTheme,themeMode,onRerun}){
  const [expanded,setExpanded]=useState(null);
  const [historyFilter,setHistoryFilter]=useState("3m");
  const [editingSession,setEditingSession]=useState(null);

  // The loaded `sessions` prop is the global .limit(100) (most-recent) load. The 1m view is
  // always within that cap (~20 for 4-5/wk), so it reads the prop. 3m/6m/all query the DB by
  // date range so a window that legitimately holds >100 sessions isn't truncated. Date basis is
  // COALESCE(completed_at, started_at) so in-progress/partial sessions still appear here.
  const [windowSessions,setWindowSessions]=useState(null); // fetched rows for the active non-1m filter | null
  const [allHasMore,setAllHasMore]=useState(false);        // more pages for the paginated "all" view
  const [reloadNonce,setReloadNonce]=useState(0);          // bump to re-fetch the current window after a mutation
  const SEL="*, logged_sets(*)";
  const ALL_PAGE=100;
  useEffect(()=>{
    if(historyFilter==="1m"){setWindowSessions(null);setAllHasMore(false);return;}
    let cancelled=false;
    setWindowSessions(null); setAllHasMore(false);
    (async()=>{
      try{
        const {data:{user:u}}=await supabase.auth.getUser();
        if(!u)return;
        if(historyFilter==="all"){
          const {data,error}=await supabase.from("workout_sessions").select(SEL).eq("user_id",u.id).order("completed_at",{ascending:false,nullsFirst:false}).range(0,ALL_PAGE-1);
          if(error||!data)return; // fail-safe: leave null → prop fallback, no banner
          if(!cancelled){setWindowSessions(data.map(mapSessionRow));setAllHasMore(data.length===ALL_PAGE);}
        }else{
          const days={"3m":90,"6m":180}[historyFilter];
          const cutoff=new Date(Date.now()-days*86400000).toISOString();
          const {data,error}=await supabase.from("workout_sessions").select(SEL).eq("user_id",u.id).or(`completed_at.gte.${cutoff},and(completed_at.is.null,started_at.gte.${cutoff})`);
          if(error||!data)return; // fail-safe
          if(!cancelled)setWindowSessions(data.map(mapSessionRow));
        }
      }catch(e){console.error("History window fetch:",e);}
    })();
    return ()=>{cancelled=true;};
  },[historyFilter,reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore=async()=>{
    if(historyFilter!=="all"||!windowSessions)return;
    try{
      const {data:{user:u}}=await supabase.auth.getUser();
      if(!u)return;
      const from=windowSessions.length;
      const {data,error}=await supabase.from("workout_sessions").select(SEL).eq("user_id",u.id).order("completed_at",{ascending:false,nullsFirst:false}).range(from,from+ALL_PAGE-1);
      if(error||!data)return;
      setWindowSessions(prev=>[...(prev||[]),...data.map(mapSessionRow)]);
      setAllHasMore(data.length===ALL_PAGE);
    }catch(e){console.error("History load more:",e);}
  };

  // Display source: 1m (or before the fetch resolves / on fetch error) → the loaded prop;
  // 3m/6m/all → the fetched full window. historyWindow applies the COALESCE date basis + sort.
  const displaySessions=(historyFilter==="1m"||windowSessions==null)?sessions:windowSessions;
  const sorted=historyWindow(displaySessions,"all");           // all loaded/fetched, for the empty-state check
  const filteredSorted=historyWindow(displaySessions,historyFilter); // windowed + sorted

  const grouped=filteredSorted.reduce((acc,s)=>{
    const m=new Date(s.completedAt).toLocaleDateString("en-CA").slice(0,7);
    if(!acc[m])acc[m]=[];
    acc[m].push(s);
    return acc;
  },{});
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [deleteError,setDeleteError]=useState(null);
  const [addingSession,setAddingSession]=useState(false);
  const [manualSession,setManualSession]=useState({
    dayLabel:"",date:new Date().toLocaleDateString("en-CA"),
    duration:"",notes:"",
    exercises:[{name:"",sets:"3",reps:"10",weight:""}]
  });

  async function saveManualSession(){
    if(!manualSession.dayLabel){return;}
    const dt=new Date(manualSession.date+"T12:00:00").toISOString();
    const setsArr=manualSession.exercises
      .filter(e=>e.name)
      .flatMap(e=>Array.from({length:parseInt(e.sets)||1},(_,si)=>({
        exName:e.name, setNum:si+1,
        weight:parseFloat(e.weight)||0,
        reps:parseInt(e.reps)||0,
        muscle:"", isPR:false
      })));
    const setsMap={};
    manualSession.exercises.filter(e=>e.name).forEach(e=>{
      setsMap[e.name]=Array.from({length:parseInt(e.sets)||1},(_,si)=>({
        setNum:si+1, weight:e.weight, reps:e.reps, done:true
      }));
    });
    const newSess={
      id:Date.now().toString(),
      dayId:"manual_"+Date.now(),
      dayLabel:manualSession.dayLabel,
      startedAt:dt, completedAt:dt,
      notes:manualSession.notes,
      sets:setsMap, setsArr,
      manual:true
    };
    const ok=await saveSessions([...sessions,newSess]);
    if(ok){await recalcPRs();setReloadNonce(n=>n+1);
      setAddingSession(false);
      setManualSession({dayLabel:"",date:new Date().toLocaleDateString("en-CA"),duration:"",notes:"",exercises:[{name:"",sets:"3",reps:"10",weight:""}]});
    }
  }

  // Recompute lifetime PRs from FULL history — NOT the capped `sessions` window — so a PR set
  // outside the loaded 100 can never be overwritten/deleted. Sources non-warmup sets via an
  // inner join to workout_sessions so a deleted session's sets (orphans) are excluded
  // regardless of FK cascade. Best-effort + fail-safe: on any query failure the function makes
  // NO change to personal_records (never downgrade or orphan-delete from a failed/partial read),
  // and the caller's primary action has already persisted independently.
  async function recalcPRs(){
    try{
      const{data:{user:u}}=await supabase.auth.getUser();
      if(!u)return;
      // Full history, completed sessions only, non-warmup, with each set's session date
      // (inner join drops orphans; the embedded completed_at filter excludes partial sessions).
      const{data:rows,error}=await supabase.from("logged_sets")
        .select("exercise_name,weight,set_type,workout_sessions!inner(completed_at)")
        .eq("user_id",u.id)
        .neq("set_type","warmup")
        .not("workout_sessions.completed_at","is",null);
      if(error||!rows){console.error("recalcPRs fetch:",error);return;} // fail-safe: no writes
      const newPRs=lifetimePRs(rows.map(r=>({exName:r.exercise_name,weight:r.weight,date:r.workout_sessions?.completed_at||null})));
      await savePRs(newPRs);
      // Orphan-delete ONLY for exercises with no non-warmup set anywhere in FULL history
      // (not merely absent from the loaded window). Skip cleanup if the read fails.
      const{data:stored,error:e2}=await supabase.from("personal_records").select("exercise_name").eq("user_id",u.id);
      if(e2||!stored)return;
      const keep=new Set(Object.keys(newPRs));
      const orphans=stored.map(r=>r.exercise_name).filter(n=>!keep.has(n));
      if(orphans.length)await supabase.from("personal_records").delete().eq("user_id",u.id).in("exercise_name",orphans);
    }catch(e){console.error("recalcPRs:",e);} // fail-safe: never break the primary action
  }

  async function saveEdit(updated,origFromModal){
    const setsArr=[];
    for(const[exName,sets]of Object.entries(updated.sets||{})){
      for(const[sn,vals]of Object.entries(sets)){
        if(vals.weight||vals.reps||vals.minutes){
          setsArr.push({exName,setNum:parseInt(sn),weight:vals.weight||"",reps:vals.reps||"",minutes:vals.minutes||"",level:vals.level||"",isPR:vals.isPR||false,type:vals.type||"working"});
        }
      }
    }
    const updatedSession={...updated,setsArr,exerciseOrder:Object.keys(updated.sets||{})};
    if(!updatedSession.supabaseId){
      // Manual session with no DB record — state update only
      const updatedSessions=sessions.map(s=>s.id===updatedSession.id?updatedSession:s);
      setSessions(updatedSessions);await recalcPRs();setReloadNonce(n=>n+1);
      return true;
    }
    // Rollback baseline: prefer the pre-edit session passed by the modal (present even for
    // beyond-cap rows not in the loaded prop), fall back to the prop find for any other caller.
    const original=origFromModal||sessions.find(s=>s.id===updatedSession.id);
    const{data:{session:_sess}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));
    const uid=_sess?.user?.id;
    // STEP 1: update workout_sessions
    const{error:updErr}=await supabase.from("workout_sessions").update({completed_at:updatedSession.completedAt,started_at:updatedSession.startedAt,notes:updatedSession.notes||"",sets_data:updatedSession.sets||{},exercise_order:updatedSession.exerciseOrder,partial:updatedSession.partial||false}).eq("id",updatedSession.supabaseId);
    if(updErr){console.error("saveEdit update:",updErr);return false;}
    // STEP 2: delete then re-insert logged_sets — rollback on any failure
    if(uid){
      const{error:delErr}=await supabase.from("logged_sets").delete().eq("session_id",updatedSession.supabaseId);
      if(delErr){
        console.error("saveEdit delete:",delErr);
        if(original){const{error:rbErr}=await supabase.from("workout_sessions").update({completed_at:original.completedAt,started_at:original.startedAt,notes:original.notes||"",sets_data:original.sets||{},partial:original.partial||false}).eq("id",updatedSession.supabaseId);if(rbErr)console.error("saveEdit rollback session:",rbErr);}
        return false;
      }
      if(setsArr.length>0){
        const setRows=setsArr.map(x=>({session_id:updatedSession.supabaseId,user_id:uid,exercise_name:x.exName,set_number:x.setNum,weight:parseFloat(x.weight)||null,reps:x.minutes?(parseInt(x.level)||null):(parseInt(x.reps)||null),minutes:parseFloat(x.minutes)||null,is_pr:x.isPR||false,set_type:x.type||"working"}));
        const{error:lsErr}=await supabase.from("logged_sets").insert(setRows);
        if(lsErr){
          console.error("saveEdit insert:",lsErr);
          // Re-insert originals to restore previous sets, then rollback session
          if(original&&(original.setsArr||[]).length>0){
            const origRows=(original.setsArr||[]).map(x=>({session_id:updatedSession.supabaseId,user_id:uid,exercise_name:x.exName,set_number:x.setNum,weight:parseFloat(x.weight)||null,reps:x.minutes?(parseInt(x.level)||null):(parseInt(x.reps)||null),minutes:parseFloat(x.minutes)||null,is_pr:x.isPR||false,set_type:x.type||"working"}));
            const{error:rbSetsErr}=await supabase.from("logged_sets").insert(origRows);if(rbSetsErr)console.error("saveEdit sets rollback:",rbSetsErr);
          }
          if(original){const{error:rbSessErr}=await supabase.from("workout_sessions").update({completed_at:original.completedAt,started_at:original.startedAt,notes:original.notes||"",sets_data:original.sets||{},partial:original.partial||false}).eq("id",updatedSession.supabaseId);if(rbSessErr)console.error("saveEdit session rollback:",rbSessErr);}
          return false;
        }
      }
    }
    // All DB writes confirmed — now update local state
    const updatedSessions=sessions.map(s=>s.id===updatedSession.id?updatedSession:s);
    setSessions(updatedSessions);
    await recalcPRs();
    setReloadNonce(n=>n+1);
    return true;
  }

  // Rename an exercise across the user's FULL history — not just the loaded .limit(100) prop — so
  // occurrences beyond that window are renamed too (the edited session is handled by saveEdit and
  // skipped via skipId). Per affected session we rebuild rather than blind-UPDATE exercise_name:
  // renameSetsData merges+renumbers when the rename collides with an existing exercise, and the
  // logged_sets are rebuilt from that blob, so the two stores stay consistent (a blind UPDATE would
  // leave duplicate set_numbers on a merge). Existing per-set is_pr is carried over (enrichIsPR) so
  // the rebuild PRESERVES PR badges rather than clearing them (preserve, not recompute). Write
  // order is logged_sets first, sets_data PATCH LAST:
  // sets_data still holding oldName is the "not done yet" marker, so any per-session partial failure
  // is fully recoverable by re-running. Idempotent (a re-run finds only remaining oldName). supabase
  // { error } pattern on every write (the builder has no .catch — see saveEdit/997f131).
  async function renameExerciseEverywhere(oldName,newName,skipId){
    if(oldName===newName)return true;
    try{
      const{data:{session:_s}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));
      const uid=_s?.user?.id;
      if(!uid)return false;
      const PAGE=1000;
      for(let from=0;;from+=PAGE){
        const{data:rows,error:fErr}=await supabase.from("workout_sessions").select("id,sets_data").eq("user_id",uid).range(from,from+PAGE-1);
        if(fErr){console.error("renameAll fetch:",fErr);return false;}
        if(!rows||rows.length===0)break;
        const affected=rows.filter(r=>r.id!==skipId&&r.sets_data&&Object.prototype.hasOwnProperty.call(r.sets_data,oldName));
        if(affected.length){
          // Read existing per-set is_pr for the affected sessions so the rebuild PRESERVES the
          // pre-rebuild badges (carry-over, NOT recompute — see project_deferred_infra). enrichIsPR
          // stamps every leaf (all exercises, since the rebuild replaces all of a session's
          // logged_sets) and renameSetsData carries the flag with the moved leaf through any renumber.
          const{data:ls,error:lErr}=await supabase.from("logged_sets").select("session_id,exercise_name,set_number,is_pr").in("session_id",affected.map(r=>r.id));
          if(lErr){console.error("renameAll flags read:",lErr);return false;}
          const prBy={};(ls||[]).forEach(x=>{(prBy[x.session_id]||(prBy[x.session_id]={}))[`${x.exercise_name}|${x.set_number}`]=x.is_pr;});
          for(const r of affected){
            const renamed=renameSetsData(enrichIsPR(r.sets_data,prBy[r.id]||{}),oldName,newName);
            const arr=setsToArr(renamed);
            // logged_sets first (delete all for the session, re-insert from the renamed+enriched blob)...
            const{error:e2}=await supabase.from("logged_sets").delete().eq("session_id",r.id);
            if(e2){console.error("renameAll delete:",e2);return false;}
            if(arr.length){
              const lsRows=arr.map(x=>({session_id:r.id,user_id:uid,exercise_name:x.exName,set_number:x.setNum,weight:parseFloat(x.weight)||null,reps:x.minutes?(parseInt(x.level)||null):(parseInt(x.reps)||null),minutes:parseFloat(x.minutes)||null,is_pr:x.isPR||false,set_type:x.type||"working"}));
              const{error:e3}=await supabase.from("logged_sets").insert(lsRows);
              if(e3){console.error("renameAll insert:",e3);return false;}
            }
            // ...sets_data PATCH last (flips the oldName marker only once logged_sets are consistent).
            const{error:e1}=await supabase.from("workout_sessions").update({sets_data:renamed}).eq("id",r.id);
            if(e1){console.error("renameAll session:",e1);return false;}
          }
        }
        if(rows.length<PAGE)break;
      }
      // Refresh loaded state for immediate UI (DB is source of truth); skip the just-saved edit.
      setSessions(prev=>prev.map(s=>{
        if(s.id!==skipId&&s.sets&&s.sets[oldName]){const ns=renameSetsData(s.sets,oldName,newName);return {...s,sets:ns,setsArr:setsToArr(ns)};}
        return s;
      }));
      await recalcPRs();
      setReloadNonce(n=>n+1);
      return true;
    }catch(e){console.error("renameExerciseEverywhere:",e);return false;}
  }

  async function deleteSession(sessId){
    // Delete by id regardless of whether the row is in the loaded (capped) prop — the History
    // window can display sessions beyond the .limit(100) load. sessId is the DB id for any
    // displayed row (mapSessionRow sets id===supabaseId). RLS scopes to the user; the user_id
    // filter is belt-and-suspenders. On error: graceful message, no state change.
    try{
      const{data:{session:_s}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));
      const uid=_s?.user?.id;
      let q=supabase.from("workout_sessions").delete().eq("id",sessId);
      if(uid)q=q.eq("user_id",uid);
      const{error}=await q;
      if(error){
        console.error("deleteSession:",error);
        setDeleteError("Could not delete — check your connection and try again.");
        setConfirmDelete(null);
        return;
      }
    }catch(e){
      console.error("deleteSession:",e);
      setDeleteError("Could not delete — check your connection and try again.");
      setConfirmDelete(null);
      return;
    }
    // Local prop update is best-effort: the filter no-ops for a beyond-cap row not in the prop.
    // recalcPRs (full history) and the window re-fetch run regardless, so PRs recompute and the
    // displayed list corrects even for beyond-cap deletes.
    saveSessions(sessions.filter(s=>s.id!==sessId));
    await recalcPRs();
    setReloadNonce(n=>n+1);
    setConfirmDelete(null);
    setExpanded(null);
  }

  return <div>
    <div style={{background:C.bg,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Workout History</div>
          <Mono style={{fontSize:11,color:C.muted}}>{filteredSorted.length} session{filteredSorted.length!==1?"s":""}{historyFilter!=="all"?` · last ${historyFilter.toUpperCase()}`:" · all time"}</Mono>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
          <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 11px",fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>{themeMode==="dark"?<Moon size={ICON.md} strokeWidth={1.75}/>:<Sun size={ICON.md} strokeWidth={1.75}/>}{themeMode==="dark"?"DARK":"LIGHT"}</button>
          <Btn size="sm" C={C} onClick={()=>setAddingSession(a=>!a)} style={{background:C.neonBtn,color:"#fff",fontWeight:700,padding:"6px 10px",fontSize:11}}>+ Log</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:5}}>
        {[["1m","1M"],["3m","3M"],["6m","6M"],["all","ALL"]].map(([k,label])=>(
          <button key={k} onClick={()=>setHistoryFilter(k)} style={{padding:"7px 14px",borderRadius:7,border:historyFilter===k?"none":`1px solid ${C.border}`,background:historyFilter===k?C.accentBtn:"transparent",color:historyFilter===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
        ))}
      </div>
    </div>
    {deleteError&&<div onClick={()=>setDeleteError(null)} style={{background:C.red,color:"#fff",padding:"10px 18px",fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"center"}}>{deleteError} (tap to dismiss)</div>}

    {/* Manual Session Logger Modal */}
    {addingSession&&<div style={{margin:"12px 18px 0",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px"}}>
      <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>Log a Workout</div>
      <div style={{marginBottom:10}}>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4}}>WORKOUT NAME</Mono>
        <input value={manualSession.dayLabel} onChange={e=>setManualSession(p=>({...p,dayLabel:e.target.value}))}
          placeholder="e.g. Chest & Triceps"
          style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>
      <div style={{marginBottom:10}}>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4}}>DATE</Mono>
        <input type="date" value={manualSession.date} onChange={e=>setManualSession(p=>({...p,date:e.target.value}))}
          style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <Mono style={{fontSize:10,color:C.muted}}>EXERCISES (optional)</Mono>
          <button onClick={()=>setManualSession(p=>({...p,exercises:[...p.exercises,{name:"",sets:"3",reps:"10",weight:""}]}))}
            style={{background:"transparent",border:"none",color:C.neonInk,cursor:"pointer",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace"}}>+ Add Exercise</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:5,marginBottom:4}}>
          {["Exercise","Sets","Reps","lbs",""].map(h=><Mono key={h} style={{fontSize:9,color:C.muted,textAlign:"center"}}>{h}</Mono>)}
        </div>
        {manualSession.exercises.map((ex,ei)=>(
          <div key={ei} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:5,marginBottom:6,alignItems:"center"}}>
            <input value={ex.name} onChange={e=>setManualSession(p=>({...p,exercises:p.exercises.map((x,i)=>i===ei?{...x,name:e.target.value}:x)}))}
              placeholder="Exercise name" style={{padding:"7px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace"}}/>
            <input value={ex.sets} onChange={e=>setManualSession(p=>({...p,exercises:p.exercises.map((x,i)=>i===ei?{...x,sets:e.target.value}:x)}))}
              style={{padding:"7px 4px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"center"}}/>
            <input value={ex.reps} onChange={e=>setManualSession(p=>({...p,exercises:p.exercises.map((x,i)=>i===ei?{...x,reps:e.target.value}:x)}))}
              style={{padding:"7px 4px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"center"}}/>
            <input value={ex.weight} onChange={e=>setManualSession(p=>({...p,exercises:p.exercises.map((x,i)=>i===ei?{...x,weight:e.target.value}:x)}))}
              style={{padding:"7px 4px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"center"}}/>
            {manualSession.exercises.length>1
              ?<button onClick={()=>setManualSession(p=>({...p,exercises:p.exercises.filter((_,i)=>i!==ei)}))}
                style={{background:"transparent",border:"none",color:C.redInk,cursor:"pointer",fontSize:14,padding:"0 2px"}}>✕</button>
              :<span/>}
          </div>
        ))}
      </div>
      <div style={{marginBottom:14}}>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4}}>NOTES (optional)</Mono>
        <textarea value={manualSession.notes} onChange={e=>setManualSession(p=>({...p,notes:e.target.value}))}
          placeholder="How did it go?"
          style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",resize:"none",height:56}}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn C={C} style={{flex:1,background:C.neonBtn,color:"#fff",fontWeight:700}} onClick={saveManualSession}>Save Session</Btn>
        <Btn C={C} variant="ghost" style={{flex:1}} onClick={()=>setAddingSession(false)}>Cancel</Btn>
      </div>
    </div>}

    <div style={{padding:"14px 18px"}}>
      {sorted.length===0&&<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:13,marginBottom:12}}>No sessions found in your log.</div><div style={{fontSize:12,color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",lineHeight:1.7}}>If you completed a workout and don't see it here,<br/>tap Debug above to inspect your storage.</div></div>}
      {Object.entries(grouped).map(([month,msess])=>(
        <div key={month} style={{marginBottom:24}}>
          <SectionLabel C={C}>{new Date(month+"-02").toLocaleDateString("en",{month:"long",year:"numeric"})} . {msess.length} sessions</SectionLabel>
          {msess.map((s,i)=>{
            const idx=`${month}-${i}`;
            const allSets=s.setsArr||[];
            const vol=allSets.filter(x=>x.type!=="warmup").reduce((a,x)=>(a+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0);
            const setCount=allSets.filter(x=>x.type!=="warmup").length;
            const dur=s.completedAt&&s.startedAt?Math.round((new Date(s.completedAt)-new Date(s.startedAt))/60000):null;
            const newPRs=allSets.filter(x=>x.isPR);
            const isExp=expanded===idx;
            return <div key={s.id} style={{background:C.card,border:`1px solid ${isExp?C.accent+"44":C.border}`,borderLeft:`3px solid ${isExp?C.accentBtn:"transparent"}`,borderRadius:8,padding:"13px 14px",marginBottom:8,transition:"border-color .2s"}}>
              {/* Header row */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setExpanded(isExp?null:idx)}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <div style={{fontSize:14,fontWeight:700}}>{s.dayLabel||"Workout"}</div>
                    {s.partial&&<Pill color={C.goldInk}>Partial</Pill>}
                    {newPRs.length>0&&<PRMark C={C}/>}
                  </div>
                  <Mono style={{fontSize:11,color:C.muted}}>
                    {new Date(s.completedAt).toLocaleDateString("en",{weekday:"long",month:"short",day:"numeric",year:"numeric"})}
                    {dur?` . ${dur}min`:""}
                  </Mono>
                  {setCount>0&&<Mono style={{fontSize:11,color:C.neonInk,fontWeight:700,marginTop:3,display:"block"}}>{setCount} set{setCount!==1?"s":""}{vol>0?` · ${Math.round(vol).toLocaleString()} lbs`:""}</Mono>}
                </div>
                <Mono style={{color:C.muted,fontSize:12,marginLeft:8}}>{isExp?"▲":"▼"}</Mono>
              </div>

              {/* Expanded view */}
              {isExp&&<div style={{marginTop:12}}>
                {s.notes&&<div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:10,padding:"8px 10px",background:C.surface,borderRadius:6,lineHeight:1.5}}>"{s.notes}"</div>}

                {/* Render exercises in the session's saved order (sets_data key order),
                    never re-derived from the plan — see lib/historyOrder.js */}
                {exerciseOrderForSession(s).map(name=>{
                  const exSets=allSets.filter(x=>x.exName===name);
                  // Collapse consecutive identical strength sets (same type+weight+reps) into one row,
                  // preserving order. Cardio intervals stay per-row (each interval is distinct).
                  const groups=[];
                  for(const x of exSets){
                    const isCardioSet=!!x.minutes;
                    const last=groups[groups.length-1];
                    if(last&&!isCardioSet&&!last.cardio&&last.type===(x.type||"working")&&last.weight===(x.weight||"")&&last.reps===(x.reps||"")){
                      last.count++; last.isPR=last.isPR||x.isPR;
                    }else{
                      groups.push({cardio:isCardioSet,type:x.type||"working",weight:x.weight||"",reps:x.reps||"",minutes:x.minutes||"",level:x.level||"",setNum:x.setNum,isPR:x.isPR||false,count:1});
                    }
                  }
                  return <div key={name} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{name}</div>
                    <div style={{display:"grid",gap:6}}>
                      {groups.map((g,j)=>(
                        <Mono key={j} style={{fontSize:11,background:C.surface,padding:"8px 10px",borderRadius:8,color:g.isPR?C.redInk:g.cardio?C.greenInk:C.muted,opacity:g.type==="warmup"?0.6:1}}>
                          {g.type==="warmup"?"W ":""}{g.cardio?`Interval ${g.setNum}: ${g.minutes} min${g.level?` · L${g.level}`:""}`:""}{!g.cardio&&g.count>1?`${g.count} × `:""}{!g.cardio&&g.weight?`${g.weight}lbs`:""}{!g.cardio&&g.weight&&g.reps?" × ":""}{!g.cardio&&g.reps?`${g.reps}r`:""}{g.isPR?<> <PRMark C={C}/></>:""}
                        </Mono>
                      ))}
                      {(() => {
                        const totalMinutes = exSets.reduce((sum,x)=>sum + (parseFloat(x.minutes)||0),0);
                        return totalMinutes>0 ? <Mono style={{fontSize:11,color:C.muted}}>Total: {Math.round(totalMinutes)} min</Mono> : null;
                      })()}
                    </div>
                  </div>;
                })}

                {/* Action buttons */}
                <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  <Btn size="sm" variant="subtle" C={C} onClick={()=>setEditingSession({...s})}>✎ Edit</Btn>
                  <Btn size="sm" variant="ghost" C={C} style={{color:C.neonInk,borderColor:C.neon+"44"}} onClick={()=>onRerun&&onRerun(s)}>↺ Re-run</Btn>
                  <Btn size="sm" variant="ghost" C={C} style={{color:C.blueInk,borderColor:C.blue+"44"}} onClick={()=>{
                    const vol=allSets.filter(x=>x.type!=="warmup").reduce((a,x)=>(a+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0);
                    const prCount=allSets.filter(x=>x.isPR).length;
                    const text=`💪 Just crushed ${s.dayLabel||"a workout"} on IRON!
${allSets.length} sets · ${vol>0?Math.round(vol).toLocaleString()+" lbs total volume":""}
${prCount>0?`${prCount} new PR${prCount>1?"s":""}!`:""}
#IRON #fitness #workout`;
                    if(navigator.share){navigator.share({text});}else{navigator.clipboard.writeText(text);}
                  }}>↗ Share</Btn>
                  <Btn size="sm" variant="danger" C={C} onClick={()=>setConfirmDelete(s.id)}>Delete</Btn>
                </div>
              </div>}
            </div>;
          })}
        </div>
      ))}
      {historyFilter==="all"&&allHasMore&&<div style={{textAlign:"center",marginTop:4,marginBottom:8}}>
        <Btn size="sm" variant="subtle" C={C} onClick={loadMore}>Load more</Btn>
      </div>}
    </div>

    {/* Edit modal */}
    {editingSession&&<SessionEditModal session={editingSession} onSave={saveEdit} onClose={()=>setEditingSession(null)} allSessions={sessions} onRenameAll={renameExerciseEverywhere} C={C}/>}

    {/* Delete confirm */}
    {confirmDelete&&<Modal onClose={()=>setConfirmDelete(null)} C={C}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Delete this workout?</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.5}}>This permanently removes the session and all logged sets. PRs from this session will not be automatically recalculated.</div>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="danger" style={{flex:1}} onClick={()=>deleteSession(confirmDelete)} C={C}>Delete</Btn>
          <Btn variant="ghost" style={{flex:1}} onClick={()=>setConfirmDelete(null)} C={C}>Cancel</Btn>
        </div>
      </div>
    </Modal>}
  </div>;
}

// -- SESSION EDIT MODAL --------------------------------------------------------
function SessionEditModal({session,onSave,onClose,allSessions=[],onRenameAll,C}){
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(null);
  const [editingName,setEditingName]=useState(null); // exName currently being renamed
  const [nameDraft,setNameDraft]=useState(""); // controlled value of the rename input
  const [renames,setRenames]=useState([]); // [{from,to}] applied this session
  const [applyAllPrompt,setApplyAllPrompt]=useState(null); // renames with matches in other sessions
  const [editData,setEditData]=useState(()=>{
    // Build editable sets: { exName -> { setNum -> { weight, reps } } }, keyed in the
    // session's saved order so the modal matches the card (and reorders persist).
    const byName={};
    (session.setsArr||[]).forEach(x=>{
      if(!byName[x.exName])byName[x.exName]={};
      byName[x.exName][x.setNum]={weight:x.weight||"",reps:x.reps||"",minutes:x.minutes||"",level:x.level||"",isPR:x.isPR||false,type:x.type||"working"};
    });
    const sets={};
    for(const name of exerciseOrderForSession(session))if(byName[name])sets[name]=byName[name];
    for(const name in byName)if(!sets[name])sets[name]=byName[name];
    return {...session,sets};
  });
  const [newExName,setNewExName]=useState("");
  const [addingEx,setAddingEx]=useState(false);
  const addRowRef=useRef(null);
  const addNameRef=useRef(null);
  // When the add-exercise row opens, bring it into view and focus the field without a
  // scroll jump (preventScroll, then a controlled smooth scroll).
  useEffect(()=>{
    if(!addingEx)return;
    const t=setTimeout(()=>{addRowRef.current?.scrollIntoView({block:"nearest",behavior:"smooth"});addNameRef.current?.focus({preventScroll:true});},30);
    return ()=>clearTimeout(t);
  },[addingEx]);
  const initDur=session.completedAt&&session.startedAt?Math.max(1,Math.round((new Date(session.completedAt)-new Date(session.startedAt))/60000)):60;
  const [durationMins,setDurationMins]=useState(initDur);

  const CARDIO_NAMES=["stair stepper","treadmill","bike","elliptical","rowing machine","rowing"];
  const isCardioName=name=>CARDIO_NAMES.some(c=>name.toLowerCase().includes(c));

  const exNames=Object.keys(editData.sets||{});

  function updateSet(exName,setNum,field,val){
    setEditData(prev=>({...prev,sets:{...prev.sets,[exName]:{...prev.sets[exName],[setNum]:{...(prev.sets[exName]?.[setNum]||{}),[field]:val}}}}));
  }

  function addSet(exName,isCardio){
    const existing=Object.keys(editData.sets[exName]||{}).map(Number);
    const nextNum=(existing.length?Math.max(...existing):0)+1;
    const defaults=isCardio?{minutes:"",level:"",isPR:false}:{weight:"",reps:"",isPR:false};
    setEditData(prev=>({...prev,sets:{...prev.sets,[exName]:{...prev.sets[exName],[nextNum]:defaults}}}));
  }

  function removeSet(exName,setNum){
    const updated={...editData.sets[exName]};
    delete updated[setNum];
    // Renumber remaining sets
    const renumbered={};
    Object.values(updated).forEach((v,i)=>{renumbered[i+1]=v;});
    if(Object.keys(renumbered).length===0){
      const newSets={...editData.sets};
      delete newSets[exName];
      setEditData(prev=>({...prev,sets:newSets}));
    } else {
      setEditData(prev=>({...prev,sets:{...prev.sets,[exName]:renumbered}}));
    }
  }

  function addExercise(){
    if(!newExName.trim())return;
    setEditData(prev=>({...prev,sets:{...prev.sets,[newExName.trim()]:{1:{weight:"",reps:"",isPR:false}}}}));
    setNewExName("");
    setAddingEx(false);
  }

  // Reorder exercises by rebuilding sets_data with swapped keys. saveEdit persists the
  // new order to exercise_order (a jsonb array, which keeps order — jsonb object keys
  // do not), and the History card renders by it.
  function moveExercise(exName,dir){
    setEditData(prev=>{
      const keys=Object.keys(prev.sets||{});
      const i=keys.indexOf(exName),j=i+dir;
      if(i<0||j<0||j>=keys.length)return prev;
      const order=[...keys];[order[i],order[j]]=[order[j],order[i]];
      const sets={};for(const k of order)sets[k]=prev.sets[k];
      return {...prev,sets};
    });
  }

  function renameExercise(oldName,rawNew){
    const newName=(rawNew||"").trim();
    setEditingName(null);
    if(!newName||newName===oldName)return;
    setEditData(prev=>({...prev,sets:renameSetsData(prev.sets,oldName,newName)}));
    // Track the rename (collapse chains so X→A→B records as X→B), drop no-ops
    setRenames(prev=>{
      const chained=prev.some(r=>r.to===oldName);
      const next=chained?prev.map(r=>r.to===oldName?{...r,to:newName}:r):[...prev,{from:oldName,to:newName}];
      return next.filter(r=>r.from!==r.to);
    });
  }

  const inputStyle={padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"};

  // Parse completedAt into a LOCAL date string for the input (YYYY-MM-DD)
  const dateVal=editData.completedAt?new Date(editData.completedAt).toLocaleDateString("en-CA"):"";

  function updateDate(val){
    if(!val)return;
    // Apply the picked local date while preserving the original local time-of-day
    const [y,mo,d]=val.split("-").map(Number);
    const nd=editData.completedAt?new Date(editData.completedAt):new Date();
    nd.setFullYear(y,mo-1,d);
    const newCompleted=nd.toISOString();
    const newStarted=new Date(nd.getTime()-(durationMins*60000)).toISOString();
    setEditData(prev=>({...prev,completedAt:newCompleted,startedAt:newStarted}));
  }

  function updateDuration(mins){
    if(mins===""){setDurationMins("");return;}
    const m=parseInt(mins)||1;
    setDurationMins(m);
    if(editData.completedAt){
      const newStarted=new Date(new Date(editData.completedAt).getTime()-(m*60000)).toISOString();
      setEditData(prev=>({...prev,startedAt:newStarted}));
    }
  }

  return <Modal onClose={onClose} C={C} showClose={false}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>✎ Edit Workout</div>
        <Mono style={{fontSize:11,color:C.muted}}>{editData.dayLabel||"Workout"}</Mono>
      </div>
      <Btn variant="ghost" size="sm" onClick={onClose} C={C}>✕</Btn>
    </div>

    {/* Date + Duration editors */}
    <div style={{display:"flex",gap:10,marginBottom:16}}>
      <div style={{flex:1,padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8}}>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4,letterSpacing:"0.1em"}}>WORKOUT DATE</Mono>
        <input type="date" value={dateVal} onChange={e=>updateDate(e.target.value)}
          style={{width:"100%",padding:"7px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",cursor:"pointer"}}/>
      </div>
      <div style={{width:110,padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,flexShrink:0}}>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4,letterSpacing:"0.1em"}}>DURATION</Mono>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" min="1" max="300" value={durationMins} onChange={e=>updateDuration(e.target.value)} onBlur={e=>{if(!e.target.value||parseInt(e.target.value)<1)updateDuration("1");}}
            style={{width:"100%",padding:"7px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:16,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",textAlign:"center"}}/>
          <Mono style={{fontSize:11,color:C.muted,flexShrink:0}}>min</Mono>
        </div>
      </div>
    </div>

    {/* Exercises */}
    {exNames.map((exName,exPos)=>{
      const sets=editData.sets[exName]||{};
      const setNums=Object.keys(sets).map(Number).sort((a,b)=>a-b);
      const isCardioEx=isCardioName(exName)||Object.values(sets).some(s=>s.minutes);
      return <div key={exName} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8}}>
          {exNames.length>1&&<div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
            <button onClick={()=>moveExercise(exName,-1)} disabled={exPos===0} aria-label="Move exercise up" style={{padding:"1px 5px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:exPos===0?C.faint:C.neonInk,cursor:exPos===0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronUp size={ICON.sm} strokeWidth={1.75}/></button>
            <button onClick={()=>moveExercise(exName,1)} disabled={exPos===exNames.length-1} aria-label="Move exercise down" style={{padding:"1px 5px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:exPos===exNames.length-1?C.faint:C.neonInk,cursor:exPos===exNames.length-1?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronDown size={ICON.sm} strokeWidth={1.75}/></button>
          </div>}
          {editingName===exName
            ?<div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
               <input autoFocus value={nameDraft} onChange={e=>setNameDraft(e.target.value)}
                 onKeyDown={e=>{if(e.key==="Enter")renameExercise(exName,nameDraft);else if(e.key==="Escape")setEditingName(null);}}
                 style={{...inputStyle,flex:1,fontWeight:700}}/>
               <button onClick={()=>renameExercise(exName,nameDraft)} title="Confirm rename" style={{background:"transparent",border:"none",color:C.neonInk,cursor:"pointer",flexShrink:0,display:"inline-flex",alignItems:"center"}}><Check size={ICON.md} strokeWidth={1.75}/></button>
               <button onClick={()=>setEditingName(null)} title="Cancel" style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
             </div>
            :<div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
               <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{exName}</div>
               <button onClick={()=>{setEditingName(exName);setNameDraft(exName);}} title="Rename exercise" style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"2px 4px",flexShrink:0}}>✎</button>
             </div>}
          {isCardioEx&&<Pill color={C.greenInk}>Cardio</Pill>}
        </div>
        {/* Set rows — cardio: minutes + level, strength: weight + reps */}
        <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 32px",gap:"4px 8px",alignItems:"center",marginBottom:6}}>
          <Mono style={{fontSize:9,color:C.muted}}>#</Mono>
          <Mono style={{fontSize:9,color:C.muted}}>{isCardioEx?"MINUTES":"WEIGHT (lbs)"}</Mono>
          <Mono style={{fontSize:9,color:C.muted}}>{isCardioEx?"LEVEL":"REPS"}</Mono>
          <div/>
          {setNums.map(n=>[
            <Mono key={`n${n}`} style={{fontSize:11,color:C.muted,textAlign:"center"}}>{n}</Mono>,
            isCardioEx
              ?<input key={`m${n}`} type="number" value={sets[n]?.minutes||""} onChange={e=>updateSet(exName,n,"minutes",e.target.value)} style={inputStyle} placeholder="min"/>
              :<input key={`w${n}`} type="number" value={sets[n]?.weight||""} onChange={e=>updateSet(exName,n,"weight",e.target.value)} style={inputStyle} placeholder="lbs"/>,
            isCardioEx
              ?<input key={`l${n}`} type="number" value={sets[n]?.level||""} onChange={e=>updateSet(exName,n,"level",e.target.value)} style={inputStyle} placeholder="lvl"/>
              :<input key={`r${n}`} type="number" value={sets[n]?.reps||""} onChange={e=>updateSet(exName,n,"reps",e.target.value)} style={inputStyle} placeholder="reps"/>,
            <button key={`x${n}`} onClick={()=>removeSet(exName,n)} style={{padding:"4px",background:"transparent",border:"none",color:C.dangerInk,cursor:"pointer",fontSize:14,borderRadius:4}}>✕</button>
          ])}
        </div>
        <Btn size="sm" variant="ghost" C={C} onClick={()=>addSet(exName,isCardioEx)} style={{fontSize:11}}>+ Set</Btn>
      </div>;
    })}

    {/* Add exercise — appends to the end; reposition with the ↑/↓ controls above */}
    {addingEx?<div ref={addRowRef} style={{marginBottom:14,padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10}}>
      <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",display:"block",marginBottom:6}}>ADD EXERCISE</Mono>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input ref={addNameRef} value={newExName} onChange={e=>setNewExName(e.target.value)}
          placeholder="Exercise name" list="exercise-name-options"
          onKeyDown={e=>{if(e.key==="Enter")addExercise();else if(e.key==="Escape"){setAddingEx(false);setNewExName("");}}}
          style={{...inputStyle,flex:1}}/>
        <Btn size="sm" C={C} onClick={addExercise}>Add</Btn>
        <Btn size="sm" variant="ghost" C={C} onClick={()=>{setAddingEx(false);setNewExName("");}}>Cancel</Btn>
      </div>
      <datalist id="exercise-name-options">{EXERCISE_LIBRARY.map(e=><option key={e.name} value={e.name}/>)}</datalist>
      <Mono style={{fontSize:10,color:C.faint,display:"block",marginTop:6}}>Added to the bottom — use ↑/↓ above to move it.</Mono>
    </div>:<Btn size="sm" variant="subtle" C={C} onClick={()=>setAddingEx(true)} style={{marginBottom:14}}>+ Add Exercise</Btn>}

    {/* Notes */}
    <div style={{marginBottom:16}}>
      <SectionLabel C={C}>Session Notes</SectionLabel>
      <textarea value={editData.notes||""} onChange={e=>setEditData(p=>({...p,notes:e.target.value}))}
        placeholder="How did it feel? Any joint issues?"
        style={{width:"100%",padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",height:72,resize:"none",boxSizing:"border-box"}}/>
    </div>

    {editData.partial&&<div style={{marginBottom:16,padding:"10px 14px",background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Mono style={{fontSize:12,color:C.goldInk}}>Partial session</Mono>
      <button onClick={()=>setEditData(p=>({...p,partial:false}))} style={{padding:"5px 10px",background:C.gold,border:"none",borderRadius:6,color:"#0b0c0e",fontSize:11,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",letterSpacing:"0.06em"}}>Mark as complete</button>
    </div>}

    {saveError&&<div style={{marginBottom:10,padding:"10px 12px",background:C.danger+"22",border:`1px solid ${C.danger}44`,borderRadius:8,color:C.dangerInk,fontSize:12,fontFamily:"'SF Mono','Courier New',monospace"}}>{saveError}</div>}
    {applyAllPrompt
      ?<div style={{padding:"12px 14px",background:C.accent+"12",border:`1px solid ${C.accent}44`,borderRadius:8}}>
        <Mono style={{fontSize:12,color:C.text,fontWeight:700,display:"block",marginBottom:6}}>Saved — apply rename to other sessions?</Mono>
        <div style={{marginBottom:10}}>
          {applyAllPrompt.map(r=>{
            const count=allSessions.filter(s=>s.id!==session.id&&s.sets&&s.sets[r.from]).length;
            return <Mono key={r.from} style={{fontSize:11,color:C.muted,display:"block",marginBottom:2}}>"{r.from}" → "{r.to}" · {count} other session{count!==1?"s":""}</Mono>;
          })}
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn style={{flex:1}} C={C} disabled={saving} onClick={async()=>{setSaving(true);try{for(const r of applyAllPrompt){await onRenameAll(r.from,r.to,session.id);}}catch(e){console.error("apply rename all:",e);}finally{setSaving(false);}onClose();}}>{saving?"Applying…":"Apply to all"}</Btn>
          <Btn variant="ghost" style={{flex:1}} C={C} disabled={saving} onClick={onClose}>Just this session</Btn>
        </div>
      </div>
      :<div style={{display:"flex",gap:10}}>
        <Btn style={{flex:1}} C={C} disabled={saving} onClick={async()=>{setSaving(true);setSaveError(null);try{const ok=await onSave(editData,session);if(ok===false){setSaveError("Save failed — your original data is unchanged. Check connection and try again.");}else{const pending=[];for(const r of renames){let other=otherOccurrence(allSessions,r.from,session.id);if(!other){try{const{data:{session:_s}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));const uid=_s?.user?.id;if(!uid){other=true;}else{const{count,error}=await supabase.from("logged_sets").select("session_id",{count:"exact",head:true}).eq("user_id",uid).eq("exercise_name",r.from).neq("session_id",session.id);other=error?true:(count||0)>0;}}catch(e){console.error("rename occurrence check:",e);other=true;}}if(other)pending.push(r);}if(pending.length&&onRenameAll){setApplyAllPrompt(pending);}else{onClose();}}}catch(e){setSaveError("Save failed — your original data is unchanged. Check connection and try again.");}finally{setSaving(false);}}}>
          {saving?"Saving…":"Save Changes"}
        </Btn>
        <Btn variant="ghost" style={{flex:1}} C={C} disabled={saving} onClick={onClose}>Cancel</Btn>
      </div>}
  </Modal>;
}

// -- STATS ---------------------------------------------------------------------
// Strength score thresholds per muscle (relative to bodyweight approximation)
const STRENGTH_LEVELS = ["Beginner","Novice","Intermediate","Advanced","Elite"];
function getStrengthScore(exName, maxWeight){
  if(!maxWeight) return 0;
  // Rough benchmarks (lbs) per level per exercise type
  const benchmarks = {
    // Chest
    "Bench Press":[95,135,185,225,275],
    "Incline Press (DB)":[40,60,80,100,130],
    "Cable Fly":[20,35,55,75,95],
    "Cable Fly / Pec Deck":[25,40,60,80,105],
    "Pec Deck / Cable Fly":[25,40,60,80,105],
    // Back
    "T-Bar Row":[85,115,155,195,245],
    "Reverse Grip Lat Pulldown":[55,80,110,145,180],
    "Seated Cable Row":[55,80,115,150,190],
    "Reverse Grip Pulldown":[55,80,110,145,180],
    "Seated Row (Close Grip)":[55,80,115,150,190],
    // Shoulders
    "Machine Shoulder Press":[50,80,110,140,170],
    "Dumbbell Lateral Raises":[10,15,25,35,50],
    "DB / Cable Lateral Raises":[10,15,25,35,50],
    "Cable Lateral Raise":[10,15,25,35,50],
    "Rear Delt Machine":[30,50,70,95,120],
    "Rear Delt Cable or Machine":[25,40,60,80,105],
    "Rear Delt Cable":[20,35,55,75,100],
    "Front Delt Raise":[15,25,35,50,65],
    // Triceps
    "Cable Rope Pressdown":[30,50,70,90,110],
    "Incline Tricep Extension":[25,40,55,75,95],
    "Cable Overhead Extension":[25,40,60,80,105],
    // Biceps
    "Cable Curl":[30,45,60,75,95],
    "Concentration Curl":[20,30,40,55,70],
    "Barbell / Cable Curl":[40,65,90,115,145],
    // Legs
    "Goblet Squat":[35,55,75,95,115],
    "DB Romanian Deadlift":[50,75,105,135,165],
    "Box Step-Ups (DB)":[20,35,50,65,85],
    "DB Lunges (optional)":[20,35,50,65,85],
  };
  const b = benchmarks[exName];
  if(!b) return Math.min(4, Math.floor(maxWeight/50));
  let level = 0;
  for(let i=0;i<b.length;i++){ if(maxWeight>=b[i]) level=i+1; }
  return Math.min(level, 4);
}

// Lightweight inline SVG sparkline (used in the Progress "All" overview — cheap to render for many lifts)
function Sparkline({data,color}){
  if(!data||data.length<2)return null;
  const w=320,h=56,pad=6;
  const ws=data.map(d=>d.weight),min=Math.min(...ws),max=Math.max(...ws),range=(max-min)||1;
  const pts=data.map((d,i)=>{const x=pad+(i/(data.length-1))*(w-2*pad);const y=h-pad-((d.weight-min)/range)*(h-2*pad);return `${x.toFixed(1)},${y.toFixed(1)}`;});
  const [lx,ly]=pts[pts.length-1].split(",");
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block",width:"100%",height:56}}>
    <polyline fill="none" stroke={color} strokeWidth="2.5" points={pts.join(" ")}/>
    <circle cx={lx} cy={ly} r="3.5" fill={color}/>
  </svg>;
}

// Realized-volume status for the Muscles tab — a FIXED trailing 28-day window,
// independent of the tonnage bars below it. Quiet by design: only under/over-target
// groups surface; nothing renders when balanced; a single line shows until there's
// enough history to score. Shares the plan analyzer's scoring core
// (analyzeRealized → scoreVolume), so logged and planned volume read the same scale.
function RealizedVolumeInsight({sessions,settings,C}){
  const [openGroups,setOpenGroups]=useState({});
  const [showSources,setShowSources]=useState(false);
  const mono="'SF Mono','Courier New',monospace";
  const rv=analyzeRealized(sessions,{goal:(settings.aiGoal||"").toLowerCase(),windowDays:28});
  // Strength: per-muscle set totals matter far less (see Plan Analysis) — stay quiet.
  if(rv.goal==="strength")return null;
  const Label=<SectionLabel C={C}>Volume vs Targets — Last 28 Days</SectionLabel>;
  const cardStyle={background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",marginBottom:18};
  if(!rv.sufficient)return <div style={cardStyle}>{Label}
    <Mono style={{fontSize:11,color:C.muted,display:"block",lineHeight:1.6}}>Keep logging — about 4 weeks of sessions unlocks volume guidance.</Mono>
  </div>;
  // Group status is evidence-gated (see lib/planAnalysis): only under/high/mixed groups
  // surface; in_range groups never appear. The summed band is not shown as a target — the
  // real comparison is per fine muscle, on expand.
  const flagged=rv.perGroup.filter(g=>g.status!=="in_range");
  if(!flagged.length)return null; // balanced → no card (absence is the signal)
  const STATUS={under:{t:"under",c:C.dangerInk},maintenance:{t:"maintenance",c:C.muted},in_range:{t:"in range",c:C.neonInk},high:{t:"high",c:C.goldInk},mixed:{t:"mixed",c:C.blueInk}};
  const Chip=({status})=>{const s=STATUS[status]||STATUS.in_range;return <span style={{fontFamily:mono,fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:s.c,border:`1px solid ${s.c}55`,borderRadius:999,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0}}>{s.t}</span>;};
  const band=(b)=>`${b[0]}–${b[1]}`;
  // Progress coupling (Lane 3): enrich a flagged muscle's plain copy with the user's own
  // strength trend on that muscle's primary lifts. Primary lifts are identified from the
  // same 28-day window; the per-lift trend is computed by projectExercise.
  // Additive only: an unknown trend falls back to the exact plain copy.
  const winCut=Date.now()-28*86400000;
  const winSessions=(sessions||[]).filter(s=>s&&s.completedAt&&new Date(s.completedAt).getTime()>winCut);
  // RECENT-WINDOW consumer (intentionally capped): builds the e1RM series from the loaded
  // sessions (.limit(100)). projectExercise gates on >=5 distinct dates over >=21 days, which is
  // satisfiable within the loaded window for any lift with a current trend; a lift without
  // enough recent data correctly returns insufficient_data ("unknown"). A trend is a recent
  // signal, not an all-time series, so this is left on the capped load by design (not part of
  // the all-time-chart fix).
  const seriesFor=(name)=>{const g={};(sessions||[]).forEach(s=>{if(!s||!s.completedAt)return;const sets=(s.setsArr||[]).filter(x=>x.exName===name&&x.type!=="warmup");const orm=sets.reduce((mx,x)=>Math.max(mx,estimate1RM(x.weight,x.reps)),0);if(orm>0){const d=new Date(s.completedAt).toLocaleDateString("en-CA");g[d]=Math.max(g[d]||0,orm);}});return Object.entries(g).sort(([a],[b])=>a>b?1:-1).map(([d,orm])=>({date:d,orm:Math.round(orm)}));};
  const trendCache={};
  const trendFn=(lift)=>lift in trendCache?trendCache[lift]:(trendCache[lift]=projectExercise(seriesFor(lift)).status);
  // Group headline is qualitative (no summed-band target); the actionable / evidence-tier
  // copy lives at the fine level on expand.
  const groupLines=(row)=>{const out=[];
    if(row.status==="under")out.push("Below the productive range on a key muscle — open for which and how much.");
    else if(row.status==="high")out.push("Over the productive range on a key muscle — more isn't better here; watch recovery.");
    else if(row.status==="mixed"){
      const lo=row.fineMuscles.filter(m=>m.evidenceTier!=="low"&&(m.status==="under"||m.status==="maintenance")).map(m=>m.muscle);
      const hi=row.fineMuscles.filter(m=>m.evidenceTier!=="low"&&m.status==="high").map(m=>m.muscle);
      out.push(`${lo.join(" & ")} ${lo.length>1?"are":"is"} below range and ${hi.join(" & ")} ${hi.length>1?"are":"is"} above — expand for detail.`);
    }
    if(row.frequencyFlag)out.push("Hitting volume in one day — splitting across 2 days usually works better.");
    if(row.sessionFlag)out.push("High single-session load — consider redistributing.");
    return out;
  };
  const fineLines=(m)=>{
    // Plain Lane-2 copy (today's exact text).
    let plain;
    if(m.status==="under"||m.status==="maintenance"){
      plain=m.evidenceTier==="low"?"Below typical range, though evidence here is limited.":`~${Math.min(4,Math.max(2,Math.ceil(m.band[0]-m.weeklySets)))} more sets/week or a second day would close it.`;
    }else if(m.status==="high")plain="Above the productive range — watch recovery.";
    else return [];
    // Low-evidence muscles are never coupled (kept soft, never elevated). Gated muscles get
    // progress-aware copy; an unknown trend returns the plain copy verbatim.
    if(m.evidenceTier==="low")return [plain];
    const trend=classifyDriverTrend(m.muscle,winSessions,trendFn);
    return [progressCopy(m.status,trend,dominantPrimaryLift(m.muscle,winSessions),plain)];
  };
  return <div style={cardStyle}>
    {Label}
    <Mono style={{fontSize:10,color:C.faint,display:"block",marginTop:-2,marginBottom:8,lineHeight:1.5}}>Logged working sets vs. evidence-based ranges.{rv.goalDefaulted?" Assuming a hypertrophy goal.":""}</Mono>
    {flagged.map(g=>{
      const expanded=!!openGroups[g.group];
      return <div key={g.group} style={{borderTop:`1px solid ${C.border}`,padding:"9px 0"}}>
        <div onClick={()=>setOpenGroups(p=>({...p,[g.group]:!p[g.group]}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <span style={{color:C.faint,display:"inline-flex",flexShrink:0}}>{expanded?<ChevronDown size={ICON.sm} strokeWidth={1.75}/>:<ChevronRight size={ICON.sm} strokeWidth={1.75}/>}</span>
          <Mono style={{fontSize:13,color:C.text,fontWeight:600,flex:1}}>{g.group}</Mono>
          <Mono style={{fontSize:11,color:C.muted}}>{g.weeklySets}/wk</Mono>
          <button onClick={e=>{e.stopPropagation();setShowSources(true);}} aria-label="See sources" style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontFamily:mono,fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",padding:"2px 7px",cursor:"pointer",flexShrink:0}}>sources</button>
          <Chip status={g.status}/>
        </div>
        {groupLines(g).map((ln,i)=><Mono key={i} style={{fontSize:11,color:C.muted,display:"block",marginTop:5,marginLeft:24,lineHeight:1.5}}>{ln}</Mono>)}
        {expanded&&<div style={{marginLeft:24,marginTop:8}}>
          {g.fineMuscles.map(m=><div key={m.muscle} style={{padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Mono style={{fontSize:11,color:C.muted,flex:1}}>{m.muscle}{m.evidenceTier==="low"?" · limited evidence":""}</Mono>
              <Mono style={{fontSize:10,color:C.faint}}>{m.weeklySets} · {band(m.band)}</Mono>
              <Chip status={m.status}/>
            </div>
            {fineLines(m).map((ln,i)=><Mono key={i} style={{fontSize:10,color:C.faint,display:"block",marginTop:3,lineHeight:1.5}}>{ln}</Mono>)}
          </div>)}
        </div>}
      </div>;
    })}
    <Mono style={{fontSize:10,color:C.faint,display:"block",marginTop:12,lineHeight:1.6}}>Working-set proxy — logged non-warmup sets over 28 days ÷ 4, not RIR-verified. Ranges are per muscle (on expand); tap “sources” for citations.</Mono>
    {showSources&&<Modal onClose={()=>setShowSources(false)} C={C}>
      <SectionLabel C={C}>Sources</SectionLabel>
      {volumeGuidelines.citations.map(c=><div key={c.id} style={{marginBottom:10}}>
        <Mono style={{fontSize:11,color:C.text,display:"block",lineHeight:1.5}}>{c.ref}</Mono>
        <Mono style={{fontSize:10,color:C.accentInk,display:"block",marginTop:2}}>{c.tier}</Mono>
      </div>)}
      <Mono style={{fontSize:10,color:C.muted,display:"block",marginTop:8,lineHeight:1.6}}>Evidence tiers: high (peer-reviewed), moderate, low (practitioner extrapolation — softer copy). The 0.5 secondary-muscle factor is a modeling convention, not a measured value.</Mono>
    </Modal>}
  </div>;
}

function StatsTab({sessions,programStart,prs,settings,C,activePlan,toggleTheme,themeMode,complianceStreak=0,deloadDue=false,bodyStatsInit=[],onBodyStatsChange}){
  const [selEx,setSelEx]=useState(null); // null = "All exercises"
  const [progressView,setProgressView]=useState(null); // null = per-mode default (drill→table, all-lifts→chart); else explicit "chart"|"table"
  const [plateausExpanded,setPlateausExpanded]=useState(false);
  const [statsView,setStatsView]=useState("overview"); // overview | progress | muscles | body | trainer
  const [bodyStats,setBodyStats]=useState(bodyStatsInit||[]);
  const [newBodyStat,setNewBodyStat]=useState({weight:"",chest:"",waist:"",hips:"",arms:"",date:new Date().toLocaleDateString("en-CA")});
  const [addingBody,setAddingBody]=useState(false);
  const [trainerInsight,setTrainerInsight]=useState("");
  const [loadingInsight,setLoadingInsight]=useState(false);
  const [coachUpgrade,setCoachUpgrade]=useState(null);
  // Full-history prior-bests for plateau detection (so a true PR older than the loaded 100
  // isn't missed). { map: {exercise:{weight,ormEpley,ormBrzycki,ormLombardi,volume}}, now } |
  // null. Best-effort: null → detectPlateaus falls back to the capped pre-window slice.
  const [plateauPB,setPlateauPB]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const now=new Date(); now.setHours(12,0,0,0);
        const windowStart=now.getTime()-42*86400000;
        const {data:{user:u}}=await supabase.auth.getUser();
        if(!u)return;
        const {data:rows,error}=await supabase.from("logged_sets")
          .select("exercise_name,weight,reps,session_id,workout_sessions!inner(completed_at)")
          .eq("user_id",u.id)
          .neq("set_type","warmup")
          .not("workout_sessions.completed_at","is",null)
          .lt("workout_sessions.completed_at",new Date(windowStart).toISOString());
        if(error||!rows){return;} // fail-safe: leave null → capped fallback in detectPlateaus
        const sets=rows.map(r=>({exName:r.exercise_name,weight:r.weight,reps:r.reps,sessionId:r.session_id,date:r.workout_sessions?.completed_at?new Date(r.workout_sessions.completed_at).toLocaleDateString("en-CA"):null}));
        if(!cancelled)setPlateauPB({map:priorBests(sets,windowStart),now:now.toISOString()});
      }catch(e){console.error("plateau priorBest fetch:",e);}
    })();
    return ()=>{cancelled=true;};
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drill-down: the selected lift's FULL completed history (not the .limit(100) load), so the
  // Max-Weight / Est-1RM charts, projection, and session table aren't truncated for high-volume
  // lifters. { name, series } | null. Best-effort: on fetch error stays null → the capped
  // seriesFor(selEx) below is used as the fallback.
  const [drill,setDrill]=useState(null);
  useEffect(()=>{
    if(!selEx){setDrill(null);return;}
    let cancelled=false;
    (async()=>{
      try{
        const {data:{user:u}}=await supabase.auth.getUser();
        if(!u)return;
        const {data:rows,error}=await supabase.from("logged_sets")
          .select("weight,reps,session_id,set_number,workout_sessions!inner(completed_at)")
          .eq("user_id",u.id).eq("exercise_name",selEx).neq("set_type","warmup")
          .not("workout_sessions.completed_at","is",null);
        if(error||!rows)return; // fail-safe: leave null → capped fallback below
        // One rich mapping feeds both shapers: liftSeriesFromSets (per-day max, for the charts)
        // and liftSessionsFromSets (per-session compressed work log, for the table). session_id +
        // set_number give true per-session grouping and performed order.
        const rich=rows.map(r=>{const ca=r.workout_sessions?.completed_at||null;return {weight:r.weight,reps:r.reps,sessionId:r.session_id,setNumber:r.set_number,completedAt:ca,date:ca?new Date(ca).toLocaleDateString("en-CA"):null};});
        if(!cancelled)setDrill({name:selEx,series:liftSeriesFromSets(rich),sessions:liftSessionsFromSets(rich)});
      }catch(e){console.error("drill series fetch:",e);}
    })();
    return ()=>{cancelled=true;};
  },[selEx]); // eslint-disable-line react-hooks/exhaustive-deps

  const allExNames=[...new Set(sessions.flatMap(s=>(s.setsArr||[]).map(x=>x.exName)))].sort();
  // Per-day best-weight series for one exercise (used by Progress charts + tables)
  const seriesFor=(name)=>{
    const grouped={};
    sessions.forEach(s=>{ if(!s.completedAt)return; const sets=(s.setsArr||[]).filter(x=>x.exName===name&&x.type!=="warmup"); const bestW=sets.reduce((m,x)=>Math.max(m,parseFloat(x.weight)||0),0); if(bestW>0){
      // per-day max for each e1RM formula, computed independently (the best set can differ per formula)
      const bestEp=sets.reduce((m,x)=>Math.max(m,estimate1RM(x.weight,x.reps)),0);
      const bestBr=sets.reduce((m,x)=>{const w=parseFloat(x.weight)||0;const r=parseInt(x.reps,10)||1;return (w<=0||r>=37)?m:Math.max(m,w*36/(37-r));},0); // Brzycki guard: skip reps>=37
      const bestLo=sets.reduce((m,x)=>{const w=parseFloat(x.weight)||0;const r=parseInt(x.reps,10)||1;return w<=0?m:Math.max(m,w*Math.pow(r,0.10));},0);
      const d=new Date(s.completedAt).toLocaleDateString("en-CA"); const prev=grouped[d]||{weight:0,orm:0,ormEpley:0,ormBrzycki:0,ormLombardi:0};
      grouped[d]={weight:Math.max(prev.weight,bestW),orm:Math.max(prev.orm,bestEp),ormEpley:Math.max(prev.ormEpley,bestEp),ormBrzycki:Math.max(prev.ormBrzycki,bestBr),ormLombardi:Math.max(prev.ormLombardi,bestLo)};} });
    return Object.entries(grouped).sort(([a],[b])=>a>b?1:-1).map(([d,v])=>({date:d,label:d.slice(5),weight:v.weight,orm:Math.round(v.orm),ormEpley:v.ormEpley,ormBrzycki:v.ormBrzycki,ormLombardi:v.ormLombardi}));
  };
  // Per-day total tonnage (Σ weight×reps over non-warmup sets) for one exercise;
  // shaped as { date, orm: tonnage } so the trend engine runs on it unchanged.
  const tonnageSeriesFor=(name)=>{
    const grouped={};
    sessions.forEach(s=>{ if(!s.completedAt)return; const ton=(s.setsArr||[]).filter(x=>x.exName===name&&x.type!=="warmup").reduce((sum,x)=>sum+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0),0); if(ton>0){const d=new Date(s.completedAt).toLocaleDateString("en-CA"); grouped[d]=(grouped[d]||0)+ton;} });
    return Object.entries(grouped).sort(([a],[b])=>a>b?1:-1).map(([d,t])=>({date:d,orm:t}));
  };
  // Drill-down charts use the lift's FULL history once fetched; fall back to the capped
  // seriesFor(selEx) until it loads or if the fetch failed.
  const chartData=selEx?((drill&&drill.name===selEx)?drill.series:seriesFor(selEx)):[];
  // Per-session compressed work log for the drill-down table. Full history once the drill fetch
  // lands; until then / on fetch error, fall back to the capped prop (same fail-safe as chartData).
  const sessionRows=selEx?((drill&&drill.name===selEx)?drill.sessions:liftSessionsFromSets((sessions||[]).flatMap(s=>(s&&s.completedAt)?(s.setsArr||[]).filter(x=>x.exName===selEx&&x.type!=="warmup").map(x=>({sessionId:s.id,setNumber:x.setNum,weight:x.weight,reps:x.reps,completedAt:s.completedAt,date:new Date(s.completedAt).toLocaleDateString("en-CA")})):[]))):[];
  const prList=Object.entries(prs).sort((a,b)=>b[1].weight-a[1].weight);

  // Rolling 28-day volume vs the prior 28 days (stable through a partial month)
  const {current:vol28,previous:volPrev28}=rollingVolume(sessions);
  const vol28Delta = volPrev28>0 ? Math.round(((vol28-volPrev28)/volPrev28)*100) : null;

  // Weekly summary — "This Week" = the current PLAN week (matches the plan/History views), not a
  // Sunday-start calendar week, so a session from the adjacent plan week can't leak in. Anchor
  // mirrors the week label: plan.startDate when present, else the earliest-completed-session
  // program start. Both cells (count + volume) derive from this one plan-week window.
  const weekSessions = planWeekSessions(sessions, activePlan?.startDate || programStart || getProgramStart(sessions));
  const weekVol = weekSessions.reduce((a,s)=>(a+(s.setsArr||[]).filter(x=>x.type!=="warmup").reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);

  // Muscle volume by group (last 7 days)
  const muscleVol = {};
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
  sessions.filter(s=>s.completedAt&&new Date(s.completedAt)>sevenDaysAgo).forEach(s=>{
    (s.setsArr||[]).forEach(x=>{
      const muscle = x.muscle || "Other";
      if(!muscleVol[muscle]) muscleVol[muscle]=0;
      muscleVol[muscle]+=(parseFloat(x.weight)||0)*(parseInt(x.reps)||0);
    });
  });
  // Better muscle mapping from exercise names
  const muscleMap={"Bench Press":"Chest","Incline Press (DB)":"Chest","Cable Fly":"Chest","Pec Deck / Cable Fly":"Chest","T-Bar Row":"Back","Reverse Grip Lat Pulldown":"Back","Seated Cable Row":"Back","Reverse Grip Pulldown":"Back","Machine Shoulder Press":"Shoulders","Cable Lateral Raise":"Shoulders","Rear Delt Machine":"Shoulders","DB / Cable Lateral Raises":"Shoulders","Front Delt Raise":"Shoulders","Cable Rope Pressdown":"Triceps","Incline Tricep Extension":"Triceps","Cable Overhead Extension":"Triceps","Cable Curl":"Biceps","Concentration Curl":"Biceps","Barbell / Cable Curl":"Biceps","Goblet Squat":"Legs","DB Romanian Deadlift":"Legs","Box Step-Ups (DB)":"Legs","DB Lunges (optional)":"Legs","Decline Sit-Ups":"Abs","Machine Crunch":"Abs","Russian Twist":"Abs","Stair Stepper":"Cardio"};
  const muscleVolMapped={};
  const fineSets={};
  let cardioSets=0,cardioMinutes=0;
  sessions.filter(s=>s.completedAt&&new Date(s.completedAt)>sevenDaysAgo).forEach(s=>{
    (s.setsArr||[]).filter(x=>x.type!=="warmup").forEach(x=>{
      // Cardio is a modality, not a muscle: cardio sets carry `minutes` (strength
      // sets carry weight — same flag History uses). Count sets + sum minutes; no
      // tonnage, and keep them out of the muscle-group bars.
      if(x.minutes){cardioSets++;cardioMinutes+=parseFloat(x.minutes)||0;return;}
      // Tonnage = primary mover, resolved by the SAME resolver as set credit (muscleContributions
      // → rollupToGroup) so the bar and the set count in a row never come from different maps; the
      // coarse muscleMap is the fallback. Missing weight contributes 0 tonnage (not reps×1).
      const m=primaryMoverGroup(x.exName,muscleMap[x.exName]);
      if(!muscleVolMapped[m])muscleVolMapped[m]=0;
      muscleVolMapped[m]+=(parseFloat(x.weight)||0)*(parseInt(x.reps)||0);
      // Sets are fractionalized via the resolver: 1.0 each primary muscle, 0.5 each
      // secondary. Cardio-by-name and unmapped-without-coarse-tag don't count.
      const res=muscleContributions(x.exName,muscleMap[x.exName]);
      if(res.counted)res.contributions.forEach(c=>{fineSets[c.muscle]=(fineSets[c.muscle]||0)+c.factor;});
    });
  });
  // Roll fine-muscle set credit up to the display groups.
  const groupSets={};
  for(const fine in fineSets){const g=rollupToGroup(fine);groupSets[g]=(groupSets[g]||0)+fineSets[fine];}
  const muscleOrder=["Chest","Back","Shoulders","Biceps","Triceps","Legs","Abs"];
  // Scale bars to the displayed groups only — "Other" (unresolved lifts) isn't rendered, so it
  // must not be the scaling denominator (it would understate every visible bar).
  const maxMuscleVol=Math.max(...muscleOrder.map(m=>muscleVolMapped[m]||0),1);


  async function loadTrainerInsight(){
    setLoadingInsight(true);
    const recentSessions=sessions.slice(0,5).map(s=>({day:s.dayLabel,date:s.completedAt?new Date(s.completedAt).toLocaleDateString("en-CA"):undefined,sets:(s.setsArr||[]).length}));
    const topPRs=prList.slice(0,5).map(([n,p])=>(`${n}: ${p.weight}lbs`));
    const prompt=`You are a personal trainer AI.${aiProfileContext(settings)} Analyze this user's recent workout data and provide ONE specific, actionable insight in 2-3 sentences. Be direct and personalized.

Recent sessions: ${JSON.stringify(recentSessions)}
Top PRs: ${topPRs.join(", ")}
Total sessions: ${sessions.length}
This week volume: ${Math.round(weekVol).toLocaleString()} lbs
28-day volume change: ${vol28Delta!==null?`${vol28Delta>0?"+":""}${vol28Delta}%`:"N/A"}

Focus on: progress trends, recovery patterns, or a specific recommendation to improve results. No generic advice.`;
    try{
      const data=await callAI({action:"coach_insight",messages:[{role:"user",content:prompt}],maxTokens:200});
      if(data.upgradeRequired){setCoachUpgrade(data);setLoadingInsight(false);return;}
      setTrainerInsight(data.content?.find(b=>b.type==="text")?.text||"");
    }catch{
      setTrainerInsight("Unable to load AI insight right now. Tap Refresh to try again.");
    }
    setLoadingInsight(false);
  }

  const tabStyle=(active)=>({flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:active?C.accentBtn:"transparent",color:active?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:10,cursor:"pointer",letterSpacing:"0.04em"});

  return <div>
    <div style={{background:C.bg,borderBottom:`1px solid ${C.border}`,padding:"16px 18px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
        <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Progress</div>
        <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 11px",fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>{themeMode==="dark"?<Moon size={ICON.md} strokeWidth={1.75}/>:<Sun size={ICON.md} strokeWidth={1.75}/>}{themeMode==="dark"?"DARK":"LIGHT"}</button>
      </div>
      <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:12}}>{(()=>{const wk=planWeekOf(activePlan);const tot=activePlan?.durationWeeks||10;const fb=programStart?programWeekFromDate(programStart):programWeek(sessions);return wk?`Week ${Math.min(wk,tot)} of ${tot} in your program`:`Week ${fb} of your program`;})()}</Mono>
      <div style={{display:"flex",gap:4,background:C.card,padding:4,borderRadius:10}}>
        {[["overview","Overview"],["progress","Progress"],["muscles","Muscles"],["body","Body"],["trainer","✦ Coach"]].filter(([k])=>k!=="trainer"||(settings.showCoach&&settings.showCoaching)).map(([k,label])=>(
          <button key={k} onClick={()=>{setStatsView(k);if(k==="trainer"&&!trainerInsight)loadTrainerInsight();}} style={tabStyle(statsView===k)}>{label}</button>
        ))}
      </div>
    </div>

    <div style={{padding:"14px 18px"}}>

      {/* OVERVIEW */}
      {statsView==="overview"&&<div>
        {/* Judgment digest — always-on adherence line + situational judgment lines (positive-first,
            capped, deduped per lift). Inputs are pre-GATED here (off → the line is hidden; the engine
            still powers its own surfaces); the pure assembleDigest orders/dedups/caps. */}
        {(()=>{
          const anchor=activePlan?.startDate||programStart||getProgramStart(sessions);
          const adherence=weeklyAdherence(activePlan,sessions,anchor,new Date());
          let recentPR=null; // prDetection-gated; only when achieved within ~2 weeks
          if(settings.prDetection){const rp=recentPRs(prs,1)[0];if(rp&&rp[1]&&rp[1].date){const da=Math.round((Date.now()-new Date(rp[1].date).getTime())/86400000);if(da>=0&&da<=14)recentPR={lift:rp[0],weight:rp[1].weight,when:da===0?"today":`${da}d ago`};}}
          let plateaus=[]; // showPlateaus && showCoaching (same gate as the Plateaus card)
          if(settings.showPlateaus&&settings.showCoaching){const lm=Object.fromEntries(allExNames.map(n=>[n,seriesFor(n)]).filter(([,s])=>s.length>0));plateaus=detectPlateaus(lm,{tonnage:Object.fromEntries(allExNames.map(n=>[n,tonnageSeriesFor(n)])),priorBest:plateauPB?.map,now:plateauPB?.now});}
          let volumeFlag=null; // showVolumeTargets && showCoaching (same gate as RealizedVolumeInsight)
          if(settings.showVolumeTargets&&settings.showCoaching){const rv=analyzeRealized(sessions,{goal:(settings.aiGoal||"").toLowerCase(),windowDays:28});if(rv.sufficient){const f=(rv.perGroup||[]).find(g=>g.status!=="in_range");if(f)volumeFlag={group:f.group,status:f.status};}}
          const digest=assembleDigest({adherence,currentStreak:settings.streakTracking?complianceStreak:0,recentPR,plateaus,volumeFlag,deloadNewlyDue:!!deloadDue});
          const toneColor={positive:C.neonInk,caution:C.goldInk,info:C.accentInk,neutral:C.text};
          return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:14}}>
            <SectionLabel C={C}>This Week</SectionLabel>
            {digest.lines.map((ln,i)=>(
              <div key={i} style={{fontSize:i===0?14:12,fontWeight:i===0?700:500,color:toneColor[ln.tone]||C.text,marginTop:i===0?2:8,lineHeight:1.5}}>{ln.text}</div>
            ))}
          </div>;
        })()}

        {/* PR Board */}
        {prList.length>0&&<div style={{marginBottom:14}}>
          <SectionLabel C={C}>Personal Records</SectionLabel>
          {prList.slice(0,5).map(([name,pr])=>(
            <div key={name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:13}}>{name}</div>
              <Mono style={{fontSize:14,color:C.goldInk,fontWeight:700}}>{pr.weight} lbs</Mono>
            </div>
          ))}
        </div>}

        <div style={{marginBottom:14}}><OverloadCalc C={C}/></div>
      </div>}

      {/* PROGRESS */}
      {statsView==="progress"&&(()=>{
        const mono="'SF Mono','Courier New',monospace";
        const cardSt={background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 14px",marginBottom:10};
        const thSt={color:C.faint,fontWeight:600,padding:"4px 6px",fontSize:9,letterSpacing:"0.08em",borderBottom:`1px solid ${C.border}`,fontFamily:mono};
        const tdSt={padding:"5px 6px",borderBottom:`1px solid ${C.border}`,fontFamily:mono,fontSize:11};
        const tableSt={width:"100%",borderCollapse:"collapse",marginTop:6};
        const emptySt={textAlign:"center",padding:"24px",color:C.muted,fontFamily:mono,fontSize:12};
        // Effective view: drill-down defaults to the work-log Table, the all-lifts overview to
        // Chart; once the user taps the toggle their explicit choice (progressView) wins everywhere.
        const view=progressView||(selEx?"table":"chart");
        return <div>
          <SectionLabel C={C}>{selEx?"Exercise Progress":"Progress — All Lifts"}</SectionLabel>
          {/* Controls: exercise selector + chart/table toggle */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <select value={selEx||""} onChange={e=>setSelEx(e.target.value||null)}
              style={{flex:1,minWidth:0,padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:mono}}>
              <option value="">All exercises</option>
              {allExNames.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{display:"flex",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",flexShrink:0}}>
              {[["chart","◊ Chart"],["table","▦ Table"]].map(([k,lbl])=>(
                <button key={k} onClick={()=>setProgressView(k)} style={{padding:"9px 12px",background:view===k?C.accentBtn:"transparent",color:view===k?"#fff":C.muted,border:"none",fontFamily:mono,fontSize:11,fontWeight:view===k?700:400,cursor:"pointer",letterSpacing:"0.04em"}}>{lbl}</button>
              ))}
            </div>
          </div>

          {!selEx ? (()=>{
            // ===== ALL MODE — one compact card per lift (tap to drill in) =====
            const lifts=allExNames.map(n=>({name:n,series:seriesFor(n)})).filter(x=>x.series.length>0);
            if(!lifts.length) return <div style={emptySt}>Log weighted sessions to see progress.</div>;
            const plateaus=detectPlateaus(Object.fromEntries(lifts.map(l=>[l.name,l.series])),{tonnage:Object.fromEntries(lifts.map(l=>[l.name,tonnageSeriesFor(l.name)])),priorBest:plateauPB?.map,now:plateauPB?.now});
            // Volume-aware plateau advice: cross each stall with the muscle's realized 28-day
            // volume status (same engine as the Muscles overlay → consistent advice). Additive:
            // the 'plain' tier renders today's suggestion unchanged.
            const rvP=analyzeRealized(sessions,{goal:(settings.aiGoal||"").toLowerCase(),windowDays:28});
            const perMuscleStatus=rvP.sufficient?Object.fromEntries(rvP.perMuscle.map(m=>[m.muscle,m.status])):{};
            return <>
              {settings.showPlateaus&&settings.showCoaching&&plateaus.length>0&&<div style={{...cardSt,padding:"12px 14px"}}>
                <div onClick={()=>setPlateausExpanded(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <span style={{color:C.faint,display:"inline-flex",flexShrink:0}}>{plateausExpanded?<ChevronDown size={ICON.sm} strokeWidth={1.75}/>:<ChevronRight size={ICON.sm} strokeWidth={1.75}/>}</span>
                  <SectionLabel C={C}>Plateaus ({plateaus.length})</SectionLabel>
                </div>
                {plateausExpanded&&plateaus.map(p=>{
                  const adv=volumeAwarePlateauAdvice(p.exercise,perMuscleStatus,primaryGatedMuscles,p.suggestion);
                  return <div key={p.exercise} onClick={()=>setSelEx(p.exercise)} style={{cursor:"pointer",padding:"7px 0",borderTop:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <Mono style={{fontSize:12,color:C.text}}>{p.exercise} — {p.status} {p.stalledWeeks} wks{adv.tier==="plain"?` · ${p.suggestion}`:""}</Mono>
                      <span style={{color:C.faint,fontSize:16,flexShrink:0,paddingLeft:8}}>›</span>
                    </div>
                    {adv.tier!=="plain"&&<Mono style={{fontSize:11,color:C.muted,display:"block",marginTop:4,lineHeight:1.5}}>{adv.copy}</Mono>}
                  </div>;
                })}
              </div>}
              {lifts.map(({name,series})=>{
              const pr=prs[name]?.weight||Math.max(...series.map(s=>s.weight));
              return <div key={name} onClick={()=>setSelEx(name)} style={{...cardSt,cursor:"pointer",position:"relative"}}>
                <div style={{position:"absolute",right:12,top:10,color:C.faint,fontSize:18,lineHeight:1}}>›</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingRight:18,gap:8}}>
                  <span style={{fontSize:14,fontWeight:700}}>{name}</span>
                  <span style={{fontFamily:mono,fontSize:11,flexShrink:0,whiteSpace:"nowrap"}}>
                    <PRMark value={pr} C={C}/>
                  </span>
                </div>
                {view==="chart"
                  ? (series.length>=2?<Sparkline data={series} color={C.accent}/>:<Mono style={{fontSize:11,color:C.muted,padding:"4px 2px",display:"block"}}>One session — need 2+ for a trend</Mono>)
                  : <table style={tableSt}><tbody>
                      <tr><th style={{...thSt,textAlign:"left"}}>DATE</th><th style={{...thSt,textAlign:"right"}}>MAX</th><th style={{...thSt,textAlign:"right"}}>EST 1RM</th></tr>
                      {series.slice(-4).map((d,i,arr)=>{const hi=i===arr.length-1;return <tr key={d.date}>
                        <td style={tdSt}>{d.label}</td>
                        <td style={{...tdSt,textAlign:"right",color:hi?C.neonInk:C.text,fontWeight:hi?700:400}}>{d.weight}</td>
                        <td style={{...tdSt,textAlign:"right",color:hi?C.neonInk:C.muted}}>{d.orm}</td>
                      </tr>;})}
                    </tbody></table>}
              </div>;
            })}
            </>;
          })() : <div>
            {/* ===== DRILL-DOWN (single exercise) ===== */}
            <div style={{position:"sticky",top:0,zIndex:10,background:C.bg,paddingBottom:12}}>
              <button onClick={()=>setSelEx(null)} aria-label="Back to all exercises" style={{display:"flex",alignItems:"center",gap:8,width:"100%",minHeight:44,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.accentInk,fontFamily:mono,fontSize:13,fontWeight:600,letterSpacing:"0.04em",cursor:"pointer",padding:"0 14px"}}>← All exercises</button>
            </div>
            {view==="chart"
              ? (chartData.length>1?<div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 8px",marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4,paddingLeft:8}}>{selEx} — Max Weight</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData} margin={{top:4,right:12,left:-10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="label" tick={{fill:C.muted,fontSize:9,fontFamily:mono}}/>
                        <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:mono}}/>
                        <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:mono,fontSize:11,color:C.text}}/>
                        <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} activeDot={{r:5}}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 8px",marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4,paddingLeft:8}}>{selEx} — Est. 1RM Trend</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={chartData} margin={{top:4,right:12,left:-10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="label" tick={{fill:C.muted,fontSize:9,fontFamily:mono}}/>
                        <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:mono}}/>
                        <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:mono,fontSize:11,color:C.text}}/>
                        <Line type="monotone" dataKey="orm" stroke={C.gold} strokeWidth={2} dot={{fill:C.gold,r:3}} activeDot={{r:5}}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {settings.showPlateaus&&settings.showCoaching&&(()=>{
                    const proj=projectExercise(chartData);
                    let text;
                    if(proj.status==="gaining"){
                      text=`Trending +${proj.trendPerWeek} lb/wk`;
                      if(proj.projected)text+=` · projected ~${proj.projected.mid} lb in ${proj.projected.weeks} wks (${proj.projected.low}–${proj.projected.high}), if the trend holds`;
                      if(proj.milestone)text+=` · on pace for ${proj.milestone.target} lb in ~${Math.max(1,Math.round(proj.milestone.weeks))} wks`;
                    }
                    else if(proj.status==="declining")text="Trending down recently";
                    else if(proj.status==="flat")text="Trending flat — consider a deload or variation";
                    else text="Keep logging — ~5 sessions over 3+ weeks to project this lift";
                    return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:12}}>
                      <SectionLabel C={C}>Projection</SectionLabel>
                      <Mono style={{fontSize:12,color:C.muted,lineHeight:1.6,display:"block"}}>{text}</Mono>
                    </div>;
                  })()}
                  {prs[selEx]&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:12}}>
                    <SectionLabel C={C}>Strength Level</SectionLabel>
                    <div style={{display:"flex",gap:4}}>
                      {STRENGTH_LEVELS.map((level,i)=>{const score=getStrengthScore(selEx,prs[selEx]?.weight);return <div key={level} style={{flex:1,textAlign:"center"}}>
                        <div style={{height:8,borderRadius:4,background:i<=score?C.accent:C.border,marginBottom:4,transition:"background .3s"}}/>
                        <Mono style={{fontSize:8,color:i<=score?C.accentInk:C.faint}}>{level.slice(0,3)}</Mono>
                      </div>;})}
                    </div>
                    <Mono style={{fontSize:12,color:C.accentInk,display:"block",marginTop:8,textAlign:"center",fontWeight:700}}>{STRENGTH_LEVELS[getStrengthScore(selEx,prs[selEx]?.weight)]} — {prs[selEx]?.weight} lbs</Mono>
                  </div>}
                </div>:<div style={emptySt}>Log 2+ weighted sessions of {selEx} to see your trend.</div>)
              : (sessionRows.length>=1?<div style={cardSt}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{selEx} — Session History</div>
                  {/* One row per session, sets compressed: uniform → "N×reps @ weight", a change
                      starts a new group in performed order → "2×8 @ 185, 1×6 @ 185". Newest first;
                      top row (most recent) highlighted so week-over-week overload reads at a glance. */}
                  <table style={tableSt}><tbody>
                    <tr><th style={{...thSt,textAlign:"left"}}>DATE</th><th style={{...thSt,textAlign:"left"}}>SETS</th></tr>
                    {sessionRows.map((s,i)=>{const hi=i===0;return <tr key={s.sessionId}>
                      <td style={{...tdSt,whiteSpace:"nowrap",verticalAlign:"top",color:hi?C.neonInk:C.text,fontWeight:hi?700:400}}>{s.date?s.date.slice(5):"—"}</td>
                      <td style={{...tdSt,color:hi?C.neonInk:C.text,fontWeight:hi?700:400}}>{s.groups.map(g=>`${g.count}×${g.reps} @ ${g.weight}`).join(", ")}</td>
                    </tr>;})}
                  </tbody></table>
                </div>:<div style={emptySt}>Log weighted sessions of {selEx} to see data.</div>)}
          </div>}
        </div>;
      })()}

      {/* MUSCLE VOLUME DASHBOARD */}
      {statsView==="muscles"&&<div>
        {settings.showVolumeTargets&&settings.showCoaching&&<RealizedVolumeInsight sessions={sessions} settings={settings} C={C}/>}
        <SectionLabel C={C}>Volume by Muscle — Last 7 Days</SectionLabel>
        {muscleOrder.filter(m=>muscleVolMapped[m]>0||groupSets[m]>0).length===0&&cardioSets===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Log workouts to see muscle volume breakdown.</div>}
        {muscleOrder.map(muscle=>{
          const vol=muscleVolMapped[muscle]||0;
          const sets=Math.round((groupSets[muscle]||0)*2)/2;
          if(!vol&&!sets)return null;
          const pct=Math.round((vol/maxMuscleVol)*100);
          const colors={"Chest":C.accent,"Back":C.blue,"Shoulders":C.gold,"Biceps":C.neon,"Triceps":C.neon,"Legs":"#b06aff","Abs":C.muted,"Cardio":C.green};
          return <div key={muscle} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <Mono style={{fontSize:12,color:C.text,fontWeight:600}}>{muscle}</Mono>
              <Mono style={{fontSize:11,color:C.muted}}>{sets} set{sets!==1?"s":""} · {Math.round(vol/1000*10)/10}k lbs</Mono>
            </div>
            <div style={{height:10,background:C.border,borderRadius:5}}>
              <div style={{height:"100%",background:colors[muscle]||C.accent,borderRadius:5,width:`${pct}%`,transition:"width .5s ease"}}/>
            </div>
          </div>;
        })}
        {/* Cardio — modality, not a muscle: sets + total minutes, no tonnage, no bar */}
        {cardioSets>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <Mono style={{fontSize:12,color:C.text,fontWeight:600}}>Cardio</Mono>
          <Mono style={{fontSize:11,color:C.muted}}>{cardioSets} set{cardioSets!==1?"s":""} · {Math.round(cardioMinutes)} min</Mono>
        </div>}
        {/* Disclose the fractional-set basis so "{sets} sets" above isn't read as raw hard sets.
            Same 0.5 convention RealizedVolumeInsight discloses; shown only when there are sets. */}
        {muscleOrder.some(m=>(groupSets[m]||0)>0)&&<Mono style={{fontSize:10,color:C.faint,display:"block",marginTop:6,lineHeight:1.6}}>Set counts credit secondary-mover muscles at 0.5 — a modeling convention, not a measured value.</Mono>}
        {/* Personal records — per LIFT (from personal_records), most-recently-achieved first. No
            strength level: getStrengthScore uses absolute-lbs benchmarks with no bodyweight/sex
            normalization, so a Beginner..Elite label was never decision-grade. */}
        <div style={{marginTop:20}}>
          <SectionLabel C={C}>Personal Records</SectionLabel>
          {recentPRs(prs,8).map(([name,pr])=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:12}}>{name}</div>
              <Mono style={{fontSize:10,color:C.muted,flexShrink:0,marginLeft:8}}>{pr.weight} lbs{pr.date?` · ${new Date(pr.date).toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}`:""}</Mono>
            </div>
          ))}
        </div>
      </div>}

      {/* BODY MEASUREMENTS */}
      {statsView==="body"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <SectionLabel C={C}>Body Measurements</SectionLabel>
          <Btn size="sm" variant="subtle" C={C} onClick={()=>setAddingBody(true)}>+ Log</Btn>
        </div>
        {addingBody&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:14}}>
          <SectionLabel C={C}>New Entry — {newBodyStat.date}</SectionLabel>
          {[["Weight (lbs)","weight"],["Chest (in)","chest"],["Waist (in)","waist"],["Hips (in)","hips"],["Arms (in)","arms"]].map(([label,key])=>(
            <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <Mono style={{fontSize:12,color:C.muted,width:120}}>{label}</Mono>
              <input type="number" value={newBodyStat[key]||""} onChange={e=>setNewBodyStat(p=>({...p,[key]:e.target.value}))}
                style={{width:80,padding:"6px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"right"}}/>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <Btn size="sm" C={C} style={{flex:1}} onClick={()=>{
              if(newBodyStat.weight||newBodyStat.chest||newBodyStat.waist){
                const updated=[{...newBodyStat,id:Date.now()},...bodyStats];
                setBodyStats(updated);
                if(onBodyStatsChange)onBodyStatsChange(updated);
                setNewBodyStat({weight:"",chest:"",waist:"",hips:"",arms:"",date:new Date().toLocaleDateString("en-CA")});
                setAddingBody(false);
              }
            }}>Save</Btn>
            <Btn size="sm" variant="ghost" C={C} style={{flex:1}} onClick={()=>setAddingBody(false)}>Cancel</Btn>
          </div>
        </div>}
        {bodyStats.length===0&&!addingBody&&<div style={{textAlign:"center",padding:"32px 0",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>
          No measurements logged yet.<br/>Tap + Log to add your first entry.
        </div>}
        {bodyStats.length>0&&<div>
          {/* Weight trend chart */}
          {bodyStats.filter(s=>s.weight).length>1&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 8px",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:8,paddingLeft:8}}>Weight Trend</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={[...bodyStats].reverse().filter(s=>s.weight).map(s=>({date:s.date.slice(5),weight:parseFloat(s.weight)}))} margin={{top:4,right:12,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="date" tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
                <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
                <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,color:C.text}}/>
                <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>}
          {bodyStats.slice(0,5).map(s=>(
            <div key={s.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",marginBottom:8}}>
              <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:6}}>{s.date}</Mono>
              <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
                {s.weight&&<div><Mono style={{fontSize:9,color:C.muted}}>WT </Mono><span style={{fontSize:14,fontWeight:700}}>{s.weight}<Mono style={{fontSize:10,color:C.muted}}> lbs</Mono></span></div>}
                {s.chest&&<div><Mono style={{fontSize:9,color:C.muted}}>CH </Mono><span style={{fontSize:14,fontWeight:700}}>{s.chest}<Mono style={{fontSize:10,color:C.muted}}>"</Mono></span></div>}
                {s.waist&&<div><Mono style={{fontSize:9,color:C.muted}}>WA </Mono><span style={{fontSize:14,fontWeight:700}}>{s.waist}<Mono style={{fontSize:10,color:C.muted}}>"</Mono></span></div>}
                {s.arms&&<div><Mono style={{fontSize:9,color:C.muted}}>AR </Mono><span style={{fontSize:14,fontWeight:700}}>{s.arms}<Mono style={{fontSize:10,color:C.muted}}>"</Mono></span></div>}
              </div>
            </div>
          ))}
        </div>}
      </div>}

      {/* AI TRAINER */}
      {statsView==="trainer"&&settings.showCoach&&settings.showCoaching&&<div>
        <div style={{background:`linear-gradient(135deg,${C.accent}18,${C.neon}10)`,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"18px",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>✦ Personal Trainer AI</div>
          <div style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:14}}>Weekly insight based on your actual training data.</div>
          {loadingInsight?<div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Analyzing your training...</div>
            :coachUpgrade?<UpgradePrompt {...coachUpgrade} C={C}/>
            :<div>
              {trainerInsight&&<div style={{fontSize:13,lineHeight:1.8,color:C.text,marginBottom:14,padding:"12px",background:C.card,borderRadius:8}}>{trainerInsight}</div>}
              <Btn size="sm" variant="ghost" C={C} onClick={()=>{if(loadingInsight)return;setCoachUpgrade(null);loadTrainerInsight();}} style={{width:"100%"}}>
                {trainerInsight?"↺ Refresh Insight":"✦ Get My Insight"}
              </Btn>
            </div>}
        </div>
      </div>}

    </div>
  </div>;
}

// -- EXPORT PANEL -------------------------------------------------------------


// -- MORE / SETTINGS -----------------------------------------------------------
function MoreTab({settings,saveSettings,plans,sessions,prs,C,toggleTheme,themeMode,authUser}){
  const [local,setLocal]=useState({...settings});
  const [saved,setSaved]=useState(false);
  const [healthMsg,setHealthMsg]=useState("");
  const [displayName,setDisplayName]=useState(authUser?.user_metadata?.display_name||authUser?.email?.split("@")[0]||"");
  const [nameMsg,setNameMsg]=useState("");
  const [pwMsg,setPwMsg]=useState("");
  const [exportMsg,setExportMsg]=useState("");
  const isIOSSafari=typeof navigator!=="undefined"&&/iPhone|iPad|iPod/.test(navigator.userAgent)&&/Safari/.test(navigator.userAgent)&&!/Chrome|CriOS|FxiOS/.test(navigator.userAgent);

  function save(){saveSettings(local);setSaved(true);setTimeout(()=>setSaved(false),2000);}

  async function saveDisplayName(){
    if(!displayName.trim())return;
    try{
      const {error}=await supabase.auth.updateUser({data:{display_name:displayName.trim()}});
      if(error)throw error;
      setNameMsg("Saved");setTimeout(()=>setNameMsg(""),2500);
    }catch(e){console.error("saveDisplayName:",e);setNameMsg("Error saving — try again");}
  }

  async function sendPasswordReset(){
    try{
      const {error}=await supabase.auth.resetPasswordForEmail(authUser?.email,{redirectTo:window.location.origin});
      if(error)throw error;
      setPwMsg("Reset link sent to "+authUser?.email);setTimeout(()=>setPwMsg(""),4000);
    }catch(e){console.error("pwReset:",e);setPwMsg("Error — try again");}
  }

  // Anonymized training-data export. The fetch selects ONLY allowlisted columns (never id/user_id/
  // notes/etc.); `partial` is FILTERED but never selected. The pure serializer enforces the allowlist
  // again and converts dates to relative offsets + genericizes custom exercise names.
  async function copyTrainingExport(){
    try{
      const {data:{user:u}}=await supabase.auth.getUser();
      if(!u){setExportMsg("Sign in to export.");return;}
      const {data,error}=await supabase.from("logged_sets")
        .select("exercise_name,set_number,weight,reps,set_type,session_id,workout_sessions!inner(completed_at)")
        .eq("user_id",u.id)
        .not("workout_sessions.completed_at","is",null)
        .eq("workout_sessions.partial",false);
      if(error||!data){setExportMsg("Export failed — try again.");return;}
      const rows=data.map(r=>({exerciseName:r.exercise_name,setNumber:r.set_number,weight:r.weight,reps:r.reps,setType:r.set_type,sessionId:r.session_id,completedAt:r.workout_sessions?.completed_at}));
      const json=JSON.stringify(serializeTrainingExport(rows),null,2);
      await navigator.clipboard.writeText(json);
      setExportMsg("Copied — paste into your AI assistant.");setTimeout(()=>setExportMsg(""),4000);
    }catch(e){console.error("copyTrainingExport:",e);setExportMsg("Export failed — try again.");}
  }

  async function handleHealthToggle(){
    const next=!local.appleHealth;
    const updated={...local,appleHealth:next};
    setLocal(updated);
    saveSettings(updated);
    if(next){
      try{
        if(window.navigator.health?.requestAuthorization){
          await window.navigator.health.requestAuthorization(["workouts","activeEnergyBurned"]);
          setHealthMsg("Connected");
        }else{
          setHealthMsg("Saved — will sync on iPhone via Safari");
        }
      }catch{
        setHealthMsg("Saved — will sync on iPhone via Safari");
      }
      setTimeout(()=>setHealthMsg(""),3500);
    }else{
      setHealthMsg("");
    }
  }

  const features=[
    {key:"restTimer",label:"Rest Timer",desc:`Auto-starts between sets`},
    {key:"prDetection",label:"PR Detection",desc:"Highlights new personal records"},
    {key:"lastRef",label:"Last Session Reference",desc:"Shows previous weight/reps while logging"},
    {key:"deloadReminder",label:"Deload Reminder",desc:"Alerts after 6-8 weeks of training"},
    {key:"streakTracking",label:"Streak Tracking",desc:"Tracks consecutive training days"},
    {key:"plateCalc",label:"Plate Calculator",desc:"Shows plate math per exercise"},
    {key:"workoutNotes",label:"Session Notes",desc:"Add notes after each workout"},
    {key:"aiRecs",label:"AI Recommendations",desc:"Exercise swaps and plan analysis"},
  ];

  // Coaching & insights visibility — master + 4 sub-toggles. COMMIT 1 only wires persistence +
  // these rows; the surfaces are gated in later commits. Sub-rows are disabled when the master is off.
  const coachingToggles=[
    {key:"showPlateaus",label:"Plateau & trend callouts",desc:"Stall flags and projected trends"},
    {key:"showVolumeTargets",label:"Volume vs targets",desc:"Weekly sets vs evidence ranges + muscle balance"},
    {key:"showCoach",label:"Coach tab",desc:"AI insight tab in Stats"},
    {key:"showPlanAnalysis",label:"Plan analysis",desc:"The “Analyze plan” breakdown"},
  ];

  return <div>
    <div style={{background:C.bg,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Settings</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 11px",fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>{themeMode==="dark"?<Moon size={ICON.md} strokeWidth={1.75}/>:<Sun size={ICON.md} strokeWidth={1.75}/>}{themeMode==="dark"?"DARK":"LIGHT"}</button>
          <button onClick={async()=>{try{await supabase.auth.signOut();}catch(e){console.error("signOut:",e);}}} style={{background:"transparent",border:`1px solid ${C.danger}44`,borderRadius:8,color:C.dangerInk,cursor:"pointer",padding:"7px 12px",fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.04em"}}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
    <div style={{padding:"14px 18px"}}>
      <SectionLabel C={C}>Account</SectionLabel>
      <div style={{padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8,fontWeight:600}}>Display Name</div>
        <div style={{display:"flex",gap:8}}>
          <input value={displayName} onChange={e=>setDisplayName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&saveDisplayName()}
            style={{flex:1,padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",outline:"none",boxSizing:"border-box"}}/>
          <Btn onClick={saveDisplayName} C={C} size="sm">Save</Btn>
        </div>
        {nameMsg&&<Mono style={{fontSize:11,color:C.neonInk,display:"block",marginTop:6}}>{nameMsg}</Mono>}
      </div>
      <div style={{padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>Email</div>
        <Mono style={{fontSize:13,color:C.text}}>{authUser?.email}</Mono>
      </div>
      <div style={{padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14}}>Password</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Send a reset link to your email</div>
          </div>
          <Btn onClick={sendPasswordReset} C={C} size="sm" variant="ghost">Reset</Btn>
        </div>
        {pwMsg&&<Mono style={{fontSize:11,color:C.neonInk,display:"block",marginTop:6}}>{pwMsg}</Mono>}
      </div>
      <div style={{marginTop:18}}><SectionLabel C={C}>Data</SectionLabel></div>
      <div style={{padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14}}>Copy training data for AI</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Anonymized — exercises, sets, reps, weights, relative dates only. Paste into any AI assistant.</div>
          </div>
          <Btn onClick={copyTrainingExport} C={C} size="sm" variant="ghost">Copy</Btn>
        </div>
        {exportMsg&&<Mono style={{fontSize:11,color:C.neonInk,display:"block",marginTop:6}}>{exportMsg}</Mono>}
      </div>
      <div style={{marginTop:18}}><SectionLabel C={C}>Features</SectionLabel></div>
      {features.map(f=>(
        <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14}}>{f.label}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.desc}</div>
          </div>
          <Toggle on={!!local[f.key]} onToggle={()=>setLocal(p=>({...p,[f.key]:!p[f.key]}))} C={C}/>
        </div>
      ))}

      <div style={{marginTop:18}}><SectionLabel C={C}>Coaching & Insights</SectionLabel></div>
      {/* Master switch for all interpretive surfaces (plateau flags, volume vs targets, Coach tab,
          plan analysis). When off, the sub-toggles are dimmed and inert. */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{flex:1,paddingRight:16}}>
          <div style={{fontSize:14}}>Coaching &amp; insights</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>Show the app’s interpretive guidance</div>
        </div>
        <Toggle on={!!local.showCoaching} onToggle={()=>setLocal(p=>({...p,showCoaching:!p.showCoaching}))} C={C}/>
      </div>
      {coachingToggles.map(f=>(
        <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0 13px 18px",borderBottom:`1px solid ${C.border}`,opacity:local.showCoaching?1:0.4}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14}}>{f.label}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.desc}</div>
          </div>
          <Toggle on={!!local[f.key]} onToggle={()=>{if(!local.showCoaching)return;setLocal(p=>({...p,[f.key]:!p[f.key]}));}} C={C}/>
        </div>
      ))}

      {local.restTimer&&<div style={{padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
        <SectionLabel C={C}>Rest Duration (seconds)</SectionLabel>
        <input type="number" value={local.restSeconds||90} onChange={e=>setLocal(p=>({...p,restSeconds:parseInt(e.target.value)||90}))}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>}

      <Btn size="lg" style={{width:"100%",marginTop:20}} onClick={save} C={C}>{saved?"Saved":"Save Settings"}</Btn>

      {/* Workout reminders */}
      <div style={{marginTop:16,padding:"14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14,fontWeight:600}}>Workout Reminders</div>
            <Mono style={{fontSize:11,color:C.muted}}>Notify me on scheduled training days</Mono>
          </div>
          <Btn size="sm" variant="subtle" C={C} onClick={async()=>{
            if(!("Notification" in window)){alert("Notifications not supported on this device.");return;}
            const permission=await Notification.requestPermission();
            if(permission==="granted"){
              new Notification("IRON",{body:"Reminders enabled! You'll be notified on your scheduled training days.",icon:"/favicon.ico"});
            }else{
              alert("To enable reminders, allow notifications in your browser or phone settings.");
            }
          }}>Enable</Btn>
        </div>
      </div>

      {/* Apple Health */}
      <div style={{marginTop:12,padding:"14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14,fontWeight:600}}>Sync to Apple Health</div>
            <Mono style={{fontSize:11,color:C.muted}}>Log workouts to Apple Health automatically</Mono>
          </div>
          <Toggle on={!!local.appleHealth} onToggle={handleHealthToggle} C={C}/>
        </div>
        {healthMsg&&<Mono style={{fontSize:11,color:C.neonInk,display:"block",marginTop:8}}>{healthMsg}</Mono>}
        {!isIOSSafari&&<Mono style={{fontSize:10,color:C.muted,display:"block",marginTop:6}}>Available on iPhone via Safari</Mono>}
      </div>

      {local.aiRecs&&<div style={{marginTop:16,padding:"14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>AI Trainer Profile</div>
        <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:14}}>Personalizes all AI suggestions and coaching to your needs</Mono>
        {[
          {label:"Age Range",key:"aiAgeRange",opts:["20s","30s","40s","50s+"]},
          {label:"Experience",key:"aiExperience",opts:["Beginner","Intermediate","Advanced"]},
          {label:"Primary Goal",key:"aiGoal",opts:["Strength","Hypertrophy","General fitness"]},
        ].map(({label,key,opts})=>(
          <div key={key} style={{marginBottom:14}}>
            <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:6,letterSpacing:"0.08em"}}>{label.toUpperCase()}</Mono>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {opts.map(o=>(
                <button key={o} onClick={()=>setLocal(p=>({...p,[key]:p[key]===o?"":o}))}
                  style={{padding:"7px 12px",borderRadius:7,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",
                    border:local[key]===o?"none":`1px solid ${C.border}`,
                    background:local[key]===o?C.accentBtn:"transparent",
                    color:local[key]===o?"#fff":C.muted}}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:6,letterSpacing:"0.08em"}}>JOINT / HEALTH NOTES</Mono>
          <input type="text" value={local.aiJointNotes||""} placeholder="e.g. bad left knee, avoid overhead press"
            onChange={e=>setLocal(p=>({...p,aiJointNotes:e.target.value}))}
            style={{width:"100%",padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
        </div>
      </div>}

      <div style={{marginTop:24,padding:"14px 0",borderTop:`1px solid ${C.border}`}}>
        <SectionLabel C={C}>About</SectionLabel>
        <Mono style={{fontSize:12,color:C.muted,lineHeight:1.9,display:"block"}}>
          IRON Workout Tracker{"\n"}
          <span style={{color:C.muted}}>v2.0 . Supabase connected</span>
        </Mono>
      </div>
    </div>
  </div>;
}

// -- AI MODAL ------------------------------------------------------------------
function AIModal({exercise,day,settings,onClose,C}){
  const [response,setResponse]=useState("");
  const [loading,setLoading]=useState(true);
  const [aiUpgrade,setAiUpgrade]=useState(null);

  useEffect(()=>{getRecommendation();},[]);// eslint-disable-line react-hooks/exhaustive-deps

  async function getRecommendation(){
    setLoading(true);
    const isEx=!!exercise&&!day;
    const profile=aiProfileContext(settings);
    const prompt=isEx
      ?`You are a personal trainer specializing in hypertrophy and joint-safe training.${profile}
Program: ${exercise?.programNote||"Strength training program"}, currently week ${programWeek([])}.
Exercise: "${exercise.name}" -- ${exercise.muscle||"unknown"}, ${exercise.sets} sets × ${exercise.reps}.
Provide:
1. THREE alternative exercises for the same muscle group (joint-friendly, brief reason each)
2. ONE form or progression tip for the current exercise
Plain text, no markdown, be concise and direct.`
      :`You are a personal trainer analyzing a workout day.${profile}
Program: ${day?.programNote||"Strength training program"}, currently week ${programWeek([])}.
Day: "${day?.label}" (${day?.tag})
Exercises: ${(day?.exercises||[]).map(e=>`${e.name} (${e.sets}×${e.reps})`).join(", ")}.
Provide:
1. Assessment of structure and volume balance (2 sentences)
2. Any muscle gaps or imbalances
3. One concrete optimization suggestion
Plain text, no markdown, be concise.`;
    try{
      const data=await callAI({action:"coach_insight",messages:[{role:"user",content:prompt}],maxTokens:800});
      if(data.upgradeRequired){setAiUpgrade(data);setLoading(false);return;}
      setResponse(data.content?.find(b=>b.type==="text")?.text||"No recommendation available.");
    }catch{
      setResponse("Unable to reach AI. Please try again.");
    }
    setLoading(false);
  }

  return <Modal onClose={onClose} C={C} showClose={false}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>✦ AI Recommendation</div>
        <Mono style={{fontSize:11,color:C.muted}}>{exercise?exercise.name:`${day?.label} Day Analysis`}</Mono>
      </div>
      <Btn variant="ghost" size="sm" onClick={onClose} C={C}>✕</Btn>
    </div>
    {loading?<div style={{textAlign:"center",padding:"32px 0",fontFamily:"'SF Mono','Courier New',monospace",color:C.muted,fontSize:13}}>Analyzing...</div>
      :aiUpgrade?<UpgradePrompt {...aiUpgrade} C={C}/>
      :<div style={{fontSize:13,lineHeight:1.8,color:C.text,whiteSpace:"pre-wrap"}}>{response}</div>}
  </Modal>;
}

function WorkoutSummary({session,newPRs,previousPRs,complianceStreak,setsWarning,onClose,C}){
  const completedDate=new Date(session.completedAt);
  const durationMin=Math.max(1,Math.round((completedDate-new Date(session.startedAt))/60000));
  const dayName=completedDate.toLocaleDateString("en-US",{weekday:"long"});
  const dateStr=completedDate.toLocaleDateString("en-US",{month:"long",day:"numeric"});
  const workingSets=(session.setsArr||[]).filter(x=>x.type!=="warmup");
  const volume=workingSets.reduce((sum,x)=>sum+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0),0);
  const setCount=workingSets.length;
  const prList=Object.entries(newPRs||{}).map(([name,pr])=>({name,weight:pr.weight}));

  const handleShare=()=>{
    const text=`${session.dayLabel} complete! ${setCount} sets · ${volume>=1000?(volume/1000).toFixed(1)+"k":volume.toLocaleString()} lbs · ${durationMin} min${prList.length>0?` · ${prList.length} new PR${prList.length>1?"s":""}!`:""} 💪 #IRON`;
    if(navigator.share){navigator.share({title:"IRON Workout",text}).catch(()=>{});}
    else if(navigator.clipboard){navigator.clipboard.writeText(text).catch(()=>{});}
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'SF Mono','Courier New',monospace",paddingTop:"env(safe-area-inset-top,0px)",paddingBottom:"env(safe-area-inset-bottom,0px)",overflowY:"auto"}}>
      {setsWarning&&<div style={{background:"#f7c948",padding:"10px 18px",textAlign:"center"}}><Mono style={{fontSize:12,color:"#0b0c0e",fontWeight:700}}>Workout saved — set details failed to sync. Check History and re-log if needed.</Mono></div>}
      {/* Header */}
      <div style={{background:"linear-gradient(150deg,#3ecf8e 0%,#2ebd80 100%)",padding:"36px 24px 32px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.08)",top:-30,right:-20,pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.06)",bottom:-10,left:-15,pointerEvents:"none"}}/>
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.2)",marginBottom:16}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <circle cx={12} cy={12} r={10} fill="#3ecf8e"/>
              <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"0.04em",marginBottom:6}}>WORKOUT SUMMARY</div>
        <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:6}}>{session.dayLabel}</div>
        <div style={{fontSize:15,fontWeight:600,color:"#fff",marginBottom:3}}>{dayName}, {dateStr}</div>
        <div style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.9)",letterSpacing:"0.08em"}}>{durationMin} MIN</div>
      </div>

      {/* Content */}
      <div style={{padding:"20px 20px 32px"}}>
        {/* 2x2 stat grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.neon}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.neonInk,marginBottom:6}}>VOLUME</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.text}}>{volume>=1000?`${(volume/1000).toFixed(1)}k`:volume.toLocaleString()}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>lbs lifted</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.accent}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.accentInk,marginBottom:6}}>SETS</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.text}}>{setCount}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>completed</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.gold}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.goldInk,marginBottom:6}}>STREAK</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.goldInk}}>{complianceStreak}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>days on plan</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.red}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.redInk,marginBottom:6}}>NEW PRs</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.redInk}}>{prList.length}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>new records</div>
          </div>
        </div>

        {/* New records section */}
        {prList.length>0&&(
          <div style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.muted,marginBottom:12}}>NEW RECORDS</div>
            {prList.map((pr,i)=>(
              <div key={pr.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:i<prList.length-1?10:0,marginBottom:i<prList.length-1?10:0,borderBottom:i<prList.length-1?`1px solid ${C.border}`:"none"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.text}}>{pr.name}</div>
                  {previousPRs[pr.name]&&<div style={{fontSize:11,color:C.muted}}>was {previousPRs[pr.name].weight} lbs</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:4}}>{pr.weight} lbs</div>
                  <PRMark C={C}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={handleShare} style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:12,padding:14,fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:C.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
            </svg>
            SHARE
          </button>
          <button onClick={onClose} style={{background:"#3ecf8e",border:"none",borderRadius:12,padding:14,fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:"#fff",cursor:"pointer"}}>
            CLOSE ✓
          </button>
        </div>
      </div>
    </div>
  );
}
