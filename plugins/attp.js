const { cmd } = require('../command');
const { spawn } = require("child_process");

const ffmpegBin = "ffmpeg";

function getArgsText(args, m) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();

    return (
        m.quoted?.text ||
        m.text?.replace(/^[./!#]attp\s*/i, "") ||
        m.body?.replace(/^[./!#]attp\s*/i, "") ||
        ""
    ).trim();
}

function escapeXml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getFontSize(text) {
    if (text.length <= 6) return 74;
    if (text.length <= 10) return 62;
    if (text.length <= 16) return 50;
    if (text.length <= 24) return 40;
    return 32;
}

async function makeFrame(text, index, totalFrames) {
    const sharp = require("sharp");

    const colors = ["#ff1744", "#ffea00", "#00e676", "#00b0ff", "#d500f9", "#ff9100"];
    const color = colors[index % colors.length];
    const shadow = colors[(index + 2) % colors.length];
    const fontSize = getFontSize(text);
    const safeText = escapeXml(text);

    const angle = (index / totalFrames) * Math.PI * 2;
    const y = 256 + Math.sin(angle) * 35;
    const scale = 1 + Math.sin(angle) * 0.08;

    const svg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="none"/>
  <g transform="translate(256 ${y}) scale(${scale})">
    <text x="0" y="0"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="900"
      stroke="${shadow}"
      stroke-width="10"
      paint-order="stroke"
      fill="${color}">${safeText}</text>
    <text x="0" y="0"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="900"
      stroke="#ffffff"
      stroke-width="3"
      paint-order="stroke"
      fill="${color}">${safeText}</text>
  </g>
</svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function createAttpSticker(text) {
    const totalFrames = 24;
    const frames = [];

    for (let i = 0; i < totalFrames; i++) {
        frames.push(await makeFrame(text, i, totalFrames));
    }

    return new Promise((resolve, reject) => {
        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-f", "image2pipe",
            "-framerate", "12",
            "-vcodec", "png",
            "-i", "pipe:0",
            "-loop", "0",
            "-vf", "scale=512:512:flags=lanczos,format=rgba",
            "-lossless", "0",
            "-compression_level", "6",
            "-q:v", "60",
            "-f", "webp",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timeout = setTimeout(() => {
            ffmpeg.kill("SIGKILL");
            reject(new Error("ATTP render timeout වුණා."));
        }, 60 * 1000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timeout);
            reject(err.code === "ENOENT" ? new Error("FFmpeg install කරලා නෑ.") : err);
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timeout);

            const output = Buffer.concat(outputChunks);
            const errorText = Buffer.concat(errorChunks).toString("utf8");

            if (code !== 0) {
                reject(new Error(errorText || `FFmpeg failed with code ${code}`));
                return;
            }

            if (!output || output.length < 1000) {
                reject(new Error("Sticker output එක empty වුණා. FFmpeg WebP encoder check කරන්න."));
                return;
            }

            resolve(output);
        });

        for (const frame of frames) {
            ffmpeg.stdin.write(frame);
        }

        ffmpeg.stdin.end();
    });
}

cmd({
    name: "attp",
    alias: ["ttp", "animatedtext"],
    category: "tools",
    fromMe: false,
    desc: "Text එක animated color sticker එකක් බවට convert කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        const text = getArgsText(args, m);

        if (!text) {
            return await m.reply("✍️ Text එකක් දෙන්න මචං.\n\nඋදා:\n.attp sadew");
        }

        if (text.length > 35) {
            return await m.reply("❌ Text එක දිග වැඩියි මචං. characters 35 ට අඩුවෙන් දෙන්න.");
        }

        await m.react("🎨");

        const stickerBuffer = await createAttpSticker(text);

        await conn.sendMessage(from, {
            sticker: stickerBuffer
        }, { quoted: m });

        await m.react("✅");
    } catch (err) {
        console.log("ATTP command error:", err);
        await m.react("❌");
        await m.reply("❌ ATTP sticker එක හදාගන්න බැරි වුණා මචං.\n\nහේතුව: " + err.message);
    }
});
