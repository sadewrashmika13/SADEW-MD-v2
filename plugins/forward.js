const { cmd } = require('../command');

function getArgsText(args, m) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();

    return (
        m.text?.replace(/^[./!#](forward|foward)\s*/i, "") ||
        m.body?.replace(/^[./!#](forward|foward)\s*/i, "") ||
        ""
    ).trim();
}

function toJid(input) {
    const text = String(input || "").trim();

    if (text.endsWith("@s.whatsapp.net") || text.endsWith("@g.us")) return text;

    const number = text.replace(/[^0-9]/g, "");
    if (!number) return "";

    return `${number}@s.whatsapp.net`;
}

function normalizeQuotedMessage(m) {
    const q = m.quoted;
    if (!q) return null;

    const message = q.message || q.quotedMessage;
    if (!message) return null;

    return {
        key: {
            remoteJid: q.key?.remoteJid || from,
            id: q.key?.id || q.stanzaId || q.id,
            fromMe: q.key?.fromMe ?? q.fromMe ?? false,
            participant: q.key?.participant || q.sender || q.participant || m.sender
        },
        message
    };
}

function getTextFromQuoted(quoted) {
    const msg = quoted?.message || {};
    const doc = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;

    return (
        doc?.caption ||
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        ""
    );
}

function sanitizeFileName(name) {
    return String(name || "")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150);
}

function inferFileName(quoted) {
    const msg = quoted?.message || {};
    const doc = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;

    if (doc?.fileName) return sanitizeFileName(doc.fileName);
    if (doc?.title) return sanitizeFileName(doc.title);

    const text = getTextFromQuoted(quoted);

    const fileMatch = text.match(/[^\n\r]+?\.(mp4|mkv|avi|mov|pdf|zip|rar|7z|mp3|m4a|jpg|jpeg|png|webp)/i);
    if (fileMatch) return sanitizeFileName(fileMatch[0]);

    const firstLine = text.split("\n").find(Boolean);
    if (firstLine) return sanitizeFileName(firstLine) + ".mp4";

    return "";
}

function applyFileName(content, fileName) {
    if (!fileName) return;

    if (content.documentMessage) {
        content.documentMessage.fileName = fileName;
        content.documentMessage.title = fileName;
    }

    if (content.documentWithCaptionMessage?.message?.documentMessage) {
        content.documentWithCaptionMessage.message.documentMessage.fileName = fileName;
        content.documentWithCaptionMessage.message.documentMessage.title = fileName;
    }
}

function loadBaileys() {
    try {
        return require("baileys");
    } catch {
        throw new Error("baileys package එක හමු වුණේ නෑ.");
    }
}

async function safeForward(client, targetJid, quoted) {
    const {
        generateForwardMessageContent,
        generateWAMessageFromContent,
        getContentType
    } = loadBaileys();

    const content = await generateForwardMessageContent(quoted, false);
    const type = getContentType(content);

    if (!type || !content[type]) {
        throw new Error("Forward content එක generate කරන්න බැරි වුණා.");
    }

    const fileName = inferFileName(quoted);
    applyFileName(content, fileName);

    if (typeof content[type] === "object") {
        content[type].contextInfo = {
            ...(content[type].contextInfo || {}),
            forwardingScore: 999,
            isForwarded: true
        };
    }

    const waMessage = await generateWAMessageFromContent(targetJid, content, {
        userJid: conn.user?.id || conn.user?.jid
    });

    await conn.relayMessage(targetJid, waMessage.message, {
        messageId: waMessage.key.id
    });
}

async function forwardHandler({ client, m, args }) {
    try {
        const targetJid = toJid(getArgsText(args, m));

        if (!targetJid) {
            return await m.reply(
                "📤 Forward කරන්න number/JID එක දෙන්න.\n\n" +
                "උදා:\n" +
                ".forward 94712345678\n" +
                ".foward 94712345678\n" +
                ".forward 120363xxxx@g.us"
            );
        }

        if (!m.quoted) {
            return await m.reply(
                "📌 Forward කරන්න ඕන text/photo/video/document එකට reply කරලා command එක දෙන්න.\n\n" +
                "උදා:\n.forward 94712345678"
            );
        }

        await m.react?.("📤");

        const quoted = normalizeQuotedMessage(m);
        if (!quoted) {
            await m.react?.("❌");
            return await m.reply("❌ Quoted message එක read කරන්න බැරි වුණා.");
        }

        await safeForward(client, targetJid, quoted);

        await m.react?.("✅");
        await m.reply(`✅ Forward කළා.\n\n📍 Target: ${targetJid}`);
    } catch (err) {
        console.log("Forward command error:", err);
        await m.react?.("❌");
        await m.reply("❌ Forward කරන්න බැරි වුණා.\n\nහේතුව: " + err.message);
    }
}

cmd({
    name: "forward",
    category: "tools",
    fromMe: false,
    desc: "Reply message/media/document එක number/JID එකකට forward කරන්න"
}, forwardHandler);

cmd({
    name: "foward",
    category: "tools",
    fromMe: false,
    desc: "Reply message/media/document එක number/JID එකකට forward කරන්න"
}, forwardHandler);
