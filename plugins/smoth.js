const { cmd } = require('../command');
const { spawn } = require("child_process");

let ffmpegBin = "ffmpeg";

try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) ffmpegBin = ffmpegStatic;
} catch {
    ffmpegBin = "ffmpeg";
}

function isVideoQuoted(m) {
    const quotedMessage = m.quoted?.message || {};
    const directMessage = m.message || {};

    return Boolean(
        quotedMessage.videoMessage ||
        directMessage.videoMessage ||
        m.quoted?.mtype?.includes?.("videoMessage")
    );
}

async function downloadVideo(m) {
    if (m.quoted && typeof m.quoted.download === "function") {
        return await m.quoted.download();
    }

    throw new Error("Video එක download කරන්න බැරි වුණා. Video එකකට reply කරලා try කරන්න.");
}

function convertTo60Fps(inputBuffer) {
    return new Promise((resolve, reject) => {
        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-i", "pipe:0",
            "-vf", "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            "-f", "mp4",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timeout = setTimeout(() => {
            ffmpeg.kill("SIGKILL");
            reject(new Error("Video convert timeout වුණා. කෙටි video එකක් try කරන්න."));
        }, 10 * 60 * 1000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timeout);

            if (err.code === "ENOENT") {
                reject(new Error("FFmpeg install කරලා නෑ. GitHub Actions workflow එකට FFmpeg install step එක add කරන්න."));
            } else {
                reject(err);
            }
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timeout);

            if (code === 0) {
                const outputBuffer = Buffer.concat(outputChunks);

                if (!outputBuffer || outputBuffer.length < 1000) {
                    reject(new Error("Output video එක empty වුණා."));
                    return;
                }

                resolve(outputBuffer);
                return;
            }

            const errorText = Buffer.concat(errorChunks).toString("utf8");
            reject(new Error(errorText || `FFmpeg failed with code ${code}`));
        });

        ffmpeg.stdin.end(inputBuffer);
    });
}

cmd({
    name: "smooth",
    alias: ["smoth", "60fps", "fps60", "smoothvideo"],
    category: "tools",
    fromMe: false,
    desc: "සාමාන්‍ය video එකක් 60fps smooth video එකක් බවට convert කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!isVideoQuoted(m)) {
            return await m.reply(
                "🎬 Video එකකට reply කරලා command එක දෙන්න මචං.\n\nඋදා:\n.smooth"
            );
        }

        await m.react("🎬");

        const videoBuffer = await downloadVideo(m);

        if (!videoBuffer || videoBuffer.length < 1000) {
            return await m.reply("❌ Video එක download කරන්න බැරි වුණා.");
        }

        if (videoBuffer.length > 60 * 1024 * 1024) {
            return await m.reply("❌ Video එක ලොකු වැඩියි මචං. 60MB ට අඩු video එකක් try කරන්න.");
        }

        await m.reply("⏳ Video එක 60fps smooth කරනවා... ටිකක් ඉන්න.");

        const outputBuffer = await convertTo60Fps(videoBuffer);

        await conn.sendMessage(from, {
            video: outputBuffer,
            mimetype: "video/mp4",
            caption: "✅ 60fps Smooth video ready!"
        }, { quoted: m });

        await m.react("✅");
    } catch (err) {
        console.log("Smooth command error:", err);
        await m.react("❌");

        await m.reply(
            "❌ Video එක smooth කරන්න බැරි වුණා මචං.\n\n" +
            "හේතුව: " + err.message
        );
    }
});
