export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const { name, role, skills, tone, templateId = "linkedin" } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing GEMINI_API_KEY in .env" }),
      };
    }

    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

    // ✅ template prompts
    const templatePrompts = {
      linkedin: `
You are a professional LinkedIn copywriter.
Write a polished LinkedIn-ready bio.
`,
      portfolio: `
You are a modern portfolio copywriter.
Write a punchy hero section bio that feels premium and confident.
`,
      resume: `
You are an ATS-friendly resume writer.
Write a concise, impact-focused professional summary.
Prefer measurable outcomes, strong verbs, and clear value.
`,
      upwork: `
You are an Upwork profile expert.
Write client-focused bio: services, value, trust, and results.
`,
      short: `
You are a minimal copywriter.
Write a very short bio that is still strong and professional.
`,
    };

    const base = templatePrompts[templateId] || templatePrompts.linkedin;

    const prompt = `
${base}

Create:
1) HEADLINE (max 12 words)
2) ABOUT (${templateId === "short" ? "30-50" : "60-90"} words)
3) ${templateId === "portfolio" ? "4" : "3"} bullet points

Tone: ${tone}
Name: ${name}
Role: ${role}
Skills: ${skills}

Return format exactly:
HEADLINE: ...
ABOUT: ...
BULLETS:
- ...
- ...
- ...
`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const raw = await r.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        statusCode: r.status || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Non-JSON response from Gemini API",
          details: raw?.slice(0, 400),
        }),
      };
    }

    if (!r.ok || data?.error) {
      return {
        statusCode: r.status || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: data?.error?.message || "Gemini API error",
        }),
      };
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from model";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (e) {
    console.error("Function crash:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
