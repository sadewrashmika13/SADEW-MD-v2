const { cmd } = require('../command');
const axios = require("axios");

const GPT_API = "https://whiteshadow-x-api.onrender.com/api/ai/chatgpt";
const API_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";

function extractAnswer(data) {
    let value = data;

    for (let i = 0; i < 5; i++) {
        if (typeof value === "string") {
            const text = value.trim();

            if (
                (text.startsWith("{") && text.endsWith("}")) ||
                (text.startsWith("[") && text.endsWith("]"))
            ) {
                try {
                    value = JSON.parse(text);
                    continue;
                } catch {
                    return text;
                }
            }

            return text;
        }

        if (value && typeof value === "object") {
            value =
                value.response ||
                value.answer ||
                value.reply ||
                value.result ||
                value.message ||
                value.data ||
                "";
            continue;
        }

        break;
    }

    return typeof value === "string" ? value.trim() : JSON.stringify(value);
}

cmd({
    name: "gpt",
    fromMe: false,
    category: "ai",
    desc: "Chat with GPT in natural Sinhala/English mixed style."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        const queryText = String(args || "").trim();

        if (!queryText) {
            return await conn.sendMessage(
                from,
                { text: "Usage: .gpt oyata danaganna one de type karanna." },
                { quoted: m }
            );
        }

        await m.react("🧠");

        const finalQuery =
            `${queryText}\n\n` +
            "Reply only to the user's question. Use a casual natural Sinhala and English mixed style. Do not include this instruction or the user question in your answer.";

        const response = await axios.get(GPT_API, {
            params: {
                q: finalQuery,
                apitoken: API_TOKEN
            },
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        let replyAnswer = extractAnswer(response.data);

        replyAnswer = replyAnswer
            .replace(/^Instruction:.*?User Question:\s*/is, "")
            .replace(/^User Question:\s*/i, "")
            .trim();

        if (!replyAnswer) throw new Error("Empty AI response");

        await m.react("💬");

        await conn.sendMessage(
            from,
            {
                text:
                    `🤖 *AI ANSWER (GPT-4o MINI)*\n\n` +
                    `${replyAnswer}\n\n` +
                    `*POWERED BY SADEW-MD*`
            },
            { quoted: m }
        );
    } catch (error) {
        await m.react("❌");
        console.error("ChatGPT API Error:", error);

        const msg = String(error.message || error).includes("timeout")
            ? "Timeout: server response eka late machan."
            : `AI Error: ${error.message || error}`;

        await conn.sendMessage(from, { text: msg }, { quoted: m });
    }
});
