const { cmd } = require("../command");
const config = require("../config.js");

if (!global.menuMsgIds) global.menuMsgIds = new Set();

// ── Categories ──
const CATEGORIES = [
    { num: 1, name: "DOWNLOAD",  icon: "📥", keywords: ["download","yt","youtube","facebook","fb","instagram","ig","tiktok","tt","video","audio","song","music","movie","film","apk"] },
    { num: 2, name: "AI",        icon: "🧠", keywords: ["ai","chatgpt","gpt","gemini","bard","chatbot","gpt4","openai","groq"] },
    { num: 3, name: "GROUP",     icon: "👥", keywords: ["group","gc","gcast","tag","mention","invite","link","groupinfo","tagall"] },
    { num: 4, name: "ADMIN",     icon: "⚙️", keywords: ["admin","promote","demote","kick","remove","add","mute","unmute","warn","ban"] },
    { num: 5, name: "TOOLS",     icon: "🔧", keywords: ["tool","qr","sticker","photo","image","edit","convert","ocr","translate","ping","alive","uptime"] },
    { num: 6, name: "OWNER",     icon: "👑", keywords: ["owner","bot","restart","shutdown","update","block","unblock","broadcast","sudo"] },
    { num: 7, name: "OTHER",     icon: "📁", keywords: ["fun","game","meme","quote","weather","news","search","misc","fancy","text"] }
];

function getCommandsForCategory(categoryNum, commands) {
    const cat = CATEGORIES.find(c => c.num === categoryNum);
    if (!cat) return [];
    const found = [];
    if (!commands || !Array.isArray(commands)) return found;

    commands.forEach(cmd => {
        if (cmd.dontAddCommandList) return;

        let cmdName = "";
        if (typeof cmd.pattern === "string") {
            cmdName = cmd.pattern;
        } else if (cmd.pattern instanceof RegExp) {
            const match = cmd.pattern.source.split("\\s*")[1]?.match(/([a-z0-9]+)/i);
            cmdName = match ? match[1] : "";
        } else if (cmd.name) {
            cmdName = String(cmd.name);
        }

        if (!cmdName || cmdName === "") return;

        const cmdCat  = (cmd.category || "other").toLowerCase();
        const cmdDesc = (cmd.desc || "").toLowerCase();
        const cmdNameL = cmdName.toLowerCase();

        let match = cmdCat === cat.name.toLowerCase();
        if (!match) {
            match = cat.keywords.some(kw => cmdDesc.includes(kw) || cmdNameL.includes(kw));
        }
        if (match && !found.includes(cmdName)) found.push(cmdName);
    });
    return found.sort();
}

// ── Show category submenu ──
async function showCategoryMenu(conn, mek, m, catNum, prefix, commands) {
    const cat = CATEGORIES.find(c => c.num === catNum);
    if (!cat) {
        await conn.sendMessage(mek.key.remoteJid, {
            text: `❌ *Invalid number!*\n\nSend *${prefix}menu* to see categories (1-7).`
        }, { quoted: mek });
        return false;
    }

    const cmds = getCommandsForCategory(catNum, commands);

    let text = `╔══════════════════════════╗\n`;
    text +=    `║  ${cat.icon} *${cat.name} MENU*\n`;
    text +=    `║  Commands: ${cmds.length}\n`;
    text +=    `╚══════════════════════════╝\n\n`;
    text +=    `┌──────────────────────────┐\n`;

    if (cmds.length > 0) {
        cmds.forEach((c, i) => {
            const n = String(i + 1).padStart(2, " ");
            text += `│ ${n}. ${prefix}${c}\n`;
        });
    } else {
        text += `│   No commands found.\n`;
    }

    text += `└──────────────────────────┘\n\n`;
    text += `💡 *Usage*\n`;
    text += `┣ ➤ ${prefix}menu [1-7] – category\n`;
    text += `┗ ➤ ${prefix}menu – main menu\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `  ⚡ *${cat.name} SECTION* ⚡\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await conn.sendMessage(mek.key.remoteJid, { text }, { quoted: mek });
    return true;
}

// ── Main menu command ──
cmd({
    pattern: "menu",
    alias: ["help", "cmds"],
    category: "misc",
    desc: "📋 Show all commands",
    fromMe: false,
    react: "📋"
}, async (conn, mek, m, { args, prefix, sessionId }) => {
    try {
        const { commands } = require("../command");
        const userInput = (args || []).join(" ").trim();

        // If user sends .menu 1  to  .menu 7
        if (userInput && /^[1-7]$/.test(userInput)) {
            await showCategoryMenu(conn, mek, m, parseInt(userInput), prefix || ".", commands);
            return;
        }

        const now     = new Date();
        const date    = now.toLocaleDateString("en-IN",  { timeZone: "Asia/Colombo" });
        const time    = now.toLocaleTimeString("en-IN",  { timeZone: "Asia/Colombo" });
        const botName = config.BOT_NAME || "SADEW MD";
        const mode    = (config.MODE || "Public").toUpperCase();
        const pfx     = prefix || ".";

        let runtime = "N/A";
        try { if (m && typeof m.uptime === "function") runtime = await m.uptime(); } catch {}

        const totalCmds = Array.isArray(commands) ? commands.filter(c => !c.dontAddCommandList).length : 0;

        let text = ``;
        text += `╔══════════════════════════════╗\n`;
        text += `║   🌙 *${botName}* 🌙\n`;
        text += `║      ✨ MAIN MENU ✨\n`;
        text += `╚══════════════════════════════╝\n\n`;

        text += `┌──────────────────────────────┐\n`;
        text += `│       👤 *USER INFO*\n`;
        text += `├──────────────────────────────┤\n`;
        text += `│ 🏷 Name   : ${m?.pushName || "Guest"}\n`;
        text += `│ 🔖 Mode   : ${mode}\n`;
        text += `│ 📅 Date   : ${date}\n`;
        text += `│ ⏰ Time   : ${time}\n`;
        text += `│ ⚡ Uptime : ${runtime}\n`;
        text += `│ 📦 Cmds   : ${totalCmds}\n`;
        text += `│ 🔰 Prefix : ${pfx}\n`;
        text += `└──────────────────────────────┘\n\n`;

        text += `┌──────────────────────────────┐\n`;
        text += `│        📚 *CATEGORIES*\n`;
        text += `├──────────────────────────────┤\n`;
        CATEGORIES.forEach(cat => {
            text += `│  ${cat.num}. ${cat.icon} *${cat.name}*\n`;
        });
        text += `└──────────────────────────────┘\n\n`;

        text += `┌──────────────────────────────┐\n`;
        text += `│        💡 *HOW TO USE*\n`;
        text += `├──────────────────────────────┤\n`;
        text += `│ Reply this message with a\n`;
        text += `│ number *1 to 7* to see cmds.\n`;
        text += `│\n`;
        CATEGORIES.forEach(cat => {
            text += `│  • *${cat.num}* → ${cat.icon} ${cat.name}\n`;
        });
        text += `│\n`;
        text += `│ Or type: *${pfx}menu 3*\n`;
        text += `└──────────────────────────────┘\n\n`;

        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `   💫 *POWERED BY ${botName}* 💫\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        const menuImage = config.MENU_IMAGE_URL ||
            "https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg";

        const sentMsg = await conn.sendMessage(
            mek.key.remoteJid,
            { image: { url: menuImage }, caption: text },
            { quoted: mek }
        );

        if (sentMsg?.key?.id) {
            global.menuMsgIds.add(sentMsg.key.id);
            setTimeout(() => global.menuMsgIds.delete(sentMsg.key.id), 5 * 60 * 1000);
        }

    } catch (e) {
        console.log("Menu error:", e.message);
        await conn.sendMessage(mek.key.remoteJid, {
            text: `❌ Menu error: ${e.message}`
        }, { quoted: mek });
    }
});

// ── Reply number handler (reply to menu msg with 1-7) ──
cmd({
    pattern: /^\d+$/,
    dontAddCommandList: true,
    fromMe: false,
    desc: "Internal: handle menu number replies"
}, async (conn, mek, m, { body, prefix }) => {
    if (!mek.message) return;

    // Must be a reply to a message
    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!quoted || !quotedId) return;

    // Check if it's a reply to our menu
    if (!global.menuMsgIds || !global.menuMsgIds.has(quotedId)) return;

    const number = parseInt(body.trim());
    if (isNaN(number) || number < 1 || number > 7) return;

    const { commands } = require("../command");
    await showCategoryMenu(conn, mek, m, number, prefix || ".", commands);
});
