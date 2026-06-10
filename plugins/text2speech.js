const { cmd } = require('../command');
const axios = require("axios");

const TTS_API = "https://whiteshadow-x-api.onrender.com/api/tools/tts";
const TTS_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";

function cleanText(text) {
    return String(text || "")
        .normalize("NFC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function splitText(text, maxLen = 160) {
    const words = cleanText(text).split(" ");
    const chunks = [];
    let current = "";

    for (const word of words) {
        if ((current + " " + word).trim().length > maxLen) {
            if (current) chunks.push(current);
            current = word;
        } else {
            current = (current + " " + word).trim();
        }
    }

    if (current) chunks.push(current);
    return chunks.slice(0, 6);
}

async function getTtsBuffer(text, lang = "si") {
    const params = new URLSearchParams({
        text,
        lang,
        apitoken: TTS_TOKEN
    });

    const res = await axios.get(`${TTS_API}?${params.toString()}`, {
        responseType: "arraybuffer",
        timeout: 60000,
        maxRedirects: 10,
        headers: {
            "User-Agent": "Mozilla/5.0"
        },
        validateStatus: (status) => status >= 200 && status < 400
    });

    const buffer = Buffer.from(res.data || []);
    const type = String(res.headers["content-type"] || "").toLowerCase();
    const preview = buffer.slice(0, 80).toString("utf8").toLowerCase();

    if (!buffer.length || buffer.length < 1200) {
        throw new Error("TTS API tiny audio ekak return kala.");
    }

    if (type.includes("json") || type.includes("html") || preview.includes("<html") || preview.includes("{")) {
        throw new Error("TTS API audio newei response ekak return kala.");
    }

    return buffer;
}

cmd({
    name: "tts",
    fromMe: false,
    category: "tools",
    desc: "Sinhala / Singlish text to speech"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        const text = cleanText(args || m.quoted?.text);

        if (!text) {
            return await m.reply(
                "Text ekak denna.\n\n" +
                "Example:\n.tts ඔයාට කොහොමද මචං?\n" +
                ".tts oyata kohomada machan?"
            );
        }

        await m.react("🔊");

        const chunks = splitText(text, 160);

        for (let i = 0; i < chunks.length; i++) {
            const audio = await getTtsBuffer(chunks[i], "si");

            await conn.sendMessage(from, {
                audio,
                mimetype: "audio/mpeg",
                ptt: false,
                fileName: `sadew-md-tts-${i + 1}.mp3`
            }, { quoted: m });
        }

        await m.react("✅");
    } catch (err) {
        console.log("TTS error:", err);
        await m.react("❌");
        await m.reply(
            "TTS error:\n" +
            (err.message || err) +
            "\n\nSinhala text eka 1 sec wenawanam Singlish walin try karanna. API eka Sinhala Unicode walata sometimes unstable."
        );
    }
});
