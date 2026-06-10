// commands/get.js
const { cmd } = require('../command');
const axios = require("axios");

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

// Server priority – best first
const SERVER_PRIORITY = ["Pixeldrain", "FilesPayout", "DLServer-01", "DLServer-02", "Telagram"];

function getBestLinkForQuality(links, targetQuality) {
    const matched = links.filter(l => l.size === targetQuality);
    if (!matched.length) return null;
    // sort by priority
    matched.sort((a, b) => {
        const aIdx = SERVER_PRIORITY.indexOf(a.quality);
        const bIdx = SERVER_PRIORITY.indexOf(b.quality);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
    });
    return matched[0]?.direct_link || null;
}

cmd({
    name: "get",
    alias: ["dl", "download"],
    category: "download",
    fromMe: false,
    desc: "⬇️ තෝරාගත් quality එකෙන් චිත්‍රපටය බාගන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const input = getQuery(args);
    if (!input || (input !== "1" && input !== "2")) {
        return m.reply(`❌ *Usage:* ${m.prefix}get <1|2>\n1 = 720p (HD)\n2 = 480p (SD)\n\n*First search with .movie and select a movie to see quality options.*`);
    }

    const session = global.movieSessions?.get(m.sender);
    if (!session || session.step !== "awaiting_quality") {
        return m.reply(`❌ ක්‍රියාකාරී චිත්‍රපට තේරීමක් නැත. කරුණාකර පළමුව .movie <name> ධාවනය කර quality options ලබා ගන්න.`);
    }

    const quality = input === "1" ? "HD 720p" : "SD 480p";
    const downloadUrl = getBestLinkForQuality(session.videoLinks, quality);
    if (!downloadUrl) {
        return m.reply(`❌ ${quality === "HD 720p" ? "720p" : "480p"} බාගැනීම් සබැඳියක් නැත.`);
    }

    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`⬇️ *${session.movieTitle}* (${quality === "HD 720p" ? "720p" : "480p"}) බාගත වෙමින්...\nමෙය විනාඩි කිහිපයක් ගත විය හැක.`);

    try {
        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 120000, // 2 minutes
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5
        });

        const buffer = Buffer.from(response.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length < 500000) {
            throw new Error(`ගොනුව ඉතා කුඩායි (${fileSizeMB} MB). සබැඳිය වලංගු නැත.`);
        }

        const fileName = `${session.movieTitle.replace(/[^a-z0-9]/gi, '_')}_${quality === "HD 720p" ? "720p" : "480p"}.mp4`;
        let caption = `🎬 *${session.movieTitle}*\n📀 Quality: ${quality === "HD 720p" ? "720p" : "480p"}\n📦 Size: ${fileSizeMB} MB`;
        if (session.subtitleLink) caption += `\n📝 *Subtitles (SRT):* ${session.subtitleLink}`;
        caption += `\n\n> *Direct download via SADEW-MINI*`;

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: "video/mp4",
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *${session.movieTitle}* (${quality === "HD 720p" ? "720p" : "480p"}) සාර්ථකව යවන ලදී.`);
        global.movieSessions.delete(m.sender); // clear session
    } catch (err) {
        console.error("Download error:", err);
        await m.react("❌");
        let errorMsg = `❌ *බාගැනීම අසාර්ථකයි*\n\n`;
        if (err.message.includes("timeout")) {
            errorMsg += `ගොනුව විශාලයි හෝ සේවාදායකය මන්දගාමීයි. කුඩා quality එකක් (480p) උත්සාහ කරන්න, නැතහොත් Pixeldrain සබැඳිය අතින් බාගන්න.`;
        } else {
            errorMsg += `Error: ${err.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
