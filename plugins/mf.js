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
    name: "mf", // 👈 ප්‍රධාන කමාන්ඩ් එක .mf ලෙස වෙනස් කරන ලදී
    alias: ["mediafire", "mfdl"],
    category: "download",
    fromMe: false,
    desc: "📥 හාඩ් ඩිස්ක් එක පාවිච්චි නොකර RAM එක හරහා කෙලින්ම ඩවුන්ලෝඩ් කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let rawInput = getQuery(args);
        
        if (!rawInput) {
            return m.reply(`📥 *MediaFire Downloader (RAM Mode)*

*Usage:* ${m.prefix}mf <mediafire_url>
*Example:* ${m.prefix}mf https://www.mediafire.com/file/xxxxx/test.zip`);
        }

        rawInput = rawInput.replace(/[`']/g, '').trim();
        const mediafireRegex = /(https?:\/\/(?:www\.)?mediafire\.com\/[^\s]+)/;
        const match = rawInput.match(mediafireRegex);

        if (!match) {
            return m.reply("❌ කරුණාකර වලංගු MediaFire ලින්ක් එකක් ලබා දෙන්න මචං!");
        }

        let cleanedUrl = match[0];
        await m.react("⏳");

        console.log(`[MediaFire] Scraping links...`);
        let downloadUrl = null;
        let fileName = "MediaFire_File";
        let fileSize = "Unknown";

        // MediaFire එකෙන් Direct Link එක ඇදලා ගැනීම
        try {
            const pageResponse = await axios.get(cleanedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

            const html = pageResponse.data;
            const dlMatch = html.match(/https?:\/\/download[0-9]+\.mediafire\.com\/[^\s"']+/);
            if (dlMatch) downloadUrl = dlMatch[0];

            const nameMatch = html.match(/<div class="filename">([^<]+)<\/div>/) || html.match(/property="og:title" content="([^"]+)"/);
            if (nameMatch) fileName = nameMatch[1].trim();

            const sizeMatch = html.match(/<span>\(([^)]+)\)<\/span>/) || html.match(/class="details">[^<]*<li><span>File size:<\/span><span>([^<]+)<\/span>/);
            if (sizeMatch) fileSize = sizeMatch[1].trim();

        } catch (e) {
            console.log("Scrape error");
        }

        if (downloadUrl) {
            await m.react("📥");
            await m.reply(`📥 *MEDIAFIRE DOWNLOADER (RAM Mode)*\n\n*📛 Name:* ${fileName}\n*⚖️ Size:* ${fileSize}\n\n⏳ ෆයිල් එක RAM එකට ඩවුන්ලෝඩ් වෙමින් පවතී...`);

            console.log(`[MediaFire] Disk එකට නොදා කෙලින්ම RAM එකට ගන්නවා...`);

            // ෆයිල් එක හාඩ් එකට ලියන්නේ නැතුව කෙලින්ම RAM එකට ගන්නවා
            const fileResponse = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'arraybuffer',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });

            const ramBuffer = Buffer.from(fileResponse.data, 'binary');

            console.log(`[MediaFire] Buffer එක සූදානම්. WhatsApp එකට සෙන්ඩ් කරනවා...`);

            await conn.sendMessage(from, {
                document: ramBuffer,
                fileName: fileName,
                mimetype: "application/octet-stream"
            }, { quoted: m });

            await m.react("✅");
        } else {
            await m.react("❌");
            m.reply("❌ ඩවුන්ලෝඩ් ලින්ක් එක හොයාගන්න බැරි වුණා මචං.");
        }

    } catch (error) {
        console.error("MediaFire RAM Error:", error);
        await m.react("❌");
        m.reply("❌ සර්වර් එකේ RAM/Disk හිරවීමක් නිසා ක්‍රෑෂ් වුණා මචං! (ENOSPC)");
    }
});
