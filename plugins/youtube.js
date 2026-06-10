const { cmd } = require('../command');
const { getString, isUrl } = require("./pluginsCore");
const axios = require("axios");
const { spawn } = require("child_process");

const lang = getString("download") || {};
const ffmpegBin = "ffmpeg";

function sanitizeFileName(name) {
    return String(name || "music")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
}

function durationToSeconds(duration) {
    const parts = String(duration || "").split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

function pickBestSong(results) {
    if (!Array.isArray(results) || !results.length) return null;

    return results.find((item) => {
        const seconds = durationToSeconds(item.duration);
        return seconds > 0 && seconds <= 15 * 60;
    }) || results[0];
}

async function downloadToBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxRedirects: 5,
        headers: { "User-Agent": "Mozilla/5.0" },
        maxContentLength: 80 * 1024 * 1024,
        maxBodyLength: 80 * 1024 * 1024
    });

    return Buffer.from(res.data);
}

function convertToPhoneMp3(inputBuffer) {
    return new Promise((resolve, reject) => {
        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-i", "pipe:0",
            "-vn",
            "-map_metadata", "-1",
            "-ac", "2",
            "-ar", "44100",
            "-c:a", "libmp3lame",
            "-b:a", "128k",
            "-id3v2_version", "3",
            "-f", "mp3",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timer = setTimeout(() => {
            ffmpeg.kill("SIGKILL");
            reject(new Error("MP3 convert timeout වුණා."));
        }, 180000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timer);
            reject(err.code === "ENOENT" ? new Error("FFmpeg install කරලා නෑ.") : err);
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timer);

            const output = Buffer.concat(outputChunks);
            const errorText = Buffer.concat(errorChunks).toString("utf8");

            if (code !== 0) return reject(new Error(errorText || `FFmpeg failed: ${code}`));
            if (!output || output.length < 1000) return reject(new Error("MP3 output empty වුණා."));

            resolve(output);
        });

        ffmpeg.stdin.end(inputBuffer);
    });
}

async function sendPhoneSupportedMp3(client, m, song) {
    const rawAudioUrl = await yta(song.url);
    if (!rawAudioUrl) throw new Error("Audio download link එක ලැබුණේ නෑ.");

    const rawBuffer = await downloadToBuffer(rawAudioUrl);
    if (!rawBuffer || rawBuffer.length < 1000) throw new Error("Audio download failed.");

    const mp3Buffer = await convertToPhoneMp3(rawBuffer);
    const fileName = `${sanitizeFileName(song.title)}.mp3`;

    await conn.sendMessage(from, {
        audio: mp3Buffer,
        mimetype: "audio/mpeg",
        fileName,
        ptt: false
    }, { quoted: m });
}

cmd({
    name: "yts",
    fromMe: false,
    category: "youtube",
    desc: "Search in YouTube"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!args) return await m.reply(lang.NEED_Q || "Need a Query");

        if (await isUrl(args)) {
            const yt = await YtInfo(args);
            if (!yt) return await m.reply("❌ YouTube info ගන්න බැරි වුණා.");

            return await conn.sendMessage(from, {
                image: { url: yt.thumbnail },
                caption:
                    `*Title:* ${yt.title}\n` +
                    `*Author:* ${yt.author}\n` +
                    `*URL:* ${args}\n` +
                    `*Video ID:* ${yt.videoId}`
            }, { quoted: m });
        }

        const videos = await yts(args);

        if (!videos || !videos.length) {
            return await m.reply("❌ Result එකක් හමු වුණේ නෑ.");
        }

        const result = videos.slice(0, 10).map((video, i) => {
            return `${i + 1}. *${video.title}*\n⏱️ ${video.duration || "Unknown"}\n🔗 ${video.url}`;
        });

        return await m.reply(`_*Result Of ${args} 🔍*_\n\n` + result.join("\n\n"));
    } catch (err) {
        console.log("YTS error:", err);
        await m.reply("❌ YTS error:\n" + err.message);
    }
});

cmd({
    name: "ytv",
    fromMe: false,
    category: "youtube",
    desc: "YouTube video download"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        args = args || m.quoted?.text;

        if (!args) return await m.reply(lang.NEED_URL || "Need a YouTube URL");
        if (!await isUrl(args)) return await m.reply(lang.INVALID_LINK || "Invalid link");

        await m.react("⬇️");

        const url = await ytv(args);

        await conn.sendMessage(from, url, { quoted: m }, "video");

        await m.react("✅");
    } catch (error) {
        console.log("YTV error:", error);
        await m.react("❌");
        await m.reply("❌ YTV error:\n" + error.message);
    }
});

cmd({
    name: "yta",
    fromMe: false,
    category: "youtube",
    desc: "YouTube audio download"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        args = args || m.quoted?.text;

        if (!args) return await m.reply(lang.NEED_URL || "Need a YouTube URL");
        if (!await isUrl(args)) return await m.reply(lang.INVALID_LINK || "Invalid link");

        await m.react("⬇️");

        const song = {
            title: "YouTube Audio",
            url: args
        };

        await sendPhoneSupportedMp3(client, m, song);

        await m.react("✅");
    } catch (error) {
        console.log("YTA error:", error);
        await m.react("❌");
        await m.reply("❌ YTA error:\n" + error.message);
    }
});

async function songSearchHandler({ m, client, args }) {
    try {
        args = args || m.quoted?.text;

        if (!args) {
            return await m.reply("🎵 Song name එකක් දෙන්න.\n\nඋදා: .music mithaya myam");
        }

        await m.react("🔎");

        const results = await yts(args);
        const song = pickBestSong(results);

        if (!song || !song.url) {
            await m.react("❌");
            return await m.reply("❌ Song එක හොයාගන්න බැරි වුණා.");
        }

        await m.reply(
            `🎧 *${song.title}*\n` +
            `⏱️ ${song.duration || "Unknown"}\n\n` +
            `_Preparing phone supported MP3..._`
        );

        await m.react("⬇️");

        await sendPhoneSupportedMp3(client, m, song);

        await m.react("✅");
    } catch (error) {
        console.log("Song/Music error:", error);
        await m.react("❌");
        await m.reply("❌ Song/Music error:\n" + error.message);
    }
}

cmd({
    name: "song",
    fromMe: false,
    category: "youtube",
    desc: "Song name එකෙන් phone supported MP3 audio එකක් send කරන්න"
}, songSearchHandler);

cmd({
    name: "music",
    fromMe: false,
    category: "youtube",
    desc: "Song name එකෙන් phone supported MP3 audio එකක් send කරන්න"
}, songSearchHandler);
