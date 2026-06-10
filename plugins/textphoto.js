const { cmd } = require('../command');
const axios = require("axios");

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

cmd({
    name: "text2img",
    alias: ["draw", "imagine", "aiimg"],
    category: "ai",
    fromMe: false,
    desc: "🎨 වචන වලින් ලස්සන AI පින්තූර සාදන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let prompt = getQuery(args);
        
        if (!prompt) {
            return m.reply(`🎨 *AI Text to Image Generator*

*Usage:* ${m.prefix}text2img <your_prompt>
*Example:* ${m.prefix}text2img A cute cat with sunglasses`);
        }

        await m.react("⏳");
        await conn.sendPresenceUpdate('composing', from);

        const query = encodeURIComponent(prompt);
        
        // 🛠️ කවදාවත් ඩවුන් නොවෙන Pollinations AI ඇතුළු අලුත්ම APIs ලිස්ට් එක
        const apis = [
            `https://image.pollinations.ai/prompt/${query}?width=1024&height=1024&nologo=true`, // 🌟 Pollinations AI (Highly Stable)
            `https://api.canvas.vreden.my.id/api/canvas?prompt=${query}`, // New Vreden
            `https://whiteshadow-x-api.vercel.app/api/ai/text2img?prompt=${query}&apitoken=VK4fry`, // ඔයාගේ එක
            `https://bk9.fun/ai/photoleap?q=${query}`
        ];

        let imageBuffer = null;
        let finalImageUrl = null;

        for (let i = 0; i < apis.length; i++) {
            try {
                console.log(`[Text2Img] ට්‍රයි කරන්නේ API ${i + 1}: ${apis[i]}`);
                
                const response = await axios.get(apis[i], {
                    responseType: 'arraybuffer',
                    timeout: 25000, // තත්පර 25ක සීමාවක්
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });

                if (response.status === 200 && response.data) {
                    const contentType = response.headers['content-type'] || '';
                    
                    // 1. API එකෙන් කෙලින්ම ඉමේජ් එකක් ආවොත් (උදා: Pollinations AI)
                    if (contentType.includes('image')) {
                        imageBuffer = response.data;
                        console.log(`[Text2Img] API ${i + 1} එකෙන් කෙලින්ම පින්තූරය ලැබුණා!`);
                        break;
                    }
                    
                    // 2. නැත්නම් JSON එකක්ද ආවේ කියලා චෙක් කරනවා
                    const jsonString = Buffer.from(response.data).toString('utf8');
                    let resData;
                    try {
                        resData = JSON.parse(jsonString);
                    } catch (e) {
                        // JSON නෙවෙයි නම්, හැබැයි පින්තූරයක් වගේ සයිස් එකක් තියෙනවා නම් බෆර් එක ගන්නවා
                        if (response.data.length > 5000) {
                            imageBuffer = response.data;
                            break;
                        }
                        continue;
                    }

                    if (resData.ok === false || resData.status === false || resData.error) {
                        console.log(`[Text2Img] API ${i + 1} සර්වර් Error එකක් දුන්නා.`);
                        continue;
                    }

                    // JSON එක ඇතුලෙන් ලින්ක් එකක් සෙවීම
                    function findImageUrl(obj) {
                        if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://'))) return obj;
                        if (typeof obj === 'object' && obj !== null) {
                            for (let key in obj) {
                                let res = findImageUrl(obj[key]);
                                if (res) return res;
                            }
                        }
                        return null;
                    }

                    let imgUrl = findImageUrl(resData);
                    if (imgUrl) {
                        finalImageUrl = imgUrl;
                        console.log(`[Text2Img] API ${i + 1} එකෙන් ලින්ක් එකක් හමුවුණා!`);
                        break;
                    }
                }
            } catch (err) {
                console.log(`[Text2Img] API ${i + 1} එක වැඩ කළේ නැහැ. ඊළඟ එක බලනවා...`);
            }
        }

        const caption = `🎨 *AI Generated Image*\n\n*Prompt:* ${prompt}\n🤖 SADEW-MINI`;

        // 📤 WhatsApp එකට යැවීම
        if (imageBuffer) {
            await conn.sendMessage(from, { image: Buffer.from(imageBuffer), caption: caption }, { quoted: m });
            await m.react("✅");
        } else if (finalImageUrl) {
            await conn.sendMessage(from, { image: { url: finalImageUrl }, caption: caption }, { quoted: m });
            await m.react("✅");
        } else {
            await m.react("❌");
            m.reply("❌ කණගාටුයි මචං, දැනට පින්තූර සාදන සියලුම AI සර්වර් කාර්යබහුලයි. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.");
        }

    } catch (error) {
        console.error("Text2Img Overall Error:", error);
        await m.react("❌");
        m.reply("❌ අනපේක්ෂිත Error එකක් ආවා මචං!");
    }
});
