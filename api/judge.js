const crypto = require("crypto");
const { judge } = require("../lib/judge");

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const secret = process.env.JUDGE_KEY;
  if (!secret || !safeEqual(req.headers["x-api-key"], secret)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const result = await judge(body || {});
    return res.status(200).json(result);
  } catch (err) {
    console.error("judge failed:", err?.message || err);
    // Roblox falls back to its built-in judge on any non-200
    return res.status(502).json({ error: "judge failed" });
  }
};
