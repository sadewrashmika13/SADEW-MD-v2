// commands/movie.js
const { cmd } = require('../command');
const axios = require("axios");

const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE = "https://api.zanta-mini.store/api/sinhalasub";

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

if (!global.movieSessions) global.movieSessions = new Map();

cmd({
    name: "movie",
    alias: ["cinema", "films"],
    category: "download",
    fromMe: false,
    desc: "🎬 සිංහල උපසිරැසි චිත්‍රපට සොයා ගන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const query = getQuery(args);
    if (!query) {
        return m.reply(`🎬 *සිංහල චිත්‍රපට සෙවුම*

*Usage:* ${m.prefix}movie <movie name>
*Example:* ${m.prefix}movie kishkindha

*After search:* ${m.prefix}movie <number>
*Then download:* ${m.prefix}get <1|2>`);
    }

    const session = global.movieSessions.get(m.sender);
    if (session && session.step === "awaiting_movie" && !isNaN(query)) {
        const idx = parseInt(query) - 1;
        if (idx < 0 || idx >= session.results.length) {
            return m.reply(`❌ වැරදි අංකයක්. කරුණාකර 1-${session.results.length} අතර අංකයක් එවන්න.`);
        }
        const selected = session.results[idx];
        await fetchQualityOptions(client, m, selected.url, selected.title);
        // ✅ FIX: Do NOT delete the session here – fetchQualityOptions creates a new one.
        // global.movieSessions.delete(m.sender);  // ❌ REMOVED
        return;
    }

    // New search
    await m.react("🔍");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`🔎 සොයමින් "${query}"...`);

    try {
        const searchUrl = `${API_BASE}/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { timeout: 15000 });

        if (!data?.success || !data?.results?.length) {
            await m.react("❌");
            return m.reply(`❌ "${query}" සඳහා ප්‍රතිඵල හමු නොවිණි.`);
        }

        const results = data.results.slice(0, 8);
        let listMsg = `🎬 *සිංහල උපසිරැසි ප්‍රතිඵල*\n🔍 *${query}*\n📊 හමු වූ: ${results.length}\n\n`;
        results.forEach((movie, i) => {
            listMsg += `${i+1}. *${movie.title}*\n`;
        });
        listMsg += `\n📌 *චිත්‍රපටය තෝරන්න:* ${m.prefix}movie <අංකය>\nඋදා: ${m.prefix}movie 1`;

        await conn.sendMessage(from, { text: listMsg }, { quoted: m });

        global.movieSessions.set(m.sender, {
            step: "awaiting_movie",
            results: results,
            timestamp: Date.now()
        });
        setTimeout(() => global.movieSessions.delete(m.sender), 5 * 60 * 1000);

        await m.react("✅");
    } catch (err) {
        console.error("Search error:", err);
        await m.react("❌");
        m.reply(`❌ සෙවීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
});

async function fetchQualityOptions(client, m, movieUrl, title) {
    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`📥 බාගැනීම් විකල්ප සොයමින් *${title}*...`);

    try {
        const dlUrl = `${API_BASE}/dl?apiKey=${API_KEY}&text=${encodeURIComponent(movieUrl)}`;
        const { data } = await axios.get(dlUrl, { timeout: 15000 });

        if (!data?.success || !data?.results?.links?.length) {
            await m.react("❌");
            return m.reply(`❌ "${title}" සඳහා බාගැනීම් සබැඳි හමු නොවිණි.`);
        }

        const allLinks = data.results.links;
        const videoLinks = allLinks.filter(l => l.quality !== "Subtitles");
        const subLink = allLinks.find(l => l.quality === "Subtitles");

        const has720p = videoLinks.some(l => l.size === "HD 720p");
        const has480p = videoLinks.some(l => l.size === "SD 480p");

        if (!has720p && !has480p) {
            await m.react("❌");
            return m.reply(`❌ මෙම චිත්‍රපටය සඳහා 720p හෝ 480p quality නැත.`);
        }

        let qualMsg = `🎬 *${title}*\n📥 *Quality එක තෝරන්න:*\n\n`;
        if (has720p) qualMsg += `1. *720p* (HD) – වේගවත් බාගැනීම\n`;
        if (has480p) qualMsg += `2. *480p* (SD) – කුඩා ගොනුව\n`;
        qualMsg += `\n📌 *බාගැනීමට:* ${m.prefix}get <අංකය>\nඋදා: ${m.prefix}get 1 (720p සඳහා)`;

        await conn.sendMessage(from, { text: qualMsg }, { quoted: m });

        // ✅ Store session for .get command (step awaiting_quality)
        global.movieSessions.set(m.sender, {
            step: "awaiting_quality",
            videoLinks: videoLinks,
            subtitleLink: subLink ? subLink.direct_link : null,
            movieTitle: title,
            timestamp: Date.now()
        });
        setTimeout(() => global.movieSessions.delete(m.sender), 5 * 60 * 1000);

        await m.react("✅");
    } catch (err) {
        console.error("Quality fetch error:", err);
        await m.react("❌");
        m.reply(`❌ බාගැනීම් විකල්ප ලබා ගැනීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
}
