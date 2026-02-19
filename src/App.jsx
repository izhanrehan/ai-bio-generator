import { useEffect, useMemo, useState } from "react";
import "./App.css";

const TEMPLATES = [
  { id: "linkedin", label: "LinkedIn", desc: "Professional, recruiter-friendly" },
  { id: "portfolio", label: "Portfolio", desc: "Hero-style, punchy & modern" },
  { id: "resume", label: "Resume", desc: "ATS-friendly, impact focused" },
  { id: "upwork", label: "Upwork", desc: "Client-focused, service-driven" },
  { id: "short", label: "Short", desc: "Quick & minimal" },
];

const HISTORY_KEY = "ai_bio_history_v1";

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function parseBio(text = "") {
  const result = { headline: "", about: "", bullets: [], raw: text };
  const lines = text.split("\n").map((l) => l.trim());
  let mode = "";

  for (const line of lines) {
    if (line.toUpperCase().startsWith("HEADLINE:")) {
      result.headline = line.replace(/HEADLINE:\s*/i, "").trim();
      mode = "headline";
      continue;
    }
    if (line.toUpperCase().startsWith("ABOUT:")) {
      result.about = line.replace(/ABOUT:\s*/i, "").trim();
      mode = "about";
      continue;
    }
    if (line.toUpperCase().startsWith("BULLETS:")) {
      mode = "bullets";
      continue;
    }
    if (mode === "about" && line && !line.startsWith("-")) {
      result.about += (result.about ? " " : "") + line;
      continue;
    }
    if (mode === "bullets" && line.startsWith("-")) {
      result.bullets.push(line.replace(/^-+\s*/, "").trim());
    }
  }

  if (!result.headline && !result.about && result.bullets.length === 0) {
    result.raw = text;
  }

  return result;
}

export default function App() {
  // ✅ empty by default
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [tone, setTone] = useState("Professional");
  const [templateId, setTemplateId] = useState("linkedin");

  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState("");
  const [bioText, setBioText] = useState("");
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState([]);

  // load history
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    const parsed = safeJsonParse(saved, []);
    if (Array.isArray(parsed)) setHistory(parsed);
  }, []);

  // save history
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const skills = useMemo(() => {
    // de-duplicate skills
    const arr = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const uniq = [];
    const seen = new Set();
    for (const s of arr) {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(s);
      }
    }
    return uniq.slice(0, 12);
  }, [skillsInput]);

  const parsed = useMemo(() => parseBio(bioText), [bioText]);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0],
    [templateId]
  );

  const canGenerate = useMemo(() => {
    return name.trim() && role.trim() && skills.length >= 1 && status !== "loading";
  }, [name, role, skills, status]);

  const addToHistory = (outputText) => {
    const id =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const item = {
      id,
      createdAt: Date.now(),
      templateId,
      tone,
      name: name.trim(),
      role: role.trim(),
      skillsInput,
      output: outputText,
    };

    // newest first, max 10
    setHistory((prev) => [item, ...prev].slice(0, 10));
  };

  const onGenerate = async () => {
    setError("");
    setCopied(false);

    // simple validation
    if (!name.trim() || !role.trim() || skills.length < 1) {
      setStatus("error");
      setError("Please enter Name, Role, and at least 1 skill.");
      return;
    }

    setStatus("loading");

    try {
      const payload = {
        name: name.trim(),
        role: role.trim(),
        skills: skills.join(", "),
        tone,
        templateId, // ✅ templates
      };

      const res = await fetch("/api/generateBio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Request failed");

      const out = data?.text || "";
      setBioText(out);
      setStatus("success");
      addToHistory(out);
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Something went wrong");
    }
  };

  const onCopy = async () => {
    try {
      const formatted =
        `HEADLINE: ${parsed.headline || ""}\n\n` +
        `ABOUT: ${parsed.about || ""}\n\n` +
        `BULLETS:\n${(parsed.bullets || []).map((b) => `- ${b}`).join("\n")}\n`;

      const toCopy =
        parsed.headline || parsed.about || (parsed.bullets || []).length
          ? formatted
          : bioText || "";

      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const loadHistoryItem = (item) => {
    setName(item.name || "");
    setRole(item.role || "");
    setSkillsInput(item.skillsInput || "");
    setTone(item.tone || "Professional");
    setTemplateId(item.templateId || "linkedin");

    setBioText(item.output || "");
    setStatus(item.output ? "success" : "idle");
    setError("");
    setCopied(false);
  };

  const deleteHistoryItem = (id) => {
    setHistory((prev) => prev.filter((x) => x.id !== id));
  };

  const clearHistory = () => {
    const ok = window.confirm("Clear all saved bios?");
    if (!ok) return;
    setHistory([]);
  };

  return (
    <div className="page">
      <div className="bgGlow" />

      <div className="container">
        <header className="header">
          <div>
            <h1>AI Bio Generator</h1>
            <p className="sub">Templates + History — real portfolio tool vibe.</p>
          </div>

          <div className="badges">
            <span className="badge">Netlify Functions</span>
            <span className="badge">Gemini</span>
            <span className="badge">Vite + React</span>
          </div>
        </header>

        <div className="grid">
          {/* Left: Form + History */}
          <section className="card">
            <div className="cardTitle">Generate your bio</div>

            <div className="formGrid">
              <div className="field">
                <label>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="field">
                <label>Role</label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Your current role"
                />
              </div>

              <div className="field full">
                <label>Skills (comma separated)</label>
                <input
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="Add skills separated by commas"
                />
                <div className="chips">
                  {skills.map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="field full">
                <label>Tone</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Confident</option>
                  <option>Minimal</option>
                  <option>Bold</option>
                </select>
              </div>

              <div className="field full">
                <label>Template</label>
                <div className="templateRow">
                  {TEMPLATES.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      className={`templateBtn ${templateId === t.id ? "active" : ""}`}
                      onClick={() => setTemplateId(t.id)}
                      title={t.desc}
                    >
                      <span className="templateLabel">{t.label}</span>
                      <span className="templateDesc">{t.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="hint">
                  Selected: <b>{selectedTemplate.label}</b> — {selectedTemplate.desc}
                </div>
              </div>
            </div>

            <div className="actions">
              <button className="btn primary" onClick={onGenerate} disabled={!canGenerate}>
                {status === "loading" ? (
                  <>
                    <span className="spinner" /> Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>

              <button className="btn" onClick={onCopy} disabled={!bioText || status === "loading"}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {status === "error" && (
              <div className="alert error">
                <strong>Oops:</strong> {error}
              </div>
            )}

            {/* ✅ History */}
            <div className="history">
              <div className="historyHeader">
                <div className="historyTitle">History</div>
                <button
                  type="button"
                  className="miniBtn danger"
                  onClick={clearHistory}
                  disabled={history.length === 0}
                >
                  Clear
                </button>
              </div>

              {history.length === 0 ? (
                <div className="historyEmpty">No saved bios yet. Generate to save.</div>
              ) : (
                <div className="historyList">
                  {history.map((item) => {
                    const t = TEMPLATES.find((x) => x.id === item.templateId);
                    return (
                      <div key={item.id} className="historyItem">
                        <div className="historyMeta">
                          <div className="historyMain">
                            <b>{item.name || "Untitled"}</b>
                            <span className="dot">•</span>
                            <span className="muted">{item.role || "Role"}</span>
                          </div>
                          <div className="historySub">
                            <span className="pill">{t?.label || "Template"}</span>
                            <span className="pill">{item.tone || "Tone"}</span>
                            <span className="mutedSmall">{formatDate(item.createdAt)}</span>
                          </div>
                        </div>

                        <div className="historyActions">
                          <button
                            type="button"
                            className="miniBtn"
                            onClick={() => loadHistoryItem(item)}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="miniBtn danger"
                            onClick={() => deleteHistoryItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: Preview */}
          <section className="card">
            <div className="cardTitle">Preview</div>

            {!bioText && status !== "loading" && (
              <div className="empty">
                <div className="emptyTitle">No output yet</div>
                <div className="emptyText">
                  Fill the form, choose a template, then click <b>Generate</b>.
                </div>
              </div>
            )}

            {status === "loading" && (
              <div className="skeletonWrap">
                <div className="skeleton line" />
                <div className="skeleton line" />
                <div className="skeleton line short" />
                <div className="skeleton box" />
              </div>
            )}

            {bioText && (
              <div className="result">
                {parsed.headline || parsed.about || parsed.bullets.length ? (
                  <>
                    <div className="resultBlock">
                      <div className="resultLabel">Headline</div>
                      <div className="headline">{parsed.headline}</div>
                    </div>

                    <div className="resultBlock">
                      <div className="resultLabel">About</div>
                      <p className="about">{parsed.about}</p>
                    </div>

                    <div className="resultBlock">
                      <div className="resultLabel">Highlights</div>
                      <ul className="bullets">
                        {parsed.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>

                    <details className="raw">
                      <summary>Raw Output</summary>
                      <pre>{bioText}</pre>
                    </details>
                  </>
                ) : (
                  <pre className="rawOnly">{bioText}</pre>
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="footer">
          Built by <b>Izhan Rehan</b> — templates + history enabled.
        </footer>
      </div>
    </div>
  );
}
