const { cmd } = require('../command');
const { getString, isUrl } = require("./pluginsCore");
const axios = require("axios");

const lang = getString("download") || {};

const TIKWM_API = "https://www.tikwm.com/api/";
const MAX_IMAGES = Number(process.env.TIKTOK_PHOTO_LIMIT || 25);
const API_TIMEOUT = 20000;
const MEDIA_TIMEOUT = 60000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function extractUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s]+/i);
    return match ? match[0].replace(/[),.]+$/, "") : "";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTikwmUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `https://www.tikwm.com${path.startsWith("/") ? "" : "/"}${path}`;
}

function pickImages(data) {
    const imageSet = new Set();
    const root = data?.data || data?.result || data || {};

    const directLists = [
        root.images,
        root.image_post?.images,
        root.imagePost?.images,
        root.photos,
        root.pictures
    ];

    for (const list of directLists) {
        if (!Array.isArray(list)) continue;

        for (const item of list) {
            if (typeof item === "string") {
                imageSet.add(buildTikwmUrl(item));
            } else if (item && typeof item === "object") {
                const url = item.url || item.image_url || item.display_image || item.origin_image || item.download_url;
                if (url) imageSet.add(buildTikwmUrl(url));
            }
        }
    }

    if (!imageSet.size) {
        const fallbackImages = [
            root.cover,
            root.origin_cover,
            root.dynamic_cover,
            root.ai_dynamic_cover,
            root.author?.avatar,
            root.author?.avatar_thumb
        ];

        for (const item of fallbackImages) {
            if (item) imageSet.add(buildTikwmUrl(item));
        }
    }

    return [...imageSet].filter(Boolean);
}

async function fetchTikwmData(tiktokUrl) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await axios.get(TIKWM_API, {
                timeout: API_TIMEOUT,
                maxRedirects: 8,
                params: {
                    url: tiktokUrl,
                    hd: 1
                },
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Referer": "https://www.tikwm.com/"
                },
                validateStatus: (status) => status >= 200 && status < 500
            });

            if (res.status >= 400) {
                throw new Error(`TikWM HTTP ${res.status}`);
            }

            const body = res.data;
            const code = Number(body?.code ?? body?.status ?? 0);
            const message = body?.msg || body?.message || "";

            if (code !== 0 && code !== 200) {
                throw new Error(message || `TikWM code ${code}`);
            }

            return body;
        } catch (err) {
            lastError = err;

            // TikTok short links sometimes need a few seconds before downloader APIs can read them.
            if (attempt < 3) await sleep(attempt * 2500);
        }
    }

    throw lastError || new Error("TikWM API failed");
}

async function downloadImage(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: MEDIA_TIMEOUT,
        maxRedirects: 12,
        maxContentLength: MAX_IMAGE_BYTES,
        maxBodyLength: MAX_IMAGE_BYTES,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Referer": "https://www.tiktok.com/"
        },
        validateStatus: (status) => status >= 200 && status < 400
    });

    const buffer = Buffer.from(res.data || []);
    if (!buffer.length) throw new Error("Image buffer empty");
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image file too large");

    return buffer;
}

async function sendTikTokPhotos(client, m, images, title) {
    const total = Math.min(images.length, MAX_IMAGES);

    for (let i = 0; i < total; i++) {
        const imageUrl = images[i];
        const buffer = await downloadImage(imageUrl);
        const caption =
            i === 0
                ? `TikTok photo download complete\nImages: ${total}${images.length > total ? `/${images.length}` : ""}\nWatermark: removed\n\n${title || ""}`.trim()
                : undefined;

        await conn.sendMessage(from, {
            image: buffer,
            mimetype: "image/jpeg",
            caption
        }, { quoted: m });

        if (i + 1 < total) await sleep(650);
    }
}

async function ttPhotoHandler({ m, client, args }) {
    try {
        args = args || m.quoted?.text || "";

        const tiktokUrl = extractUrl(args);

        if (!tiktokUrl) {
            return await m.reply(
                "TikTok photo/slideshow link ekak denna.\n\n" +
                "Example:\n.tp https://www.tiktok.com/@user/photo/1234567890\n" +
                ".ttphoto https://vt.tiktok.com/xxxx/"
            );
        }

        if (!await isUrl(tiktokUrl)) {
            return await m.reply(lang.INVALID_LINK || "Invalid link");
        }

        if (!/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(tiktokUrl)) {
            return await m.reply("Me command eka TikTok link walata witharai.");
        }

        await m.react("🔎");
        await m.reply("TikTok photo prepare karanawa...\nWatermark nathi image tika RAM buffer walata download karanawa.");

        const result = await fetchTikwmData(tiktokUrl);
        const root = result?.data || {};
        const images = pickImages(result);

        if (!images.length) {
            await m.react("❌");
            return await m.reply("Photo list eka hambune na. Me link eka video ekak nam .timg command eka use karanna.");
        }

        await m.react("⬇️");
        await sendTikTokPhotos(client, m, images, root.title || "TikTok Photo");
        await m.react("✅");
    } catch (err) {
        console.log("TikTok photo error:", err);
        await m.react("❌");
        await m.reply("TikTok photo download error:\n" + (err.message || err));
    }
}

cmd({
    name: "tp",
    fromMe: false,
    category: "tiktok",
    desc: "TikTok photo/slideshow images download without watermark"
}, ttPhotoHandler);

cmd({
    name: "ttphoto",
    fromMe: false,
    category: "tiktok",
    desc: "TikTok photo/slideshow images download without watermark"
}, ttPhotoHandler);

cmd({
    name: "ttimg",
    fromMe: false,
    category: "tiktok",
    desc: "TikTok photo/slideshow images download without watermark"
}, ttPhotoHandler);
