import { useState, useEffect, useRef, Component } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@supabase/supabase-js";

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
  const start = new Date(getProgramStart(sessions)+"T12:00:00");
  const now = new Date();now.setHours(12,0,0,0);
  const days = Math.floor((now - start) / 86400000);
  return Math.max(1, Math.ceil((days + 1) / 7));
};
const planWeekOf = (plan) => {
  if (!plan?.startDate) return null;
  const start = new Date(plan.startDate + "T12:00:00");
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  if (days < 0) return 1;
  return Math.max(1, Math.ceil((days + 1) / 7));
};


// -- THEME ---------------------------------------------------------------------
const THEMES = {
  dark: {
    bg:"#161b22", surface:"#1e2530", card:"#252d3a", border:"#3a4456",
    accent:"#4f8ef7", neon:"#3ecf8e", red:"#f06584", gold:"#f7c948",
    blue:"#4f8ef7", green:"#3ecf8e", danger:"#f06584",
    text:"#e8edf4", muted:"#b0bac8", faint:"#6a7585", cardText:"#f2f5fa",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#1a2130", gradTop:"linear-gradient(135deg,#4f8ef715 0%,#3ecf8e08 100%)",
  },
  light: {
    bg:"#f7f9fc", surface:"#ffffff", card:"#ffffff", border:"#e2e8f0",
    accent:"#4f8ef7", neon:"#0ea66e", red:"#e53e6a", gold:"#d4a017",
    blue:"#4f8ef7", green:"#0ea66e", danger:"#e53e6a",
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
  return <span style={{fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",background:color+"20",color,padding:"2px 10px 2px 8px",borderRadius:3,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,border:`1px solid ${color}40`,...style}}>{children}</span>;
}

function Btn({children,onClick,variant="primary",size="md",style={},disabled=false,C}){
  const sizes={sm:{padding:"6px 13px",fontSize:11},md:{padding:"10px 18px",fontSize:13},lg:{padding:"14px 24px",fontSize:14}};
  const bg={primary:C.accent,ghost:"transparent",danger:C.danger+"22",subtle:C.card,gold:C.gold};
  const col={primary:"#fff",ghost:C.text,danger:C.danger,subtle:C.text,gold:"#fff"};
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
    <div style={{fontSize:20,fontFamily:"'SF Mono','Courier New',monospace",color:rem<10?C.red:C.neon,fontWeight:700,minWidth:42}}>
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
  return <Mono style={{fontSize:11,color:C.neon,marginTop:3,display:"block"}}>⚖ Each side: {res.length?res.join(" + "):"bar only"}{rem>0.1?<span style={{color:C.muted}}> (+{rem.toFixed(1)})</span>:null}</Mono>;
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
        <div style={{fontSize:24,fontWeight:600,fontFamily:"'SF Mono','Courier New',monospace",color:C.gold}}>{p25}</div>
        <Mono style={{fontSize:10,color:C.muted}}>lbs</Mono>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.gold}88`,borderRadius:6,padding:"12px",textAlign:"center"}}>
        <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",display:"block",marginBottom:4}}>+5% NEXT</Mono>
        <div style={{fontSize:24,fontWeight:600,fontFamily:"'SF Mono','Courier New',monospace",color:C.gold}}>{p5}</div>
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

  const inputStyle={
    width:"100%",padding:"13px 14px",
    background:"#252d3a",border:"1px solid #3a4456",
    borderRadius:10,color:"#e8edf4",fontSize:16,
    fontFamily:"'SF Mono','Courier New',monospace",
    boxSizing:"border-box",outline:"none",
    WebkitAppearance:"none"
  };

  return <div style={{minHeight:"100vh",background:"#161b22",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"Georgia,serif"}}>
    {/* Theme toggle */}
    <div style={{width:"100%",maxWidth:380}}>
      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:36}}>
        {/* Dumbbell icon */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:14,position:"relative"}}>
          <img src="data:image/jpeg;base64,/9j/4QFARXhpZgAATU0AKgAAAAgACAEOAAIAAAALAAAAbgESAAMAAAABAAEAAAEaAAUAAAABAAAAegEbAAUAAAABAAAAggEoAAMAAAABAAIAAAEyAAIAAAAUAAAAigITAAMAAAABAAEAAIdpAAQAAAABAAAAngAAAABTY3JlZW5zaG90AAAAAABIAAAAAQAAAEgAAAABMjAyNjowNTowNiAxNDo0NToyMwAACZAAAAcAAAAEMDIyMZADAAIAAAAUAAABEJEBAAcAAAAEAQIDAJKGAAcAAAASAAABJKAAAAcAAAAEMDEwMKABAAMAAAABAAEAAKACAAQAAAABAAAEdqADAAQAAAABAAAEn6QGAAMAAAABAAAAAAAAAAAyMDI2OjA1OjA2IDE0OjQ1OjIzAEFTQ0lJAAAAU2NyZWVuc2hvdAAA/+ELVGh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6SXB0YzR4bXBFeHQ9Imh0dHA6Ly9pcHRjLm9yZy9zdGQvSXB0YzR4bXBFeHQvMjAwOC0wMi0yOS8iIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgcGhvdG9zaG9wOkNyZWRpdD0iQXBwbGUgUGhvdG9zIENsZWFuIFVwIiBwaG90b3Nob3A6RGF0ZUNyZWF0ZWQ9IjIwMjYtMDUtMDZUMTQ6NDU6MjMiIElwdGM0eG1wRXh0OkRpZ2l0YWxTb3VyY2VUeXBlPSJodHRwOi8vY3YuaXB0Yy5vcmcvbmV3c2NvZGVzL2RpZ2l0YWxzb3VyY2V0eXBlL2NvbXBvc2l0ZVdpdGhUcmFpbmVkQWxnb3JpdGhtaWNNZWRpYSIgeG1wOk1vZGlmeURhdGU9IjIwMjYtMDUtMDZUMTQ6NDU6MjMiPiA8ZGM6ZGVzY3JpcHRpb24+IDxyZGY6QWx0PiA8cmRmOmxpIHhtbDpsYW5nPSJ4LWRlZmF1bHQiPlNjcmVlbnNob3Q8L3JkZjpsaT4gPC9yZGY6QWx0PiA8L2RjOmRlc2NyaXB0aW9uPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmRlc2MAAAD8AAAAMGNwcnQAAAEsAAAAUHd0cHQAAAF8AAAAFHJYWVoAAAGQAAAAFGdYWVoAAAGkAAAAFGJYWVoAAAG4AAAAFHJUUkMAAAHMAAAAIGNoYWQAAAHsAAAALGJUUkMAAAHMAAAAIGdUUkMAAAHMAAAAIG1sdWMAAAAAAAAAAQAAAAxlblVTAAAAFAAAABwARABpAHMAcABsAGEAeQAgAFAAM21sdWMAAAAAAAAAAQAAAAxlblVTAAAANAAAABwAQwBvAHAAeQByAGkAZwBoAHQAIABBAHAAcABs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/Sl3NUm1aiPWgBdzUhOaSigB6sAMU3OaASBijaaAEooooAKKKKAJlORj0p1QA4GBRk0AT5X1qJmPQUyigAqZRgVDS5NAE9FMDDFOBBoAWiioixzQBLRTVORTqACiiigCUKMCkZAORTQxAxSUEpaiUUUUFBRRUbntQAjNnimUUUAQHrT09KYetOTrQBLRRRQAppKM+tFACYHWlo4ooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9P+UeiiigAooooAKaW28U6on60ALv8AapB0qvUynIoAdRRRQAUUUUAJgGloooAKKKKACiiigAooooAKKKKACiiigAooooAKKBz0ooAQjIxTPLqSigBuxacAB0oooAKZvxxinnkdMVX5oAfuJNS1AvUVPQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAISB1pNy0NjHNQ0AWKKh3GpFINADqKKKACiiigAooooAKKKKACiiigAooooAKaVzTqKAICMUlWKaVyMUAMVcipaRRtGKWgAwvpTSueKdRQBARjikqVx3qKgAooooAKKKKACiipguBigCGlBx0o6cUlAE3J70wqacrdqVjtFACJwOeKfUBJNTDoKAFooooAKKKOBQAUUfSigAqJ+tS1G470AR0UoGeBSUAM2U8cDFFFABRRRQAUnbFLRQA3G3mlowDQMdqaAWiiikAUUUUAFFFFABRRRQAUUUUAJjiloooAKKKKAP/1P5R6KKKACiiigAqNgSelSUUAR+XT1G0YpaKACiiigBCcECgEHilpm3nIoAfRRRQAUUoGeBQRg4oASinBcnFSbFoAh4xQKm2jGKhxjigAooooAKKKKACmP0p9FAEAOOlSqcijatKBigBaKKKACm7lp1QsMGgCQk9VpNmeelOUYFLQAm0ZzS0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFADW+7UNTkZGKiK7aAG0oOOlJTlXNAE1FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACEZGKh6cVP0FRBd3NADKUAnpRjFOVj0oAeEGKZsPapaKAGquKdRRQBEy45plSv0qPBFACUUUoHpQAAZ4FTDpSKAKdQAUUUUAFGBRRQAnQcUtKKSgApCMjFLRQAgUCkYZFOo7YoAr0UvTikoAKKKKAClFJRQA7bnpTaKBxTAKKKKQBRTuB0p6nPBNADNv5U8IKQgDikBVaAFIP3RTdoA5oyD04oz3oAbilOO1JRQAUUUUAFFFFAH//V/lHooooAQkDrTS2KR+1Nbt9KAJFYGnVEnWpaAE6daWmr3p1ABRRRQAUUUUAFFFTjoKAEUACmsvepKQ9KAI0+9UtV6nHQUALULDBqamt92gCGiiigAooooAKKKKACm4PrTqKACiiigBj9KjA54oPWnJ1oAlooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAox2oooABxxRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABR0oqN+1ADwQelLUSdaloAO2KQDAxS0UANfpTEIHFS1AetAE9FIOgpaACiiigAowKKKAG7FpQAOlLRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBE64plSv0qKgAooooAKKKKACiiigAowKKKAFzTtwHSmUUAPLUzk0UUAJjnNLRRQAUUUUAFFFFABRRRQB//2Q==" alt="IRON" style={{width:220,height:"auto",borderRadius:12,display:"block"}}/>
          <div style={{position:"absolute",inset:0,borderRadius:12,background:"radial-gradient(ellipse at center, transparent 45%, #161b22 78%)",pointerEvents:"none"}}/>
        </div>
        <div style={{fontSize:22,fontFamily:"'SF Mono','Courier New',monospace",color:"#3ecf8e",letterSpacing:"0.45em",fontWeight:900,marginBottom:16,textShadow:"0 0 30px rgba(62,207,142,0.5)"}}>IRON</div>
        {mode==="login"&&<div style={{marginBottom:6}}>
          <div style={{fontSize:32,fontWeight:900,letterSpacing:"-0.04em",color:"#e8edf4",lineHeight:1.1,marginBottom:4}}>Workout.</div>
          <div style={{fontSize:32,fontWeight:900,letterSpacing:"-0.04em",color:"#e8edf4",lineHeight:1.1,marginBottom:4}}>Track.</div>
          <div style={{fontSize:32,fontWeight:900,letterSpacing:"-0.04em",color:"#3ecf8e",lineHeight:1.1,marginBottom:16}}>Improve.</div>
          <div style={{fontSize:13,color:"#8a96a8",lineHeight:1.6,maxWidth:280,margin:"0 auto"}}>Your training log, reinvented. Plan your program, track every set, and watch yourself get stronger.</div>
        </div>}
        {mode==="signup"&&<div style={{marginBottom:6}}>
          <div style={{fontSize:26,fontWeight:800,letterSpacing:"-0.03em",color:"#e8edf4",marginBottom:6}}>Create your account</div>
          <div style={{fontSize:13,color:"#8a96a8"}}>Start tracking your progress today.</div>
        </div>}
        {mode==="reset"&&<div style={{marginBottom:6}}>
          <div style={{fontSize:26,fontWeight:800,letterSpacing:"-0.03em",color:"#e8edf4",marginBottom:6}}>Reset password</div>
          <div style={{fontSize:13,color:"#8a96a8"}}>We'll send you a reset link.</div>
        </div>}
      </div>

      {/* Form */}
      <div style={{background:"#1e2530",border:"1px solid #3a4456",borderRadius:16,padding:"24px"}}>
        {mode==="signup"&&<div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:"#9ba3b0",letterSpacing:"0.12em",marginBottom:6}}>NAME (optional)</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"
            style={inputStyle} autoComplete="name"/>
        </div>}

        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:"#9ba3b0",letterSpacing:"0.12em",marginBottom:6}}>EMAIL</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
            style={inputStyle} autoComplete="email"
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>

        {mode!=="reset"&&<div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:"#9ba3b0",letterSpacing:"0.12em",marginBottom:6}}>PASSWORD</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder={mode==="signup"?"At least 6 characters":"Your password"}
            style={inputStyle} autoComplete={mode==="signup"?"new-password":"current-password"}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>}

        {error&&<div style={{background:"#f0658415",border:"1px solid #f0658444",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:12,color:"#f06584",fontFamily:"'SF Mono','Courier New',monospace"}}>{error}</div>
        </div>}
        {message&&<div style={{background:"#3ecf8e15",border:"1px solid #3ecf8e44",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:12,color:"#3ecf8e",fontFamily:"'SF Mono','Courier New',monospace"}}>{message}</div>
        </div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{width:"100%",padding:"14px",background:loading?"#2e333d":"#4f8ef7",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,letterSpacing:"0.08em",cursor:loading?"not-allowed":"pointer",transition:"background .2s"}}>
          {loading?"...":(mode==="login"?"SIGN IN":mode==="signup"?"CREATE ACCOUNT":"SEND RESET EMAIL")}
        </button>
      </div>

      {/* Mode switcher */}
      <div style={{textAlign:"center",marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
        {mode==="login"&&<>
          <button onClick={()=>{setMode("signup");setError("");setMessage("");}} style={{background:"transparent",border:"none",color:"#9ba3b0",cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif"}}>
            Don't have an account? <span style={{color:"#aaff00",fontWeight:600}}>Sign up</span>
          </button>
          <button onClick={()=>{setMode("reset");setError("");setMessage("");}} style={{background:"transparent",border:"none",color:"#555e6b",cursor:"pointer",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace"}}>
            Forgot password?
          </button>
        </>}
        {mode!=="login"&&<button onClick={()=>{setMode("login");setError("");setMessage("");}} style={{background:"transparent",border:"none",color:"#9ba3b0",cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif"}}>
          Already have an account? <span style={{color:"#aaff00",fontWeight:600}}>Sign in</span>
        </button>}
      </div>
    </div>
  </div>;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function ForgeApp(){
  const [plans,setPlans]=useState({});
  const [activePlanKey,setActivePlanKey]=useState(null);
  const [settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [sessions,setSessions]=useState([]);
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
  const [deloadDismissed,setDeloadDismissed]=useState(null);
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
      ai_joint_notes:s.aiJointNotes||"", ai_goal:s.aiGoal||""
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
          aiJointNotes:sett.ai_joint_notes||"", aiGoal:sett.ai_goal||""
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
        const mapped=sessData.map(s=>{
          const lsMap={};
          (s.logged_sets||[]).forEach(ls=>{lsMap[`${ls.exercise_name}|${ls.set_number}`]={isPR:ls.is_pr||false,type:ls.set_type||"working"};});
          return {
            id:s.id, supabaseId:s.id,
            dayLabel:s.day_label, dayId:s.day_id,
            startedAt:s.started_at, completedAt:s.completed_at,
            notes:s.notes, partial:s.partial||false, sets:s.sets_data||{},
            setsArr:Object.entries(s.sets_data||{}).flatMap(([exName,sets])=>
              Object.entries(sets).map(([setNum,x])=>{
                const ls=lsMap[`${exName}|${setNum}`]||{};
                return {exName, setNum:parseInt(setNum),
                  weight:x.weight||"", reps:x.reps||"",
                  minutes:x.minutes||"", level:x.level||"",
                  muscle:"", isPR:ls.isPR||false, type:ls.type||x.type||"working"};
              })
            )
          };
        });
        setSessions(mapped);
      }
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
      const savedPlanKey=prof?.active_plan_key||u.user_metadata?.active_plan_key;
      const planKeys=Object.keys(mergedPlans);
      const resolvedKey=(savedPlanKey&&mergedPlans[savedPlanKey])?savedPlanKey:(planKeys.length>0?planKeys[0]:null);
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
              sets_data:draft.logged_sets||{}
            }).select("id").single();
            if(draftSaveErr){console.error("draft expired save:",draftSaveErr);return;}
            const savedId=savedSession?.id;
            if(savedId&&draft.logged_sets){
              const setRows=[];
              for(const[exName,sets]of Object.entries(draft.logged_sets)){
                for(const[n,v]of Object.entries(sets)){
                  const num=parseInt(n);
                  if(!Number.isFinite(num)||!v.done)continue;
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
                return Object.values(m).filter(v=>v.done).length>=numSets;
              }).map(ex=>ex.id);
              setWorkoutDraft({loggedSets:draft.logged_sets||{},elapsed:restoredElapsed,startedAt:draft.started_at,workout:matchDay,exercises:draft.exercises_json||null,completedExIds:derivedCompletedExIds});
              setActiveWorkout(matchDay);
              await supabase.from("workout_drafts").delete().eq("user_id",u.id);
            }
          }
        }
      }catch(e){console.error("loadUserData draft:",e);}
      setLoading(false);
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
      else if(!session?.user){setSessions([]);setPrs({});setPlans({});setSettings(DEFAULT_SETTINGS);setActivePlanKey(null);setLoading(false);}
    });
    return()=>subscription.unsubscribe();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

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
    const planStart=planStartDate?new Date(planStartDate+"T12:00:00"):null;
    let count=0;
    for(let i=0;i<=730;i++){
      const d=new Date(today);
      d.setDate(today.getDate()-i);
      const dateStr=toLD(d);
      if(dateStr<progStart)break;
      let planDay=null;
      if(planStart&&numDays>0){
        const elapsed=Math.floor((d-planStart)/86400000);
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
    {key:"today",icon:"dumbbell",label:"Workout"},
    {key:"plan",icon:"notebook",label:"Plan"},
    {key:"log",icon:"clock",label:"History"},
    {key:"stats",icon:"↗",label:"Stats"},
    {key:"more",icon:"gear",label:"Settings"},
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
      settings={settings} sessions={sessions} streak={streak} complianceStreak={complianceStreak} deloadDue={deloadDue&&deloadDismissed!==new Date().toLocaleDateString("en-CA").slice(0,7)}
      onDeloadDismiss={()=>{setDeloadDismissed(new Date().toLocaleDateString("en-CA").slice(0,7));}}
      onStart={day=>{setWorkoutDraft(null);setActiveWorkout(day);}} C={C} toggleTheme={toggleTheme} themeMode={themeMode}
      authUser={authUser} todayDay={(()=>{const days=activePlan?.days||[];if(!activePlan?.startDate||!days.length)return undefined;const now=new Date();now.setHours(12,0,0,0);const elapsed=Math.floor((now-new Date(activePlan.startDate+"T12:00:00"))/86400000);if(elapsed<0)return undefined;const slot=days[elapsed%days.length];return slot?.isRest?undefined:slot;})()}
      onGoToPlan={()=>setTab("plan")}/>}
    {tab==="plan"&&<PlanErrorBoundary C={C}><PlanTab plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={persistActivePlanKey}
      savePlans={savePlans} settings={settings} C={C}/></PlanErrorBoundary>}
    {tab==="log"&&<HistoryTab sessions={sessions} saveSessions={saveSessions} setSessions={setSessions} savePRs={savePRs} prs={prs} plans={plans} C={C} onRerun={sess=>{
      const day=(activePlan?.days||[]).find(d=>d.id===sess.dayId)||{...sess,exercises:Object.keys(sess.sets||{}).map(name=>({id:name,name,sets:"3",reps:"",muscle:"",note:""})),label:sess.dayLabel||"Workout"};
      setActiveWorkout({...day,_rerunSets:sess.sets});
      setTab("today");
    }}/>}
    {tab==="stats"&&<StatsTab sessions={sessions} prs={prs} settings={settings} C={C} activePlan={activePlan} bodyStatsInit={bodyStatsGlobal} onBodyStatsChange={async(stats)=>{
      setBodyStatsGlobal(stats);
      const {data:{user:u}}=await supabase.auth.getUser().catch(()=>({data:{user:null}}));
      if(u)await supabase.auth.updateUser({data:{body_stats:JSON.stringify(stats)}}).catch(()=>{});
    }}/>}
    {tab==="more"&&<MoreTab settings={settings} saveSettings={saveSettings} plans={plans} sessions={sessions} prs={prs} C={C} toggleTheme={toggleTheme} themeMode={themeMode}/>}
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"10px 4px 8px",background:"none",border:"none",color:tab===t.key?(themeMode==="dark"?C.gold:C.accent):C.muted,cursor:"pointer",fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          {t.icon==="dumbbell"
            ?<svg width="28" height="14" viewBox="0 0 36 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <rect x="10" y="8" width="16" height="2" rx="1" fill="currentColor"/>
              <rect x="7.5" y="6.5" width="2.5" height="5" rx="0.8" fill="currentColor"/>
              <rect x="3.5" y="3" width="3.5" height="12" rx="1" fill="currentColor"/>
              <rect x="0.5" y="5.5" width="2.5" height="7" rx="1" fill="currentColor"/>
              <rect x="26" y="6.5" width="2.5" height="5" rx="0.8" fill="currentColor"/>
              <rect x="29" y="3" width="3.5" height="12" rx="1" fill="currentColor"/>
              <rect x="33" y="5.5" width="2.5" height="7" rx="1" fill="currentColor"/>
            </svg>
            :t.icon==="clock"
            ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              <line x1="12" y1="7" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="12" y1="12" x2="15.5" y2="14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            :t.icon==="gear"
            ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            :t.icon==="notebook"
            ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <rect x="4" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              <line x1="8" y1="2" x2="8" y2="22" stroke="currentColor" strokeWidth="1.8"/>
              <line x1="11" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="11" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="11" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            :<span style={{fontSize:18,lineHeight:1}}>{t.icon}</span>}
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
function TodayTab({plan,plans,activePlanKey,setActivePlanKey,settings,sessions,streak,complianceStreak,deloadDue,onDeloadDismiss,onStart,C,toggleTheme,themeMode,authUser,todayDay,onGoToPlan}){
  const rawDays=plan?.days||[];
  const numDays=rawDays.length;
  const toLocalDateStr=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  // Position-based scheduling: slot = daysSinceStart % numDays
  const todayMidnightRef=new Date();todayMidnightRef.setHours(12,0,0,0);
  const startDate=plan?.startDate?new Date(plan.startDate+"T12:00:00"):null;
  const elapsedDays=startDate?Math.floor((todayMidnightRef-startDate)/86400000):null;
  const isFutureStart=elapsedDays!==null&&elapsedDays<0;
  const daysUntilStart=isFutureStart?-elapsedDays:0;
  const todaySlot=(elapsedDays!==null&&elapsedDays>=0&&numDays>0)?elapsedDays%numDays:null;
  const orderedDays=(()=>{
    if(todaySlot===null)return rawDays;
    return[...rawDays.slice(todaySlot),...rawDays.slice(0,todaySlot)];
  })();
  const todaySessions=sessions.filter(s=>s.completedAt&&toLocalDateStr(new Date(s.completedAt))===toLocalDateStr(new Date()));

  const userName = authUser?.user_metadata?.display_name || authUser?.email?.split("@")[0] || "there";
  const wkNum = planWeekOf(plan);
  const wkTotal = plan?.durationWeeks || 10;
  const isProgramComplete = !!wkNum && wkNum > wkTotal;
  const [dismissedComplete,setDismissedComplete]=useState(false);
  const weekLabel = wkNum
    ? (isProgramComplete ? `COMPLETE · WEEK ${wkTotal} OF ${wkTotal}` : `WEEK ${wkNum} OF ${wkTotal}`)
    : (sessions.length > 0 ? `WEEK ${programWeek(sessions)}` : "");

  return <div>
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 14px 14px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:C.gradTop,pointerEvents:"none"}}/>
      {/* Row 1: greeting / day / date — theme toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,position:"relative"}}>
        <div>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Hello, <span style={{fontWeight:600}}>{userName}</span> 👋</div>
          <div style={{fontSize:22,letterSpacing:"-0.03em",fontWeight:800}}>{new Date().toLocaleDateString("en",{weekday:"long"})}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:1}}>{new Date().toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}</div>
        </div>
        <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 11px",fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em",marginTop:2,display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          <span style={{fontSize:11}}>◐</span>{themeMode==="dark"?"DARK":"LIGHT"}
        </button>
      </div>
      {/* Row 2: plan + week badge — streak pill */}
      <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
        {plan&&(
          <div style={{display:"flex",alignItems:"center",gap:6,background:C.accent+"15",border:`1px solid ${C.accent}33`,borderRadius:6,padding:"4px 10px",whiteSpace:"nowrap",flexShrink:0}}>
            <span style={{fontSize:11,color:C.accent,fontWeight:600,letterSpacing:"0.02em"}}>{plan.name}</span>
            {weekLabel&&<>
              <span style={{width:3,height:3,background:C.accent+"99",borderRadius:"50%",display:"inline-block"}}/>
              <span style={{fontSize:11,color:isProgramComplete?C.gold:C.accent,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.04em"}}>{weekLabel}</span>
            </>}
          </div>
        )}
        {settings.streakTracking&&complianceStreak>0&&(
          <div style={{display:"flex",alignItems:"center",gap:5,background:C.gold+"12",border:`1px solid ${C.gold}30`,borderRadius:6,padding:"4px 10px",marginLeft:"auto",flexShrink:0,whiteSpace:"nowrap"}}>
            <span style={{fontSize:12}}>🏆</span>
            <span style={{fontSize:11,color:C.gold,fontWeight:600}}>{complianceStreak} session streak!</span>
          </div>
        )}
        {settings.streakTracking&&complianceStreak===0&&(
          <span style={{fontSize:10,color:C.muted,marginLeft:"auto"}}>Start your streak today</span>
        )}
      </div>
    </div>
    <div style={{padding:"14px 18px"}}>
      {!plan&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:18,marginBottom:8}}>💪</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>No plan set up yet</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Pick a template to get started or build a custom plan.</div>
        <button onClick={onGoToPlan} style={{padding:"10px 20px",borderRadius:8,border:"none",background:C.accent,color:"#fff",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,cursor:"pointer",letterSpacing:"0.04em"}}>Browse Templates</button>
      </div>}
      {deloadDue&&<div style={{background:C.gold+"15",border:`1px solid ${C.gold}55`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:C.gold,fontWeight:700,marginBottom:4}}>⚠ Deload Week Recommended</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              You've logged 10+ sessions over 6+ weeks of consistent training. A deload week lets joints recover and consolidates strength gains.
            </div>
            <div style={{fontSize:11,color:C.gold,marginTop:6,lineHeight:1.6}}>
              This week: drop all weights to 60%, keep same exercises and sets. Resume normal load next week.
            </div>
          </div>
          <button onClick={onDeloadDismiss} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:"0 0 0 12px",flexShrink:0,lineHeight:1}}>✕</button>
        </div>
      </div>}
      {isProgramComplete&&!dismissedComplete&&<div style={{background:C.gold+"15",border:`1px solid ${C.gold}55`,borderRadius:10,padding:"14px",marginBottom:14}}>
        <div style={{fontSize:13,color:C.gold,fontWeight:700,marginBottom:4}}>🏆 PROGRAM COMPLETE · WEEK {wkTotal} OF {wkTotal}</div>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:10}}>You've completed your {wkTotal}-week program. What's next?</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setDismissedComplete(true)} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer"}}>Continue As Is</button>
          <button onClick={onGoToPlan} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:C.gold,color:"#1a202c",fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,cursor:"pointer"}}>Start New Plan</button>
        </div>
      </div>}
      {plan&&isFutureStart&&<div style={{background:C.accent+"15",border:`1px solid ${C.accent}40`,borderRadius:10,padding:"14px",marginBottom:14}}>
        <Mono style={{fontSize:10,color:C.accent,letterSpacing:"0.1em",display:"block",marginBottom:6}}>STARTS IN {daysUntilStart} DAY{daysUntilStart!==1?"S":""} · {startDate.toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"})}</Mono>
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
                {isToday&&!doneSess&&<Pill color={C.neon}>Today</Pill>}
                {(doneSess||(day.isRest&&isPast))&&<Pill color={C.neon}>✓ Done</Pill>}
              </div>
              <div style={{fontSize:11,color:C.muted}}>{calDateDisplay} · {day.tag}</div>
              {!day.isRest&&!doneSess&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{day.exercises.length} exercises</div>}
              {doneSess&&dayVol&&dayVol.sets>0&&<Mono style={{fontSize:11,color:C.neon+"bb",display:"block",marginTop:4}}>{dayVol.sets} sets · {dayVol.vol>0?`${Math.round(dayVol.vol).toLocaleString()} lbs`:"logged"}</Mono>}
              {day.isRest&&isToday&&<div style={{fontSize:12,color:C.neon,fontStyle:"italic",marginTop:6,lineHeight:1.5}}>"{quote}"</div>}
            </div>
            {!isToday&&!day.isRest&&!doneSess&&!isFutureStart&&<Btn onClick={()=>onStart(day)} size="sm" C={C} style={{marginLeft:10,background:C.neon,color:"#fff",fontWeight:700,letterSpacing:"0.1em"}}>START</Btn>}
            {!day.isRest&&doneSess&&!isToday&&<Btn onClick={()=>onStart(day)} size="sm" variant="ghost" C={C} style={{marginLeft:10,fontSize:10,color:C.muted,borderColor:C.border}}>↺ Again</Btn>}
          </div>
          {isToday&&!doneSess&&!day.isRest&&!isFutureStart&&<button onClick={()=>onStart(day)} style={{width:"100%",padding:"11px",background:themeMode==="dark"?"#f7c948":"#d4a017",border:"none",borderRadius:10,color:themeMode==="dark"?"#1a202c":"#ffffff",fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:800,letterSpacing:"0.08em",cursor:"pointer",marginTop:12,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>START {day.label.toUpperCase()}</button>}
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
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:tab===k?C.accent:"transparent",color:tab===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:"0.04em"}}>{label}</button>
      ))}
    </div>
    {tab==="library"&&<div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search 200+ exercises..."
        autoFocus
        style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",marginBottom:10,outline:"none"}}/>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        <button onClick={()=>setMuscleFilter(null)} style={{padding:"5px 9px",borderRadius:5,border:`1px solid ${muscleFilter===null?C.accent+"66":C.border}`,background:muscleFilter===null?C.accent+"20":"transparent",color:muscleFilter===null?C.accent:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>ALL</button>
        {muscles.map(m=>(
          <button key={m} onClick={()=>setMuscleFilter(muscleFilter===m?null:m)} style={{padding:"5px 9px",borderRadius:5,border:`1px solid ${muscleFilter===m?C.accent+"66":C.border}`,background:muscleFilter===m?C.accent+"20":"transparent",color:muscleFilter===m?C.accent:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>{m.toUpperCase()}</button>
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
                <Pill color={C.accent}>{ex.muscle}</Pill>
                <Pill color={equipColor[ex.equipment]||C.faint}>{ex.equipment}</Pill>
              </div>
            </div>
            <div style={{color:C.neon,fontSize:20,fontWeight:300,flexShrink:0,paddingTop:2}}>+</div>
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
    // If restoring from a saved draft, use draft data (clear prepop flags)
    if(workoutDraft?.loggedSets&&Object.keys(workoutDraft.loggedSets).length){
      const restored={};
      for(const[ex,sets] of Object.entries(workoutDraft.loggedSets)){
        restored[ex]={};
        for(const[n,vals] of Object.entries(sets)){
          restored[ex][n]={...vals,prepop:false};
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
  const [setStates,setSetStates]=useState({});
  const [showEndMenu,setShowEndMenu]=useState(false);
  const [showAbandonConfirm,setShowAbandonConfirm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(null);
  const [autoSaveToast,setAutoSaveToast]=useState(false);
  const autoSavedRef=useRef(false);
  const finishCalledRef=useRef(false);
  const [autoFinishCountdown,setAutoFinishCountdown]=useState(null);
  const topRef=useRef(null);
  const lastActiveExRef=useRef(null);
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

  // Heartbeat: persist draft every 30s as a backstop against iOS app kill
  useEffect(()=>{
    const t=setInterval(()=>{saveDraft();},30000);
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
    // Smooth scroll to top of exercise list
    setTimeout(()=>{
      topRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
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
      for(const[sn,vals]of Object.entries(sets)){
        if(!vals.prepop&&(vals.weight||vals.reps||vals.minutes)){
          const w=parseFloat(vals.weight)||0;
          const typ=(setTypes[exName]?.[parseInt(sn)])||"working";
          const isPR=!vals.minutes&&settings.prDetection&&w>0&&typ!=="warmup"&&(!prs[exName]||w>prs[exName].weight);
          if(isPR&&(!newPRs[exName]||w>newPRs[exName].weight))newPRs[exName]={weight:w,date:new Date().toISOString()};
          setsArr.push({exName,setNum:parseInt(sn),weight:vals.weight||"",reps:vals.reps||"",minutes:vals.minutes||"",level:vals.level||"",isPR,type:typ});
        }
      }
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
    <div style={{background:C.surface,borderBottom:`2px solid ${C.neon}`,padding:"14px 18px",position:"sticky",top:0,zIndex:50,marginTop:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{workout.label}</div>
          <Mono style={{fontSize:11,color:C.muted}}>{exercises.length} exercises</Mono>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Mono style={{fontSize:13,color:C.neon,fontWeight:700}}>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</Mono>
          <Btn onClick={()=>setAddExModal(true)} variant="ghost" size="sm" C={C} style={{fontSize:11,color:C.neon,borderColor:C.neon+"44"}}>+ Add</Btn>
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
                {isCardio&&<Pill color={C.green}>Cardio</Pill>}
                {isPRNow&&<span style={{fontSize:10,color:C.red,fontWeight:700}}>★ PR!</span>}
                {hasAnyLog&&<span style={{fontSize:9,color:C.neon,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.08em"}}>LOGGED</span>}
              </div>
              <Mono style={{fontSize:11,color:C.muted}}>{isCardio?"Duration goal:":ex.sets+" sets ."} {ex.reps}{!isCardio&&ex.muscle?` . ${ex.muscle}`:""}</Mono>
              {ex.note&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{ex.note}</div>}
              {!isCardio&&last&&<Mono style={{fontSize:11,color:C.muted,display:"block",marginTop:2}}>Last: {last[1]?.weight||"--"}lbs × {last[1]?.reps||"--"}</Mono>}
              {isCardio&&last&&last[1]?.minutes&&<Mono style={{fontSize:11,color:C.muted,display:"block",marginTop:2}}>Last: {last[1].minutes} min</Mono>}
              {myPR&&<Mono style={{fontSize:11,color:C.red,display:"block"}}>PR: {myPR.weight}lbs</Mono>}
              {!isCardio&&settings.plateCalc&&w0&&<PlateCalc weight={w0} C={C}/>}
            </div>
            <div style={{display:"flex",gap:4,marginLeft:8,flexShrink:0}}>
              {!isCardio&&settings.aiRecs&&<Btn onClick={()=>setAiModal(ex)} variant="ghost" size="sm" C={C} style={{fontSize:12,padding:"5px 8px"}}>✦</Btn>}
              <Btn onClick={()=>setEditExModal(ex)} variant="ghost" size="sm" C={C} style={{fontSize:12,padding:"5px 8px"}}>✎</Btn>
              {!isCardio&&<Btn onClick={()=>setSwapModal(ex)} variant="ghost" size="sm" C={C} style={{fontSize:12,padding:"5px 8px",color:C.gold,borderColor:C.gold+"44"}}>⇄</Btn>}
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
                  <span style={{color:C.neon,fontSize:14,fontWeight:800}}>✓</span>
                  <Mono style={{color:C.neon,fontSize:12,fontWeight:700}}>Interval {n}</Mono>
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
                }} style={{padding:"9px 14px",background:"transparent",border:`1px solid ${C.neon}44`,borderRadius:7,color:C.neon,cursor:"pointer",fontSize:14,fontWeight:700,transition:"all .2s"}}>✓</button>
              </div>;
            })}
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <Btn size="sm" variant="ghost" C={C} onClick={()=>{
                const nextNum=Math.max(0,...intervalKeys)+1;
                setLoggedSets(prev=>({...prev,[ex.name]:{...(prev[ex.name]||{}),[nextNum]:{minutes:"",level:"",prepop:false}}}));
              }} style={{fontSize:11,color:C.neon,borderColor:C.neon+"44"}}>+ Add Interval</Btn>
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
                      <span style={{color:C.neon,fontSize:11,fontWeight:800}}>✓</span>
                      <Mono style={{color:C.neon,fontSize:12,fontWeight:700}}>{n}</Mono>
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
                        for(let i=n+1;i<=numSets;i++){if(cur[i]?.prepop){updated[i]={...cur[i],weight:w};}else if(!cur[i]?.weight&&!cur[i]?.reps){updated[i]={weight:w,reps:"",prepop:true};}}
                        return {...prev,[ex.name]:updated};
                      });
                      setSetStates(prev=>({...prev,[stateKey]:"confirmed"}));
                      const myL=loggedSets[ex.name]||{};
                      const allFilled=Array.from({length:numSets},(_,i)=>i+1).every(s=>myL[s]?.weight&&myL[s]?.reps);
                      if(n===numSets&&allFilled){markExerciseDone(ex.id,ex.name,!isWarmup);}
                      // REST TIMER: only triggered here, on explicit set confirmation
                      else if(!isWarmup){setShowRest(true);setRestKey(k=>k+1);}
                    }} style={{padding:"9px 4px",background:"transparent",border:`1px solid ${C.neon}44`,borderRadius:7,color:C.neon,cursor:"pointer",fontSize:14,fontWeight:700}}>✓</button>
                  ])
              ];
            })}
          </div>}
          {!isCardio&&<button onClick={()=>setExtraSets(prev=>({...prev,[ex.name]:(prev[ex.name]||0)+1}))} style={{marginTop:6,padding:"5px 10px",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:6,color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>+ SET</button>}
          {setError[ex.name]&&<Mono style={{fontSize:11,color:C.red,display:"block",marginTop:4}}>{setError[ex.name]}</Mono>}
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
      <Btn onClick={finish} disabled={saving} size="lg" C={C} style={{width:"100%",marginTop:14,background:saving?C.card:C.neon,color:saving?C.muted:"#fff",fontWeight:800,letterSpacing:"0.1em",fontSize:15}}>{saving?"SAVING...":"COMPLETE WORKOUT ✓"}</Btn>
    </div>

    {/* Swap exercise modal */}
    {showEndMenu&&<div onClick={()=>setShowEndMenu(false)} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"16px 16px 0 0",padding:"20px 18px calc(32px + env(safe-area-inset-bottom,0px)) 18px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{width:36,height:4,borderRadius:2,background:C.border,alignSelf:"center",marginTop:-8,marginBottom:4}}/>
        <Mono style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>END WORKOUT</Mono>
        <button onClick={()=>{setShowEndMenu(false);finish();}} disabled={saving} style={{width:"100%",padding:"13px 16px",background:C.neon+"22",border:`1px solid ${C.neon}44`,borderRadius:10,color:C.neon,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:saving?"not-allowed":"pointer",textAlign:"left",letterSpacing:"0.04em",opacity:saving?0.5:1}}>✓ Complete Workout</button>
        <button onClick={()=>{setShowEndMenu(false);savePartialAndExit();}} disabled={saving} style={{width:"100%",padding:"13px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:saving?"not-allowed":"pointer",textAlign:"left",letterSpacing:"0.04em",opacity:saving?0.5:1}}>↓ Save & Exit</button>
        <button onClick={()=>{setShowEndMenu(false);setShowAbandonConfirm(true);}} style={{width:"100%",padding:"13px 16px",background:C.red+"11",border:`1px solid ${C.red}44`,borderRadius:10,color:C.red,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}>✕ Abandon</button>
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
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:tab===k?C.accent:"transparent",color:tab===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer"}}>
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
        <div style={{fontSize:15,fontWeight:700,color:C.red,marginBottom:8}}>Plan editor error</div>
        <Mono style={{fontSize:12,color:C.muted,display:"block",marginBottom:16}}>Something went wrong. Tap Retry to reload the editor.</Mono>
        <button onClick={()=>this.setState({hasError:false})} style={{padding:"10px 20px",borderRadius:8,border:"none",background:C.accent,color:"#fff",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",fontWeight:700}}>Retry</button>
      </div>;
    }
    return this.props.children;
  }
}

// -- PLAN TAB ------------------------------------------------------------------
function PlanTab({plans,activePlanKey,setActivePlanKey,savePlans,settings,C}){
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

  const plan=plans[activePlanKey];
  const days=plan?.days||[];
  const startDOW=plan?.startDate?new Date(plan.startDate+"T12:00:00").getDay():null;
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

  return <div>
    <div style={{background:C.surface,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px 14px"}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em",marginBottom:10}}>Plan Editor</div>
      {/* View switcher */}
      <div style={{display:"flex",gap:6,marginBottom:10,background:C.card,padding:4,borderRadius:10}}>
        {[["mine","My Plans"],["presets","Templates"],["ai","✦ AI Builder"]].map(([k,label])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:view===k?C.accent:"transparent",color:view===k?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:"0.04em"}}>
            {label}
          </button>
        ))}
      </div>
      {view==="mine"&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.keys(plans).map(k=>(
          <button key={k} onClick={()=>setActivePlanKey(k)} style={{padding:"5px 11px",borderRadius:6,fontFamily:"'SF Mono','Courier New',monospace",fontSize:10,cursor:"pointer",border:activePlanKey===k?"none":`1px solid ${C.border}`,background:activePlanKey===k?C.accent:"transparent",color:activePlanKey===k?"#fff":C.muted}}>
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
        <button onClick={()=>setView("presets")} style={{padding:"10px 20px",borderRadius:8,border:"none",background:C.accent,color:"#fff",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,cursor:"pointer"}}>Browse Templates</button>
      </div>}
      {plan&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.1em"}}>PLAN SCHEDULE</Mono>
          {(()=>{const wk=planWeekOf(plan);const tot=plan?.durationWeeks||10;return wk?<Mono style={{fontSize:10,color:wk>tot?C.gold:C.accent,fontWeight:700}}>{wk>tot?`COMPLETE`:`WEEK ${wk} OF ${tot}`}</Mono>:null;})()}
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
                  style={{padding:"9px 12px",borderRadius:7,border:(plan?.durationWeeks||10)===w?"none":`1px solid ${C.border}`,background:(plan?.durationWeeks||10)===w?C.accent:"transparent",color:(plan?.durationWeeks||10)===w?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {w}W
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>}
      {plan&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <Btn size="sm" variant="ghost" style={{color:dayReorderMode?C.neon:C.muted,borderColor:dayReorderMode?C.neon+"55":C.border}} onClick={()=>{const next=!dayReorderMode;setDayReorderMode(next);setExpandedDay(null);if(!next){setSaveToast("Day order saved");setTimeout(()=>setSaveToast(""),2500);}}} C={C}>
          {dayReorderMode?"✓ Done Reordering":"⇅ Reorder Days"}
        </Btn>
      </div>}
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
                    style={{padding:"3px 8px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:i===0?C.faint:C.neon,cursor:i===0?"default":"pointer",fontSize:12,lineHeight:1}}>↑</button>
                  <button onClick={e=>{e.stopPropagation();reorderDay(i,i+1);}} disabled={i===days.length-1}
                    style={{padding:"3px 8px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:i===days.length-1?C.faint:C.neon,cursor:i===days.length-1?"default":"pointer",fontSize:12,lineHeight:1}}>↓</button>
                </div>
                :<Mono style={{color:C.muted,fontSize:12,flexShrink:0}}>{expandedDay===i?"▲":"▼"}</Mono>
              }
            </div>
          </div>
          {expandedDay===i&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:"8px 14px 14px"}}>
            {/* Reorder mode header */}
            {reorderMode===day.id&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0 10px",borderBottom:`1px solid ${C.neon}44`,marginBottom:4}}>
              <Mono style={{fontSize:10,color:C.neon,letterSpacing:"0.12em"}}>DRAG MODE -- USE ↑↓ TO REORDER</Mono>
              <Btn size="sm" variant="ghost" style={{color:C.neon,borderColor:C.neon+"55"}} onClick={()=>setReorderMode(null)} C={C}>Done</Btn>
            </div>}
            {day.exercises.map((ex,exIdx)=>(
              <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`,background:reorderMode===day.id?"transparent":"transparent",transition:"background .15s"}}>
                {/* Reorder arrows */}
                {reorderMode===day.id&&<div style={{display:"flex",flexDirection:"column",gap:1,marginRight:8,flexShrink:0}}>
                  <button onClick={()=>exIdx>0&&reorderExercises(day.id,exIdx,exIdx-1)}
                    disabled={exIdx===0}
                    style={{padding:"2px 7px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:exIdx===0?C.faint:C.neon,cursor:exIdx===0?"default":"pointer",fontSize:12,lineHeight:1}}>↑</button>
                  <button onClick={()=>exIdx<day.exercises.length-1&&reorderExercises(day.id,exIdx,exIdx+1)}
                    disabled={exIdx===day.exercises.length-1}
                    style={{padding:"2px 7px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:exIdx===day.exercises.length-1?C.faint:C.neon,cursor:exIdx===day.exercises.length-1?"default":"pointer",fontSize:12,lineHeight:1}}>↓</button>
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
              <Btn size="sm" variant="ghost" style={{color:reorderMode===day.id?C.neon:C.muted,borderColor:reorderMode===day.id?C.neon+"55":C.border}} onClick={()=>setReorderMode(reorderMode===day.id?null:day.id)} C={C}>
                {reorderMode===day.id?"✓ Done":"⇅ Reorder"}
              </Btn>
              {settings.aiRecs&&<Btn size="sm" variant="ghost" style={{color:C.accent}} onClick={()=>{if(sequencingDay!==day.id)aiSequenceDay(day);}} C={C}>
                {sequencingDay===day.id?"Sequencing...":"✦ AI Sequence"}
              </Btn>}
              {settings.aiRecs&&<Btn size="sm" variant="ghost" style={{color:C.muted}} onClick={()=>setAiModal({type:"day",day})} C={C}>✦ Analyze</Btn>}
              <Btn size="sm" variant="danger" onClick={()=>setDeletingDay(day.id)} C={C}>Delete Day</Btn>
            </div>
            <Btn onClick={()=>setSaveSheet(day.id)} C={C} style={{width:"100%",marginTop:10,background:C.neon,color:"#0b0c0e",fontWeight:800,letterSpacing:"0.08em",fontSize:13,borderColor:C.neon}}>Save Day</Btn>
          </div>}
        </div>
      ))}
      <Btn variant="ghost" style={{width:"100%",marginTop:6}} onClick={()=>setAddDayModal(true)} C={C}>+ Add Day</Btn>
    </div>}

    {/* PRESET TEMPLATES */}
    {view==="presets"&&<div style={{padding:"14px 18px"}}>
      <SectionLabel C={C}>Popular Programs</SectionLabel>
      {PRESET_TEMPLATES.map(t=>(
        <div key={t.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{fontSize:16}}>{t.emoji} <span style={{fontWeight:700,fontSize:15}}>{t.name}</span></div>
              <Pill color={C.accent}>{t.tag}</Pill>
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
          <button onClick={()=>{updatePlan(days);setSaveSheet(null);setExpandedDay(null);setSaveToast("Plan updated");setTimeout(()=>setSaveToast(""),2500);}} style={{width:"100%",padding:"13px 16px",background:C.neon+"22",border:`1px solid ${C.neon}44`,borderRadius:10,color:C.neon,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}>✓ Update Current Plan</button>
          <button onClick={()=>{setNewPlanSheet(true);setNewPlanName("Custom - "+(plan?.name||"Plan")+" (modified)");}} style={{width:"100%",padding:"13px 16px",background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:10,color:C.accent,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}>+ Save as New Plan</button>
          <button onClick={()=>setSaveSheet(null)} style={{width:"100%",padding:"11px 16px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",letterSpacing:"0.04em",marginTop:2}}>Cancel</button>
        </>:<>
          <Mono style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>NAME YOUR NEW PLAN</Mono>
          <input type="text" value={newPlanName} onChange={e=>setNewPlanName(e.target.value)} autoFocus style={{padding:"11px 12px",background:C.card,border:`1px solid ${C.accent}44`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"}}/>
          <button onClick={saveAsNewPlan} style={{width:"100%",padding:"13px 16px",background:C.neon+"22",border:`1px solid ${C.neon}44`,borderRadius:10,color:C.neon,fontSize:14,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",textAlign:"left",letterSpacing:"0.04em"}}>✓ Create &amp; Activate</button>
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
              style={{flex:1,padding:"11px",borderRadius:8,border:modalDuration===w?"none":`1px solid ${C.border}`,background:modalDuration===w?C.accent:"transparent",color:modalDuration===w?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:13,fontWeight:700,cursor:"pointer"}}>
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
          <button key={opt} onClick={()=>answer(q.key,opt)} style={{padding:"13px 16px",background:answers[q.key]===opt?C.accent:C.card,border:`1px solid ${answers[q.key]===opt?C.accent:C.border}`,borderRadius:10,color:answers[q.key]===opt?"#fff":C.text,textAlign:"left",fontSize:14,cursor:"pointer",fontFamily:C.serif,transition:"all .15s"}}>
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

// -- HISTORY -------------------------------------------------------------------
function HistoryTab({sessions,saveSessions,setSessions,savePRs,prs,plans,C,onRerun}){
  const todayStr=new Date().toLocaleDateString("en-CA");
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr=yesterday.toLocaleDateString("en-CA");

  // Sort all sessions newest first -- include ALL sessions, even if completedAt is missing
  const sorted=[...sessions]
    .filter(s=>s.completedAt||s.startedAt)
    .map(s=>({...s,completedAt:s.completedAt||s.startedAt}))
    .sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));

  const grouped=sorted.reduce((acc,s)=>{
    const m=s.completedAt.slice(0,7);
    if(!acc[m])acc[m]=[];
    acc[m].push(s);
    return acc;
  },{});

  // Auto-expand most recent session
  const mostRecentIdx=(()=>{
    if(!sorted.length)return null;
    const m=sorted[0].completedAt.slice(0,7);
    return `${m}-0`;
  })();

  const [expanded,setExpanded]=useState(mostRecentIdx);
  const [editingSession,setEditingSession]=useState(null);
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
    if(ok){recalcPRs([...sessions,newSess]);
      setAddingSession(false);
      setManualSession({dayLabel:"",date:new Date().toLocaleDateString("en-CA"),duration:"",notes:"",exercises:[{name:"",sets:"3",reps:"10",weight:""}]});
    }
  }

  function recalcPRs(updatedSessions){
    const newPRs={};
    for(const sess of updatedSessions){
      for(const set of (sess.setsArr||[])){
        const w=parseFloat(set.weight)||0;
        if(w>0&&(!newPRs[set.exName]||w>newPRs[set.exName].weight)){
          newPRs[set.exName]={weight:w,date:sess.completedAt};
        }
      }
    }
    savePRs(newPRs);
  }

  async function saveEdit(updated){
    const setsArr=[];
    for(const[exName,sets]of Object.entries(updated.sets||{})){
      for(const[sn,vals]of Object.entries(sets)){
        if(vals.weight||vals.reps||vals.minutes){
          setsArr.push({exName,setNum:parseInt(sn),weight:vals.weight||"",reps:vals.reps||"",minutes:vals.minutes||"",level:vals.level||"",isPR:vals.isPR||false,type:vals.type||"working"});
        }
      }
    }
    const updatedSession={...updated,setsArr};
    if(!updatedSession.supabaseId){
      // Manual session with no DB record — state update only
      const updatedSessions=sessions.map(s=>s.id===updatedSession.id?updatedSession:s);
      setSessions(updatedSessions);recalcPRs(updatedSessions);
      return true;
    }
    const original=sessions.find(s=>s.id===updatedSession.id);
    const{data:{session:_sess}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));
    const uid=_sess?.user?.id;
    // STEP 1: update workout_sessions
    const{error:updErr}=await supabase.from("workout_sessions").update({completed_at:updatedSession.completedAt,started_at:updatedSession.startedAt,notes:updatedSession.notes||"",sets_data:updatedSession.sets||{},partial:updatedSession.partial||false}).eq("id",updatedSession.supabaseId);
    if(updErr){console.error("saveEdit update:",updErr);return false;}
    // STEP 2: delete then re-insert logged_sets — rollback on any failure
    if(uid){
      const{error:delErr}=await supabase.from("logged_sets").delete().eq("session_id",updatedSession.supabaseId);
      if(delErr){
        console.error("saveEdit delete:",delErr);
        if(original)await supabase.from("workout_sessions").update({completed_at:original.completedAt,started_at:original.startedAt,notes:original.notes||"",sets_data:original.sets||{},partial:original.partial||false}).eq("id",updatedSession.supabaseId).catch(e=>console.error("saveEdit rollback session:",e));
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
            await supabase.from("logged_sets").insert(origRows).catch(e=>console.error("saveEdit sets rollback:",e));
          }
          if(original)await supabase.from("workout_sessions").update({completed_at:original.completedAt,started_at:original.startedAt,notes:original.notes||"",sets_data:original.sets||{},partial:original.partial||false}).eq("id",updatedSession.supabaseId).catch(e=>console.error("saveEdit session rollback:",e));
          return false;
        }
      }
    }
    // All DB writes confirmed — now update local state
    const updatedSessions=sessions.map(s=>s.id===updatedSession.id?updatedSession:s);
    setSessions(updatedSessions);
    recalcPRs(updatedSessions);
    return true;
  }

  async function deleteSession(sessId){
    const sess=sessions.find(s=>s.id===sessId);
    if(!sess){setConfirmDelete(null);return;}
    if(sess.supabaseId){
      const{error}=await supabase.from("workout_sessions").delete().eq("id",sess.supabaseId);
      if(error){
        console.error("deleteSession:",error);
        setDeleteError("Could not delete — check your connection and try again.");
        setConfirmDelete(null);
        return;
      }
    }
    const updatedSessions=sessions.filter(s=>s.id!==sessId);
    saveSessions(updatedSessions);
    recalcPRs(updatedSessions);
    setConfirmDelete(null);
    setExpanded(null);
  }

  return <div>
    <div style={{background:C.surface,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Workout History</div>
          <Mono style={{fontSize:11,color:C.muted}}>{sorted.length} sessions . {Object.keys(grouped).length} months</Mono>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
          <Btn size="sm" C={C} onClick={()=>setAddingSession(a=>!a)} style={{background:C.neon,color:"#fff",fontWeight:700,padding:"6px 10px",fontSize:11}}>+ Log</Btn>
        </div>
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
            style={{background:"transparent",border:"none",color:C.neon,cursor:"pointer",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace"}}>+ Add Exercise</button>
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
                style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:"0 2px"}}>✕</button>
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
        <Btn C={C} style={{flex:1,background:C.neon,color:"#fff",fontWeight:700}} onClick={saveManualSession}>Save Session</Btn>
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
            const dur=s.completedAt&&s.startedAt?Math.round((new Date(s.completedAt)-new Date(s.startedAt))/60000):null;
            const newPRs=allSets.filter(x=>x.isPR);
            const isExp=expanded===idx;
            return <div key={s.id} style={{background:C.card,border:`1px solid ${isExp?C.accent+"44":C.border}`,borderLeft:`3px solid ${isExp?C.accent:"transparent"}`,borderRadius:8,padding:"13px 14px",marginBottom:8,transition:"border-color .2s"}}>
              {/* Header row */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setExpanded(isExp?null:idx)}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <div style={{fontSize:14,fontWeight:700}}>{s.dayLabel||"Workout"}</div>
                    {s.partial&&<Pill color={C.gold}>Partial</Pill>}
                    {newPRs.length>0&&<Pill color={C.red}>★ {newPRs.length} PR{newPRs.length>1?"s":""}</Pill>}
                  </div>
                  <Mono style={{fontSize:11,color:C.muted}}>
                    {(()=>{
                      const d=s.completedAt.split("T")[0];
                      const label=d===todayStr?"Today":d===yesterdayStr?"Yesterday":new Date(s.completedAt).toLocaleDateString("en",{weekday:"long",month:"short",day:"numeric"});
                      return label;
                    })()}
                    {dur?` . ${dur}min`:""}
                    {vol>0?` . ${Math.round(vol).toLocaleString()} lbs`:""}
                  </Mono>
                </div>
                <Mono style={{color:C.muted,fontSize:12,marginLeft:8}}>{isExp?"▲":"▼"}</Mono>
              </div>

              {/* Expanded view */}
              {isExp&&<div style={{marginTop:12}}>
                {s.notes&&<div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:10,padding:"8px 10px",background:C.surface,borderRadius:6,lineHeight:1.5}}>"{s.notes}"</div>}

                {/* Set summary — sort by plan day exercise order when available */}
                {(()=>{
                  const planDay=Object.values(plans||{}).flatMap(p=>p.days||[]).find(d=>d.label===s.dayLabel||d.id===s.dayId);
                  const exIdx=Object.fromEntries((planDay?.exercises||[]).map((e,i)=>[e.name,i]));
                  return [...new Set(allSets.map(x=>x.exName))].sort((a,b)=>(exIdx[a]??999)-(exIdx[b]??999));
                })().map(name=>{
                  const exSets=allSets.filter(x=>x.exName===name);
                  return <div key={name} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{name}</div>
                    <div style={{display:"grid",gap:6}}>
                      {exSets.map((x,j)=>(
                        <Mono key={j} style={{fontSize:11,background:C.surface,padding:"8px 10px",borderRadius:8,color:x.isPR?C.red:x.minutes?C.green:C.muted,opacity:x.type==="warmup"?0.6:1}}>
                          {x.type==="warmup"?"W ":""}{x.minutes?`Interval ${x.setNum}: ${x.minutes} min${x.level?` · L${x.level}`:""}`:""}{!x.minutes&&x.weight?`${x.weight}lbs`:""}{!x.minutes&&x.weight&&x.reps?" × ":""}{!x.minutes&&x.reps?`${x.reps}r`:""}{x.isPR?" ★":""}
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
                  <Btn size="sm" variant="ghost" C={C} style={{color:C.neon,borderColor:C.neon+"44"}} onClick={()=>onRerun&&onRerun(s)}>↺ Re-run</Btn>
                  <Btn size="sm" variant="ghost" C={C} style={{color:C.blue,borderColor:C.blue+"44"}} onClick={()=>{
                    const vol=allSets.filter(x=>x.type!=="warmup").reduce((a,x)=>(a+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0);
                    const prCount=allSets.filter(x=>x.isPR).length;
                    const text=`💪 Just crushed ${s.dayLabel||"a workout"} on IRON!
${allSets.length} sets · ${vol>0?Math.round(vol).toLocaleString()+" lbs total volume":""}
${prCount>0?`★ ${prCount} new PR${prCount>1?"s":""}!`:""}
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
    </div>

    {/* Edit modal */}
    {editingSession&&<SessionEditModal session={editingSession} onSave={saveEdit} onClose={()=>setEditingSession(null)} C={C}/>}

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
function SessionEditModal({session,onSave,onClose,C}){
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState(null);
  const [editData,setEditData]=useState(()=>{
    // Build editable sets: { exName -> { setNum -> { weight, reps } } }
    const sets={};
    (session.setsArr||[]).forEach(x=>{
      if(!sets[x.exName])sets[x.exName]={};
      sets[x.exName][x.setNum]={weight:x.weight||"",reps:x.reps||"",minutes:x.minutes||"",level:x.level||"",isPR:x.isPR||false,type:x.type||"working"};
    });
    return {...session,sets};
  });
  const [newExName,setNewExName]=useState("");
  const [addingEx,setAddingEx]=useState(false);
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

  const inputStyle={padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"};

  // Parse completedAt into a local date string for the input (YYYY-MM-DD)
  const dateVal=editData.completedAt?editData.completedAt.split("T")[0]:"";

  function updateDate(val){
    if(!val)return;
    const time=editData.completedAt?.split("T")[1]||"10:00:00.000Z";
    const newCompleted=`${val}T${time}`;
    const newStarted=new Date(new Date(newCompleted).getTime()-(durationMins*60000)).toISOString();
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
    {exNames.map(exName=>{
      const sets=editData.sets[exName]||{};
      const setNums=Object.keys(sets).map(Number).sort((a,b)=>a-b);
      const isCardioEx=isCardioName(exName)||Object.values(sets).some(s=>s.minutes);
      return <div key={exName} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{exName}</div>
          {isCardioEx&&<Pill color={C.green}>Cardio</Pill>}
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
            <button key={`x${n}`} onClick={()=>removeSet(exName,n)} style={{padding:"4px",background:"transparent",border:"none",color:C.danger,cursor:"pointer",fontSize:14,borderRadius:4}}>✕</button>
          ])}
        </div>
        <Btn size="sm" variant="ghost" C={C} onClick={()=>addSet(exName,isCardioEx)} style={{fontSize:11}}>+ Set</Btn>
      </div>;
    })}

    {/* Add exercise */}
    {addingEx?<div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
      <input value={newExName} onChange={e=>setNewExName(e.target.value)}
        placeholder="Exercise name" autoFocus
        onKeyDown={e=>e.key==="Enter"&&addExercise()}
        style={{...inputStyle,flex:1}}/>
      <Btn size="sm" C={C} onClick={addExercise}>Add</Btn>
      <Btn size="sm" variant="ghost" C={C} onClick={()=>{setAddingEx(false);setNewExName("");}}>✕</Btn>
    </div>:<Btn size="sm" variant="subtle" C={C} onClick={()=>setAddingEx(true)} style={{marginBottom:14}}>+ Add Exercise</Btn>}

    {/* Notes */}
    <div style={{marginBottom:16}}>
      <SectionLabel C={C}>Session Notes</SectionLabel>
      <textarea value={editData.notes||""} onChange={e=>setEditData(p=>({...p,notes:e.target.value}))}
        placeholder="How did it feel? Any joint issues?"
        style={{width:"100%",padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",height:72,resize:"none",boxSizing:"border-box"}}/>
    </div>

    {editData.partial&&<div style={{marginBottom:16,padding:"10px 14px",background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Mono style={{fontSize:12,color:C.gold}}>Partial session</Mono>
      <button onClick={()=>setEditData(p=>({...p,partial:false}))} style={{padding:"5px 10px",background:C.gold,border:"none",borderRadius:6,color:"#0b0c0e",fontSize:11,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer",letterSpacing:"0.06em"}}>Mark as complete</button>
    </div>}

    {saveError&&<div style={{marginBottom:10,padding:"10px 12px",background:C.danger+"22",border:`1px solid ${C.danger}44`,borderRadius:8,color:C.danger,fontSize:12,fontFamily:"'SF Mono','Courier New',monospace"}}>{saveError}</div>}
    <div style={{display:"flex",gap:10}}>
      <Btn style={{flex:1}} C={C} disabled={saving} onClick={async()=>{setSaving(true);setSaveError(null);try{const ok=await onSave(editData);if(ok===false){setSaveError("Save failed — your original data is unchanged. Check connection and try again.");}else{onClose();}}catch(e){setSaveError("Save failed — your original data is unchanged. Check connection and try again.");}finally{setSaving(false);}}}>
        {saving?"Saving…":"Save Changes"}
      </Btn>
      <Btn variant="ghost" style={{flex:1}} C={C} disabled={saving} onClick={onClose}>Cancel</Btn>
    </div>
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

function StatsTab({sessions,prs,settings,C,activePlan,bodyStatsInit=[],onBodyStatsChange}){
  const [selEx,setSelEx]=useState(null);
  const [chartData,setChartData]=useState([]);
  const [statsView,setStatsView]=useState("overview"); // overview | progress | muscles | body | trainer
  const [bodyStats,setBodyStats]=useState(bodyStatsInit||[]);
  const [newBodyStat,setNewBodyStat]=useState({weight:"",chest:"",waist:"",hips:"",arms:"",date:new Date().toLocaleDateString("en-CA")});
  const [addingBody,setAddingBody]=useState(false);
  const [trainerInsight,setTrainerInsight]=useState("");
  const [loadingInsight,setLoadingInsight]=useState(false);
  const [coachUpgrade,setCoachUpgrade]=useState(null);

  const allExNames=[...new Set(sessions.flatMap(s=>(s.setsArr||[]).map(x=>x.exName)))].sort();
  const prList=Object.entries(prs).sort((a,b)=>b[1].weight-a[1].weight);
  const totalVol=sessions.reduce((a,s)=>(a+(s.setsArr||[]).filter(x=>x.type!=="warmup").reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);

  // Month over month
  const now = new Date();
  const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonth=`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,"0")}`;
  const thisMonthVol = sessions.filter(s=>s.completedAt&&new Date(s.completedAt).toLocaleDateString("en-CA").startsWith(thisMonth)).reduce((a,s)=>(a+(s.setsArr||[]).filter(x=>x.type!=="warmup").reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);
  const lastMonthVol = sessions.filter(s=>s.completedAt&&new Date(s.completedAt).toLocaleDateString("en-CA").startsWith(lastMonth)).reduce((a,s)=>(a+(s.setsArr||[]).filter(x=>x.type!=="warmup").reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);
  const momChange = lastMonthVol>0 ? Math.round(((thisMonthVol-lastMonthVol)/lastMonthVol)*100) : null;

  // Weekly volume summary
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const weekStr = weekStart.toLocaleDateString("en-CA");
  const weekSessions = sessions.filter(s=>s.completedAt&&new Date(s.completedAt).toLocaleDateString("en-CA")>=weekStr);
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
  sessions.filter(s=>s.completedAt&&new Date(s.completedAt)>sevenDaysAgo).forEach(s=>{
    (s.setsArr||[]).filter(x=>x.type!=="warmup").forEach(x=>{
      const m=muscleMap[x.exName]||"Other";
      if(!muscleVolMapped[m])muscleVolMapped[m]=0;
      muscleVolMapped[m]+=(parseFloat(x.weight)||1)*(parseInt(x.reps)||1);
    });
  });
  const muscleOrder=["Chest","Back","Shoulders","Biceps","Triceps","Legs","Abs","Cardio"];
  const maxMuscleVol=Math.max(...Object.values(muscleVolMapped),1);

  useEffect(()=>{
    if(!selEx){if(allExNames.length)setSelEx(allExNames[0]);return;}
    const rel=sessions.filter(s=>s.completedAt&&(s.setsArr||[]).some(x=>x.exName===selEx));
    const grouped={};
    rel.forEach(s=>{const d=new Date(s.completedAt).toLocaleDateString("en-CA");const best=(s.setsArr||[]).filter(x=>x.exName===selEx&&x.type!=="warmup").reduce((m,x)=>Math.max(m,parseFloat(x.weight)||0),0);if(!grouped[d]||best>grouped[d])grouped[d]=best;});
    setChartData(Object.entries(grouped).sort(([a],[b])=>a>b?1:-1).map(([d,w])=>({date:d.slice(5),weight:w,orm:Math.round(w*1.0333*1)})));
  },[selEx,sessions]);// eslint-disable-line react-hooks/exhaustive-deps

  async function loadTrainerInsight(){
    setLoadingInsight(true);
    const recentSessions=sessions.slice(0,5).map(s=>({day:s.dayLabel,date:s.completedAt?.split("T")[0],sets:(s.setsArr||[]).length}));
    const topPRs=prList.slice(0,5).map(([n,p])=>(`${n}: ${p.weight}lbs`));
    const prompt=`You are a personal trainer AI.${aiProfileContext(settings)} Analyze this user's recent workout data and provide ONE specific, actionable insight in 2-3 sentences. Be direct and personalized.

Recent sessions: ${JSON.stringify(recentSessions)}
Top PRs: ${topPRs.join(", ")}
Total sessions: ${sessions.length}
This week volume: ${Math.round(weekVol).toLocaleString()} lbs
Month-over-month change: ${momChange!==null?`${momChange>0?"+":""}${momChange}%`:"N/A"}

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

  const tabStyle=(active)=>({flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:active?C.accent:"transparent",color:active?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:10,cursor:"pointer",letterSpacing:"0.04em"});

  return <div>
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 18px 0"}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em",marginBottom:2}}>Progress</div>
      <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:12}}>{(()=>{const wk=planWeekOf(activePlan);const tot=activePlan?.durationWeeks||10;return wk?`Week ${Math.min(wk,tot)} of ${tot} in your program`:`Week ${programWeek(sessions)} of your program`;})()}</Mono>
      <div style={{display:"flex",gap:4,background:C.card,padding:4,borderRadius:10,marginBottom:"-1px"}}>
        {[["overview","Overview"],["progress","Progress"],["muscles","Muscles"],["body","Body"],["trainer","✦ Coach"]].map(([k,label])=>(
          <button key={k} onClick={()=>{setStatsView(k);if(k==="trainer"&&!trainerInsight)loadTrainerInsight();}} style={tabStyle(statsView===k)}>{label}</button>
        ))}
      </div>
    </div>

    <div style={{padding:"14px 18px"}}>

      {/* OVERVIEW */}
      {statsView==="overview"&&<div>
        {/* Weekly summary */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:14}}>
          <SectionLabel C={C}>This Week</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:C.neon,fontFamily:"'SF Mono','Courier New',monospace"}}>{weekSessions.length}</div><Mono style={{fontSize:10,color:C.muted}}>sessions</Mono></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:C.accent,fontFamily:"'SF Mono','Courier New',monospace"}}>{weekVol>0?`${Math.round(weekVol/1000)}k`:"0"}</div><Mono style={{fontSize:10,color:C.muted}}>lbs</Mono></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:C.gold,fontFamily:"'SF Mono','Courier New',monospace"}}>{sessions.filter(s=>s.completedAt).length}</div><Mono style={{fontSize:10,color:C.muted}}>total</Mono></div>
          </div>
        </div>

        {/* Month over month */}
        {momChange!==null&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <SectionLabel C={C}>Month vs Last Month</SectionLabel>
            <div style={{fontSize:13,color:C.muted}}>Volume comparison</div>
          </div>
          <div style={{fontSize:28,fontWeight:800,fontFamily:"'SF Mono','Courier New',monospace",color:momChange>=0?C.neon:C.red}}>
            {momChange>0?"+":""}{momChange}%
          </div>
        </div>}

        {/* PR Board */}
        {prList.length>0&&<div style={{marginBottom:14}}>
          <SectionLabel C={C}>Personal Records</SectionLabel>
          {prList.slice(0,5).map(([name,pr])=>(
            <div key={name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <div style={{fontSize:13}}>{name}</div>
                <Mono style={{fontSize:10,color:C.muted}}>{STRENGTH_LEVELS[getStrengthScore(name,pr.weight)]}</Mono>
              </div>
              <Mono style={{fontSize:14,color:C.gold,fontWeight:700}}>{pr.weight} lbs ★</Mono>
            </div>
          ))}
        </div>}

        <div style={{marginBottom:14}}><OverloadCalc C={C}/></div>
      </div>}

      {/* PROGRESS */}
      {statsView==="progress"&&<div>
        <SectionLabel C={C}>Exercise Progress</SectionLabel>
        <select value={selEx||""} onChange={e=>setSelEx(e.target.value)}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",marginBottom:14}}>
          {allExNames.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        {chartData.length>1?<div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 8px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4,paddingLeft:8}}>{selEx} — Max Weight</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{top:4,right:12,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="date" tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
                <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
                <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,color:C.text}}/>
                <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Est 1RM chart */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 8px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4,paddingLeft:8}}>{selEx} — Est. 1RM Trend</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData.map(d=>({...d,orm:d.weight?Math.round(d.weight*1.0333*1):0}))} margin={{top:4,right:12,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="date" tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
                <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
                <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,color:C.text}}/>
                <Line type="monotone" dataKey="orm" stroke={C.gold} strokeWidth={2} dot={{fill:C.gold,r:3}} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Strength score for this exercise */}
          {prs[selEx]&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:12}}>
            <SectionLabel C={C}>Strength Level</SectionLabel>
            <div style={{display:"flex",gap:4}}>
              {STRENGTH_LEVELS.map((level,i)=>{
                const score=getStrengthScore(selEx,prs[selEx]?.weight);
                return <div key={level} style={{flex:1,textAlign:"center"}}>
                  <div style={{height:8,borderRadius:4,background:i<=score?C.accent:C.border,marginBottom:4,transition:"background .3s"}}/>
                  <Mono style={{fontSize:8,color:i<=score?C.accent:C.faint}}>{level.slice(0,3)}</Mono>
                </div>;
              })}
            </div>
            <Mono style={{fontSize:12,color:C.accent,display:"block",marginTop:8,textAlign:"center",fontWeight:700}}>
              {STRENGTH_LEVELS[getStrengthScore(selEx,prs[selEx]?.weight)]} — {prs[selEx]?.weight} lbs
            </Mono>
          </div>}
        </div>:<div style={{textAlign:"center",padding:"24px",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Log more sessions to see your trend.</div>}
      </div>}

      {/* MUSCLE VOLUME DASHBOARD */}
      {statsView==="muscles"&&<div>
        <SectionLabel C={C}>Volume by Muscle — Last 7 Days</SectionLabel>
        {muscleOrder.filter(m=>muscleVolMapped[m]>0).length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Log workouts to see muscle volume breakdown.</div>}
        {muscleOrder.map(muscle=>{
          const vol=muscleVolMapped[muscle]||0;
          if(!vol)return null;
          const pct=Math.round((vol/maxMuscleVol)*100);
          const colors={"Chest":C.accent,"Back":C.blue,"Shoulders":C.gold,"Biceps":C.neon,"Triceps":C.neon,"Legs":"#b06aff","Abs":C.muted,"Cardio":C.green};
          return <div key={muscle} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <Mono style={{fontSize:12,color:C.text,fontWeight:600}}>{muscle}</Mono>
              <Mono style={{fontSize:11,color:C.muted}}>{Math.round(vol/1000*10)/10}k lbs</Mono>
            </div>
            <div style={{height:10,background:C.border,borderRadius:5}}>
              <div style={{height:"100%",background:colors[muscle]||C.accent,borderRadius:5,width:`${pct}%`,transition:"width .5s ease"}}/>
            </div>
          </div>;
        })}
        {/* Strength scores per muscle */}
        <div style={{marginTop:20}}>
          <SectionLabel C={C}>Strength Score by Muscle</SectionLabel>
          {Object.entries(prs).slice(0,8).map(([name,pr])=>{
            const score=getStrengthScore(name,pr.weight);
            const level=STRENGTH_LEVELS[score];
            const colors=["#8a96a8","#4f8ef7","#3ecf8e","#f7c948","#f06584"];
            return <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12}}>{name}</div>
                <Mono style={{fontSize:10,color:C.muted}}>{pr.weight} lbs PR</Mono>
              </div>
              <div style={{padding:"3px 10px",borderRadius:12,background:colors[score]+"22",border:`1px solid ${colors[score]}44`}}>
                <Mono style={{fontSize:10,color:colors[score],fontWeight:700}}>{level}</Mono>
              </div>
            </div>;
          })}
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
      {statsView==="trainer"&&<div>
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
function MoreTab({settings,saveSettings,plans,sessions,prs,C,toggleTheme,themeMode}){
  const [local,setLocal]=useState({...settings});
  const [saved,setSaved]=useState(false);
  const [healthMsg,setHealthMsg]=useState("");
  const isIOSSafari=typeof navigator!=="undefined"&&/iPhone|iPad|iPod/.test(navigator.userAgent)&&/Safari/.test(navigator.userAgent)&&!/Chrome|CriOS|FxiOS/.test(navigator.userAgent);

  function save(){saveSettings(local);setSaved(true);setTimeout(()=>setSaved(false),2000);}

  async function handleHealthToggle(){
    const next=!local.appleHealth;
    const updated={...local,appleHealth:next};
    setLocal(updated);
    saveSettings(updated);
    if(next){
      try{
        if(window.navigator.health?.requestAuthorization){
          await window.navigator.health.requestAuthorization(["workouts","activeEnergyBurned"]);
          setHealthMsg("Connected ✓");
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

  return <div>
    <div style={{background:C.surface,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Settings</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={toggleTheme} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,cursor:"pointer",padding:"7px 12px",fontSize:13}}>
            {themeMode==="dark"?"☀️":"🌙"}
          </button>
          <button onClick={async()=>{try{await supabase.auth.signOut();}catch(e){console.error("signOut:",e);}}} style={{background:"transparent",border:`1px solid ${C.danger}44`,borderRadius:8,color:C.danger,cursor:"pointer",padding:"7px 12px",fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.04em"}}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
    <div style={{padding:"14px 18px"}}>
      <SectionLabel C={C}>Features</SectionLabel>
      {features.map(f=>(
        <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14}}>{f.label}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.desc}</div>
          </div>
          <Toggle on={!!local[f.key]} onToggle={()=>setLocal(p=>({...p,[f.key]:!p[f.key]}))} C={C}/>
        </div>
      ))}

      {local.restTimer&&<div style={{padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
        <SectionLabel C={C}>Rest Duration (seconds)</SectionLabel>
        <input type="number" value={local.restSeconds||90} onChange={e=>setLocal(p=>({...p,restSeconds:parseInt(e.target.value)||90}))}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:16,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
      </div>}

      <Btn size="lg" style={{width:"100%",marginTop:20}} onClick={save} C={C}>{saved?"Saved ✓":"Save Settings"}</Btn>

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
        {healthMsg&&<Mono style={{fontSize:11,color:C.neon,display:"block",marginTop:8}}>{healthMsg}</Mono>}
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
                    background:local[key]===o?C.accent:"transparent",
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
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.neon,marginBottom:6}}>VOLUME</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.text}}>{volume>=1000?`${(volume/1000).toFixed(1)}k`:volume.toLocaleString()}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>lbs lifted</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.accent}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.accent,marginBottom:6}}>SETS</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.text}}>{setCount}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>completed</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.gold}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.gold,marginBottom:6}}>STREAK</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.gold}}>{complianceStreak}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>days on plan</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"14px 16px",textAlign:"center",border:`1.5px solid ${C.red}44`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",color:C.red,marginBottom:6}}>NEW PRs</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:C.red}}>{prList.length}</div>
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
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#f0fdf4",border:"1.5px solid #3ecf8e",borderRadius:6,padding:"3px 8px",color:"#1a7a4a",fontSize:9,fontWeight:700}}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <path d="M12 3L14.5 9.5L21.5 10.3L16.5 15L18 22L12 18.5L6 22L7.5 15L2.5 10.3L9.5 9.5L12 3Z" fill="#3ecf8e" stroke="#2ab87a" strokeWidth={1}/>
                    </svg>
                    PR
                  </div>
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
