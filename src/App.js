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
const PROGRAM_START = "2026-05-02"; // Program start date
const programWeek = () => {
  const start = new Date(PROGRAM_START);
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  return Math.max(1, Math.ceil((days + 1) / 7));
};

// Saturday May 2 2026 session — enter manually via Log tab


// -- THEME ---------------------------------------------------------------------
const THEMES = {
  dark: {
    bg:"#0b0c0e", surface:"#13151a", card:"#1c1f26", border:"#2e333d",
    accent:"#ff5500", neon:"#aaff00", red:"#e82020", gold:"#f0b429",
    blue:"#3d8eff", green:"#aaff00", danger:"#e82020",
    text:"#f0f2f5", muted:"#9ba3b0", faint:"#555e6b",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#0f1115", gradTop:"linear-gradient(135deg,#ff550020 0%,#aaff0008 100%)",
  },
  light: {
    bg:"#e8eaed", surface:"#f4f5f7", card:"#ffffff", border:"#c0c6d0",
    accent:"#e84800", neon:"#4db800", red:"#c41a1a", gold:"#b87800",
    blue:"#1a5fd4", green:"#4db800", danger:"#c41a1a",
    text:"#0d1017", muted:"#3a424f", faint:"#6b7585",
    mono:"'SF Mono','Courier New',monospace",
    serif:"'Georgia','Times New Roman',serif",
    navBg:"#f4f5f7", gradTop:"linear-gradient(135deg,#e8480012 0%,#4db80008 100%)",
  }
};

// -- DEFAULT PLANS -------------------------------------------------------------
const mkId = () => `id_${Math.random().toString(36).slice(2,9)}`;

const MIKE_PLANS = {
  A: {
    key:"A", name:"Plan A -- Integrated Arms", subtitle:"PPL-style . 4-5 days",
    description:"Arms built into Push/Pull days. High frequency, clean structure.",
    days:[
      { id:"a1", name:"Monday", label:"Push", tag:"Chest . Shoulders . Triceps", color:"#ff5500", isRest:false, exercises:[
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
      { id:"a5", name:"Friday", label:"Push", tag:"Chest . Shoulders . Triceps (Vol)", color:"#ff5500", isRest:false, exercises:[
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
    key:"B", name:"Plan B -- Dedicated Arm Day", subtitle:"Antagonist-inspired . 4-5 days",
    description:"Chest/Back paired, then a standalone Arm day. Full arm focus and great pumps.",
    days:[
      { id:"b1", name:"Monday", label:"Chest + Back", tag:"Antagonist Pair", color:"#ff5500", isRest:false, exercises:[
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
      { id:"b5", name:"Friday", label:"Chest + Back", tag:"Antagonist Pair (Volume)", color:"#ff5500", isRest:false, exercises:[
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
      { label:"Upper Strength", tag:"Chest . Back . Shoulders", color:"#ff5500", isRest:false, exercises:[
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
      { label:"Upper Volume", tag:"Chest . Back . Arms", color:"#ff5500", isRest:false, exercises:[
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
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",marginBottom:12}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <Mono style={{fontSize:10,color:C.muted,letterSpacing:"0.12em"}}>REST</Mono>
        <div style={{fontSize:38,fontFamily:"'SF Mono','Courier New',monospace",color:rem<10?C.red:C.neon,lineHeight:1.1}}>
          {Math.floor(rem/60)}:{String(rem%60).padStart(2,"0")}
        </div>
      </div>
      <Btn onClick={onSkip} variant="ghost" size="sm" C={C}>Skip</Btn>
    </div>
    <div style={{height:3,background:C.border,borderRadius:2,marginTop:10}}>
      <div style={{height:"100%",background:C.accent,borderRadius:2,width:`${(rem/seconds)*100}%`,transition:"width 1s linear"}}/>
    </div>
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
    background:"#1c1f26",border:"1px solid #2e333d",
    borderRadius:10,color:"#f0f2f5",fontSize:16,
    fontFamily:"'SF Mono','Courier New',monospace",
    boxSizing:"border-box",outline:"none",
    WebkitAppearance:"none"
  };

  return <div style={{minHeight:"100vh",background:"#0b0c0e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"Georgia,serif"}}>
    {/* Theme toggle */}
    <button onClick={toggleTheme} style={{position:"fixed",top:16,right:16,background:"transparent",border:"1px solid #2e333d",borderRadius:8,color:"#9ba3b0",cursor:"pointer",padding:"6px 10px",fontSize:14}}>
      {themeMode==="dark"?"☀️":"🌙"}
    </button>

    <div style={{width:"100%",maxWidth:380}}>
      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",color:"#aaff00",letterSpacing:"0.28em",fontWeight:800,marginBottom:8}}>FORGE</div>
        <div style={{fontSize:26,fontWeight:800,letterSpacing:"-0.03em",color:"#f0f2f5",marginBottom:6}}>
          {mode==="login"?"Welcome back":mode==="signup"?"Create account":"Reset password"}
        </div>
        <div style={{fontSize:13,color:"#9ba3b0"}}>
          {mode==="login"?"Sign in to your training log":mode==="signup"?"Start tracking your progress":"We'll send you a reset link"}
        </div>
      </div>

      {/* Form */}
      <div style={{background:"#13151a",border:"1px solid #2e333d",borderRadius:16,padding:"24px"}}>
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

        {error&&<div style={{background:"#e8202015",border:"1px solid #e8202044",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:12,color:"#e82020",fontFamily:"'SF Mono','Courier New',monospace"}}>{error}</div>
        </div>}
        {message&&<div style={{background:"#aaff0015",border:"1px solid #aaff0044",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:12,color:"#aaff00",fontFamily:"'SF Mono','Courier New',monospace"}}>{message}</div>
        </div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{width:"100%",padding:"14px",background:loading?"#2e333d":"#ff5500",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",fontWeight:700,letterSpacing:"0.08em",cursor:loading?"not-allowed":"pointer",transition:"background .2s"}}>
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
  const [tab,setTab]=useState("today");
  const [activeWorkout,setActiveWorkout]=useState(null);
  const [deloadDismissed,setDeloadDismissed]=useState(null);
  const C=useTheme(themeMode);

  const savePlans=async(p)=>{
    setPlans(p);
    const {data:{user:u}}=await supabase.auth.getUser();
    if(!u)return;
    // Upsert each plan
    for(const[key,plan]of Object.entries(p)){
      await supabase.from("plans").upsert({
        id:plan.supabaseId||undefined,
        user_id:u.id, plan_key:key, name:plan.name,
        subtitle:plan.subtitle, description:plan.description
      },{onConflict:"user_id,plan_key"});
    }
  };

  const saveSettings=async(s)=>{
    setSettings(s);
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
  };

  const saveSessions=async(s)=>{
    if(!Array.isArray(s))return;
    setSessions(s);
    const {data:{user:u}}=await supabase.auth.getUser();
    if(!u)return;
    // Save the most recent session (last in array)
    const latest=s[s.length-1];
    if(latest&&!latest.supabaseId){
      const {data}=await supabase.from("workout_sessions").insert({
        user_id:u.id, day_label:latest.dayLabel,
        started_at:latest.startedAt, completed_at:latest.completedAt,
        notes:latest.notes, sets_data:latest.sets||{}
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
  };

  const savePRs=async(p)=>{
    setPrs(p);
    const {data:{user:u}}=await supabase.auth.getUser();
    if(!u)return;
    for(const[name,pr]of Object.entries(p)){
      await supabase.from("personal_records").upsert({
        user_id:u.id, exercise_name:name,
        max_weight:pr.weight, achieved_at:pr.date
      },{onConflict:"user_id,exercise_name"});
    }
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
    {key:"today",icon:"◎",label:"Today"},
    {key:"plan",icon:"▦",label:"Plan"},
    {key:"log",icon:"◈",label:"Log"},
    {key:"stats",icon:"↗",label:"Stats"},
    {key:"more",icon:"⊙",label:"More"},
  ];

  // Show loading spinner while checking auth
  if(!authChecked){
    return <div style={{minHeight:"100vh",background:"#0b0c0e",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:12,fontFamily:"'SF Mono','Courier New',monospace",color:"#aaff00",letterSpacing:"0.22em",fontWeight:800,marginBottom:24}}>FORGE</div>
        <div style={{width:32,height:32,border:"2px solid #2e333d",borderTop:"2px solid #ff5500",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
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
    {tab==="today"&&<TodayTab plan={activePlan} plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={k=>{setActivePlanKey(k);}}
      settings={settings} sessions={sessions} streak={streak} scheduledStreak={scheduledStreak} calendarStreak={calendarStreak} deloadDue={deloadDue&&deloadDismissed!==new Date().toISOString().slice(0,7)}
      onDeloadDismiss={()=>{setDeloadDismissed(new Date().toISOString().slice(0,7));}}
      onStart={day=>setActiveWorkout(day)} C={C} getOrderedDays={getOrderedDays} toggleTheme={toggleTheme} themeMode={themeMode}/>}
    {tab==="plan"&&<PlanTab plans={plans} activePlanKey={activePlanKey}
      setActivePlanKey={k=>{setActivePlanKey(k);}}
      savePlans={savePlans} settings={settings} C={C}/>}
    {tab==="log"&&<HistoryTab sessions={sessions} saveSessions={saveSessions} savePRs={savePRs} prs={prs} C={C}/>}
    {tab==="stats"&&<StatsTab sessions={sessions} prs={prs} settings={settings} C={C}/>}
    {tab==="more"&&<MoreTab settings={settings} saveSettings={saveSettings} plans={plans} sessions={sessions} prs={prs} C={C} toggleTheme={toggleTheme} themeMode={themeMode}/>}
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.navBg,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"10px 4px 8px",background:"none",border:"none",color:tab===t.key?C.accent:C.muted,cursor:"pointer",fontSize:9,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span style={{fontSize:18,lineHeight:1}}>{t.icon}</span>{t.label}
        </button>
      ))}
    </nav>
  </div>;
}

// -- TODAY ---------------------------------------------------------------------
function TodayTab({plan,plans,activePlanKey,setActivePlanKey,settings,sessions,streak,scheduledStreak,calendarStreak,deloadDue,onDeloadDismiss,onStart,C,getOrderedDays,toggleTheme,themeMode}){
  const todayName=DOW[new Date().getDay()];
  const orderedDays=getOrderedDays(plan?.days||[]);
  const todaySessions=sessions.filter(s=>s.completedAt?.startsWith(new Date().toISOString().split("T")[0]));

  return <div>
    <div style={{background:C.surface,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px 14px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:C.gradTop,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative"}}>
        <div>
          <div style={{fontSize:10,fontFamily:"'SF Mono','Courier New',monospace",color:C.neon,letterSpacing:"0.22em",fontWeight:800,marginBottom:1}}>FORGE</div>
          <div style={{fontSize:24,letterSpacing:"-0.03em",fontWeight:800}}>{new Date().toLocaleDateString("en",{weekday:"long"})}</div>
          <Mono style={{fontSize:11,color:C.muted}}>{new Date().toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}</Mono>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
          <button onClick={toggleTheme} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:14}}>
            {themeMode==="dark"?"☀️":"🌙"}
          </button>
          <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <Mono style={{fontSize:10,color:C.accent,letterSpacing:"0.1em"}}>WEEK {programWeek()}</Mono>
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
            {plans[k]?.name?.split("--")[0]?.trim()}
          </button>
        ))}
      </div>
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
      <SectionLabel C={C}>This Week</SectionLabel>
      {orderedDays.map((day,i)=>{
        const isToday=day.name===todayName;
        const doneSess=sessions.some(s=>s.dayId===day.id&&s.completedAt?.startsWith(new Date().toISOString().split("T")[0]));
        return <div key={day.id} style={{background:C.card,border:`1px solid ${isToday?C.neon+"44":C.border}`,borderLeft:`3px solid ${isToday?C.neon:"transparent"}`,borderRadius:10,padding:"13px 14px",marginBottom:8,opacity:day.isRest?.65:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                <span style={{fontSize:15,fontWeight:600}}>{day.label}</span>
                {isToday&&<Pill color={C.neon}>Today</Pill>}
                {doneSess&&<Pill color={C.neon}>✓</Pill>}
              </div>
              <Mono style={{fontSize:11,color:C.muted}}>{day.name} . {day.tag}</Mono>
              {!day.isRest&&<Mono style={{fontSize:11,color:C.muted,display:"block",marginTop:1}}>{day.exercises.length} exercises</Mono>}
            </div>
            {!day.isRest&&<Btn onClick={()=>onStart(day)} size="sm" C={C} style={{marginLeft:10,background:C.neon,color:"#0b0c0e",fontWeight:700,letterSpacing:"0.1em"}}>START</Btn>}
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
  const [startTime]=useState(new Date().toISOString());
  const [aiModal,setAiModal]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [swapModal,setSwapModal]=useState(null);
  const [addExModal,setAddExModal]=useState(false);
  const [editExModal,setEditExModal]=useState(null);
  const topRef=useRef(null);

  useEffect(()=>{const t=setInterval(()=>setElapsed(e=>e+1),1000);return()=>clearInterval(t);},[]);

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
    onFinish({id:Date.now().toString(),dayId:workout.id,dayLabel:workout.label,startedAt:startTime,completedAt:new Date().toISOString(),notes,sets:loggedSets,setsArr},newPRs);
  }

  const inputStyle={padding:"9px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:14,fontFamily:"'SF Mono','Courier New',monospace",width:"100%",boxSizing:"border-box"};

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
      <Btn onClick={finish} size="lg" C={C} style={{width:"100%",marginTop:14,background:C.neon,color:"#0b0c0e",fontWeight:800,letterSpacing:"0.1em",fontSize:15}}>COMPLETE WORKOUT ✓</Btn>
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
    const prompt=`You are an expert personal trainer working with a 49-year-old male on Plan B Antagonist Split (started May 2 2026, week 1). Reorder these exercises for optimal workout sequencing -- compound lifts first, isolation second, abs and cardio last. Consider muscle fatigue, joint stress, and training science.
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
            {plans[k]?.name?.split("--")[0]?.trim()||plans[k]?.name?.slice(0,18)}
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
  const [d,setD]=useState({name:"",label:"",tag:"",color:"#ff5500",isRest:false});
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
function HistoryTab({sessions,saveSessions,savePRs,prs,C}){
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
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Workout Log</div>
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
                  <Btn size="sm" variant="subtle" C={C} onClick={()=>setEditingSession({...s})}>✎ Edit Workout</Btn>
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
function StatsTab({sessions,prs,settings,C}){
  const [selEx,setSelEx]=useState(null);
  const [chartData,setChartData]=useState([]);
  const allExNames=[...new Set(sessions.flatMap(s=>(s.setsArr||[]).map(x=>x.exName)))].sort();
  const prList=Object.entries(prs).sort((a,b)=>b[1].weight-a[1].weight);

  useEffect(()=>{
    if(!selEx){if(allExNames.length)setSelEx(allExNames[0]);return;}
    const rel=sessions.filter(s=>s.completedAt&&(s.setsArr||[]).some(x=>x.exName===selEx));
    const grouped={};
    rel.forEach(s=>{const d=s.completedAt.split("T")[0];const best=(s.setsArr||[]).filter(x=>x.exName===selEx).reduce((m,x)=>Math.max(m,parseFloat(x.weight)||0),0);if(!grouped[d]||best>grouped[d])grouped[d]=best;});
    setChartData(Object.entries(grouped).sort(([a],[b])=>a>b?1:-1).map(([d,w])=>({date:d.slice(5),weight:w})));
  },[selEx,sessions]);// eslint-disable-line react-hooks/exhaustive-deps

  const totalVol=sessions.reduce((a,s)=>(a+(s.setsArr||[]).reduce((b,x)=>(b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0)),0)),0);

  return <div>
    <div style={{background:C.surface,borderBottom:`2px solid ${C.accent}`,padding:"16px 18px"}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Progress</div>
      <Mono style={{fontSize:11,color:C.muted}}>Week {programWeek()} of your program</Mono>
    </div>
    <div style={{padding:"14px 18px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
        {[{label:"Sessions",value:sessions.filter(s=>s.completedAt).length},{label:"Total Volume",value:totalVol>0?`${Math.round(totalVol/1000)}k lbs`:"--"},{label:"PRs Set",value:prList.length},{label:"Exercises",value:allExNames.length}].map(c=>(
          <div key={c.label} style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,borderRadius:6,padding:"14px"}}>
            <SectionLabel C={C}>{c.label}</SectionLabel>
            <div style={{fontSize:24,fontWeight:800,fontFamily:"'SF Mono','Courier New',monospace",color:C.neon}}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Overload Calculator */}
      <div style={{marginBottom:20}}><OverloadCalc C={C}/></div>

      {prList.length>0&&<div style={{marginBottom:20}}>
        <SectionLabel C={C}>Personal Records</SectionLabel>
        {prList.slice(0,6).map(([name,pr])=>(
          <div key={name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:13}}>{name}</div>
            <Mono style={{fontSize:14,color:C.gold,fontWeight:700,fontFamily:"'SF Mono','Courier New',monospace"}}>{pr.weight} lbs ★</Mono>
          </div>
        ))}
      </div>}

      {allExNames.length>0&&<div>
        <SectionLabel C={C}>Exercise Progress</SectionLabel>
        <select value={selEx||""} onChange={e=>setSelEx(e.target.value)}
          style={{width:"100%",padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"'SF Mono','Courier New',monospace",marginBottom:14}}>
          {allExNames.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        {chartData.length>1?<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 8px"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12,paddingLeft:8}}>{selEx} -- Max Weight</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{top:4,right:12,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="date" tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
              <YAxis tick={{fill:C.muted,fontSize:9,fontFamily:"'SF Mono','Courier New',monospace"}}/>
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'SF Mono','Courier New',monospace",fontSize:11,color:C.text}}/>
              <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>:<div style={{textAlign:"center",padding:"24px",color:C.muted,fontFamily:"'SF Mono','Courier New',monospace",fontSize:12}}>Log more sessions to see your trend.</div>}
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
          <button onClick={async()=>{await supabase.auth.signOut();}} style={{background:"transparent",border:`1px solid ${C.danger}44`,borderRadius:8,color:C.danger,cursor:"pointer",padding:"7px 12px",fontSize:11,fontFamily:"'SF Mono','Courier New',monospace",letterSpacing:"0.04em"}}>
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

      <div style={{marginTop:24,padding:"14px 0",borderTop:`1px solid ${C.border}`}}>
        <SectionLabel C={C}>About</SectionLabel>
        <Mono style={{fontSize:12,color:C.muted,lineHeight:1.9,display:"block"}}>
          FORGE Workout Tracker{"\n"}
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
      ?`You are a personal trainer specializing in hypertrophy and joint-safe training for a 49-year-old male with sensitive knees.
Program: Plan B Antagonist Split, started May 2 2026, currently week ${programWeek()}.
Exercise: "${exercise.name}" -- ${exercise.muscle||"unknown"}, ${exercise.sets} sets × ${exercise.reps}.
Provide:
1. THREE alternative exercises for the same muscle group (joint-friendly, brief reason each)
2. ONE form or progression tip for the current exercise
Plain text, no markdown, be concise and direct.`
      :`You are a personal trainer analyzing a workout day for a 49-year-old male focused on hypertrophy. Sensitive knees.
Program: Plan B Antagonist Split, started May 2 2026, currently week ${programWeek()}.
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
