const { cmd } = require('../command');
const axios = require("axios");

cmd({
    name: "deepseek",
    alias: ["ai", "ask"],
    category: "ai",
    desc: "Chat with AI (Robust 3-Layer Fallback)"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return m.reply("_මචං අහන්න ඕන ප්‍රශ්නයක් දාපන්! Example: .deepseek What is Node.js_");

    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);

    // ==========================================
    // 🚀 TRY 1: පළවෙනි API එක (Whiteshadow DeepSeek V4)
    // ==========================================
    try {
        const token = process.env.DEEPSEEK_TOKEN || "VK4fry";
        const url1 = `https://whiteshadow-x-api.vercel.app/api/ai/deepseekv4?q=${encodeURIComponent(args)}&apitoken=${token}`;
        
        const res1 = await axios.get(url1, { timeout: 12000 });
        
        if (res1.data && res1.data.success && res1.data.response) {
            await m.react("✅");
            return m.reply(res1.data.response);
        } else {
            throw new Error("API 1 Invalid Response");
        }

    } catch (error1) {
        console.error("API 1 Failed! Switching to API 2 (Zanta Mini)...", error1.message);
        
        // ==========================================
        // 🔄 TRY 2: දෙවැනි API එක (Zanta Mini DeepChat)
        // ==========================================
        try {
            // උඹ දුන්න අලුත්ම API එක මචං
            const url2 = `https://api.zanta-mini.store/api/deepchat?apiKey=zan_FIAO7Ayh_eo1vllkep6&text=${encodeURIComponent(args)}`;
            const res2 = await axios.get(url2, { timeout: 12000 });
            
            // සාමාන්‍යයෙන් මේ වගේ API වල උත්තරේ එන්නේ result, response හෝ reply කියන key එකකින්
            const aiReply2 = res2.data?.result || res2.data?.response || res2.data?.reply;
            
            if (aiReply2) {
                await m.react("✅");
                return m.reply(aiReply2);
            } else {
                throw new Error("API 2 Invalid Response");
            }

        } catch (error2) {
            console.error("API 2 Failed! Switching to API 3 (Popcat Chatbot)...", error2.message);
            
            // ==========================================
            // 🔄 TRY 3: තුන්වැනි API එක (Popcat Free Chatbot)
            // ==========================================
            try {
                const url3 = `https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(args)}`;
                const res3 = await axios.get(url3, { timeout: 12000 });
                
                if (res3.data && res3.data.response) {
                    await m.react("✅");
                    return m.reply(`🤖 *SADEW MD (Fallback AI):*\n\n${res3.data.response}`);
                } else {
                    throw new Error("API 3 Invalid Response");
                }

            } catch (error3) {
                console.error("All 3 APIs Failed:", error3.message);
                await m.react("❌");
                
                // API 3ම කෙලවුණොත් විතරක් වැටෙන මැසේජ් එක
                return m.reply(`❌ *මචං AI සර්වර්ස් 3ම මේ වෙලාවේ වැඩ කරන්නේ නැහැ!*\n\nපස්සේ වෙලාවක නැවත උත්සාහ කරන්න.`);
            }
        }
    }
});
