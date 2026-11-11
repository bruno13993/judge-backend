const Anthropic = require("@anthropic-ai/sdk");
const { renderDrawing, inkAmount } = require("./render");
const { SYSTEM, TOOL, userIntro } = require("./prompt");

const MODEL = process.env.JUDGE_MODEL || "claude-sonnet-5-5";
const MAX_DRAWINGS = 12;

let client;
const getClient = () => (client ??= new Anthropic({ timeout: 50_000, maxRetries: 1 }));

const clamp10 = (v) => Math.min(10, Math.max(0, Number(v) || 0));
const clip = (s, n) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

async function callModel(content, withThinkingOff) {
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [TOOL],
    // Sonnet/Opus 5.5 reject forced tool_choice; "auto" + strict schema + instructions is the supported way.
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content }],
  };
  // Skip up-front thinking for speed (Roblox waits on us). Models that reject it get a retry without.
  if (withThinkingOff) params.thinking = { type: "between_tools" };
  return getClient().messages.create(params);
}

async function ask(content) {
  let res;
  try {
    res = await callModel(content, process.env.JUDGE_THINKING !== "default");
  } catch (err) {
    if (err?.status === 400 && /thinking/i.test(String(err.message))) {
      res = await callModel(content, false);
    } else {
      throw err;
    }
  }
  const use = res.content.find((b) => b.type === "tool_use" && b.name === TOOL.name);
  if (!use) throw new Error("Model did not call record_judgement (stop_reason=" + res.stop_reason + ")");
  return use.input;
}

// body: { topic, modeHint, drawings: [{label, strokes}] }  ->  Roblox contract
async function judge(body) {
  const topic = clip(body.topic, 80) || "anything";
  const modeHint = clip(body.modeHint, 200);
  const drawings = (Array.isArray(body.drawings) ? body.drawings : [])
    .slice(0, MAX_DRAWINGS)
    .filter((d) => d && typeof d.label === "string");
  if (drawings.length === 0) throw new Error("no drawings");

  const labels = drawings.map((d) => d.label);
  const content = [{ type: "text", text: userIntro(topic, modeHint, labels) }];
  const images = await Promise.all(drawings.map((d) => renderDrawing(d.strokes)));
  drawings.forEach((d, i) => {
    content.push({ type: "text", text: `Drawing ${d.label}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: images[i].toString("base64") },
    });
  });

  const known = new Set(labels);
  // The model sometimes writes "Drawing A", "a" or "A." instead of "A": map those back to the real label.
  const canonLabel = (v) => {
    const t = String(v ?? "").trim();
    if (known.has(t)) return t;
    const up = t.toUpperCase().replace(/^DRAWING\s*/, "").replace(/[^A-Z0-9]/g, "");
    return labels.find((l) => l.toUpperCase() === up) || null;
  };
  const normalize = (o) => {
    if (o && Array.isArray(o.scores)) {
      for (const s of o.scores) if (s) s.drawing = canonLabel(s.drawing) ?? s.drawing;
    }
    if (o && typeof o.winner === "string") o.winner = canonLabel(o.winner) ?? o.winner;
    return o;
  };
  const usable = (o) => (o?.scores || []).filter((s) => s && known.has(s.drawing)).length;

  let out;
  try {
    out = normalize(await ask(content));
  } catch (err) {
    // one quick extra attempt for transient/format problems
    console.error("first judge attempt failed:", err?.message || err);
    out = normalize(await ask(content));
  }
  if (usable(out) === 0) {
    console.error(
      "model gave no usable scores. labels sent:",
      labels.join(","),
      "| got:",
      JSON.stringify(out).slice(0, 600)
    );
    const again = [
      ...content,
      {
        type: "text",
        text:
          "IMPORTANT: call record_judgement with a non-empty scores array: exactly one entry for each of these labels, written exactly like this: " +
          labels.join(", ") +
          ".",
      },
    ];
    out = normalize(await ask(again));
  }

  // The model sometimes skips a drawing; ask again for just those, so one miss doesn't throw the whole round away.
  const answered = new Set((out.scores || []).map((s) => s && s.drawing));
  const missing = drawings.map((d, i) => ({ d, i })).filter(({ d }) => !answered.has(d.label));
  if (missing.length > 0 && missing.length < drawings.length) {
    try {
      const extra = [{ type: "text", text: userIntro(topic, modeHint, missing.map(({ d }) => d.label)) }];
      for (const { d, i } of missing) {
        extra.push({ type: "text", text: `Drawing ${d.label}:` });
        extra.push({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: images[i].toString("base64") },
        });
      }
      const more = normalize(await ask(extra));
      out.scores = [...(out.scores || []), ...(more.scores || [])];
    } catch (err) {
      console.error("filling skipped drawings failed:", err?.message || err);
    }
  }

  const extreme = /EXTREME/i.test(modeHint || "");
  const seen = new Set();
  const scores = [];
  for (const s of out.scores || []) {
    if (!s || !known.has(s.drawing) || seen.has(s.drawing)) continue;
    seen.add(s.drawing);
    const blank = inkAmount(drawings.find((d) => d.label === s.drawing).strokes) < 1;
    scores.push({
      drawing: s.drawing,
      match: blank ? 0 : clamp10(s.match),
      recognizable: blank ? 0 : clamp10(s.recognizable),
      creativity: blank ? 0 : clamp10(s.creativity),
      effort: blank ? 0 : clamp10(s.effort),
      composition: blank ? 0 : clamp10(s.composition),
      flag: s.flag === "inappropriate" ? "inappropriate" : undefined,
      roast: clip(s.roast, extreme ? 280 : 160),
      praise: clip(s.praise, extreme ? 200 : 160),
      teaser: clip(s.teaser, 100),
    });
  }
  if (scores.length === 0) throw new Error("model returned no usable scores");

  const flagged = new Set(scores.filter((s) => s.flag).map((s) => s.drawing));
  let winner = out.winner;
  if (!known.has(winner) || flagged.has(winner)) winner = undefined;

  return { scores, winner, winner_reason: clip(out.winner_reason, 400) };
}

module.exports = { judge };
