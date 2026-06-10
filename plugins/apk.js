// commands/apk.js (Final Working Version)
const { cmd } = require('../command');
const axios = require("axios");

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

const API_TOKEN = "VK4fry";
const API_BASE = "https://whiteshadow-x-api.onrender.com/api";

cmd({
    name: "apk",
    alias: ["apkdl", "getapk"],
    category: "download",
    fromMe: false,
    desc: "📲 Download APK files from Aptoide"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    let query = getQuery(args);
    if (!query) {
        return m.reply(`📲 *APK Downloader*\n\n*Usage:* ${m.prefix}apk <app name>\n*Example:* ${m.prefix}apk whatsapp`);
    }

    await m.react("⏳");
    await conn.sendPresenceUpdate('composing', from);
    await m.reply(`🔍 Searching for "${query}"...`);

    try {
        // 1. Search for the app
        const searchUrl = `${API_BASE}/search/aptoide?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        if (!searchRes.data?.success || !searchRes.data?.data?.length) {
            throw new Error("No apps found");
        }

        // Find best match
        let bestMatch = searchRes.data.data[0];
        const exactMatch = searchRes.data.data.find(app => 
            app.package === query.toLowerCase() || 
            app.title.toLowerCase() === query.toLowerCase()
        );
        if (exactMatch) bestMatch = exactMatch;

        const packageName = bestMatch.package;
        const appName = bestMatch.title;
        const appSize = bestMatch.size;

        await m.reply(`✅ *Found:* ${appName}\n📦 Size: ${appSize}\n⬇️ Getting sadew md download link...`);

        // 2. Get the download link from the API (this returns JSON)
        const downloadApiUrl = `${API_BASE}/download/aptoide?package=${packageName}&apitoken=${API_TOKEN}`;
        const jsonRes = await axios.get(downloadApiUrl, { 
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // Check if we got a valid response with download_link
        if (!jsonRes.data?.success || !jsonRes.data?.download_link) {
            console.error("Invalid API response:", jsonRes.data);
            throw new Error("No download link found in API response");
        }

        const directApkUrl = jsonRes.data.download_link;
        console.log(`[APK] Direct APK URL: ${directApkUrl}`);

        await m.reply(`✅ Got direct APK URL. Downloading file...`);

        // 3. Download the actual APK file from the direct URL
        const apkRes = await axios.get(directApkUrl, {
            responseType: 'arraybuffer',
            timeout: 90000, // 90 seconds for large files
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 5
        });

        const buffer = Buffer.from(apkRes.data);
        const actualSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        
        if (buffer.length < 500000) { // Less than ~0.5 MB is suspicious
            throw new Error(`Downloaded file too small (${actualSizeMB} MB). Might be invalid.`);
        }

        const fileName = `${appName.replace(/[^a-z0-9]/gi, '_')}.apk`;
        const caption = `📲 *${appName}*\n📦 Size: ${actualSizeMB} MB\n📥 *APK ready for installation*\n\n> *Powered by sadew md*`;

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: "application/vnd.android.package-archive",
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error("APK error:", error);
        await m.react("❌");
        
        let errMsg = `❌ *APK Download Failed*\n\n`;
        if (error.message.includes("No apps")) {
            errMsg += `No results for "${query}".\nTry using exact package name: ${m.prefix}apk com.whatsapp`;
        } else if (error.message.includes("download link")) {
            errMsg += `Could not get download link. The API might have changed.\n\n📝 ${error.message}`;
        } else if (error.message.includes("too small")) {
            errMsg += `Downloaded file appears to be invalid.\nThe direct APK link might be broken or expired.`;
        } else {
            errMsg += `📝 Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errMsg);
    }
});
