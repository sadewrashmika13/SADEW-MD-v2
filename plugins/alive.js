// commands/alive.js
const { cmd } = require('../command');
const os = require("os");
const axios = require("axios");
const config = require("../config");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// Runtime formatter
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
        return {
            name: "Unknown CPU",
            speed: "Unknown"
        };
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

        const res = await axios.get(testUrl, {
            responseType: "arraybuffer",
            timeout: 8000,
            headers: {
                "Cache-Control": "no-cache"
            }
        });

        const end = Date.now();
        const seconds = Math.max((end - start) / 1000, 0.001);
        const bytes = res.data.byteLength;
        const mbps = ((bytes * 8) / seconds / 1024 / 1024).toFixed(2);

        return `${mbps} Mbps`;
    } catch {
        return "Unavailable";
    }
}

cmd({
    name: "alive",
    alias: ["status", "online", "a"],
    category: "main",
    fromMe: false,
    desc: "බොට් එක ජීවතුන් අතරදැයි පරීක්ෂා කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        const botName = config.BOT_INFO?.split(";")[0] || "SADEW-MINI";
        const ownerName = config.BOT_INFO?.split(";")[1] || "Sadew";
        const prefix = m.prefix || ".";

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
│📝 Prefix: [${prefix}]
│📳 Mode: [${config.WORK_TYPE || "public"}]
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

        await conn.sendMessage(from, {
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

        const filter = (msg) => {
            if (!msg?.message) return false;
            if (msg.key.remoteJid !== from) return false;
            if (msg.key.fromMe) return false;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            return ["1", "2"].includes(text.trim());
        };

        const replyMsg = await new Promise((resolve) => {
            const handler = (chatUpdate) => {
                const msg = chatUpdate.messages?.[0];

                if (filter(msg)) {
                    conn.ev.off("messages.upsert", handler);
                    resolve(msg);
                }
            };

            conn.ev.on("messages.upsert", handler);

            setTimeout(() => {
                conn.ev.off("messages.upsert", handler);
                resolve(null);
            }, 30000);
        });

        if (!replyMsg) return;

        const replyText = (
            replyMsg.message.conversation ||
            replyMsg.message.extendedTextMessage?.text ||
            ""
        ).trim();

        if (replyText === "1") {
            await conn.sendMessage(from, {
                text: "🏓 Pong! Bot is alive."
            }, { quoted: m });
        } else if (replyText === "2") {
            const fakeMsg = {
                ...replyMsg,
                message: {
                    conversation: `${prefix}menu`
                }
            };

            conn.ev.emit("messages.upsert", {
                messages: [fakeMsg],
                type: "notify"
            });
        }
    } catch (err) {
        console.error("❌ Alive cmd error:", err);
        await m.reply("❌ Alive command එකේ දෝෂයක්: " + err.message);
    }
});
