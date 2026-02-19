export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { name, role, skills, tone, templateId = "linkedin" } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const prompt = `
You are a professional copywriter.
Template: ${templateId}
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

    const data = await r.json().catch(() => ({}));

    if (!r.ok || data?.error) {
      return res
        .status(r.status || 500)
        .json({ error: data?.error?.message || "Gemini API error" });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from model";

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
