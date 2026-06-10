const { cmd } = require('../command');
const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

cmd(
  {
    name: "tt",
    fromMe: false,
    category: "downloader",
    desc: "Download TikTok videos in HD if available.",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args || args.trim() === "") {
      return await conn.sendMessage(from, { text: "❌ *Usage:* `.tt <URL>`" }, { quoted: m });
    }

    // Improved URL validation
    const urlMatch = args.match(/(https?:\/\/[^\s]+)/g);
    const tiktokRegex = /(tiktok\.com|vt\.tiktok\.com)/;
    if (!urlMatch || !tiktokRegex.test(urlMatch[0])) {
      return await conn.sendMessage(from, { text: "❌ *Invalid TikTok URL.*" }, { quoted: m });
    }

    const tiktokUrl = urlMatch[0];
    await m.react('⏳');

    try {
      const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
      const response = await axios.get(apiUrl, { httpsAgent, timeout: 15000 });
      const data = response.data;

      if (!data || !data.data) throw new Error("Video not found!");

      // ⚡ HD තිබුණොත් ඒක ගන්නවා, නැත්නම් Normal එක
      const videoUrl = data.data.hdplay || data.data.play;
      if (!videoUrl) throw new Error("No video URL found (HD or normal).");

      const isHD = data.data.hdplay ? "High Quality (HD) ✅" : "Normal Quality ⚠️";
      const title = data.data.title || "No Title";

      await m.react('⬇️');

      const videoStream = await axios.get(videoUrl, {
        httpsAgent,
        responseType: "arraybuffer",
        timeout: 20000
      });
      const videoBuffer = Buffer.from(videoStream.data);

      const captionText = `🎬 *ѕά𝓭є𝔀 ᵐ𝐃 Ŧ𝕚ᛕ𝕋𝔬ķ♫*\n\n📝 *Title:* ${title}\n✨ *Quality:* ${isHD}\n📦 *Size:* ${(videoBuffer.length / (1024 * 1024)).toFixed(2)}MB\n\n*Downloaded by SADEW-MD*`;

      // 16MB limit check
      if (videoBuffer.length > 16 * 1024 * 1024) {
        await conn.sendMessage(from, {
          document: videoBuffer,
          mimetype: "video/mp4",
          fileName: `tiktok_${Date.now()}.mp4`,
          caption: captionText
        }, { quoted: m });
      } else {
        await conn.sendMessage(from, {
          video: videoBuffer,
          caption: captionText,
        }, { quoted: m });
      }

      await m.react('✅');

    } catch (error) {
      await m.react('❌');
      console.error("TikTok error:", error);
      let errorMsg = error.message.includes("timeout")
        ? "❌ *Timeout:* Server took too long."
        : `❌ *Error:* ${error.message}`;
      await conn.sendMessage(from, { text: errorMsg }, { quoted: m });
    }
  }
);
