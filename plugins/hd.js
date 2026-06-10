const { cmd } = require('../command');
const sharp = require("sharp");

function getArgsText(args) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

function getScaleFromArgs(text) {
    const lower = String(text || "").toLowerCase();

    if (lower.includes("4x") || lower.includes("uhd") || lower.includes("ultra")) return 4;
    if (lower.includes("3x")) return 3;

    return 2;
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

function isImageMessage(m) {
    const quotedMessage = m.quoted?.message || {};
    const directMessage = m.message || {};

    return Boolean(
        quotedMessage.imageMessage ||
        directMessage.imageMessage ||
        m.quoted?.mtype?.includes?.("imageMessage")
    );
}

async function enhanceImage(inputBuffer, scale) {
    const image = sharp(inputBuffer, {
        failOn: "none"
    });

    const metadata = await image.metadata();

    const width = metadata.width || 512;
    const height = metadata.height || 512;

    const maxSize = scale >= 4 ? 4096 : 2560;
    const newWidth = Math.min(width * scale, maxSize);
    const newHeight = Math.min(height * scale, maxSize);

    return await sharp(inputBuffer)
        .rotate()
        .resize({
            width: newWidth,
            height: newHeight,
            fit: "inside",
            kernel: sharp.kernel.lanczos3,
            withoutEnlargement: false
        })
        .modulate({
            brightness: 1.04,
            saturation: 1.12
        })
        .gamma(1.08)
        .median(1)
        .sharpen({
            sigma: 1.4,
            m1: 1.2,
            m2: 2.2,
            x1: 2,
            y2: 10,
            y3: 20
        })
        .jpeg({
            quality: 95,
            mozjpeg: true
        })
        .toBuffer();
}

async function reminiHandler({ client, m, args }) {
    try {
        if (!isImageMessage(m)) {
            return await m.reply(
                "🖼️ Photo එකකට reply කරලා command එක දෙන්න මචං.\n\n" +
                "උදා:\n" +
                ".remini\n" +
                ".hd\n" +
                ".hd uhd\n" +
                ".remini 4x"
            );
        }

        const input = getArgsText(args);
        const scale = getScaleFromArgs(input);

        await m.react("🪄");

        const imageBuffer = await downloadImage(m);

        if (!imageBuffer || imageBuffer.length < 500) {
            return await m.reply("❌ Photo එක download කරන්න බැරි වුණා.");
        }

        if (imageBuffer.length > 20 * 1024 * 1024) {
            return await m.reply("❌ Photo එක ලොකු වැඩියි මචං. 20MB ට අඩු image එකක් try කරන්න.");
        }

        await m.reply(`⏳ Photo එක ${scale}x HD කරනවා... ටිකක් ඉන්න.`);

        const outputBuffer = await enhanceImage(imageBuffer, scale);

        await conn.sendMessage(from, {
            image: outputBuffer,
            mimetype: "image/jpeg",
            caption: `✅ HD Enhance complete!\nMode: ${scale}x ${scale >= 4 ? "UHD" : "HD"}`
        }, { quoted: m });

        await m.react("✅");
    } catch (err) {
        console.log("Remini command error:", err);
        await m.react("❌");

        await m.reply(
            "❌ Photo එක HD කරන්න බැරි වුණා මචං.\n\n" +
            "හේතුව: " + err.message
        );
    }
}

cmd({
    name: "remini",
    category: "tools",
    fromMe: false,
    desc: "බොඳ වුණු photo HD/UHD quality එකට enhance කරන්න"
}, reminiHandler);

cmd({
    name: "hd",
    category: "tools",
    fromMe: false,
    desc: "Photo එකක් HD quality එකට enhance කරන්න"
}, reminiHandler);
