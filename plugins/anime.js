// commands/anime.js
const { cmd } = require('../command');
const axios = require("axios");

// API configuration
const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE = "https://api.zanta-mini.store/api";

// Helper to safely extract query text from arguments
function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

// Cache user sessions to track their navigation
if (!global.animeSessions) global.animeSessions = new Map();

cmd({
    name: "anime",
    alias: ["ani", "animesearch"],
    category: "download",
    fromMe: false,
    desc: "🎬 Search, browse, and download anime episodes from AnimeClub"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    // ----- Search Command -----
    const query = getQuery(args);
    if (!query) {
        return m.reply(`🎬 *AnimeClub Search*

*Usage:* ${m.prefix}anime <anime name>
*Example:* ${m.prefix}anime Naruto

*After search, type:* ${m.prefix}anime <number> to see episodes`);
    }

    // Check if the user is in a browsing session (handles number input)
    const session = global.animeSessions.get(m.sender);
    if (session && session.step === "awaiting_episode_list" && !isNaN(query)) {
        // ----- Episode List Command -----
        const selectedIndex = parseInt(query) - 1;
        if (selectedIndex < 0 || selectedIndex >= session.results.length) {
            return m.reply(`❌ Invalid selection. Please enter a number between 1 and ${session.results.length}.`);
        }
        const selectedAnime = session.results[selectedIndex];
        await fetchEpisodeList(client, m, selectedAnime.url, selectedAnime.title);
        global.animeSessions.delete(m.sender);
        return;
    }

    // If user is in episode selection mode
    if (session && session.step === "awaiting_download" && !isNaN(query)) {
        const selectedEpIndex = parseInt(query) - 1;
        if (selectedEpIndex < 0 || selectedEpIndex >= session.episodes.length) {
            return m.reply(`❌ Invalid episode number. Please choose between 1 and ${session.episodes.length}.`);
        }
        const selectedEpisode = session.episodes[selectedEpIndex];
        await fetchDownload(client, m, selectedEpisode.url, session.animeTitle);
        global.animeSessions.delete(m.sender);
        return;
    }

    // ----- If not a number, perform a new search -----
    await m.react("🔍");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`🔎 Searching for "${query}"...`);

    try {
        const searchUrl = `${API_BASE}/anime/search?apiKey=${API_KEY}&url=${encodeURIComponent(query)}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        if (!searchRes.data?.success || !searchRes.data?.result?.length) {
            await m.react("❌");
            return m.reply(`❌ No results found for "${query}".`);
        }

        const results = searchRes.data.result.slice(0, 10);
        let listMsg = `🎬 *Anime Search Results*\n🔍 *Query:* ${query}\n📊 *Found:* ${results.length}\n\n`;
        results.forEach((anime, i) => {
            listMsg += `${i+1}. *${anime.title}*\n   📅 ${anime.year || 'N/A'} | ⭐ ${anime.rating || 'N/A'}\n\n`;
        });
        listMsg += `📌 *To see episodes:* Type ${m.prefix}anime <number>\nExample: ${m.prefix}anime 1`;

        await conn.sendMessage(from, { text: listMsg }, { quoted: m });

        // Store search results
        global.animeSessions.set(m.sender, {
            step: "awaiting_episode_list",
            results: results,
            timestamp: Date.now()
        });
        setTimeout(() => global.animeSessions.delete(m.sender), 300000); // Auto clear after 5 minutes

        await m.react("✅");
    } catch (error) {
        console.error("Search error:", error);
        await m.react("❌");
        m.reply(`❌ Search failed: ${error.message.substring(0, 100)}`);
    }
});

// Function to fetch and send episode list
async function fetchEpisodeList(client, m, animeUrl, animeTitle) {
    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`📺 Fetching episodes for *${animeTitle}*...`);

    try {
        const episodeUrl = `${API_BASE}/animeclub/ep?apiKey=${API_KEY}&url=${encodeURIComponent(animeUrl)}`;
        const epRes = await axios.get(episodeUrl, { timeout: 15000 });

        if (!epRes.data?.success || !epRes.data?.episodes?.length) {
            await m.react("❌");
            return m.reply(`❌ No episodes found for ${animeTitle}.`);
        }

        let episodes = epRes.data.episodes.slice(0, 30);
        let epListMsg = `🎬 *${animeTitle}*\n📺 *Episodes (First ${episodes.length})*\n\n`;
        episodes.forEach((ep, i) => {
            epListMsg += `${i+1}. *${ep.title || `Episode ${ep.number || i+1}`}*\n`;
        });
        epListMsg += `\n📌 *To download:* Type ${m.prefix}anime <episode number>\nExample: ${m.prefix}anime 1`;

        await conn.sendMessage(from, { text: epListMsg }, { quoted: m });

        // Store episode list
        global.animeSessions.set(m.sender, {
            step: "awaiting_download",
            episodes: episodes,
            animeTitle: animeTitle,
            timestamp: Date.now()
        });
        setTimeout(() => global.animeSessions.delete(m.sender), 300000);

        await m.react("✅");
    } catch (error) {
        console.error("Episode fetch error:", error);
        await m.react("❌");
        m.reply(`❌ Failed to fetch episodes: ${error.message.substring(0, 100)}`);
    }
}

// Function to fetch and send download link
async function fetchDownload(client, m, episodeUrl, animeTitle) {
    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`📥 Getting download link for *${animeTitle}*...`);

    try {
        const downloadUrl = `${API_BASE}/animeclub/dl?apiKey=${API_KEY}&url=${encodeURIComponent(episodeUrl)}`;
        const dlRes = await axios.get(downloadUrl, { timeout: 15000 });

        if (!dlRes.data?.success || !dlRes.data?.download_url) {
            await m.react("❌");
            return m.reply(`❌ No download link found for this episode.`);
        }

        const directLink = dlRes.data.download_url;
        const caption = `🎬 *${animeTitle}*\n📥 *Download Link:*\n${directLink}\n\n> Powered by AnimeClub`;

        await conn.sendMessage(from, { text: caption }, { quoted: m });
        await m.react("✅");
    } catch (error) {
        console.error("Download error:", error);
        await m.react("❌");
        m.reply(`❌ Download failed: ${error.message.substring(0, 100)}`);
    }
}
