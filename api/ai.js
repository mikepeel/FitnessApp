const { createClient } = require("@supabase/supabase-js");

const LIMITS = { exercise_swap:5, sequence_opt:3, plan_builder:1, coach_insight:2 };

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});

  const authHeader=req.headers.authorization;
  if(!authHeader?.startsWith("Bearer "))return res.status(401).json({error:"Unauthorized"});
  const token=authHeader.slice(7);

  const supabaseUrl=process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey=process.env.REACT_APP_SUPABASE_ANON_KEY;
  const supabase=createClient(supabaseUrl,supabaseKey,{
    auth:{autoRefreshToken:false,persistSession:false},
    global:{headers:{Authorization:`Bearer ${token}`}}
  });

  const{data:{user},error:authError}=await supabase.auth.getUser(token);
  if(authError||!user)return res.status(401).json({error:"Unauthorized"});

  const{action,messages,max_tokens=800}=req.body||{};

  const{data:profile}=await supabase.from("profiles").select("is_pro").eq("id",user.id).single();
  const isPro=profile?.is_pro===true;

  if(!isPro&&LIMITS[action]!==undefined){
    const startOfMonth=new Date();
    startOfMonth.setDate(1);startOfMonth.setHours(0,0,0,0);
    const{count}=await supabase.from("ai_usage")
      .select("id",{count:"exact",head:true})
      .eq("user_id",user.id)
      .eq("action",action)
      .gte("created_at",startOfMonth.toISOString());
    if(count>=LIMITS[action]){
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
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens,messages})
    });
  }catch(e){
    return res.status(502).json({error:"AI service unavailable"});
  }

  const data=await anthropicRes.json();

  if(!isPro&&action){
    await supabase.from("ai_usage").insert({user_id:user.id,action}).catch(()=>{});
  }

  return res.status(anthropicRes.status).json(data);
};
