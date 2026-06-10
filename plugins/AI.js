const { cmd } = require('../command');
const axios = require("axios");

cmd({
    name: "ai",
    alias: ["ask", "groq"],
    category: "ai",
    desc: "Chat with Ultra-Fast Dedicated GROQ AI Engine (Sinhala Mode)"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return m.reply("_මචං අහන්න ඕන ප්‍රශ්නයක් දාපන්! Example: .ai Who is Tony Stark?_");

    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);

    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
        console.log(`[AI LOG] ❌ GROQ_API_KEY is missing in GitHub Secrets!`);
        return await tryBackup(args, m);
    }

    try {
        console.log(`\n[AI LOG] ⚡ Triggering GROQ using GitHub Secrets Key...`);
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile", 
            // ✨ මෙතනට System Message එකක් දාලා AI එකට සිංහලෙන් විතරක් කතා කරන්න අණ කරලා තියෙන්නේ
            messages: [
                { 
                    role: "system", 
                    content: "You are a helpful AI assistant. You must always reply in clear, natural Sinhala language, no matter what language the user asks the question in." 
                },
                { 
                    role: "user", 
                    content: args 
                }
            ]
        }, {
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            timeout: 10000 
        });

        const groqReply = response.data?.choices?.[0]?.message?.content;

        if (groqReply) {
            await m.react("✅");
            return m.reply(groqReply.trim());
        }

    } catch (error) {
        console.log(`\n[🚨 GROQ ERROR DETAILS] Status: ${error.response?.status}`);
        console.log(`[🚨 GROQ ERROR BODY]:`, error.response?.data || error.message);
        
        return await tryBackup(args, m);
    }
});

async function tryBackup(args, m) {
    try {
        const token = process.env.DEEPSEEK_TOKEN || "VK4fry";
        // ✨ බැකප් එකටත් ප්‍රශ්නය අන්තිමට (Reply in Sinhala) කෑල්ල එකතු කරලා යවනවා
        const sinhalaQuery = args + " (Reply in Sinhala language)";
        const urlBackup = `https://whiteshadow-x-api.vercel.app/api/ai/deepseekv4?q=${encodeURIComponent(sinhalaQuery)}&apitoken=${token}`;
        const resBackup = await axios.get(urlBackup, { timeout: 7000 });
        
        if (resBackup.data && resBackup.data.success && resBackup.data.response) {
            await m.react("✅");
            return m.reply(resBackup.data.response);
        } else {
            throw new Error("Backup Invalid Response");
        }
    } catch (backupError) {
        await m.react("❌");
        return m.reply(`❌ *මචං GROQ සර්වර් එක වගේම බැකප් සර්වර්ස් සියල්ලම මේ වෙලාවේ ඩවුන්!*`);
    }
}
