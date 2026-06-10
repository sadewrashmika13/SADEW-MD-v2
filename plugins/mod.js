// commands/mod.js
const { cmd } = require('../command');
const axios = require("axios");

// Helper to extract query from args
function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE = "https://api.zanta-mini.store/api/modapk";

// Store search results temporarily (expires after 5 minutes)
if (!global.modStore) global.modStore = new Map();

cmd({
    name: "mod",
    category: "download",
    fromMe: false,
    desc: "🎮 Search and download MOD APK games (AN1.com)"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    let full = getQuery(args);
    if (!full) {
        return m.reply(`🎮 *MOD APK Downloader*

*Usage:*
• Search: ${m.prefix}mod <game name>
• Download: ${m.prefix}mod dl <number>

*Examples:*
${m.prefix}mod subway surfers
${m.prefix}mod dl 1`);
    }

    // ----- SUBCOMMAND: download -----
    if (full.startsWith("dl ")) {
        let num = parseInt(full.split(" ")[1]);
        if (isNaN(num)) return m.reply(`❌ Invalid number. Usage: ${m.prefix}mod dl <number>`);

        let session = global.modStore.get(m.sender);
        if (!session || !session.results) {
            return m.reply(`❌ No active search. Please run ${m.prefix}mod <game name> first.`);
        }
        if (num < 1 || num > session.results.length) {
            return m.reply(`❌ Number must be between 1 and ${session.results.length}.`);
        }

        let selected = session.results[num-1];
        let gameUrl = encodeURIComponent(selected.url);
        let gameTitle = selected.title;

        await m.react("⏳");
        await conn.sendPresenceUpdate('composing', from);
        await m.reply(`📥 Downloading *${gameTitle}* ...`);

        try {
            let dlRes = await axios.get(`${API_BASE}/dl?apiKey=${API_KEY}&url=${gameUrl}`, { timeout: 15000 });
            if (!dlRes.data?.success || !dlRes.data?.download_url) throw new Error("No download link");

            let apkRes = await axios.get(dlRes.data.download_url, {
                responseType: 'arraybuffer',
                timeout: 90000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            let buffer = Buffer.from(apkRes.data);
            let sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            if (buffer.length < 500000) throw new Error("File too small");

            let fileName = `${gameTitle.replace(/[^a-z0-9]/gi, '_')}.apk`;
            let caption = `🎮 *${gameTitle}* [MOD]\n📦 ${sizeMB} MB\n📥 Ready for install`;

            await conn.sendMessage(from, {
                document: buffer,
                mimetype: "application/vnd.android.package-archive",
                fileName: fileName,
                caption: caption
            }, { quoted: m });

            await m.react("✅");
            global.modStore.delete(m.sender); // clear session
        } catch (err) {
            console.error("Download error:", err);
            await m.react("❌");
            m.reply(`❌ Download failed: ${err.message.substring(0, 100)}`);
        }
        return;
    }

    // ----- SUBCOMMAND: search -----
    let query = full;
    await m.react("🔍");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`🔎 Searching for "${query}"...`);

    try {
        let searchRes = await axios.get(`${API_BASE}/search?apiKey=${API_KEY}&url=${encodeURIComponent(query)}`, { timeout: 15000 });
        if (!searchRes.data?.success || !searchRes.data?.result?.length) throw new Error("No results");

        let results = searchRes.data.result.slice(0, 10);
        let listMsg = `🎮 *MOD APK Results*\n🔍 *${query}*\n📊 *Found:* ${results.length}\n\n`;
        results.forEach((game, i) => {
            listMsg += `${i+1}. *${game.title}*\n   👤 ${game.developer || "Unknown"} | ⭐ ${game.rating || "N/A"}\n\n`;
        });
        listMsg += `📌 *To download:* ${m.prefix}mod dl <number>\nExample: ${m.prefix}mod dl 1`;

        await conn.sendMessage(from, { text: listMsg }, { quoted: m });

        // store results
        global.modStore.set(m.sender, { results: results, timestamp: Date.now() });
        setTimeout(() => global.modStore.delete(m.sender), 300000); // auto clear after 5 min

        await m.react("✅");
    } catch (err) {
        console.error("Search error:", err);
        await m.react("❌");
        m.reply(`❌ Search failed: ${err.message.substring(0, 100)}`);
    }
});
