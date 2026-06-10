const axios = require("axios");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { cmd } = require('../command');

const API_BASE_URL = "https://whiteshadow-x-api.onrender.com/api";
const API_TOKEN =
  process.env.WHITESHADOW_API_TOKEN ||
  process.env.YOUTUBE_API_TOKEN ||
  process.env.YT_API_TOKEN ||
  "VK4fry";
const VIDEO_QUALITY = process.env.YT_VIDEO_QUALITY || "720";
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || 120);
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const FFMPEG_CRF = process.env.YT_FFMPEG_CRF || "20";
const FFMPEG_PRESET = process.env.YT_FFMPEG_PRESET || "ultrafast";
const FFMPEG_MAX_HEIGHT = process.env.YT_FFMPEG_MAX_HEIGHT || "720";
const FFMPEG_MAXRATE = process.env.YT_FFMPEG_MAXRATE || "3500k";
const FFMPEG_BUFSIZE = process.env.YT_FFMPEG_BUFSIZE || "7000k";
const FFMPEG_AUDIO_BITRATE = process.env.YT_FFMPEG_AUDIO_BITRATE || "160k";

const AXIOS_JSON_CONFIG = {
  timeout: 60000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
  },
};

function getJid(m) {
  return from || m.chat || m.from || m.key?.remoteJid;
}

function getInputText(args, m) {
  let text = "";

  if (Array.isArray(args)) text = args.join(" ");
  else if (typeof args === "string") text = args;
  else if (m?.quoted?.text) text = m.quoted.text;
  else if (m?.text) text = m.text.replace(/^[./!#]video\s*/i, "");

  return text.replace(/^link\s*=\s*/i, "").trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isYouTubeUrl(value) {
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(
    String(value || "").trim()
  );
}

function extractYouTubeUrl(text) {
  const match = String(text || "").match(
    /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s]+)/i
  );

  if (match?.[1]) return match[1].trim();
  return isYouTubeUrl(text) ? String(text).trim() : "";
}

function isImageUrl(value) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(String(value || ""));
}

function getStringByKeys(node, keys) {
  if (!node || typeof node !== "object") return "";

  for (const key of Object.keys(node)) {
    if (
      keys.some((wanted) => wanted.toLowerCase() === key.toLowerCase()) &&
      typeof node[key] === "string" &&
      node[key].trim()
    ) {
      return node[key].trim();
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = getStringByKeys(value, keys);
      if (found) return found;
    }
  }

  return "";
}

function findFirstYouTubeResult(node) {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstYouTubeResult(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;

  const rawUrl =
    node.url ||
    node.link ||
    node.videoUrl ||
    node.video_url ||
    node.webpage_url ||
    node.href;
  const url = rawUrl ? extractYouTubeUrl(rawUrl) : "";
  const rawId = node.videoId || node.video_id || node.id;
  const id = typeof rawId === "string" ? rawId.trim() : "";

  if (url || /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return {
      url: url || `https://youtu.be/${id}`,
      title:
        node.title ||
        node.name ||
        node.videoTitle ||
        node.video_title ||
        "YouTube Video",
      duration: node.duration || node.timestamp || node.length || "",
      channel:
        node.channel ||
        node.author ||
        node.uploader ||
        node.ownerChannelName ||
        "",
    };
  }

  for (const value of Object.values(node)) {
    const found = findFirstYouTubeResult(value);
    if (found) return found;
  }

  return null;
}

function collectUrls(node, pathParts = [], urls = []) {
  if (!node) return urls;

  if (typeof node === "string") {
    const trimmed = node.trim();
    if (isHttpUrl(trimmed)) urls.push({ url: trimmed, path: pathParts.join(".") });
    return urls;
  }

  if (Array.isArray(node)) {
    node.forEach((value, index) =>
      collectUrls(value, [...pathParts, index], urls)
    );
    return urls;
  }

  if (typeof node === "object") {
    Object.entries(node).forEach(([key, value]) =>
      collectUrls(value, [...pathParts, key], urls)
    );
  }

  return urls;
}

function pickDirectVideoUrl(data) {
  const urls = collectUrls(data)
    .map((item) => {
      const itemPath = item.path.toLowerCase();
      const url = item.url;
      let score = 0;

      if (/download|dl|direct/.test(itemPath)) score += 8;
      if (/mp4|video|media|file|url|link/.test(itemPath)) score += 5;
      if (/\.mp4(\?|$)|videoplayback|googlevideo|ytmp4|download/i.test(url)) {
        score += 8;
      }
      if (isYouTubeUrl(url)) score -= 20;
      if (/thumbnail|thumb|image|cover|avatar/.test(itemPath) || isImageUrl(url)) {
        score -= 20;
      }

      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return urls[0]?.url || "";
}

function safeFileName(title) {
  return (
    String(title || "youtube-video")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "youtube-video"
  );
}

function getFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    // Optional dependency. The GitHub Actions runner can also provide ffmpeg.
  }

  try {
    const staticPath = require("ffmpeg-static");
    if (staticPath) return staticPath;
  } catch {
    // Optional dependency.
  }

  return "ffmpeg";
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 6000) stderr = stderr.slice(-6000);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function makePhoneCompatibleMp4(inputBuffer) {
  const ffmpegPath = getFfmpegPath();
  const tempRoot = process.env.VIDEO_TMP_DIR || os.tmpdir();
  const tempDir = path.join(
    tempRoot,
    `sadew-video-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`
  );
  const inputPath = path.join(tempDir, "input.mp4");
  const outputPath = path.join(tempDir, "phone-compatible.mp4");

  await fsp.mkdir(tempDir, { recursive: true });

  try {
    await fsp.writeFile(inputPath, inputBuffer);

    await runProcess(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      FFMPEG_PRESET,
      "-crf",
      FFMPEG_CRF,
      "-maxrate",
      FFMPEG_MAXRATE,
      "-bufsize",
      FFMPEG_BUFSIZE,
      "-pix_fmt",
      "yuv420p",
      "-vf",
      `scale=-2:min(${FFMPEG_MAX_HEIGHT}\\,ih),fps=30,format=yuv420p`,
      "-profile:v",
      "main",
      "-level",
      "3.1",
      "-c:a",
      "aac",
      "-b:a",
      FFMPEG_AUDIO_BITRATE,
      "-movflags",
      "+faststart",
      "-max_muxing_queue_size",
      "1024",
      outputPath,
    ]);

    const outputBuffer = await fsp.readFile(outputPath);
    if (!outputBuffer.length) throw new Error("ffmpeg output file is empty");

    return outputBuffer;
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function sendText(m, client, text) {
  const jid = getJid(m);

  if (typeof m.reply === "function") return m.reply(text);
  if (typeof m.sendMsg === "function") return m.sendMsg(jid, text, { quoted: m });
  if (typeof client?.sendMessage === "function") {
    return conn.sendMessage(jid, { text }, { quoted: m });
  }

  throw new Error("Message send method not found");
}

async function sendVideo(m, client, buffer, caption, fileName) {
  const jid = getJid(m);
  const payload = {
    video: buffer,
    mimetype: "video/mp4",
    caption,
    fileName,
    gifPlayback: false,
    ptv: false,
  };

  if (typeof client?.sendMessage === "function") {
    return conn.sendMessage(jid, payload, { quoted: m });
  }
  if (typeof m.sendMsg === "function") {
    return m.sendMsg(jid, payload, { quoted: m });
  }

  throw new Error("Video send method not found");
}

async function searchYouTube(query) {
  const { data } = await axios.get(`${API_BASE_URL}/search/yt`, {
    ...AXIOS_JSON_CONFIG,
    params: {
      q: query,
      apitoken: API_TOKEN,
    },
  });

  const result = findFirstYouTubeResult(data);
  if (!result?.url) throw new Error("YouTube search result not found");

  return result;
}

async function getDownloadInfo(url) {
  const { data } = await axios.get(`${API_BASE_URL}/download/ytmp4`, {
    ...AXIOS_JSON_CONFIG,
    params: {
      url,
      quality: VIDEO_QUALITY,
      apitoken: API_TOKEN,
    },
  });

  const directUrl = pickDirectVideoUrl(data);
  if (!directUrl) throw new Error("Download link not found from API");

  return {
    directUrl,
    title: getStringByKeys(data, ["title", "name", "videoTitle"]) || "",
  };
}

async function downloadVideoBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      Accept: "video/mp4,video/*,*/*",
    },
  });

  return Buffer.from(response.data);
}

cmd(
  {
    name: "video",
    fromMe: false,
    category: "downloader",
    desc: "Download YouTube video in phone supported HD MP4. Use .video <link or search text>",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const input = getInputText(args, m);

    if (!input) {
      return sendText(
        m,
        client,
        "Use karanna: .video <YouTube link / search text>\n\nExample:\n.video kudda\n.video link=https://youtu.be/dQw4w9WgXcQ"
      );
    }

    try {
      let videoUrl = extractYouTubeUrl(input);
      let title = "YouTube Video";
      let channel = "";
      let duration = "";

      if (!videoUrl) {
        await sendText(m, client, `Search karanawa: ${input}`);
        const result = await searchYouTube(input);
        videoUrl = result.url;
        title = result.title || title;
        channel = result.channel || "";
        duration = result.duration || "";
      }

      await sendText(m, client, `HD video eka download karanawa...\n${title}`);

      const downloadInfo = await getDownloadInfo(videoUrl);
      if (downloadInfo.title) title = downloadInfo.title;

      const downloadedBuffer = await downloadVideoBuffer(downloadInfo.directUrl);
      if (!downloadedBuffer.length) {
        throw new Error("Downloaded video buffer is empty");
      }

      await sendText(
        m,
        client,
        "Phone support HD MP4 format ekata hadanawa..."
      );

      const compatibleBuffer = await makePhoneCompatibleMp4(downloadedBuffer);
      if (!compatibleBuffer.length) {
        throw new Error("Compatible video buffer is empty");
      }

      if (compatibleBuffer.length > MAX_VIDEO_BYTES) {
        return sendText(
          m,
          client,
          `Video eka loku wadi (${Math.round(
            compatibleBuffer.length / 1024 / 1024
          )}MB). WhatsApp/GitHub Actions limit eka pass wenna puluwan.\n\nDirect link:\n${downloadInfo.directUrl}`
        );
      }

      const details = [
        `Title: ${title}`,
        channel ? `Channel: ${channel}` : "",
        duration ? `Duration: ${duration}` : "",
        `Quality: HD ${VIDEO_QUALITY}p`,
        "Format: MP4 / H.264 / AAC",
        "",
        "Powered by Sadew Rashmika",
      ]
        .filter(Boolean)
        .join("\n");

      await sendVideo(
        m,
        client,
        compatibleBuffer,
        details,
        `${safeFileName(title)}-${VIDEO_QUALITY}p.mp4`
      );
    } catch (error) {
      console.error("video command error:", error);
      return sendText(
        m,
        client,
        `Video eka download karanna bari una.\nReason: ${
          error?.response?.data?.message || error.message || "Unknown error"
        }`
      );
    }
  }
);
