const { cmd } = require('../command');
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

// 🔍 ffmpeg-static එක කලින් ඉන්ස්ටෝල් කරපු නිසා මෙතනට ඔටෝ ලෝඩ් වෙනවා
let ffmpegPath = "ffmpeg";
let staticLoadError = null;

try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) {
        ffmpegPath = ffmpegStatic;
    } else {
        staticLoadError = "ffmpeg-static returned an empty path";
    }
} catch (e) {
    staticLoadError = e.message;
}

cmd({
    name: "slow",
    category: "misc",
    fromMe: false,
    desc: "Slows down the speed of a replied audio or voice note"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        // 🔍 රිප්ලයි එකක් තියෙනවද බලනවා
        if (!m.quoted) {
            return await m.reply("_❌ කරුණාකර ඕඩියෝ එකකට හෝ වොයිස් නෝට් එකකට Reply කරලා .slow ගහන්න!_");
        }

        await m.react("⏳"); // ස්ලෝව් කරන නිසා ⏳ එකෙන් රියැක්ට් කරනවා

        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ ඕඩියෝ එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
        }

        const tempIn = path.join(__dirname, `temp_in_slow_${Date.now()}.mp3`);
        const tempOut = path.join(__dirname, `temp_out_slow_${Date.now()}.mp3`);

        fs.writeFileSync(tempIn, media);

        // ⚡ FFmpeg Slow Command (atempo=0.75 කියන්නේ 0.75x ස්පීඩ් එක)
        // ඔයාට තවත් ස්ලෝව් කරන්න ඕනෙ නම් ඕක 0.60 වගේ කරන්න පුළුවන්
        const ffmpegCmd = `"${ffmpegPath}" -i "${tempIn}" -af "atempo=0.75" "${tempOut}" -y`;

        exec(ffmpegCmd, async (err, stdout, stderr) => {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);

            if (err) {
                console.error("FFmpeg Slow Error:", err);
                await m.react("❌");
                
                let errorMsg = `_❌ FFmpeg System Error (Slow):_\n\`\`\`${err.message}\`\`\`\n\n`;
                errorMsg += `*📊 Debug Info:*\n`;
                errorMsg += `• Used Path: \`${ffmpegPath}\`\n`;
                errorMsg += `• Package Static Status: \`${staticLoadError ? "Failed (" + staticLoadError + ")" : "Success"}\`\n`;
                
                return await m.reply(errorMsg);
            }

            const audioBuffer = fs.readFileSync(tempOut);
            
            // 📤 ස්ලෝව් කරපු ඕඩියෝ එක ආපහු යවනවා
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
