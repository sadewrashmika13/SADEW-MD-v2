// plugins/alive.js
const { cmd } = require('../command');
const os = require("os");
const axios = require("axios");
const config = require("../config");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

function runtime(seconds) {
    seconds = Number(seconds);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);
    return parts.join(" ") || "0s";
}

function formatBytes(bytes) {
    bytes = Number(bytes);
    if (!bytes || isNaN(bytes)) return "0B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)}${sizes[i]}`;
}

function getCpuInfo() {
    try {
        const cpu = os.cpus()?.[0];
        return {
            name: cpu?.model || "Unknown CPU",
            speed: cpu?.speed ? `${cpu.speed} MHz` : "Unknown"
        };
    } catch {
        return { name: "Unknown CPU", speed: "Unknown" };
    }
}

async function getStorageInfo() {
    try {
        const { stdout } = await execAsync("df -kP /");
        const lines = stdout.trim().split("\n");
        if (!lines[1]) return "Unavailable";
        const parts = lines[1].split(/\s+/);
        const total = Number(parts[1]) * 1024;
        const used = Number(parts[2]) * 1024;
        const free = Number(parts[3]) * 1024;
        const percent = parts[4] || "0%";
        return `${formatBytes(used)} / ${formatBytes(total)} (${percent}) | Free: ${formatBytes(free)}`;
    } catch {
        return "Unavailable";
    }
}

async function getNetworkSpeed() {
    try {
        const testUrl = "https://speed.cloudflare.com/__down?bytes=524288";
        const start = Date.now();
        const res = await axios.get(testUrl, { responseType: "arraybuffer", timeout: 8000 });
        const end = Date.now();
        const seconds = Math.max((end - start) / 1000, 0.001);
        const bytes = res.data.byteLength;
        const mbps = ((bytes * 8) / seconds / 1024 / 1024).toFixed(2);
        return `${mbps} Mbps`;
    } catch {
        return "Unavailable";
    }
}

// ✅ Per-chat alive reply state - listener leak prevent
const aliveReplyState = new Map();

cmd({
    pattern: "alive",
    alias: ["status", "online", "a"],
    category: "main",
    fromMe: false,
    desc: "Check if bot is alive"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    try {
        const botName = config.BOT_INFO?.split(";")?.[0] || config.BOT_NAME || "SADEW MD";
        const ownerName = config.BOT_INFO?.split(";")?.[1] || "Sadew";
        const pfx = prefix || ".";

        const cpuInfo = getCpuInfo();
        const storageInfo = await getStorageInfo();
        const networkSpeed = await getNetworkSpeed();

        const ramUsed = formatBytes(process.memoryUsage().heapUsed);
        const ramTotal = formatBytes(os.totalmem());

        const status = `
╭───────────────◉
│ *🤖 ${botName} STATUS*
├───────────────◉
│✨ Bot is Active & Online!
│🧠 Owner: ${ownerName}
│⚡ Version: ${config.VERSION || "1.0.0"}
│📝 Prefix: [${pfx}]
│📳 Mode: [${config.MODE || config.WORK_TYPE || "public"}]
│💾 RAM: ${ramUsed} / ${ramTotal}
│🧩 CPU: ${cpuInfo.name}
│🚀 CPU Speed: ${cpuInfo.speed}
│📦 Storage: ${storageInfo}
│🌐 Network: ${networkSpeed}
│🖥️ Host: ${os.hostname()}
│⌛ Uptime: ${runtime(process.uptime())}
╰────────────────◉
> ${botName} WhatsApp Bot

*Reply with:*
1️⃣ Ping
2️⃣ Menu
`;

        const sentMsg = await conn.sendMessage(from, {
            image: {
                url: "https://res.cloudinary.com/dqlh378fb/image/upload/v1779928206/zanta_media_uploads/n6pgdmmiivooq8ylvrao.jpg"
            },
            caption: status,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 1000,
                isForwarded: true
            }
        }, { quoted: m });

        // ✅ FIX: Store the sent message ID so the reply handler can match it
        if (sentMsg?.key?.id) {
            aliveReplyState.set(sentMsg.key.id, { from, prefix: pfx, sentAt: Date.now() });
            // cleanup after 60s
            setTimeout(() => aliveReplyState.delete(sentMsg.key.id), 60000);
        }

    } catch (err) {
        console.error("❌ Alive cmd error:", err);
        await m.reply("❌ Alive command error: " + err.message);
    }
});

// ✅ FIX: alive number reply handler - no nested ev.on() leak
cmd({
    pattern: /^[12]$/,
    dontAddCommandList: true,
    fromMe: false,
    desc: "Internal: alive reply handler"
}, async (conn, mek, m, { from, body, prefix }) => {
    if (!mek.message) return;

    const quotedId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!quotedId) return;
    if (!aliveReplyState.has(quotedId)) return;

    const state = aliveReplyState.get(quotedId);
    const num = body.trim();
    const pfx = state.prefix || prefix || ".";

    if (num === "1") {
        await conn.sendMessage(from, { text: "🏓 Pong! Bot is alive and fast." }, { quoted: mek });
    } else if (num === "2") {
        const fakeMsg = {
            ...mek,
            message: { conversation: `${pfx}menu` }
        };
        conn.ev.emit("messages.upsert", { messages: [fakeMsg], type: "notify" });
    }
});
