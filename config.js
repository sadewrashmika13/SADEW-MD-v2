const fs = require("fs");
const dotenv = require("dotenv");

function toBool(value) {
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
}

if (fs.existsSync("config.env")) {
    dotenv.config({ path: "./config.env" });
} else if (fs.existsSync(".env")) {
    dotenv.config({ path: "./.env" });
}

module.exports = {
    VERSION: require("./package.json").version,

    // ── Bot Identity ──
    SESSION_ID: process.env.SESSION_ID || "shavi&72gHlJyT#QfGvYOmcxra98TNj-h0zlACxb-VIfMo7jaQbJHKO44o",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "94753518443",
    BOT_NAME: process.env.BOT_NAME || "SADEW MD",
    PREFIX: (process.env.PREFIX || process.env.HANDLERS || ".").trim(),
    MODE: process.env.MODE || process.env.WORK_TYPE || "public",

    // ── Features ──
    ALIVE_MSG: process.env.ALIVE_MSG || "I'm alive! ⚡\n\n*Bot:* SADEW MD\n*Owner:* Sadew",
    START_MSG: toBool(process.env.START_MSG || "true"),
    AUTO_STATUS_VIEW: toBool(process.env.AUTO_STATUS_VIEW || "true"),
    STATUS_REACTION: toBool(process.env.STATUS_REACTION || "false"),
    STATUS_REACTION_EMOJI: process.env.STATUS_REACTION_EMOJI || "❤️",
    STATUS_REPLY: toBool(process.env.STATUS_REPLY || "false"),
    STATUS_REPLY_MSG: process.env.STATUS_REPLY_MSG || "Nice Status! ✨ - SADEW MD",
    SAVE_STATUS: toBool(process.env.SAVE_STATUS || "false"),
    READ_MESSAGES: toBool(process.env.READ_MESSAGES || "false"),
    ALWAYS_ONLINE: toBool(process.env.ALWAYS_ONLINE || "false"),

    // ── Restrictions ──
    PM_BLOCK: toBool(process.env.PM_BLOCK || "false"),
    DISABLE_PM: toBool(process.env.DISABLE_PM || "false"),
    CALL_BLOCK: toBool(process.env.CALL_BLOCK || "false"),
    CALL_BLOCK_MSG: process.env.CALL_BLOCK_MSG || "Calls are not allowed!",
    REJECT_CALL: toBool(process.env.REJECT_CALL || "false"),

    // ── API Keys ──
    GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    SINHALASUB_API_KEY: process.env.SINHALASUB_API_KEY || "",

    // ── Heroku Deploy ──
    HEROKU_API_KEY: process.env.HEROKU_API_KEY || "",
    HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || "",

    // ── Sticker / Audio ──
    STICKER_DATA: process.env.STICKER_DATA || "SADEW MD;Sadew",
    AUDIO_DATA: process.env.AUDIO_DATA || "SADEW MD;Sadew",
    BOT_INFO: process.env.BOT_INFO || "SADEW MD;Sadew;https://i.imgur.com/vrzBEoB.jpeg",

    // ── Menu ──
    MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || "https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg",

    // ── Misc ──
    WARN_COUNT: process.env.WARN_COUNT || "3",
    SUDO: process.env.SUDO || "94783360267",
    LOGS: toBool(process.env.LOGS || "false"),
    PORT: process.env.PORT || 8080,
    BGMBOT: toBool(process.env.BGMBOT || "false"),
    LANGUAGE: process.env.LANGUAGE || "english",

    // ── Aliases (backward compat) ──
    get HANDLERS() { return this.PREFIX; },
    get WORK_TYPE() { return this.MODE; },
};

// ── Compatibility aliases ──
Object.defineProperties(module.exports, {
    OWNER_NUM:    { get() { return this.OWNER_NUMBER; } },
    ADMIN_EVENTS: { get() { return process.env.ADMIN_EVENTS || "true"; } },
    WELCOME:      { get() { return process.env.WELCOME || "true"; } },
    AUTH_SYSTEM:  { get() { return process.env.AUTH_SYSTEM || "public"; } },
    PING:         { get() { return process.env.PING || "true"; } },
});
