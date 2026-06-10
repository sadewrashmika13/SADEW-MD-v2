const axios = require("axios");
const { cmd } = require('../command');

const API_URL = "https://whiteshadow-x-api.onrender.com/api/ai/gemini";
const API_TOKEN =
  process.env.WHITESHADOW_API_TOKEN ||
  process.env.GEMINI_API_TOKEN ||
  process.env.GEMINI_TOKEN ||
  "VK4fry";
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);

const EMOJI_THINKING = "\uD83E\uDD16";
const EMOJI_DONE = "\u2705";
const EMOJI_ERROR = "\u274C";

const STYLE_INSTRUCTION =
  "Reply in a natural Sinhala and English mixed style.nutural sinhala kind friendly sinhala latters.don'tUse singlish.use friendly clear Sinhala-English mix like a Sri Lankan WhatsApp chat.";

function getJid(m) {
  return from || m.chat || m.from || m.key?.remoteJid;
}

function getPrompt(args, m) {
  if (Array.isArray(args) && args.length) return args.join(" ").trim();
  if (typeof args === "string" && args.trim()) return args.trim();
  if (m?.quoted?.text) return m.quoted.text.trim();
  if (m?.text) return m.text.replace(/^[./!#]gemini\s*/i, "").trim();
  return "";
}

function extractTextFromObject(value, depth = 0) {
  if (!value || depth > 4) return "";

  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractTextFromObject(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";

  const priorityKeys = [
    "result",
    "response",
    "answer",
    "message",
    "text",
    "content",
    "reply",
    "output",
    "data",
  ];

  for (const key of priorityKeys) {
    const found = extractTextFromObject(value[key], depth + 1);
    if (found) return found;
  }

  for (const item of Object.values(value)) {
    const found = extractTextFromObject(item, depth + 1);
    if (found) return found;
  }

  return "";
}

async function safeReact(m, emoji) {
  try {
    await m.react?.(emoji);
  } catch (error) {
    console.error("gemini command react error:", error);
  }
}

async function sendText(m, client, text) {
  const jid = getJid(m);

  if (typeof m.reply === "function") return m.reply(text);
  if (typeof m.sendMsg === "function") return m.sendMsg(jid, text, { quoted: m });
  if (typeof client?.sendMessage === "function") {
    return conn.sendMessage(jid, { text }, { quoted: m });
  }

  throw new Error("No supported text send method found");
}

async function askGemini(prompt) {
  const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
  const { data } = await axios.get(API_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    params: {
      q,
      apitoken: API_TOKEN,
    },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
    },
  });

  const answer = extractTextFromObject(data);
  if (!answer) throw new Error("Gemini API response eke answer eka empty.");

  return answer;
}

cmd(
  {
    name: "gemini",
    fromMe: false,
    category: "ai",
    desc: "Chat with Gemini AI in Sinhala-English mixed style.",
    description: "Chat with Gemini AI in Sinhala-English mixed style.",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const prompt = getPrompt(args, m);

    if (!prompt) {
      return sendText(
        m,
        client,
        `${EMOJI_ERROR} *Usage:* \`.gemini oyage question eka\`\n\nExample: .gemini Write a poem about nature`
      );
    }

    try {
      await safeReact(m, EMOJI_THINKING);

      const answer = await askGemini(prompt);
      await sendText(m, client, answer);

      await safeReact(m, EMOJI_DONE);
    } catch (error) {
      console.error("gemini command error:", error);
      await safeReact(m, EMOJI_ERROR);

      return sendText(
        m,
        client,
        `${EMOJI_ERROR} Gemini AI reply eka ganna bari una.\nReason: ${
          error?.response?.data?.message || error.message || "Unknown Error"
        }`
      );
    }
  }
);
