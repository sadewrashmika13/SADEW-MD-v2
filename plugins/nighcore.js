const { cmd } = require('../command');
const { spawn } = require("child_process");

let ffmpegBin = "ffmpeg";

try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) ffmpegBin = ffmpegStatic;
} catch {
    ffmpegBin = "ffmpeg";
}

function isAudioMessage(m) {
    const quotedMessage = m.quoted?.message || {};
    const directMessage = m.message || {};

    return Boolean(
        quotedMessage.audioMessage ||
        directMessage.audioMessage ||
        quotedMessage.videoMessage ||
        directMessage.videoMessage ||
        m.quoted?.mtype?.includes?.("audioMessage") ||
        m.quoted?.mtype?.includes?.("videoMessage")
    );
}

async function downloadMedia(m) {
    if (m.quoted && typeof m.quoted.download === "function") {
        return await m.quoted.download();
    }

    if (typeof m.download === "function") {
        return await m.download();
    }

    throw new Error("Audio එක download කරන්න බැරි වුණා. Audio එකකට reply කරලා try කරන්න.");
}

function getArgsText(args) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

function getNightcoreSettings(argsText) {
    const text = String(argsText || "").toLowerCase();

    if (text.includes("hard")) {
        return {
            speed: 1.25,
            tempo: 1.25,
            pitch: 1.18,
            label: "Hard Nightcore"
        };
    }

    if (text.includes("soft")) {
        return {
            speed: 1.12,
            tempo: 1.12,
            pitch: 1.08,
            label: "Soft Nightcore"
        };
    }

    return {
        speed: 1.18,
        tempo: 1.18,
        pitch: 1.12,
        label: "Nightcore"
    };
}

function convertToNightcore(inputBuffer, settings) {
    return new Promise((resolve, reject) => {
        const pitchFilter = `asetrate=44100*${settings.pitch},aresample=44100`;
        const tempoFilter = `atempo=${settings.tempo}`;
        const audioFilter = `${pitchFilter},${tempoFilter},volume=1.05`;

        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-i", "pipe:0",
            "-vn",
            "-filter:a", audioFilter,
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            "-f", "mp3",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timeout = setTimeout(() => {
            ffmpeg.kill("SIGKILL");
            reject(new Error("Nightcore convert timeout වුණා. කෙටි song එකක් try කරන්න."));
        }, 8 * 60 * 1000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timeout);

            if (err.code === "ENOENT") {
                reject(new Error("FFmpeg install කරලා නෑ. Workflow එකට FFmpeg install step එක add කරන්න."));
            } else {
                reject(err);
            }
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timeout);

            if (code === 0) {
                const outputBuffer = Buffer.concat(outputChunks);

                if (!outputBuffer || outputBuffer.length < 1000) {
                    reject(new Error("Output audio එක empty වුණා."));
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
    name: "nightcore",
    alias: ["nc", "remix", "speedup"],
    category: "tools",
    fromMe: false,
    desc: "Song එකක speed සහ pitch වැඩි කරලා Nightcore remix vibe එකක් හදන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!isAudioMessage(m)) {
            return await m.reply(
                "🎧 Song/audio එකකට reply කරලා command එක දෙන්න මචං.\n\n" +
                "උදා:\n" +
                ".nightcore\n" +
                ".nightcore soft\n" +
                ".nightcore hard"
            );
        }

        await m.react("🎧");

        const inputBuffer = await downloadMedia(m);

        if (!inputBuffer || inputBuffer.length < 1000) {
            return await m.reply("❌ Audio එක download කරන්න බැරි වුණා.");
        }

        if (inputBuffer.length > 50 * 1024 * 1024) {
            return await m.reply("❌ Audio එක ලොකු වැඩියි මචං. 50MB ට අඩු file එකක් try කරන්න.");
        }

        const settings = getNightcoreSettings(getArgsText(args));

        await m.reply(`⏳ ${settings.label} remix එක හදනවා... ටිකක් ඉන්න.`);

        const outputBuffer = await convertToNightcore(inputBuffer, settings);

        await conn.sendMessage(from, {
            audio: outputBuffer,
            mimetype: "audio/mpeg",
            fileName: "nightcore.mp3",
            ptt: false
        }, { quoted: m });

        await m.react("✅");
    } catch (err) {
        console.log("Nightcore command error:", err);
        await m.react("❌");

        await m.reply(
            "❌ Nightcore remix එක හදන්න බැරි වුණා මචං.\n\n" +
            "හේතුව: " + err.message
        );
    }
});
