import{c as d}from"./index-DlgjYzLG.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]],b=d("bot",f);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],S=d("user",w),h=["收入","软件支出","外包支出","其他支出"],u=["餐饮","交通","房租","娱乐","个人其他"];function k(t,n){const o=t==="business"?h:u,s=new Date().toISOString().slice(0,10);return`You are a bookkeeping assistant. Parse the user's natural language input into a structured transaction.

Available categories: ${JSON.stringify(o)}
Today's date: ${s}
Language context: ${n==="zh"?"Chinese":"English"}

Rules:
- Pick the most appropriate category from the list above
- Extract the amount as a positive number
- Write a short description
- Use today's date unless the user specifies otherwise
- For business tab: "收入" category means income, others are expenses
- For personal tab: all are expenses

Respond with ONLY a JSON object, no markdown, no explanation:
{"category": "...", "amount": 0, "description": "...", "date": "YYYY-MM-DD"}`}async function m(t,n,o){var a,e,i,p,l;const s=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${t}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system_instruction:{parts:[{text:n}]},contents:[{parts:[{text:o}]}],generationConfig:{responseMimeType:"application/json"}})});if(!s.ok)throw new Error(`Gemini API error: ${s.status}`);const r=(l=(p=(i=(e=(a=(await s.json()).candidates)==null?void 0:a[0])==null?void 0:e.content)==null?void 0:i.parts)==null?void 0:p[0])==null?void 0:l.text;if(!r)throw new Error("Empty Gemini response");return JSON.parse(r)}async function y(t,n,o){var a,e;const s=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":t,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-6-20250514",max_tokens:256,system:n,messages:[{role:"user",content:o}]})});if(!s.ok)throw new Error(`Claude API error: ${s.status}`);const r=(e=(a=(await s.json()).content)==null?void 0:a[0])==null?void 0:e.text;if(!r)throw new Error("Empty Claude response");return JSON.parse(r.replace(/```json\n?|\n?```/g,"").trim())}async function g(t,n,o){var a,e,i;const s=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({model:"gpt-4.1-mini",response_format:{type:"json_object"},messages:[{role:"system",content:n},{role:"user",content:o}],max_tokens:256})});if(!s.ok)throw new Error(`OpenAI API error: ${s.status}`);const r=(i=(e=(a=(await s.json()).choices)==null?void 0:a[0])==null?void 0:e.message)==null?void 0:i.content;if(!r)throw new Error("Empty OpenAI response");return JSON.parse(r)}async function x(t,n,o,s,c){const r=k(n,o),e=await{gemini:m,claude:y,openai:g}[s](c,r,t),i=n==="business"?h:u;if(i.includes(e.category)||(e.category=i[i.length-1]),!e.amount||e.amount<=0)throw new Error("Invalid amount");return e.date||(e.date=new Date().toISOString().slice(0,10)),e.description||(e.description=t),e}async function T(t,n,o,s){const c=`You are a productivity assistant. The user describes a task or goal.
Break it down into 5-8 small, concrete, actionable steps in execution order.
Each step should be something that takes 5-30 minutes and is easy to start.
The goal is to reduce procrastination by making each step feel small and doable.
Language: ${n==="zh"?"Chinese":"English"}

Respond with ONLY a JSON object, no markdown:
{"title": "concise task name", "steps": ["step 1", "step 2", ...]}`,a=await{gemini:m,claude:y,openai:g}[o](s,c,t);if(a.title||(a.title=t),!Array.isArray(a.steps)||a.steps.length===0)throw new Error("AI returned no steps");return a}async function v(t,n){try{return t==="gemini"?(await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${n}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:"Say OK"}]}],generationConfig:{maxOutputTokens:5}})})).ok:t==="claude"?(await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":n,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-6-20250514",max_tokens:5,messages:[{role:"user",content:"Say OK"}]})})).ok:t==="openai"?(await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({model:"gpt-4.1-mini",messages:[{role:"user",content:"Say OK"}],max_tokens:5})})).ok:!1}catch{return!1}}export{b as B,S as U,x as a,T as p,v as t};
