// commands/ss.js
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
    name: "ss",
    alias: ["screenshot", "webss"],
    category: "tools",
    fromMe: false,
    desc: "📸 වෙබ් අඩවියක තිර රුවක් ගන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let url = getQuery(args);
        if (!url) {
            return m.reply(`📸 *Website Screenshot*

*Usage:* ${m.prefix}ss <website_url>
*Example:* ${m.prefix}ss https://google.com`);
        }
        if (!url.startsWith("http")) url = "https://" + url;

        await m.react("⏳");
        await conn.sendPresenceUpdate('composing', from);

        // API 1: ScreenshotAPI.net (free tier, no key)
        const screenshotUrl = `https://shot.screenshotapi.net/screenshot?url=${encodeURIComponent(url)}&width=1280&height=800&output=image&file_type=png`;
        
        const response = await axios.get(screenshotUrl, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (response.status !== 200 || !response.data || response.data.length < 1000) {
            throw new Error("Empty response");
        }

        const caption = `📸 *Screenshot of:* ${url}\n🤖 SADEW-MINI\n⏱️ ${new Date().toLocaleString()}`;

        await conn.sendMessage(from, {
            image: Buffer.from(response.data),
            caption: caption
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error("Screenshot error:", error);
        await m.react("❌");
        
        // Fallback to alternative API if the first fails
        try {
            let url = getQuery(args);
            if (!url.startsWith("http")) url = "https://" + url;
            const fallbackUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`;
            const { data } = await axios.get(fallbackUrl, { timeout: 15000 });
            const screenshotUrl = data?.data?.screenshot?.url;
            if (screenshotUrl) {
                const caption = `📸 *Screenshot of:* ${url}\n🤖 SADEW-MINI (fallback)\n⏱️ ${new Date().toLocaleString()}`;
                await conn.sendMessage(from, { image: { url: screenshotUrl }, caption: caption }, { quoted: m });
                await m.react("✅");
                return;
            }
        } catch (e) {
            console.error("Fallback also failed:", e);
        }
        
        m.reply(`❌ *Screenshot failed*\n\nCould not capture screenshot.\nMake sure the website is accessible.`);
    }
});
