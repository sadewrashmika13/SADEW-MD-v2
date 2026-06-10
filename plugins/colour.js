const sharp = require("sharp");
const { cmd } = require('../command');

let downloadContentFromMessage;
try {
  ({ downloadContentFromMessage } = require("@whiskeysockets/baileys"));
} catch {
  ({ downloadContentFromMessage } = require("baileys"));
}

const EMOJI_WORKING = "\uD83C\uDFA8";
const EMOJI_DONE = "\u2705";
const EMOJI_ERROR = "\u274C";

const LEVELS = {
  1: { saturation: 1.18, brightness: 1.02, contrast: 1.04, sharpen: 0.6 },
  2: { saturation: 1.32, brightness: 1.03, contrast: 1.06, sharpen: 0.8 },
  3: { saturation: 1.48, brightness: 1.04, contrast: 1.08, sharpen: 1.0 },
  4: { saturation: 1.65, brightness: 1.05, contrast: 1.1, sharpen: 1.2 },
  5: { saturation: 1.85, brightness: 1.06, contrast: 1.12, sharpen: 1.4 },
};

function getJid(m) {
  return from || m.chat || m.from || m.key?.remoteJid;
}

function getArgsText(args) {
  if (Array.isArray(args)) return args.join(" ").trim();
  if (typeof args === "string") return args.trim();
  return "";
}

function getLevel(args) {
  const match = getArgsText(args).match(/\b([1-5])\b/);
  return match ? Number(match[1]) : null;
}

function unwrapMessage(message) {
  let content = message;

  while (
    content?.ephemeralMessage ||
    content?.viewOnceMessage ||
    content?.viewOnceMessageV2 ||
    content?.viewOnceMessageV2Extension
  ) {
    content =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.viewOnceMessageV2Extension?.message;
  }

  return content;
}

function findImageMessage(content) {
  const unwrapped = unwrapMessage(content?.message || content);
  if (!unwrapped || typeof unwrapped !== "object") return null;

  if (unwrapped.imageMessage) return unwrapped.imageMessage;
  if (unwrapped.quotedMessage) return findImageMessage(unwrapped.quotedMessage);

  for (const value of Object.values(unwrapped)) {
    if (value && typeof value === "object") {
      const found = findImageMessage(value);
      if (found) return found;
    }
  }

  return null;
}

function getQuotedContent(m) {
  return (
    m.quoted ||
    m.reply_message ||
    m.quotedMsg ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    m.message
  );
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function downloadImageBuffer(m, client) {
  const quoted = getQuotedContent(m);

  if (quoted && typeof quoted.download === "function") {
    const buffer = await quoted.download();
    if (Buffer.isBuffer(buffer) && buffer.length) return buffer;
  }

  if (typeof m.download === "function") {
    const buffer = await m.download();
    if (Buffer.isBuffer(buffer) && buffer.length) return buffer;
  }

  if (client && typeof conn.downloadMediaMessage === "function" && quoted) {
    try {
      const buffer = await conn.downloadMediaMessage(quoted);
      if (Buffer.isBuffer(buffer) && buffer.length) return buffer;
    } catch (error) {
      console.error("colour command conn.downloadMediaMessage failed:", error);
    }
  }

  const imageMessage = findImageMessage(quoted);
  if (!imageMessage) {
    throw new Error("Please reply to a photo.");
  }

  const stream = await downloadContentFromMessage(imageMessage, "image");
  const buffer = await streamToBuffer(stream);
  if (!buffer.length) throw new Error("Could not download the replied photo.");

  return buffer;
}

async function enhanceImage(inputBuffer, level) {
  const config = LEVELS[level];
  const contrastOffset = Math.round(128 - 128 * config.contrast);

  return sharp(inputBuffer, { limitInputPixels: false })
    .rotate()
    .modulate({
      saturation: config.saturation,
      brightness: config.brightness,
    })
    .linear(config.contrast, contrastOffset)
    .sharpen({ sigma: config.sharpen })
    .jpeg({
      quality: 98,
      chromaSubsampling: "4:4:4",
      progressive: true,
      mozjpeg: false,
    })
    .toBuffer();
}

async function safeReact(m, emoji) {
  try {
    await m.react?.(emoji);
  } catch (error) {
    console.error("colour command react error:", error);
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

async function sendImage(m, client, buffer, caption) {
  const jid = getJid(m);
  const payload = {
    image: buffer,
    mimetype: "image/jpeg",
    caption,
  };

  if (typeof client?.sendMessage === "function") {
    return conn.sendMessage(jid, payload, { quoted: m });
  }
  if (typeof m.sendMsg === "function") {
    return m.sendMsg(jid, payload, { quoted: m });
  }

  throw new Error("No supported image send method found");
}

async function colourHandler({ m, client, args }) {
  const level = getLevel(args);

  if (!level) {
    return sendText(
      m,
      client,
      `${EMOJI_ERROR} *Usage:* Reply photo ekakata \`.colour 1\`\n\nLevels: 1, 2, 3, 4, 5\nAlso works: \`.color 1\``
    );
  }

  try {
    await safeReact(m, EMOJI_WORKING);

    const inputBuffer = await downloadImageBuffer(m, client);
    const outputBuffer = await enhanceImage(inputBuffer, level);

    await sendImage(
      m,
      client,
      outputBuffer,
      `HD colour enhanced photo\nLevel: ${level}\nPowered by Sadew Rashmika`
    );

    await safeReact(m, EMOJI_DONE);
  } catch (error) {
    console.error("colour command error:", error);
    await safeReact(m, EMOJI_ERROR);

    return sendText(
      m,
      client,
      `${EMOJI_ERROR} Photo eka edit karanna bari una.\nReason: ${
        error.message || "Unknown Error"
      }`
    );
  }
}

cmd(
  {
    name: "colour",
    fromMe: false,
    category: "image",
    desc: "Increase replied photo colour saturation. Use .colour 1 to .colour 5",
  },
  colourHandler
);

cmd(
  {
    name: "color",
    fromMe: false,
    category: "image",
    desc: "Increase replied photo color saturation. Use .color 1 to .color 5",
  },
  colourHandler
);
