import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ldbrabnvpiidrdkmjpbo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYnJhYm52cGlpZHJka21qcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDMxOTQsImV4cCI6MjA5MzUxOTE5NH0.mJZINJgMl8QD-gTSc2LLikwc8OUloCTyfqoHqRe1xZI";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ── IN-MEMORY CACHE (Supabase is source of truth) ────────────────────────────
const _cacheData = {};
const cache = {
  get: (k, fb=null) => k in _cacheData ? _cacheData[k] : fb,
  set: (k, v) => { _cacheData[k] = v; },
};

const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// -- PROGRAM START -------------------------------------------------------------
const PROGRAM_START = "2026-05-02"; // fallback only
const getProgramStart = (sessions) => {
  if(!sessions||!sessions.length) return PROGRAM_START;
  const dates = sessions
    .filter(s=>s.completedAt)
    .map(s=>s.completedAt.split("T")[0])
    .sort();
  return dates[0] || PROGRAM_START;
};
const programWeek = (sessions=[]) => {
  const start = new Date(getProgramStart(sessions));
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  return Math.max(1, Math.ceil((days + 1) / 7));
};

// Saturday May 2 2026 session — enter manually via Log tab


// -- THEME ---------------------------------------------------------------------
const THEMES = {
  dark: {
    bg:"#161b22", surface:"#1e2530", card:"#252d3a", border:"#3a4456",
    accent:"#4f8ef7", neon:"#3ecf8e", red:"#f06584", gold:"#f7c948",
    blue:"#4f8ef7", green:"#3ecf8e", danger:"#f06584",
    text:"#e8edf4", muted:"#8a96a8", faint:"#4a5568", cardText:"#f2f5fa",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#1a2130", gradTop:"linear-gradient(135deg,#4f8ef715 0%,#3ecf8e08 100%)",
  },
  light: {
    bg:"#f7f9fc", surface:"#ffffff", card:"#ffffff", border:"#e2e8f0",
    accent:"#4f8ef7", neon:"#0ea66e", red:"#e53e6a", gold:"#d4a017",
    blue:"#4f8ef7", green:"#0ea66e", danger:"#e53e6a",
    text:"#1a202c", muted:"#64748b", faint:"#94a3b8", cardText:"#0d1117",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#ffffff", gradTop:"linear-gradient(135deg,#4f8ef710 0%,#0ea66e08 100%)",
  }
};

// -- DEFAULT PLANS -------------------------------------------------------------
const mkId = () => `id_${Math.random().toString(36).slice(2,9)}`;

const MIKE_PLANS = {
  A: {
    key:"A", name:"Custom - PPL", subtitle:"Push/Pull/Legs . 4-5 days",
    description:"Arms built into Push/Pull days. High frequency, clean structure.",
    days:[
      { id:"a1", name:"Monday", label:"Push", tag:"Chest . Shoulders . Triceps", color:"#4f8ef7", isRest:false, exercises:[
        {id:"a1e1",name:"Bench Press",sets:"4",reps:"6-10",note:"Primary strength move",muscle:"Chest"},
        {id:"a1e2",name:"Incline Press (DB)",sets:"3",reps:"8-12",note:"DB preferred for shoulder safety",muscle:"Chest"},
        {id:"a1e3",name:"Machine Shoulder Press",sets:"3",reps:"10-12",note:"Machine reduces joint stress",muscle:"Shoulders"},
        {id:"a1e4",name:"Dumbbell Lateral Raises",sets:"3",reps:"12-15",note:"Slow eccentric, avoid momentum",muscle:"Shoulders"},
        {id:"a1e5",name:"Incline Tricep Extension",sets:"3",reps:"10-12",note:"Elbow-friendly angle",muscle:"Triceps"},
        {id:"a1e6",name:"Cable Overhead Extension",sets:"2",reps:"12-15",note:"Long-head emphasis",muscle:"Triceps"},
        {id:"a1e7",name:"Stair Stepper",sets:"--",reps:"10-15 min",note:"Zone 2 cardio post-workout",muscle:"Cardio"},
      ]},
      { id:"a2", name:"Tuesday", label:"Pull", tag:"Back . Biceps . Rear Delt", color:"#3d8eff", isRest:false, exercises:[
        {id:"a2e1",name:"Reverse Grip Lat Pulldown",sets:"4",reps:"8-12",note:"Supinated grip -- easier on elbows",muscle:"Back"},
        {id:"a2e2",name:"Seated Cable Row",sets:"3",reps:"10-12",note:"Drive elbows back, hold 1 sec",muscle:"Back"},
        {id:"a2e3",name:"Rear Delt Machine",sets:"3",reps:"12-15",note:"Shoulder health -- never skip",muscle:"Shoulders"},
        {id:"a2e4",name:"Cable Curl",sets:"3",reps:"10-12",note:"Control the negative",muscle:"Biceps"},
        {id:"a2e5",name:"Concentration Curl",sets:"2",reps:"12-15",note:"Full squeeze at top, slow negative",muscle:"Biceps"},
        {id:"a2e6",name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {id:"a2e7",name:"Russian Twist",sets:"3",reps:"20 total",note:"Add plate for progression",muscle:"Abs"},
      ]},
      { id:"a3", name:"Wednesday", label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {id:"a3e1",name:"Walking / Yoga / Stretching",sets:"--",reps:"20-30 min",note:"Keep it easy",muscle:"Recovery"},
      ]},
      { id:"a4", name:"Thursday", label:"Legs", tag:"Quads . Glutes . Hamstrings . Core", color:"#aa44ff", isRest:false, exercises:[
        {id:"a4e1",name:"Goblet Squat",sets:"4",reps:"10-15",note:"Keep weight over mid-foot",muscle:"Legs"},
        {id:"a4e2",name:"DB Romanian Deadlift",sets:"3",reps:"10-12",note:"Hip hinge -- protects knees",muscle:"Legs"},
        {id:"a4e3",name:"Box Step-Ups (DB)",sets:"3",reps:"10 each leg",note:"Drive through heel, controlled step down",muscle:"Legs"},
        {id:"a4e4",name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
        {id:"a4e5",name:"Russian Twist",sets:"3",reps:"20 total",note:"",muscle:"Abs"},
        {id:"a4e6",name:"Stair Stepper",sets:"--",reps:"10 min",note:"Shorter today -- legs already worked",muscle:"Cardio"},
      ]},
      { id:"a5", name:"Friday", label:"Push", tag:"Chest . Shoulders . Triceps (Vol)", color:"#4f8ef7", isRest:false, exercises:[
        {id:"a5e1",name:"Incline Press (DB)",sets:"4",reps:"8-12",note:"Lead with incline today",muscle:"Chest"},
        {id:"a5e2",name:"Cable Fly / Pec Deck",sets:"3",reps:"12-15",note:"Stretch-focused, lighter load",muscle:"Chest"},
        {id:"a5e3",name:"Machine Shoulder Press",sets:"3",reps:"10-12",note:"",muscle:"Shoulders"},
        {id:"a5e4",name:"Cable Lateral Raise",sets:"3",reps:"12-15",note:"Constant tension vs DB",muscle:"Shoulders"},
        {id:"a5e5",name:"Cable Rope Pressdown",sets:"3",reps:"12-15",note:"",muscle:"Triceps"},
        {id:"a5e6",name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
      ]},
      { id:"a6", name:"Saturday", label:"Pull", tag:"Back . Biceps (Volume)", color:"#3d8eff", isRest:false, exercises:[
        {id:"a6e1",name:"T-Bar Row",sets:"4",reps:"8-12",note:"Neutral grip easier on elbows",muscle:"Back"},
        {id:"a6e2",name:"Reverse Grip Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {id:"a6e3",name:"Rear Delt Cable or Machine",sets:"3",reps:"12-15",note:"",muscle:"Shoulders"},
        {id:"a6e4",name:"Cable Curl",sets:"3",reps:"12-15",note:"Constant tension",muscle:"Biceps"},
        {id:"a6e5",name:"Concentration Curl",sets:"2",reps:"12-15",note:"Full squeeze at top",muscle:"Biceps"},
        {id:"a6e6",name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
        {id:"a6e7",name:"Stair Stepper",sets:"--",reps:"15 min",note:"",muscle:"Cardio"},
      ]},
      { id:"a7", name:"Sunday", label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {id:"a7e1",name:"Full Rest or Light Walk",sets:"--",reps:"--",note:"Recovery is where you grow",muscle:"Recovery"},
      ]},
    ]
  },
  B: {
    key:"B", name:"Custom - Antagonist Split", subtitle:"Antagonist pairs . 4-5 days",
    description:"Chest/Back paired, then a standalone Arm day. Full arm focus and great pumps.",
    days:[
      { id:"b1", name:"Monday", label:"Chest + Back", tag:"Antagonist Pair", color:"#4f8ef7", isRest:false, exercises:[
        {id:"b1e1",name:"Bench Press",sets:"4",reps:"6-10",note:"Primary push strength",muscle:"Chest"},
        {id:"b1e2",name:"T-Bar Row",sets:"4",reps:"8-12",note:"Superset option with bench",muscle:"Back"},
        {id:"b1e3",name:"Incline Press (DB)",sets:"3",reps:"8-12",note:"",muscle:"Chest"},
        {id:"b1e4",name:"Reverse Grip Lat Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {id:"b1e5",name:"Cable Fly",sets:"3",reps:"12-15",note:"Stretch focus",muscle:"Chest"},
        {id:"b1e6",name:"Seated Cable Row",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {id:"b1e7",name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {id:"b1e8",name:"Stair Stepper",sets:"--",reps:"10-15 min",note:"",muscle:"Cardio"},
      ]},
      { id:"b2", name:"Tuesday", label:"Arms", tag:"Shoulders . Triceps . Biceps", color:"#f0b429", isRest:false, exercises:[
        {id:"b2e1",name:"Machine Shoulder Press",sets:"4",reps:"10-12",note:"Machine reduces joint stress",muscle:"Shoulders"},
        {id:"b2e2",name:"DB / Cable Lateral Raises",sets:"3",reps:"12-15",note:"Slow and controlled",muscle:"Shoulders"},
        {id:"b2e3",name:"Rear Delt Machine",sets:"3",reps:"12-15",note:"Critical for shoulder health",muscle:"Shoulders"},
        {id:"b2e4",name:"Incline Tricep Extension",sets:"3",reps:"10-12",note:"",muscle:"Triceps"},
        {id:"b2e5",name:"Cable Overhead Extension",sets:"2",reps:"12-15",note:"",muscle:"Triceps"},
        {id:"b2e6",name:"Cable Curl",sets:"3",reps:"10-12",note:"",muscle:"Biceps"},
        {id:"b2e7",name:"Concentration Curl",sets:"3",reps:"12-15",note:"Full squeeze, slow negative",muscle:"Biceps"},
        {id:"b2e8",name:"Russian Twist",sets:"3",reps:"20 total",note:"",muscle:"Abs"},
      ]},
      { id:"b3", name:"Wednesday", label:"Rest", tag:"Active Recovery", color:"#aaff00", isRest:true, exercises:[
        {id:"b3e1",name:"Walking / Yoga / Stretching",sets:"--",reps:"20-30 min",note:"",muscle:"Recovery"},
      ]},
      { id:"b4", name:"Thursday", label:"Legs", tag:"Quads . Glutes . Hamstrings . Core", color:"#aa44ff", isRest:false, exercises:[
        {id:"b4e1",name:"Goblet Squat",sets:"4",reps:"10-15",note:"Heels elevated slightly if needed",muscle:"Legs"},
        {id:"b4e2",name:"DB Romanian Deadlift",sets:"3",reps:"10-12",note:"Hip hinge -- protects knees",muscle:"Legs"},
        {id:"b4e3",name:"Box Step-Ups (DB)",sets:"3",reps:"10 each leg",note:"Drive through heel, controlled down",muscle:"Legs"},
        {id:"b4e4",name:"DB Lunges (optional)",sets:"3",reps:"10 each leg",note:"Only if knees feel good",muscle:"Legs"},
        {id:"b4e5",name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
        {id:"b4e6",name:"Machine Crunch",sets:"3",reps:"15-20",note:"",muscle:"Abs"},
        {id:"b4e7",name:"Stair Stepper",sets:"--",reps:"10 min",note:"",muscle:"Cardio"},
      ]},
      { id:"b5", name:"Friday", label:"Chest + Back", tag:"Antagonist Pair (Volume)", color:"#4f8ef7", isRest:false, exercises:[
        {id:"b5e1",name:"Incline Press (DB)",sets:"4",reps:"8-12",note:"Lead with incline",muscle:"Chest"},
        {id:"b5e2",name:"Seated Row (Close Grip)",sets:"4",reps:"10-12",note:"",muscle:"Back"},
        {id:"b5e3",name:"Pec Deck / Cable Fly",sets:"3",reps:"12-15",note:"",muscle:"Chest"},
        {id:"b5e4",name:"Reverse Grip Pulldown",sets:"3",reps:"10-12",note:"",muscle:"Back"},
        {id:"b5e5",name:"Rear Delt Cable",sets:"3",reps:"12-15",note:"Shoulder health",muscle:"Shoulders"},
        {id:"b5e6",name:"Russian Twist",sets:"3",reps:"20 total",note:"",muscle:"Abs"},
        {id:"b5e7",name:"Stair Stepper",sets:"--",reps:"15 min",note:"",muscle:"Cardio"},
      ]},
      { id:"b6", name:"Saturday", label:"Arms", tag:"Shoulders . Triceps . Biceps (Vol)", color:"#f0b429", isRest:false, exercises:[
        {id:"b6e1",name:"Machine Shoulder Press",sets:"3",reps:"10-12",note:"",muscle:"Shoulders"},
        {id:"b6e2",name:"Cable Lateral Raise",sets:"3",reps:"12-15",note:"Constant tension",muscle:"Shoulders"},
        {id:"b6e3",name:"Front Delt Raise",sets:"2",reps:"12-15",note:"",muscle:"Shoulders"},
        {id:"b6e4",name:"Cable Rope Pressdown",sets:"3",reps:"12-15",note:"",muscle:"Triceps"},
        {id:"b6e5",name:"Incline Tricep Extension",sets:"2",reps:"10-12",note:"",muscle:"Triceps"},
        {id:"b6e6",name:"Barbell / Cable Curl",sets:"3",reps:"10-12",note:"",muscle:"Biceps"},
        {id:"b6e7",name:"Concentration Curl",sets:"2",reps:"12-15",note:"",muscle:"Biceps"},
        {id:"b6e8",name:"Decline Sit-Ups",sets:"3",reps:"12-15",note:"",muscle:"Abs"},
      ]},
      { id:"b7", name:"Sunday", label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {id:"b7e1",name:"Full Rest",sets:"--",reps:"--",note:"Recovery is where you grow",muscle:"Recovery"},
      ]},
    ]
  }
};

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
      { label:"Rest", tag:"Full Rest", color:"#aaff00", isRest:true, exercises:[
        {name:"Rest",sets:"--",reps:"--",note:"",muscle:"Recovery"},
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
  }
];

const DEFAULT_SETTINGS = {
  restTimer:true, restSeconds:90, prDetection:true, lastRef:true,
  deloadReminder:true, streakTracking:true, plateCalc:true,
  workoutNotes:true, aiRecs:true, startDay:1,
};

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
  return <span style={{fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",background:color+"20",color,padding:"2px 8px",borderRadius:3,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,border:`1px solid ${color}40`,...style}}>{children}</span>;
}

function Btn({children,onClick,variant="primary",size="md",style={},disabled=false,C}){
  const sizes={sm:{padding:"6px 13px",fontSize:11},md:{padding:"10px 18px",fontSize:13},lg:{padding:"14px 24px",fontSize:14}};
  const bg={primary:C.accent,ghost:"transparent",danger:C.danger+"22",subtle:C.card,gold:C.gold};
  const col={primary:"#fff",ghost:C.text,danger:C.danger,subtle:C.text,gold:"#fff"};
  const bdr={ghost:`1px solid ${C.border}`,danger:`1px solid ${C.danger}44`,subtle:`1px solid ${C.border}`};
  return <button style={{border:bdr[variant]||"none",cursor:disabled?"not-allowed":"pointer",fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.04em",borderRadius:8,transition:"opacity .15s",opacity:disabled?.5:1,background:bg[variant]||C.accent,color:col[variant]||"#fff",...sizes[size],...style}} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Modal({children,onClose,C}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:C.surface,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:"20px 20px 40px"}} onClick={e=>e.stopPropagation()}>
      {children}
    </div>
  </div>;
}

function SectionLabel({children,C}){
  return <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.14em",textTransform:"uppercase",display:"block",marginBottom:10,fontWeight:600}}>{children}</Mono>;
}

function RestTimer({seconds,onDone,onSkip,C}){
  const [rem,setRem]=useState(seconds);
  useEffect(()=>{
    if(rem<=0){onDone();return;}
    const t=setTimeout(()=>setRem(r=>r-1),1000);
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
        style={{flex:1,padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
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
    <button onClick={toggleTheme} style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 12px)",right:16,background:"transparent",border:"1px solid #2e333d",borderRadius:8,color:"#9ba3b0",cursor:"pointer",padding:"6px 10px",fontSize:14}}>
      {themeMode==="dark"?"☀️":"🌙"}
    </button>

    <div style={{width:"100%",maxWidth:380}}>
      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:36}}>
        {/* Dumbbell icon */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
          <img src="data:image/png;base64,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" alt="IRON" style={{width:200,height:"auto",filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.7))"}}/>
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
          <div style={{fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",color:"#9ba3b0",letterSpacing:"0.12em",marginBottom:6}}>NAME (optional)</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"
            style={inputStyle} autoComplete="name"/>
        </div>}

        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",color:"#9ba3b0",letterSpacing:"0.12em",marginBottom:6}}>EMAIL</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
            style={inputStyle} autoComplete="email"
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>

        {mode!=="reset"&&<div style={{marginBottom:20}}>
          <div style={{fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",color:"#9ba3b0",letterSpacing:"0.12em",marginBottom:6}}>PASSWORD</div>
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
  const [plans,setPlans]=useState(MIKE_PLANS);
  const [activePlanKey,setActivePlanKey]=useState("B");
  const [settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [sessions,setSessions]=useState([]);
  const [prs,setPrs]=useState({});
  const [themeMode,setThemeMode]=useState("dark");
  const [loading,setLoading]=useState(true);
  const [authUser,setAuthUser]=useState(null);
  const [authChecked,setAuthChecked]=useState(false);
  const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [offlineQueue,setOfflineQueue]=useState([]);
  const [bodyStatsGlobal,setBodyStatsGlobal]=useState([]);
  const [tab,setTab]=useState("today");
  const [activeWorkout,setActiveWorkout]=useState(null);
  const [deloadDismissed,setDeloadDismissed]=useState(null);
  const C=useTheme(themeMode);

  const savePlans=async(p)=>{
    setPlans(p);
    try{
      const {data:{user:u}}=await supabase.auth.getUser();
      if(!u)return;
      for(const[key,plan]of Object.entries(p)){
        await supabase.from("plans").upsert({
          id:plan.supabaseId||undefined,
          user_id:u.id, plan_key:key, name:plan.name,
          subtitle:plan.subtitle, description:plan.description
        },{onConflict:"user_id,plan_key"});
      }
    }catch(e){ console.error("savePlans:",e); }
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
      ai_recs:s.aiRecs, start_day:s.startDay, theme_mode:themeMode
    },{onConflict:"user_id"});
    }catch(e){ console.error("saveSettings:",e); }
  };

  const saveSessions=async(s)=>{
    if(!Array.isArray(s))return;
    setSessions(s);
    try{
    const {data:{user:u}}=await supabase.auth.getUser();
    if(!u)return;
    // Save the most recent session (last in array)
    const latest=s[s.length-1];
    if(latest&&!latest.supabaseId){
      const {data}=await supabase.from("workout_sessions").insert({
        user_id:u.id, day_label:latest.dayLabel,
        started_at:latest.startedAt, completed_at:latest.completedAt,
        notes:latest.notes, sets_data:latest.sets||{},
        rating:latest.rating||null
      }).select().single();
      if(data){
        // Save individual sets
        const setRows=(latest.setsArr||[]).map(x=>({
          session_id:data.id, user_id:u.id,
          exercise_name:x.exName, set_number:x.setNum,
          weight:parseFloat(x.weight)||null,
          reps:parseInt(x.reps)||null,
          minutes:parseFloat(x.minutes)||null,
          is_pr:x.isPR||false
        }));
        if(setRows.length>0)await supabase.from("logged_sets").insert(setRows);
      }
    }
    }catch(e){ console.error("saveSessions:",e); }
  };

  const savePRs=async(p)=>{
    setPrs(p);
    try{
      const {data:{user:u}}=await supabase.auth.getUser();
      if(!u)return;
      for(const[name,pr]of Object.entries(p)){
        await supabase.from("personal_records").upsert({
          user_id:u.id, exercise_name:name,
          max_weight:pr.weight, achieved_at:pr.date
        },{onConflict:"user_id,exercise_name"});
      }
    }catch(e){ console.error("savePRs:",e); }
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
          aiRecs:sett.ai_recs, startDay:sett.start_day||1
        });
        if(sett.theme_mode)setThemeMode(sett.theme_mode);
      }
      // Load sessions
      const {data:sessData}=await supabase.from("workout_sessions")
        .select("*, logged_sets(*)")
        .eq("user_id",u.id)
        .order("completed_at",{ascending:false})
        .limit(100);
      if(sessData){
        const mapped=sessData.map(s=>({
          id:s.id, supabaseId:s.id,
          dayLabel:s.day_label, dayId:s.day_id,
          startedAt:s.started_at, completedAt:s.completed_at,
          notes:s.notes, sets:s.sets_data||{},
          setsArr:(s.logged_sets||[]).map(x=>({
            exName:x.exercise_name, setNum:x.set_number,
            weight:x.weight?.toString()||"",
            reps:x.reps?.toString()||"",
            minutes:x.minutes?.toString()||"",
            isPR:x.is_pr
          }))
        }));
        setSessions(mapped);
      }
      // Load PRs
      const {data:prData}=await supabase.from("personal_records").select("*").eq("user_id",u.id);
      if(prData){
        const prMap={};
        prData.forEach(r=>{prMap[r.exercise_name]={weight:r.max_weight,date:r.achieved_at};});
        setPrs(prMap);
      }
      // Load body stats from profile metadata
      if(prof?.raw_user_meta_data?.body_stats){
        try{ setBodyStatsGlobal(JSON.parse(prof.raw_user_meta_data.body_stats||"[]")); }catch{}
      }
      // Load active plan key from profile
      const {data:prof}=await supabase.from("profiles").select("*").eq("id",u.id).single();
      if(prof?.active_plan_key)setActivePlanKey(prof.active_plan_key);
      setLoading(false);
    };
    supabase.auth.getSession().then(({data:{session}})=>{
      setAuthUser(session?.user||null);
      setAuthChecked(true);
      if(session?.user)loadUserData(session.user);
      else setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      setAuthUser(session?.user||null);
      if(session?.user){loadUserData(session.user);}
      else{setSessions([]);setPrs({});setPlans(MIKE_PLANS);setSettings(DEFAULT_SETTINGS);setLoading(false);}
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

  // Data persisted to Supabase automatically

  const activePlan=plans[activePlanKey];

  // Compute reordered days based on startDay
  const getOrderedDays=(days)=>{
    if(!days||!days.length)return days;
    const sd=settings.startDay??1;
    const idx=days.findIndex(d=>DOW.indexOf(d.name)===sd);
    if(idx<=0)return days;
    return [...days.slice(idx),...days.slice(0,idx)];
  };

  // Scheduled streak -- consecutive planned (non-rest) workout days completed
  // A rest day in the plan does NOT break this streak
  const scheduledStreak=(()=>{
    if(!settings.streakTracking)return 0;
    const activePlanDays=(plans[activePlanKey]?.days||[]).filter(d=>!d.isRest).map(d=>d.name); // e.g. ["Monday","Tuesday","Thursday","Friday","Saturday"]
    // Get workout dates that have actual data, newest first
    const workedDates=[...new Set(
      sessions.filter(s=>s.completedAt&&(s.setsArr||[]).some(x=>x.weight||x.reps||x.minutes))
        .map(s=>s.completedAt.split("T")[0])
    )].sort().reverse();
    if(!workedDates.length)return 0;
    // Walk forward from program start, count consecutive scheduled days that were completed
    // Build list of all scheduled workout dates from program start up to today
    const start=new Date(PROGRAM_START);
    const today=new Date();
    const scheduledPast=[];
    for(let d=new Date(start);d<=today;d.setDate(d.getDate()+1)){
      const dayName=DOW[d.getDay()];
      if(activePlanDays.includes(dayName)){
        scheduledPast.push(d.toISOString().split("T")[0]);
      }
    }
    // Walk backwards from most recent scheduled day and count how many were completed
    let count=0;
    for(let i=scheduledPast.length-1;i>=0;i--){
      if(workedDates.includes(scheduledPast[i])){
        count++;
      } else {
        // If this scheduled day is today and no session yet, don't break -- still possible
        if(scheduledPast[i]===today.toISOString().split("T")[0])continue;
        break; // Missed a scheduled day -- streak broken
      }
    }
    return count;
  })();

  // Calendar streak -- consecutive calendar days with any workout (classic definition)
  const calendarStreak=(()=>{
    if(!settings.streakTracking)return 0;
    const todayStr=new Date().toISOString().split("T")[0];
    const yesterdayStr=(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().split("T")[0];})();
    const dates=[...new Set(
      sessions.filter(s=>s.completedAt&&(s.setsArr||[]).some(x=>x.weight||x.reps||x.minutes))
        .map(s=>s.completedAt.split("T")[0])
    )].sort().reverse();
    if(!dates.length)return 0;
    if(dates[0]!==todayStr&&dates[0]!==yesterdayStr)return 0;
    let count=1;
    for(let i=1;i<dates.length;i++){
      const diff=Math.round((new Date(dates[i-1])-new Date(dates[i]))/86400000);
      if(diff===1){count++;}else break;
    }
    return count;
  })();

  const streak=scheduledStreak; // primary streak is scheduled

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
    {key:"plan",icon:"▦",label:"Plan"},
    {key:"log",icon:"◈",label:"History"},
    {key:"stats",icon:"↗",label:"Stats"},
    {key:"more",icon:"⊙",label:"More"},
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

  if(activeWorkout){
    return <WorkoutSession workout={activeWorkout} settings={settings} prs={prs} sessions={sessions}
      plans={plans} activePlanKey={activePlanKey} savePlans={savePlans}
      onFinish={(sess,newPRs)=>{saveSessions([...sessions,sess]);savePRs({...prs,...newPRs});setActiveWorkout(null);}}
      onCancel={()=>setActiveWorkout(null)} C={C}/>;
  }

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.serif,paddingBottom:72,userSelect:"none",scrollBehavior:"smooth"}}>
    {!isOnline&&<div style={{background:"#f7c948",color:"#1a202c",padding:"8px 18px",fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"center",letterSpacing:"0.04em"}}>
      ⚠ Offline — workouts will sync when connection is restored
    </div>}
    {tab==="today"&&<TodayTab plan={activePlan} plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={k=>{setActivePlanKey(k);}}
      settings={settings} sessions={sessions} streak={streak} scheduledStreak={scheduledStreak} calendarStreak={calendarStreak} deloadDue={deloadDue&&deloadDismissed!==new Date().toISOString().slice(0,7)}
      onDeloadDismiss={()=>{setDeloadDismissed(new Date().toISOString().slice(0,7));}}
      onStart={day=>setActiveWorkout(day)} C={C} getOrderedDays={getOrderedDays} toggleTheme={toggleTheme} themeMode={themeMode}
      authUser={authUser} todayDay={(activePlan?.days||[]).find(d=>d.name===DOW[new Date().getDay()]&&!d.isRest)}/>}
    {tab==="plan"&&<PlanTab plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={k=>{setActivePlanKey(k);}}
      savePlans={savePlans} settings={settings} C={C}/>}
    {tab==="log"&&<HistoryTab sessions={sessions} saveSessions={saveSessions} savePRs={savePRs} prs={prs} C={C} onRerun={sess=>{
      const day=(activePlan?.days||[]).find(d=>d.id===sess.dayId)||{...sess,exercises:Object.keys(sess.sets||{}).map(name=>({id:name,name,sets:"3",reps:"",muscle:"",note:""})),label:sess.dayLabel||"Workout"};
      setActiveWorkout({...day,_rerunSets:sess.sets});
      setTab("today");
    }}/>}
    {tab==="stats"&&<StatsTab sessions={sessions} prs={prs} settings={settings} C={C} bodyStatsInit={bodyStatsGlobal} onBodyStatsChange={async(stats)=>{
      setBodyStatsGlobal(stats);
      const {data:{user:u}}=await supabase.auth.getUser().catch(()=>({data:{user:null}}));
      if(u)await supabase.auth.updateUser({data:{body_stats:JSON.stringify(stats)}}).catch(()=>{});
    }}/>}
    {tab==="more"&&<MoreTab settings={settings} saveSettings={saveSettings} plans={plans} sessions={sessions} prs={prs} C={C} toggleTheme={toggleTheme} themeMode={themeMode}/>}
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"10px 4px 8px",background:"none",border:"none",color:tab===t.key?C.accent:C.muted,cursor:"pointer",fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          {t.icon==="dumbbell"
            ?<svg width="28" height="14" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <defs>
                <linearGradient id="dbn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde878"/><stop offset="50%" stopColor="#e8b030"/><stop offset="100%" stopColor="#a06008"/></linearGradient>
                <linearGradient id="dbr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f9e07a"/><stop offset="50%" stopColor="#c8860a"/><stop offset="100%" stopColor="#e8a820"/></linearGradient>
              </defs>
              <rect x="28" y="27" width="64" height="6" rx="3" fill="url(#dbr)"/>
              <rect x="20" y="24" width="10" height="12" rx="2" fill="#d4a020"/>
              <rect x="90" y="24" width="10" height="12" rx="2" fill="#d4a020"/>
              <ellipse cx="10" cy="30" rx="5" ry="18" fill="#906000"/>
              <ellipse cx="10" cy="30" rx="4.2" ry="16" fill="url(#dbn)"/>
              <ellipse cx="14" cy="30" rx="3.5" ry="13" fill="#c88010"/>
              <ellipse cx="110" cy="30" rx="5" ry="18" fill="#906000"/>
              <ellipse cx="110" cy="30" rx="4.2" ry="16" fill="url(#dbn)"/>
              <ellipse cx="106" cy="30" rx="3.5" ry="13" fill="#c88010"/>
            </svg>
            :<span style={{fontSize:18,lineHeight:1}}>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </nav>
  </div>;
}

// -- TODAY ---------------------------------------------------------------------
function TodayTab({plan,plans,activePlanKey,setActivePlanKey,settings,sessions,streak,scheduledStreak,calendarStreak,deloadDue,onDeloadDismiss,onStart,C,getOrderedDays,toggleTheme,themeMode,authUser,todayDay}){
  const todayName=DOW[new Date().getDay()];
  // Smart week ordering: today first, then future days this week, then past days
  const rawDays=plan?.days||[];
  const todayIdx=rawDays.findIndex(d=>d.name===todayName);
  const orderedDays=(()=>{
    if(todayIdx<0)return getOrderedDays(rawDays);
    // Split: today + future days first, then past days of this week
    const todayAndFuture=rawDays.slice(todayIdx);
    const pastDays=rawDays.slice(0,todayIdx);
    return [...todayAndFuture,...pastDays];
  })();
  const todaySessions=sessions.filter(s=>s.completedAt?.startsWith(new Date().toISOString().split("T")[0]));

  const userName = authUser?.user_metadata?.display_name || authUser?.email?.split("@")[0] || "there";

  return <div>
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 18px 14px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:C.gradTop,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative"}}>
        <div>
          <div style={{fontSize:13,color:C.muted,marginBottom:10}}>Hello, <span style={{color:C.text,fontWeight:600}}>{userName}</span> 👋</div>
          <div style={{fontSize:22,letterSpacing:"-0.03em",fontWeight:800}}>{new Date().toLocaleDateString("en",{weekday:"long"})}</div>
          <Mono style={{fontSize:11,color:C.muted}}>{new Date().toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}</Mono>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
          <button onClick={toggleTheme} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:14}}>
            {themeMode==="dark"?"☀️":"🌙"}
          </button>
          <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <Mono style={{fontSize:10,color:C.accent,letterSpacing:"0.1em"}}>WEEK {programWeek(sessions)}</Mono>
            {settings.streakTracking&&(
              scheduledStreak>0
                ?<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:18}}>🔥</span>
                      <Mono style={{fontSize:18,color:C.neon,fontWeight:800}}>{scheduledStreak}</Mono>
                    </div>
                    <Mono style={{fontSize:9,color:C.muted}}>scheduled{calendarStreak>1?` . ${calendarStreak}d cal`:""}</Mono>
                  </div>
                :<Mono style={{fontSize:10,color:C.muted}}>
                    {sessions.filter(s=>s.completedAt&&(s.setsArr||[]).some(x=>x.weight||x.reps||x.minutes)).length>0?"Rest day -- streak holds":"Train to start streak"}
                  </Mono>
            )}
            {todaySessions.length>0&&<Pill color={C.neon} C={C}>Done today</Pill>}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap",position:"relative"}}>
        {Object.keys(plans).map(k=>(
          <button key={k} onClick={()=>setActivePlanKey(k)} style={{padding:"6px 12px",borderRadius:6,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",border:activePlanKey===k?"none":`1px solid ${C.border}`,background:activePlanKey===k?C.accent:"transparent",color:activePlanKey===k?"#fff":C.muted,letterSpacing:"0.04em"}}>
            {plans[k]?.name}
          </button>
        ))}
      </div>
      {/* Smart Start Today button */}
      {todayDay&&<div style={{padding:"12px 18px 0",position:"relative"}}>
        <button onClick={()=>onStart(todayDay)} style={{width:"100%",padding:"14px",background:`linear-gradient(135deg,${C.accent},${C.neon})`,border:"none",borderRadius:12,color:"#fff",fontSize:15,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:800,letterSpacing:"0.08em",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:`0 4px 16px ${C.accent}44`}}>
          <svg width="36" height="18" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <defs>
                <linearGradient id="dbs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff8d0"/><stop offset="50%" stopColor="#ffe090"/><stop offset="100%" stopColor="#ffc840"/></linearGradient>
                <linearGradient id="dbsr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffde0"/><stop offset="50%" stopColor="#ffe878"/><stop offset="100%" stopColor="#ffd040"/></linearGradient>
              </defs>
              <rect x="28" y="27" width="64" height="6" rx="3" fill="url(#dbsr)"/>
              <rect x="20" y="24" width="10" height="12" rx="2" fill="#ffe090"/>
              <rect x="90" y="24" width="10" height="12" rx="2" fill="#ffe090"/>
              <ellipse cx="10" cy="30" rx="5" ry="18" fill="rgba(255,200,50,0.6)"/>
              <ellipse cx="10" cy="30" rx="4.2" ry="16" fill="url(#dbs)"/>
              <ellipse cx="14" cy="30" rx="3.5" ry="13" fill="rgba(255,220,100,0.8)"/>
              <ellipse cx="110" cy="30" rx="5" ry="18" fill="rgba(255,200,50,0.6)"/>
              <ellipse cx="110" cy="30" rx="4.2" ry="16" fill="url(#dbs)"/>
              <ellipse cx="106" cy="30" rx="3.5" ry="13" fill="rgba(255,220,100,0.8)"/>
            </svg> START TODAY — {todayDay.label.toUpperCase()}
        </button>
      </div>}
    </div>
    <div style={{padding:"14px 18px"}}>
      {deloadDue&&<div style={{background:C.gold+"15",border:`1px solid ${C.gold}55`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:C.gold,fontWeight:700,marginBottom:4}}>⚠ Deload Week Recommended</div>
            <Mono style={{fontSize:11,color:C.muted,lineHeight:1.6,display:"block"}}>
              You've logged 10+ sessions over 6+ weeks of consistent training. A deload week lets joints recover and consolidates strength gains.
            </Mono>
            <Mono style={{fontSize:11,color:C.gold,display:"block",marginTop:6,lineHeight:1.6}}>
              This week: drop all weights to 60%, keep same exercises and sets. Resume normal load next week.
            </Mono>
          </div>
          <button onClick={onDeloadDismiss} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:"0 0 0 12px",flexShrink:0,lineHeight:1}}>✕</button>
        </div>
      </div>}
      {/* Weekly volume summary - show every Monday or always */}
      {(()=>{
        const today=new Date();
        const weekStart=new Date(today);weekStart.setDate(today.getDate()-today.getDay());
        const weekStr=weekStart.toISOString().split("T")[0];
        const weekSess=sessions.filter(s=>s.completedAt>=weekStr);
        const weekVol=weekSess.reduce((a,s)=>(a+(s.setsArr||[]).reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);
        if(weekSess.length===0)return null;
        return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12,display:"flex",gap:16,alignItems:"center"}}>
          <div style={{flex:1}}>
            <Mono style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",display:"block",marginBottom:2}}>THIS WEEK</Mono>
            <div style={{fontSize:13,fontWeight:600}}>{weekSess.length} session{weekSess.length!==1?"s":""} · {weekVol>0?`${Math.round(weekVol/1000)}k lbs`:"just started"}</div>
          </div>
          <div style={{fontSize:22}}>{"💪"}</div>
        </div>;
      })()}
      <SectionLabel C={C}>This Week</SectionLabel>
      {orderedDays.map((day,i)=>{
        const isToday=day.name===todayName;
        const doneSess=sessions.some(s=>s.dayId===day.id&&s.completedAt?.startsWith(new Date().toISOString().split("T")[0]));
        const quotes=["The body achieves what the mind believes.","Rest is not quitting — it's the fuel for your comeback.","Champions are built in moments they want to quit.","Progress is progress, no matter how small.","Every rep is a promise kept to yourself.","Strong is earned, not given.","Your only competition is who you were yesterday."];
        const quote=quotes[(new Date().getDate()+i)%quotes.length];
        return <div key={day.id} style={{background:isToday?C.neon+"0d":C.card,border:`2px solid ${isToday?C.neon:C.border}`,borderRadius:10,padding:"13px 14px",marginBottom:8,opacity:day.isRest&&!isToday?.65:1,boxShadow:isToday?`0 0 12px ${C.neon}33`:"none",transition:"all .2s"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                <span style={{fontSize:15,fontWeight:600,color:C.cardText||C.text}}>{day.label}</span>
                {isToday&&<Pill color={C.neon}>Today</Pill>}
                {doneSess&&<Pill color={C.neon}>✓</Pill>}
              </div>
              <Mono style={{fontSize:11,color:C.cardText||C.text,opacity:0.7}}>{day.name} . {day.tag}</Mono>
              {!day.isRest&&<Mono style={{fontSize:11,color:C.cardText||C.text,opacity:0.6,display:"block",marginTop:1}}>{day.exercises.length} exercises</Mono>}
              {day.isRest&&isToday&&<div style={{fontSize:12,color:C.neon,fontStyle:"italic",marginTop:6,lineHeight:1.5}}>"{quote}"</div>}
            </div>
            {!day.isRest&&<Btn onClick={()=>onStart(day)} size="sm" C={C} style={{marginLeft:10,background:C.neon,color:"#fff",fontWeight:700,letterSpacing:"0.1em"}}>START</Btn>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// -- WORKOUT SESSION -----------------------------------------------------------
function WorkoutSession({workout,settings,prs,sessions,plans,activePlanKey,savePlans,onFinish,onCancel,C}){
  const [exercises,setExercises]=useState(workout.exercises||[]);
  const [loggedSets,setLoggedSets]=useState({});
  const [completedExIds,setCompletedExIds]=useState(new Set());
  const [showRest,setShowRest]=useState(false);
  const [notes,setNotes]=useState("");
  const [rating,setRating]=useState(0);
  const [startTime]=useState(new Date().toISOString());
  const [aiModal,setAiModal]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [swapModal,setSwapModal]=useState(null);
  const [addExModal,setAddExModal]=useState(false);
  const [editExModal,setEditExModal]=useState(null);
  const topRef=useRef(null);

  useEffect(()=>{const t=setInterval(()=>setElapsed(e=>e+1),1000);return()=>clearInterval(t);},[]);// eslint-disable-line

  const lastSessionForDay=sessions.filter(s=>s.dayId===workout.id&&s.completedAt).sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))[0];
  const lastSets=lastSessionForDay?.sets||{};

  function logSet(exName,setNum,field,value){
    setLoggedSets(prev=>({...prev,[exName]:{...(prev[exName]||{}),[setNum]:{...(prev[exName]?.[setNum]||{}),[field]:value}}}));
  }

  // When all sets for an exercise are ticked, move it to the bottom
  function markExerciseDone(exId, exName){
    setShowRest(true);
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

  function finish(){
    const newPRs={};
    const setsArr=[];
    for(const[exName,sets]of Object.entries(loggedSets)){
      for(const[sn,vals]of Object.entries(sets)){
        if(vals.weight||vals.reps||vals.minutes){
          const w=parseFloat(vals.weight)||0;
          const isPR=!vals.minutes&&settings.prDetection&&w>0&&(!prs[exName]||w>prs[exName].weight);
          if(isPR)newPRs[exName]={weight:w,date:new Date().toISOString()};
          setsArr.push({exName,setNum:parseInt(sn),weight:vals.weight||"",reps:vals.reps||"",minutes:vals.minutes||"",isPR});
        }
      }
    }
    onFinish({id:Date.now().toString(),dayId:workout.id,dayLabel:workout.label,startedAt:startTime,completedAt:new Date().toISOString(),notes,rating,sets:loggedSets,setsArr},newPRs);
  }

  const inputStyle={padding:"9px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"};

  // Auto-start timer on mount - elapsed increments every second
  useEffect(()=>{
    const t=setInterval(()=>setElapsed(e=>e+1),1000);
    return()=>clearInterval(t);
  },[]);// eslint-disable-line

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.serif,paddingBottom:100,scrollBehavior:"smooth"}}>
    <div style={{background:C.surface,borderBottom:`2px solid ${C.neon}`,padding:"14px 18px",position:"sticky",top:0,zIndex:50,marginTop:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{workout.label}</div>
          <Mono style={{fontSize:11,color:C.muted}}>{exercises.length} exercises</Mono>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Mono style={{fontSize:13,color:C.neon,fontWeight:700}}>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</Mono>
          <Btn onClick={()=>setAddExModal(true)} variant="ghost" size="sm" C={C} style={{fontSize:11,color:C.neon,borderColor:C.neon+"44"}}>+ Add</Btn>
          <Btn onClick={onCancel} variant="ghost" size="sm" C={C}>✕</Btn>
        </div>
      </div>
    </div>
    <div style={{padding:"14px 18px"}}>
      {showRest&&settings.restTimer&&<RestTimer seconds={settings.restSeconds||90} onDone={()=>setShowRest(false)} onSkip={()=>setShowRest(false)} C={C}/>}

      <div ref={topRef}/>
      {exercises.map((ex,exIdx)=>{
        const isCardio=ex.muscle==="Cardio"||ex.muscle==="Recovery"||/stair|stepper|treadmill|bike|walk|jog|run|cardio|stretch|yoga/i.test(ex.name);
        const myLog=loggedSets[ex.name]||{};
        const last=settings.lastRef?lastSets[ex.name]:null;
        const hasAnyLog=isCardio?(myLog[1]?.minutes):Object.values(myLog).some(v=>v.weight||v.reps);
        const myPR=(!isCardio&&settings.prDetection)?prs[ex.name]:null;
        const w0=myLog[1]?.weight;
        const isPRNow=myPR&&w0&&parseFloat(w0)>myPR.weight;

        const isDone=completedExIds.has(ex.id);
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
              {!isCardio&&last&&<Mono style={{fontSize:11,color:C.neon,display:"block",marginTop:2}}>Last: {last[1]?.weight||"--"}lbs × {last[1]?.reps||"--"}</Mono>}
              {isCardio&&last&&last[1]?.minutes&&<Mono style={{fontSize:11,color:C.neon,display:"block",marginTop:2}}>Last: {last[1].minutes} min</Mono>}
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

          {/* CARDIO: single minutes input */}
          {isCardio&&<div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input type="number" placeholder={ex.reps.replace(/[^0-9]/g,"")||"0"}
              value={myLog[1]?.minutes||""}
              onChange={e=>setLoggedSets(prev=>({...prev,[ex.name]:{1:{minutes:e.target.value}}}))}
              style={{...inputStyle,flex:1,fontSize:20,fontWeight:700,textAlign:"center"}}/>
            <Mono style={{fontSize:13,color:C.muted,width:32}}>min</Mono>
            <button onClick={()=>{
              setLoggedSets(prev=>({...prev,[ex.name]:{1:{...prev[ex.name]?.[1],done:true}}}));
            }} style={{padding:"9px 14px",background:myLog[1]?.done?C.neon:"transparent",border:`1px solid ${C.neon}44`,borderRadius:7,color:myLog[1]?.done?"#0b0c0e":C.neon,cursor:"pointer",fontSize:14,fontWeight:700,transition:"all .2s"}}>✓</button>
          </div>}

          {/* STRENGTH: sets × weight × reps */}
          {!isCardio&&<div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 34px",gap:"4px 8px",alignItems:"center"}}>
            <Mono style={{fontSize:9,color:C.muted}}>#</Mono>
            <Mono style={{fontSize:9,color:C.muted}}>WEIGHT</Mono>
            <Mono style={{fontSize:9,color:C.muted}}>REPS</Mono>
            <div/>
            {Array.from({length:parseInt(ex.sets)||3},(_,i)=>i+1).map(n=>[
              <Mono key={`n${n}`} style={{fontSize:12,color:C.muted,textAlign:"center"}}>{n}</Mono>,
              <input key={`w${n}`} type="number" placeholder={last?.[n]?.weight||"lbs"} value={myLog[n]?.weight||""} onChange={e=>logSet(ex.name,n,"weight",e.target.value)} style={inputStyle}/>,
              <input key={`r${n}`} type="number" placeholder={last?.[n]?.reps||"reps"} value={myLog[n]?.reps||""} onChange={e=>logSet(ex.name,n,"reps",e.target.value)} style={inputStyle}/>,
              <button key={`d${n}`} onClick={()=>{
                const numS=parseInt(ex.sets)||3;
                const myL=loggedSets[ex.name]||{};
                const allFilled=Array.from({length:numS},(_,i)=>i+1).every(s=>myL[s]?.weight||myL[s]?.reps);
                if(allFilled&&n===numS){markExerciseDone(ex.id,ex.name);}else{setShowRest(true);}
              }} style={{padding:"9px 4px",background:completedExIds.has(ex.id)&&n===parseInt(ex.sets)?C.neon+"44":"transparent",border:`1px solid ${C.neon}44`,borderRadius:7,color:C.neon,cursor:"pointer",fontSize:14,fontWeight:700}}>✓</button>
            ])}
          </div>}
        </div>;
      })}

      {/* Add exercise inline button */}
      <button onClick={()=>setAddExModal(true)} style={{width:"100%",padding:"12px",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:10,color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12,cursor:"pointer",marginBottom:10,letterSpacing:"0.08em"}}>
        + ADD EXERCISE
      </button>

      {settings.workoutNotes&&<div style={{marginTop:4}}>
        <SectionLabel C={C}>Session Notes</SectionLabel>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Energy, joints, anything notable..."
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:13,fontFamily:C.serif,height:72,resize:"none",boxSizing:"border-box"}}/>
      </div>}
      {/* Session rating */}
      <div style={{marginTop:14,marginBottom:8}}>
        <SectionLabel C={C}>How was this session?</SectionLabel>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          {[1,2,3,4,5].map(n=>(
            <button key={n} onClick={()=>setRating(n)}
              style={{width:44,height:44,borderRadius:22,border:`2px solid ${rating>=n?C.accent:C.border}`,background:rating>=n?C.accent+"22":"transparent",fontSize:18,cursor:"pointer",transition:"all .15s"}}>
              {["😴","😐","🙂","💪","🔥"][n-1]}
            </button>
          ))}
        </div>
      </div>
      <Btn onClick={finish} size="lg" C={C} style={{width:"100%",marginTop:8,background:C.neon,color:"#fff",fontWeight:800,letterSpacing:"0.1em",fontSize:15}}>COMPLETE WORKOUT ✓</Btn>
    </div>

    {/* Swap exercise modal */}
    {swapModal&&<SwapExerciseModal exercise={swapModal} onSwap={(newData)=>swapExercise(swapModal,newData)} onClose={()=>setSwapModal(null)} C={C}/>}

    {/* Add exercise modal */}
    {addExModal&&<Modal onClose={()=>setAddExModal(false)} C={C}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Add Exercise</div>
      <ExerciseForm title="" initial={{name:"",sets:"3",reps:"10-12",note:"",muscle:""}}
        onSave={addExercise} onClose={()=>setAddExModal(false)} isNew C={C}/>
    </Modal>}

    {/* Edit exercise modal */}
    {editExModal&&<Modal onClose={()=>setEditExModal(null)} C={C}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Edit Exercise</div>
      <ExerciseForm title="" initial={editExModal}
        onSave={(data)=>updateExercise(editExModal.id,data)} onClose={()=>setEditExModal(null)} C={C}/>
    </Modal>}

    {aiModal&&<AIModal exercise={aiModal} onClose={()=>setAiModal(null)} C={C}/>}
  </div>;
}

// -- SWAP EXERCISE MODAL -------------------------------------------------------
function SwapExerciseModal({exercise,onSwap,onClose,C}){
  const [query,setQuery]=useState("");
  const [aiSuggestions,setAiSuggestions]=useState([]);
  const [loadingAI,setLoadingAI]=useState(false);
  const [custom,setCustom]=useState({name:"",sets:exercise.sets,reps:exercise.reps,note:"",muscle:exercise.muscle||""});
  const [tab,setTab]=useState("ai"); // ai | custom

  useEffect(()=>{ loadAISuggestions(); },[]);// eslint-disable-line react-hooks/exhaustive-deps

  async function loadAISuggestions(){
    setLoadingAI(true);
    const prompt=`You are a personal trainer. Suggest 6 alternative exercises to swap for "${exercise.name}" (muscle: ${exercise.muscle||"unknown"}).
Requirements: joint-friendly for a 49-year-old, similar muscle group, gym equipment available.
Return ONLY a JSON array of objects: [{"name":"Exercise Name","sets":"3","reps":"10-12","note":"brief reason","muscle":"${exercise.muscle||""}"}]
No markdown, no explanation, just the array.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content?.find(b=>b.type==="text")?.text||"[]";
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      setAiSuggestions(parsed);
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

  return <Modal onClose={onClose} C={C}>
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
        style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box",marginBottom:10}}/>
      {loadingAI?<div style={{textAlign:"center",padding:"24px",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Finding alternatives...</div>
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
            style={{width:"100%",padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
        </div>
      ))}
      <Btn style={{width:"100%",marginTop:6}} C={C} onClick={()=>onSwap(custom)} disabled={!custom.name.trim()}>Swap In</Btn>
    </div>}
  </Modal>;
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
  const [reorderMode,setReorderMode]=useState(null); // dayId in manual reorder mode

  const plan=plans[activePlanKey];
  const days=plan?.days||[];

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

  async function aiSequenceDay(day){
    setSequencingDay(day.id);
    const prompt=`You are an expert personal trainer. Reorder these exercises for optimal workout sequencing -- compound lifts first, isolation second, abs and cardio last. Consider muscle fatigue, joint stress, and training science.
Exercises: ${day.exercises.map((e,i)=>`${i+1}. ${e.name} (${e.muscle||"unknown"})`).join(", ")}
Return ONLY a JSON array of exercise names in the optimal order. Example: ["Bench Press","Incline Press","Cable Fly","Machine Crunch"]
No explanation, no markdown, just the JSON array.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
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

  function loadPreset(template){
    const newKey=`preset_${Date.now()}`;
    const newPlan={
      key:newKey, name:template.name, subtitle:template.tag, description:template.desc,
      days:template.days.map((d,i)=>({...d,id:mkId(),exercises:(d.exercises||[]).map(e=>({...e,id:mkId()}))}))
    };
    savePlans({...plans,[newKey]:newPlan});
    setActivePlanKey(newKey);
    setView("mine");
    setPresetPreview(null);
  }

  function addAIPlan(generatedPlan){
    const newKey=`ai_${Date.now()}`;
    savePlans({...plans,[newKey]:generatedPlan});
    setActivePlanKey(newKey);
    setView("mine");
    setGoalModal(false);
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

    {/* MY PLANS */}
    {view==="mine"&&<div style={{padding:"14px 18px"}}>
      {days.map((day,i)=>(
        <div key={day.id} style={{marginBottom:8}}>
          <div onClick={()=>setExpandedDay(expandedDay===i?null:i)}
            style={{background:C.card,border:`1px solid ${expandedDay===i?day.color+"55":C.border}`,borderLeft:`3px solid ${day.color}`,borderRadius:expandedDay===i?"10px 10px 0 0":10,padding:"13px 14px",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>{day.name} -- {day.label}</div>
                <Mono style={{fontSize:11,color:C.muted}}>{day.tag} . {day.exercises.length} exercises</Mono>
              </div>
              <Mono style={{color:C.muted,fontSize:12}}>{expandedDay===i?"▲":"▼"}</Mono>
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
                <div style={{width:8,height:8,borderRadius:4,background:d.color,flexShrink:0}}/>
                <Mono style={{fontSize:11,color:C.muted,flex:1}}>{d.label}</Mono>
                <Mono style={{fontSize:10,color:C.muted}}>{d.exercises.length} ex</Mono>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn size="sm" variant="ghost" onClick={()=>setPresetPreview(t)} C={C}>Preview</Btn>
            <Btn size="sm" onClick={()=>loadPreset(t)} C={C}>Add to My Plans</Btn>
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
    {editEx&&<Modal onClose={()=>setEditEx(null)} C={C}><ExerciseForm title="Edit Exercise" initial={editEx.ex} onSave={ex=>{saveExercise(editEx.dayId,ex);setEditEx(null);}} onClose={()=>setEditEx(null)} C={C}/></Modal>}
    {addExDay&&<Modal onClose={()=>setAddExDay(null)} C={C}><ExerciseForm title="Add Exercise" initial={{name:"",sets:"3",reps:"10-12",note:"",muscle:""}} onSave={ex=>{addExercise(addExDay,ex);setAddExDay(null);}} onClose={()=>setAddExDay(null)} isNew C={C}/></Modal>}
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
            <div style={{width:8,height:8,borderRadius:4,background:d.color}}/>
            <div style={{fontSize:13,fontWeight:600}}>{d.label}</div>
            <Mono style={{fontSize:11,color:C.muted}}>{d.tag}</Mono>
          </div>
          {!d.isRest&&d.exercises.map((e,j)=>(
            <Mono key={j} style={{fontSize:11,color:C.muted,display:"block",marginLeft:16,marginBottom:2}}>. {e.name} -- {e.sets}×{e.reps}</Mono>
          ))}
        </div>
      ))}
      <Btn style={{width:"100%",marginTop:16}} onClick={()=>loadPreset(presetPreview)} C={C}>Add to My Plans</Btn>
    </Modal>}
    {goalModal&&<GoalBuilderModal onAdd={addAIPlan} onClose={()=>setGoalModal(false)} C={C}/>}
    {aiModal&&<AIModal exercise={null} day={aiModal.day} onClose={()=>setAiModal(null)} C={C}/>}
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
      "color": "#ff5e1a",
      "isRest": false,
      "exercises": [
        {"name": "Bench Press", "sets": "4", "reps": "8-12", "note": "brief tip", "muscle": "Chest"}
      ]
    }
  ]
}
Use 7 days total (fill rest days with isRest:true and minimal exercises array with one recovery item). Colors: use only these hex values: #ff5e1a, #3d9bff, #b06aff, #00d4aa, #ffb830. Make the plan practical and appropriate for the stated limitations.`;

    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
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
      setResult({error:"AI plan generation requires API access in the full build. For now, try one of the preset templates."});
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
            <div style={{width:8,height:8,borderRadius:4,background:d.color||C.accent}}/>
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

    {result?.error&&<div style={{textAlign:"center",padding:"20px 0"}}>
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
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
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
  const colors=["#ff5e1a","#3d9bff","#b06aff","#00d4aa","#ffb830"];
  return <div>
    <div style={{fontSize:16,fontWeight:600,marginBottom:18}}>Add Day</div>
    {[["Day Name (e.g. Monday)","name"],["Label (e.g. Push)","label"],["Tag (e.g. Chest . Back)","tag"]].map(([label,key])=>(
      <div key={key} style={{marginBottom:12}}>
        <SectionLabel C={C}>{label}</SectionLabel>
        <input value={d[key]||""} onChange={e=>setD(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
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
function HistoryTab({sessions,saveSessions,savePRs,prs,C,onRerun}){
  const todayStr=new Date().toISOString().split("T")[0];
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr=yesterday.toISOString().split("T")[0];

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
  const [showDebug,setShowDebug]=useState(false);

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

  function saveEdit(updated){
    const setsArr=[];
    for(const[exName,sets]of Object.entries(updated.sets||{})){
      for(const[sn,vals]of Object.entries(sets)){
        if(vals.weight||vals.reps){
          setsArr.push({exName,setNum:parseInt(sn),weight:vals.weight||"",reps:vals.reps||"",isPR:vals.isPR||false});
        }
      }
    }
    const updatedSession={...updated,setsArr};
    const updatedSessions=sessions.map(s=>s.id===updatedSession.id?updatedSession:s);
    saveSessions(updatedSessions);
    recalcPRs(updatedSessions);
    setEditingSession(null);
  }

  function deleteSession(sessId){
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
        <Btn size="sm" variant="ghost" C={C} onClick={()=>setShowDebug(d=>!d)} style={{fontSize:10}}>
          {showDebug?"Hide":"Debug"}
        </Btn>
      </div>
      {showDebug&&<div style={{marginTop:12,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px"}}>
        <SectionLabel C={C}>Storage Diagnostic</SectionLabel>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:6}}>
          Raw sessions in storage: {sessions.length}
        </Mono>
        {sessions.length===0&&<Mono style={{fontSize:11,color:C.danger,display:"block",marginBottom:6}}>
          ⚠ No sessions found. Complete a workout to start logging.
        </Mono>}
        {sessions.slice(0,8).map((s,i)=>(
          <Mono key={i} style={{fontSize:10,color:C.muted,display:"block",marginBottom:2}}>
            {i+1}. {s.dayLabel||"?"} -- {s.completedAt?new Date(s.completedAt).toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"no date"} -- {(s.setsArr||[]).length} sets
          </Mono>
        ))}
        {sessions.length>8&&<Mono style={{fontSize:10,color:C.faint,display:"block"}}>...+{sessions.length-8} more</Mono>}
        <Btn size="sm" variant="ghost" C={C} style={{marginTop:10,fontSize:10,color:C.danger,borderColor:C.danger+"44"}}
          onClick={()=>{
            const raw=JSON.stringify(sessions);
            alert(raw?`Raw storage:
${raw.slice(0,500)}...`:"No sessions found");
          }}>
          Inspect Raw Storage
        </Btn>
      </div>}
    </div>
    <div style={{padding:"14px 18px"}}>
      {sorted.length===0&&<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:13,marginBottom:12}}>No sessions found in your log.</div><div style={{fontSize:12,color:C.faint,fontFamily:"'SF Mono','Courier New',monospace",lineHeight:1.7}}>If you completed a workout and don't see it here,<br/>tap Debug above to inspect your storage.</div></div>}
      {Object.entries(grouped).map(([month,msess])=>(
        <div key={month} style={{marginBottom:24}}>
          <SectionLabel C={C}>{new Date(month+"-02").toLocaleDateString("en",{month:"long",year:"numeric"})} . {msess.length} sessions</SectionLabel>
          {msess.map((s,i)=>{
            const idx=`${month}-${i}`;
            const allSets=s.setsArr||[];
            const vol=allSets.reduce((a,x)=>(a+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0);
            const dur=s.completedAt&&s.startedAt?Math.round((new Date(s.completedAt)-new Date(s.startedAt))/60000):null;
            const newPRs=allSets.filter(x=>x.isPR);
            const isExp=expanded===idx;
            return <div key={s.id} style={{background:C.card,border:`1px solid ${isExp?C.accent+"44":C.border}`,borderLeft:`3px solid ${isExp?C.accent:"transparent"}`,borderRadius:8,padding:"13px 14px",marginBottom:8,transition:"border-color .2s"}}>
              {/* Header row */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setExpanded(isExp?null:idx)}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700}}>{s.dayLabel||"Workout"}</div>
                  <Mono style={{fontSize:11,color:C.muted}}>
                    {(()=>{
                      const d=s.completedAt.split("T")[0];
                      const label=d===todayStr?"Today":d===yesterdayStr?"Yesterday":new Date(s.completedAt).toLocaleDateString("en",{weekday:"long",month:"short",day:"numeric"});
                      return label;
                    })()}
                    {dur?` . ${dur}min`:""}
                    {vol>0?` . ${Math.round(vol).toLocaleString()} lbs`:""}
                  </Mono>
                  {newPRs.length>0&&<Pill color={C.red} style={{marginTop:4}}>★ {newPRs.length} PR{newPRs.length>1?"s":""}</Pill>}
                </div>
                <Mono style={{color:C.muted,fontSize:12,marginLeft:8}}>{isExp?"▲":"▼"}</Mono>
              </div>

              {/* Expanded view */}
              {isExp&&<div style={{marginTop:12}}>
                {s.notes&&<div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:10,padding:"8px 10px",background:C.surface,borderRadius:6,lineHeight:1.5}}>"{s.notes}"</div>}

                {/* Set summary */}
                {[...new Set(allSets.map(x=>x.exName))].map(name=>{
                  const exSets=allSets.filter(x=>x.exName===name);
                  return <div key={name} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{name}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {exSets.map((x,j)=>(
                        <Mono key={j} style={{fontSize:11,background:C.surface,padding:"3px 8px",borderRadius:5,color:x.isPR?C.red:x.minutes?C.green:C.muted}}>
                          {x.minutes?`${x.minutes} min`:""}{!x.minutes&&x.weight?`${x.weight}lbs`:""}{!x.minutes&&x.weight&&x.reps?" × ":""}{!x.minutes&&x.reps?`${x.reps}r`:""}{x.isPR?" ★":""}
                        </Mono>
                      ))}
                    </div>
                  </div>;
                })}

                {/* Action buttons */}
                <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  <Btn size="sm" variant="subtle" C={C} onClick={()=>setEditingSession({...s})}>✎ Edit</Btn>
                  <Btn size="sm" variant="ghost" C={C} style={{color:C.neon,borderColor:C.neon+"44"}} onClick={()=>onRerun&&onRerun(s)}>↺ Re-run</Btn>
                  <Btn size="sm" variant="ghost" C={C} style={{color:C.blue,borderColor:C.blue+"44"}} onClick={()=>{
                    const vol=allSets.reduce((a,x)=>(a+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0);
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
  const [editData,setEditData]=useState(()=>{
    // Build editable sets: { exName -> { setNum -> { weight, reps } } }
    const sets={};
    (session.setsArr||[]).forEach(x=>{
      if(!sets[x.exName])sets[x.exName]={};
      sets[x.exName][x.setNum]={weight:x.weight||"",reps:x.reps||"",isPR:x.isPR||false};
    });
    return {...session,sets};
  });
  const [newExName,setNewExName]=useState("");
  const [addingEx,setAddingEx]=useState(false);

  const exNames=Object.keys(editData.sets||{});

  function updateSet(exName,setNum,field,val){
    setEditData(prev=>({...prev,sets:{...prev.sets,[exName]:{...prev.sets[exName],[setNum]:{...(prev.sets[exName]?.[setNum]||{}),[field]:val}}}}));
  }

  function addSet(exName){
    const existing=Object.keys(editData.sets[exName]||{}).map(Number);
    const nextNum=(existing.length?Math.max(...existing):0)+1;
    setEditData(prev=>({...prev,sets:{...prev.sets,[exName]:{...prev.sets[exName],[nextNum]:{weight:"",reps:"",isPR:false}}}}));
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

  const inputStyle={padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"};

  // Parse completedAt into a local date string for the input (YYYY-MM-DD)
  const dateVal=editData.completedAt?editData.completedAt.split("T")[0]:"";

  function updateDate(val){
    if(!val)return;
    // Keep the time portion, just swap the date
    const time=editData.completedAt?.split("T")[1]||"10:00:00.000Z";
    setEditData(prev=>({...prev,
      completedAt:`${val}T${time}`,
      startedAt:`${val}T${time}`
    }));
  }

  return <Modal onClose={onClose} C={C}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>✎ Edit Workout</div>
        <Mono style={{fontSize:11,color:C.muted}}>{editData.dayLabel||"Workout"}</Mono>
      </div>
      <Btn variant="ghost" size="sm" onClick={onClose} C={C}>✕</Btn>
    </div>

    {/* Date editor */}
    <div style={{marginBottom:16,padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginBottom:4,letterSpacing:"0.1em"}}>WORKOUT DATE</Mono>
        <div style={{fontSize:14,fontWeight:700}}>
          {editData.completedAt?new Date(editData.completedAt+"").toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric",year:"numeric"}):"No date set"}
        </div>
      </div>
      <input type="date" value={dateVal} onChange={e=>updateDate(e.target.value)}
        style={{padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",cursor:"pointer"}}/>
    </div>

    {/* Exercises */}
    {exNames.map(exName=>{
      const sets=editData.sets[exName]||{};
      const setNums=Object.keys(sets).map(Number).sort((a,b)=>a-b);
      return <div key={exName} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{exName}</div>
        </div>
        {/* Set rows */}
        <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 32px",gap:"4px 8px",alignItems:"center",marginBottom:6}}>
          <Mono style={{fontSize:9,color:C.muted}}>#</Mono>
          <Mono style={{fontSize:9,color:C.muted}}>WEIGHT (lbs)</Mono>
          <Mono style={{fontSize:9,color:C.muted}}>REPS</Mono>
          <div/>
          {setNums.map(n=>[
            <Mono key={`n${n}`} style={{fontSize:11,color:C.muted,textAlign:"center"}}>{n}</Mono>,
            <input key={`w${n}`} type="number" value={sets[n]?.weight||""} onChange={e=>updateSet(exName,n,"weight",e.target.value)} style={inputStyle} placeholder="lbs"/>,
            <input key={`r${n}`} type="number" value={sets[n]?.reps||""} onChange={e=>updateSet(exName,n,"reps",e.target.value)} style={inputStyle} placeholder="reps"/>,
            <button key={`x${n}`} onClick={()=>removeSet(exName,n)} style={{padding:"4px",background:"transparent",border:"none",color:C.danger,cursor:"pointer",fontSize:14,borderRadius:4}}>✕</button>
          ])}
        </div>
        <Btn size="sm" variant="ghost" C={C} onClick={()=>addSet(exName)} style={{fontSize:11}}>+ Set</Btn>
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

    <div style={{display:"flex",gap:10}}>
      <Btn style={{flex:1}} C={C} onClick={()=>onSave(editData)}>Save Changes</Btn>
      <Btn variant="ghost" style={{flex:1}} C={C} onClick={onClose}>Cancel</Btn>
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
    "Bench Press":[95,135,185,225,275],
    "T-Bar Row":[85,115,155,195,245],
    "Incline Press (DB)":[40,60,80,100,130],
    "Goblet Squat":[35,55,75,95,115],
    "DB Romanian Deadlift":[50,75,105,135,165],
    "Cable Curl":[30,45,60,75,95],
    "Concentration Curl":[20,30,40,55,70],
    "Cable Rope Pressdown":[30,50,70,90,110],
    "Machine Shoulder Press":[50,80,110,140,170],
  };
  const b = benchmarks[exName];
  if(!b) return Math.min(4, Math.floor(maxWeight/50));
  let level = 0;
  for(let i=0;i<b.length;i++){ if(maxWeight>=b[i]) level=i+1; }
  return Math.min(level, 4);
}

function StatsTab({sessions,prs,settings,C,bodyStatsInit=[],onBodyStatsChange}){
  const [selEx,setSelEx]=useState(null);
  const [chartData,setChartData]=useState([]);
  const [statsView,setStatsView]=useState("overview"); // overview | progress | muscles | body | trainer
  const [bodyStats,setBodyStats]=useState(bodyStatsInit||[]);
  const [newBodyStat,setNewBodyStat]=useState({weight:"",chest:"",waist:"",hips:"",arms:"",date:new Date().toISOString().split("T")[0]});
  const [addingBody,setAddingBody]=useState(false);
  const [trainerInsight,setTrainerInsight]=useState("");
  const [loadingInsight,setLoadingInsight]=useState(false);

  const allExNames=[...new Set(sessions.flatMap(s=>(s.setsArr||[]).map(x=>x.exName)))].sort();
  const prList=Object.entries(prs).sort((a,b)=>b[1].weight-a[1].weight);
  const totalVol=sessions.reduce((a,s)=>(a+(s.setsArr||[]).reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);

  // Month over month
  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0,7);
  const thisMonthVol = sessions.filter(s=>s.completedAt?.startsWith(thisMonth)).reduce((a,s)=>(a+(s.setsArr||[]).reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);
  const lastMonthVol = sessions.filter(s=>s.completedAt?.startsWith(lastMonth)).reduce((a,s)=>(a+(s.setsArr||[]).reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);
  const momChange = lastMonthVol>0 ? Math.round(((thisMonthVol-lastMonthVol)/lastMonthVol)*100) : null;

  // Weekly volume summary
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const weekStr = weekStart.toISOString().split("T")[0];
  const weekSessions = sessions.filter(s=>s.completedAt>=weekStr);
  const weekVol = weekSessions.reduce((a,s)=>(a+(s.setsArr||[]).reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);

  // Muscle volume by group (last 7 days)
  const muscleVol = {};
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
  sessions.filter(s=>s.completedAt&&new Date(s.completedAt)>sevenDaysAgo).forEach(s=>{
    (s.setsArr||[]).forEach(x=>{
      // Map exercise to muscle group
      const plan_ex = null;
      const muscle = x.muscle || "Other";
      if(!muscleVol[muscle]) muscleVol[muscle]=0;
      muscleVol[muscle]+=(parseFloat(x.weight)||0)*(parseInt(x.reps)||0);
    });
  });
  // Better muscle mapping from exercise names
  const muscleMap={"Bench Press":"Chest","Incline Press (DB)":"Chest","Cable Fly":"Chest","Pec Deck / Cable Fly":"Chest","T-Bar Row":"Back","Reverse Grip Lat Pulldown":"Back","Seated Cable Row":"Back","Reverse Grip Pulldown":"Back","Machine Shoulder Press":"Shoulders","Cable Lateral Raise":"Shoulders","Rear Delt Machine":"Shoulders","DB / Cable Lateral Raises":"Shoulders","Front Delt Raise":"Shoulders","Cable Rope Pressdown":"Triceps","Incline Tricep Extension":"Triceps","Cable Overhead Extension":"Triceps","Cable Curl":"Biceps","Concentration Curl":"Biceps","Barbell / Cable Curl":"Biceps","Goblet Squat":"Legs","DB Romanian Deadlift":"Legs","Box Step-Ups (DB)":"Legs","DB Lunges (optional)":"Legs","Decline Sit-Ups":"Abs","Machine Crunch":"Abs","Russian Twist":"Abs","Stair Stepper":"Cardio"};
  const muscleVolMapped={};
  sessions.filter(s=>s.completedAt&&new Date(s.completedAt)>sevenDaysAgo).forEach(s=>{
    (s.setsArr||[]).forEach(x=>{
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
    rel.forEach(s=>{const d=s.completedAt.split("T")[0];const best=(s.setsArr||[]).filter(x=>x.exName===selEx).reduce((m,x)=>Math.max(m,parseFloat(x.weight)||0),0);if(!grouped[d]||best>grouped[d])grouped[d]=best;});
    setChartData(Object.entries(grouped).sort(([a],[b])=>a>b?1:-1).map(([d,w])=>({date:d.slice(5),weight:w,orm:Math.round(w*1.0333*1)})));
  },[selEx,sessions]);// eslint-disable-line react-hooks/exhaustive-deps

  async function loadTrainerInsight(){
    setLoadingInsight(true);
    const recentSessions=sessions.slice(0,5).map(s=>({day:s.dayLabel,date:s.completedAt?.split("T")[0],sets:(s.setsArr||[]).length,rating:s.rating}));
    const topPRs=prList.slice(0,5).map(([n,p])=>(`${n}: ${p.weight}lbs`));
    const prompt=`You are a personal trainer AI. Analyze this user's recent workout data and provide ONE specific, actionable insight in 2-3 sentences. Be direct and personalized.

Recent sessions: ${JSON.stringify(recentSessions)}
Top PRs: ${topPRs.join(", ")}
Total sessions: ${sessions.length}
This week volume: ${Math.round(weekVol).toLocaleString()} lbs
Month-over-month change: ${momChange!==null?`${momChange>0?"+":""}${momChange}%`:"N/A"}

Focus on: progress trends, recovery patterns, or a specific recommendation to improve results. No generic advice.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      setTrainerInsight(data.content?.find(b=>b.type==="text")?.text||"");
    }catch{
      setTrainerInsight("Keep logging consistently to unlock personalized AI insights about your training patterns.");
    }
    setLoadingInsight(false);
  }

  const tabStyle=(active)=>({flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:active?C.accent:"transparent",color:active?"#fff":C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:10,cursor:"pointer",letterSpacing:"0.04em"});

  return <div>
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 18px 0"}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em",marginBottom:2}}>Progress</div>
      <Mono style={{fontSize:11,color:C.muted,display:"block",marginBottom:12}}>Week {programWeek(sessions)} of your program</Mono>
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
                style={{width:80,padding:"6px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",textAlign:"right"}}/>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <Btn size="sm" C={C} style={{flex:1}} onClick={()=>{
              if(newBodyStat.weight||newBodyStat.chest||newBodyStat.waist){
                const updated=[{...newBodyStat,id:Date.now()},...bodyStats];
                setBodyStats(updated);
                if(onBodyStatsChange)onBodyStatsChange(updated);
                setNewBodyStat({weight:"",chest:"",waist:"",hips:"",arms:"",date:new Date().toISOString().split("T")[0]});
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
            :<div>
              {trainerInsight&&<div style={{fontSize:13,lineHeight:1.8,color:C.text,marginBottom:14,padding:"12px",background:C.card,borderRadius:8}}>{trainerInsight}</div>}
              <Btn size="sm" variant="ghost" C={C} onClick={loadTrainerInsight} style={{width:"100%"}}>
                {trainerInsight?"↺ Refresh Insight":"✦ Get My Insight"}
              </Btn>
            </div>}
        </div>
        {/* Session ratings history */}
        {sessions.filter(s=>s.rating).length>0&&<div>
          <SectionLabel C={C}>Session Energy Ratings</SectionLabel>
          {sessions.filter(s=>s.rating).slice(0,8).map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{fontSize:13}}>{s.dayLabel||"Workout"}</div>
                <Mono style={{fontSize:10,color:C.muted}}>{s.completedAt?.split("T")[0]}</Mono>
              </div>
              <div style={{fontSize:20}}>{["😴","😐","🙂","💪","🔥"][s.rating-1]}</div>
            </div>
          ))}
        </div>}
      </div>}

    </div>
  </div>;
}

// -- EXPORT PANEL -------------------------------------------------------------


// -- MORE / SETTINGS -----------------------------------------------------------
function MoreTab({settings,saveSettings,plans,sessions,prs,C,toggleTheme,themeMode}){
  const [local,setLocal]=useState({...settings});
  const [saved,setSaved]=useState(false);

  function save(){saveSettings(local);setSaved(true);setTimeout(()=>setSaved(false),2000);}

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
      <div style={{marginBottom:20}}>
        <SectionLabel C={C}>Week Start Day</SectionLabel>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {DOW.map((d,i)=>(
            <button key={i} onClick={()=>{ const updated={...local,startDay:i}; setLocal(updated); saveSettings(updated); }} style={{padding:"7px 11px",borderRadius:7,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,cursor:"pointer",border:local.startDay===i?"none":`1px solid ${C.border}`,background:local.startDay===i?C.accent:"transparent",color:local.startDay===i?"#fff":C.muted}}>
              {d.slice(0,3)}
            </button>
          ))}
        </div>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginTop:6}}>Applies instantly -- check Today tab to see updated order</Mono>
      </div>

      <SectionLabel C={C}>Features</SectionLabel>
      {features.map(f=>(
        <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
          <div style={{flex:1,paddingRight:16}}>
            <div style={{fontSize:14}}>{f.label}</div>
            <Mono style={{fontSize:11,color:C.muted}}>{f.desc}</Mono>
          </div>
          <Toggle on={!!local[f.key]} onToggle={()=>setLocal(p=>({...p,[f.key]:!p[f.key]}))} C={C}/>
        </div>
      ))}

      {local.restTimer&&<div style={{padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
        <SectionLabel C={C}>Rest Duration (seconds)</SectionLabel>
        <input type="number" value={local.restSeconds||90} onChange={e=>setLocal(p=>({...p,restSeconds:parseInt(e.target.value)||90}))}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",boxSizing:"border-box"}}/>
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
function AIModal({exercise,day,onClose,C}){
  const [response,setResponse]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{getRecommendation();},[]);// eslint-disable-line react-hooks/exhaustive-deps

  async function getRecommendation(){
    setLoading(true);
    const isEx=!!exercise&&!day;
    const prompt=isEx
      ?`You are a personal trainer specializing in hypertrophy and joint-safe training.
Program: ${exercise?.programNote||"Strength training program"}, currently week ${programWeek([])}.
Exercise: "${exercise.name}" -- ${exercise.muscle||"unknown"}, ${exercise.sets} sets × ${exercise.reps}.
Provide:
1. THREE alternative exercises for the same muscle group (joint-friendly, brief reason each)
2. ONE form or progression tip for the current exercise
Plain text, no markdown, be concise and direct.`
      :`You are a personal trainer analyzing a workout day for someone focused on hypertrophy.
Program: ${day?.programNote||"Strength training program"}, currently week ${programWeek([])}.
Day: "${day?.label}" (${day?.tag})
Exercises: ${(day?.exercises||[]).map(e=>`${e.name} (${e.sets}×${e.reps})`).join(", ")}.
Provide:
1. Assessment of structure and volume balance (2 sentences)
2. Any muscle gaps or imbalances
3. One concrete optimization suggestion
Plain text, no markdown, be concise.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      setResponse(data.content?.find(b=>b.type==="text")?.text||"No recommendation available.");
    }catch{
      setResponse("AI recommendations will be live in the full deployed build with API access.\n\nThis preview shows the full UI and all features -- the AI responses will work once connected.");
    }
    setLoading(false);
  }

  return <Modal onClose={onClose} C={C}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>✦ AI Recommendation</div>
        <Mono style={{fontSize:11,color:C.muted}}>{exercise?exercise.name:`${day?.label} Day Analysis`}</Mono>
      </div>
      <Btn variant="ghost" size="sm" onClick={onClose} C={C}>✕</Btn>
    </div>
    {loading?<div style={{textAlign:"center",padding:"32px 0",fontFamily:"'SF Mono','Courier New',monospace",color:C.muted,fontSize:13}}>Analyzing...</div>
      :<div style={{fontSize:13,lineHeight:1.8,color:C.text,whiteSpace:"pre-wrap"}}>{response}</div>}
  </Modal>;
}
