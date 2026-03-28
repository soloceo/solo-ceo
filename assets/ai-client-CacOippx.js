const h=["收入","软件支出","外包支出","其他支出"],g=["餐饮","交通","房租","娱乐","个人其他"];function y(e,s){const a=e==="business"?h:g,o=new Date().toISOString().slice(0,10);return`You are a bookkeeping assistant. Parse the user's natural language input into a structured transaction.

Available categories: ${JSON.stringify(a)}
Today's date: ${o}
Language context: ${s==="zh"?"Chinese":"English"}

Rules:
- Pick the most appropriate category from the list above
- Extract the amount as a positive number
- Write a short description
- Use today's date unless the user specifies otherwise
- For business tab: "收入" category means income, others are expenses
- For personal tab: all are expenses

Respond with ONLY a JSON object, no markdown, no explanation:
{"category": "...", "amount": 0, "description": "...", "date": "YYYY-MM-DD"}`}async function l(e,s,a){var n,t,r,p,m;const o=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system_instruction:{parts:[{text:s}]},contents:[{parts:[{text:a}]}],generationConfig:{responseMimeType:"application/json"}})});if(!o.ok)throw new Error(`Gemini API error: ${o.status}`);const i=(m=(p=(r=(t=(n=(await o.json()).candidates)==null?void 0:n[0])==null?void 0:t.content)==null?void 0:r.parts)==null?void 0:p[0])==null?void 0:m.text;if(!i)throw new Error("Empty Gemini response");return JSON.parse(i)}async function u(e,s,a){var n,t;const o=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":e,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-6-20250514",max_tokens:256,system:s,messages:[{role:"user",content:a}]})});if(!o.ok)throw new Error(`Claude API error: ${o.status}`);const i=(t=(n=(await o.json()).content)==null?void 0:n[0])==null?void 0:t.text;if(!i)throw new Error("Empty Claude response");return JSON.parse(i.replace(/```json\n?|\n?```/g,"").trim())}async function d(e,s,a){var n,t,r;const o=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e}`},body:JSON.stringify({model:"gpt-4.1-mini",response_format:{type:"json_object"},messages:[{role:"system",content:s},{role:"user",content:a}],max_tokens:256})});if(!o.ok)throw new Error(`OpenAI API error: ${o.status}`);const i=(r=(t=(n=(await o.json()).choices)==null?void 0:n[0])==null?void 0:t.message)==null?void 0:r.content;if(!i)throw new Error("Empty OpenAI response");return JSON.parse(i)}async function f(e,s,a,o,c){const i=y(s,a),t=await{gemini:l,claude:u,openai:d}[o](c,i,e),r=s==="business"?h:g;if(r.includes(t.category)||(t.category=r[r.length-1]),!t.amount||t.amount<=0)throw new Error("Invalid amount");return t.date||(t.date=new Date().toISOString().slice(0,10)),t.description||(t.description=e),t}async function w(e,s,a,o,c){const i={formal:"professional and formal",friendly:"warm and friendly",direct:"concise and direct"},n=`You are a sales copywriter for a solo entrepreneur/freelance designer.
Write a cold outreach email to a potential client.

Lead info:
- Name/Company: ${e.name}
- Industry: ${e.industry||"unknown"}
- Needs: ${e.needs||"not specified"}
- Website/Bio: ${e.website||"none"}

Rules:
- Tone: ${i[s]}
- Language: ${a==="zh"?"Chinese":"English"}
- Keep it under 200 words
- Show you understand their business
- End with a clear call to action
- Do NOT use markdown formatting, write plain text email only
- Include a subject line at the top`,r=await{gemini:l,claude:u,openai:d}[o](c,n,`Write an outreach email for ${e.name}`);return typeof r=="string"?r:JSON.stringify(r)}async function b(e,s,a,o){const c=`You are a sales advisor for a solo entrepreneur who does design/web development.
Analyze this lead and rate its quality.

Lead info:
- Name/Company: ${e.name}
- Industry: ${e.industry||"unknown"}
- Needs: ${e.needs||"not specified"}
- Website/Bio: ${e.website||"none"}

Rate as "high", "medium", or "low" based on:
- How well the needs match design/web services
- Industry potential (budget likelihood)
- How actionable the lead info is

Language: ${s==="zh"?"Chinese":"English"}

Respond with ONLY a JSON object:
{"score": "high|medium|low", "reason": "one sentence explanation"}`,n=await{gemini:l,claude:u,openai:d}[a](o,c,`Analyze lead: ${e.name}`);return["high","medium","low"].includes(n.score)||(n.score="medium"),n.reason||(n.reason=""),n}async function k(e,s,a,o,c){new Date().toISOString().slice(0,10);const i=`You are a task assistant. Parse the user's natural language into a work task.

Known clients: ${s.length?s.join(", "):"none"}
Columns: todo, inProgress, review, done (default: todo)
Priorities: High, Medium, Low (default: Medium)
Language: ${a==="zh"?"Chinese":"English"}

Rules:
- Extract task title (concise, action-oriented)
- Match client name from the known list if mentioned (or leave empty)
- Detect priority if mentioned (高/high → High, 中/medium → Medium, 低/low → Low)
- Default column is "todo"

Respond with ONLY a JSON object:
{"title": "...", "client": "", "priority": "Medium", "column": "todo"}`,t=await{gemini:l,claude:u,openai:d}[o](c,i,e);return t.title||(t.title=e),["High","Medium","Low"].includes(t.priority)||(t.priority="Medium"),["todo","inProgress","review","done"].includes(t.column)||(t.column="todo"),t}async function O(e,s,a,o){const c=`You are a productivity assistant. The user describes a task or goal.
Break it down into 5-8 small, concrete, actionable steps in execution order.
Each step should be something that takes 5-30 minutes and is easy to start.
The goal is to reduce procrastination by making each step feel small and doable.
Language: ${s==="zh"?"Chinese":"English"}

Respond with ONLY a JSON object, no markdown:
{"title": "concise task name", "steps": ["step 1", "step 2", ...]}`,n=await{gemini:l,claude:u,openai:d}[a](o,c,e);if(n.title||(n.title=e),!Array.isArray(n.steps)||n.steps.length===0)throw new Error("AI returned no steps");return n}async function S(e,s){try{return e==="gemini"?(await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${s}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:"Say OK"}]}],generationConfig:{maxOutputTokens:5}})})).ok:e==="claude"?(await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":s,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-6-20250514",max_tokens:5,messages:[{role:"user",content:"Say OK"}]})})).ok:e==="openai"?(await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s}`},body:JSON.stringify({model:"gpt-4.1-mini",messages:[{role:"user",content:"Say OK"}],max_tokens:5})})).ok:!1}catch{return!1}}export{k as a,b,f as c,w as g,O as p,S as t};
