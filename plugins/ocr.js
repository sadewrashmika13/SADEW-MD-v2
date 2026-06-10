const { cmd } = require('../command');
const { recognize } = require("tesseract.js");
const sharp = require("sharp");

function getArgsText(args) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

function isImageMessage(m) {
    const quotedMessage = m.quoted?.message || {};
    const directMessage = m.message || {};

    return Boolean(
        quotedMessage.imageMessage ||
        directMessage.imageMessage ||
        m.quoted?.mtype?.includes?.("imageMessage")
    );
}

async function downloadImage(m) {
    if (m.quoted && typeof m.quoted.download === "function") {
        return await m.quoted.download();
    }

    if (typeof m.download === "function") {
        return await m.download();
    }

    throw new Error("Image එක download කරන්න බැරි වුණා.");
}

function getOcrLang(input) {
    const text = String(input || "").toLowerCase();

    if (text.includes("si") || text.includes("sinhala")) return "sin+eng";
    if (text.includes("ta") || text.includes("tamil")) return "tam+eng";
    if (text.includes("hi") || text.includes("hindi")) return "hin+eng";
    if (text.includes("jp") || text.includes("japanese")) return "jpn+eng";
    if (text.includes("ko") || text.includes("korean")) return "kor+eng";
    if (text.includes("ar") || text.includes("arabic")) return "ara+eng";

    return "eng";
}

async function prepareImage(buffer) {
    return await sharp(buffer, { failOn: "none" })
        .rotate()
        .resize({
            width: 1600,
            withoutEnlargement: false,
            fit: "inside"
        })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();
}

async function runOcr(buffer, lang) {
    const result = await recognize(buffer, lang, {
        logger: () => {}
    });

    return result?.data?.text || "";
}

cmd({
    name: "ocr",
    alias: ["readtext", "imgtext", "scantext"],
    category: "tools",
    fromMe: false,
    desc: "Photo එකක තියෙන අකුරු text එකක් විදිහට extract කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!isImageMessage(m)) {
            return await m.reply(
                "🖼️ Text තියෙන photo එකකට reply කරලා command එක දෙන්න මචං.\n\n" +
                "උදා:\n" +
                ".ocr\n" +
                ".ocr sinhala\n" +
                ".ocr tamil"
            );
        }

        const input = getArgsText(args);
        const lang = getOcrLang(input);

        await m.react("🔎");

        const imageBuffer = await downloadImage(m);

        if (!imageBuffer || imageBuffer.length < 500) {
            return await m.reply("❌ Photo එක download කරන්න බැරි වුණා.");
        }

        if (imageBuffer.length > 15 * 1024 * 1024) {
            return await m.reply("❌ Photo එක ලොකු වැඩියි මචං. 15MB ට අඩු image එකක් try කරන්න.");
        }

        await m.reply("⏳ Photo එකේ text scan කරනවා... ටිකක් ඉන්න.");

        const preparedImage = await prepareImage(imageBuffer);
        const text = (await runOcr(preparedImage, lang)).trim();

        if (!text) {
            await m.react("❌");
            return await m.reply("❌ මේ photo එකෙන් readable text හමු වුණේ නෑ මචං.");
        }

        await m.reply(
            `✅ *OCR Result*\n\n` +
            `🌐 Language: ${lang}\n\n` +
            `\`\`\`\n${text}\n\`\`\``
        );

        await m.react("✅");
    } catch (err) {
        console.log("OCR command error:", err);
        await m.react("❌");

        await m.reply(
            "❌ OCR කරන්න බැරි වුණා මචං.\n\n" +
            "හේතුව: " + err.message
        );
    }
});
