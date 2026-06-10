const { cmd } = require('../command');
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

// 🛠️ සර්වර් එකේ ffmpeg නැති නිසා ffmpeg-static පැකේජ් එක තියෙනවද කියලා ඔටෝ චෙක් කරනවා
let ffmpegPath = "ffmpeg";
try {
    ffmpegPath = require("ffmpeg-static");
} catch (e) {
    // ffmpeg-static නැත්නම් global command එකම තියාගන්නවා
}

cmd({
    name: "bass",
    category: "misc",
    fromMe: false,
    desc: "Boosts the bass of a replied audio or voice note"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!m.quoted) {
            return await m.reply("_❌ කරුණාකර ඕඩියෝ එකකට හෝ වොයිස් නෝට් එකකට Reply කරලා .bass ගහන්න!_");
        }

        await m.react("🎧");

        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ ඕඩියෝ එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
        }

        const tempIn = path.join(__dirname, `temp_in_${Date.now()}.mp3`);
        const tempOut = path.join(__dirname, `temp_out_${Date.now()}.mp3`);

        fs.writeFileSync(tempIn, media);

        // ⚡ ffmpegPath එක ඩයිනමික් කරා (Static එක තිබ්බොත් ඒකෙන් රන් වෙන්නේ)
        const ffmpegCmd = `"${ffmpegPath}" -i "${tempIn}" -af "bass=g=15,volume=1.2" "${tempOut}" -y`;

        exec(ffmpegCmd, async (err, stdout, stderr) => {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);

            if (err) {
                console.error("FFmpeg Raw Error:", err);
                await m.react("❌");
                
                // 📝 ඔයා ඉල්ලපු විදිහටම එරර් එක ලස්සනට වට්ස්ඇප් එකට එන්න හැදුවා
                let errorMsg = `_❌ FFmpeg System Error:_\n\`\`\`${err.message}\`\`\`\n\n`;
                
                if (err.message.includes("not found")) {
                    errorMsg += `*💡 පියවර:* ඔයාගේ සර්වර් එකේ FFmpeg නැහැ මචං. මේක ගොඩදාගන්න බොට්ගේ ටර්මිනල් එකේ \`npm i ffmpeg-static\` කියලා ටයිප් කරලා එන්ටර් කරලා බොට්ව Restart කරන්න!`;
                }
                
                return await m.reply(errorMsg);
            }

            const audioBuffer = fs.readFileSync(tempOut);
            await conn.sendMessage(from, audioBuffer, { quoted: m, mimetype: 'audio/mpeg' }, "audio");
            await m.react("✅");

            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        });

    } catch (error) {
        console.error(error);
        await m.react("❌");
        m.reply(`_❌ Unexpected Error:_\n\`\`\`${error.message || error}\`\`\``);
    }
});
