const { cmd } = require('../command');
const axios = require("axios");

function getArgsText(args, m) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();

    return (
        m.text?.replace(/^[./!#](dl|download)\s*/i, "") ||
        m.body?.replace(/^[./!#](dl|download)\s*/i, "") ||
        m.quoted?.text ||
        ""
    ).trim();
}

function extractUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s]+/i);
    return match ? match[0] : "";
}

function formatSize(bytes) {
    bytes = Number(bytes || 0);
    if (!bytes) return "Unknown";
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(2)} KB`;
}

function sanitizeFileName(name) {
    return String(name || "download_file")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}

function getFileInfo(url, contentType = "") {
    const cleanUrl = url.split("?")[0].toLowerCase();
    const ct = contentType.toLowerCase();

    if (ct.includes("video") || /\.(mp4|mkv|avi|mov|webm)$/.test(cleanUrl)) {
        return { mimetype: "video/mp4", ext: "mp4" };
    }

    if (ct.includes("audio") || /\.(mp3|m4a|ogg|wav|aac)$/.test(cleanUrl)) {
        return { mimetype: "audio/mpeg", ext: "mp3" };
    }

    if (ct.includes("image") || /\.(jpg|jpeg|png|webp)$/.test(cleanUrl)) {
        return { mimetype: "image/jpeg", ext: "jpg" };
    }

    if (ct.includes("pdf") || cleanUrl.endsWith(".pdf")) {
        return { mimetype: "application/pdf", ext: "pdf" };
    }

    if (/\.(zip|rar|7z)$/.test(cleanUrl)) {
        return { mimetype: "application/zip", ext: "zip" };
    }

    return { mimetype: "application/octet-stream", ext: "bin" };
}

function getNameFromUrl(url) {
    try {
        const parsed = new URL(url);
        const last = parsed.pathname.split("/").filter(Boolean).pop();
        return last ? decodeURIComponent(last) : "download_file";
    } catch {
        return "download_file";
    }
}

async function getRemoteFileMeta(url) {
    let fileSize = 0;
    let fileName = getNameFromUrl(url);
    let contentType = "";

    try {
        const res = await axios.head(url, {
            timeout: 15000,
            maxRedirects: 5,
            headers: { "User-Agent": "Mozilla/5.0" },
            validateStatus: (status) => status >= 200 && status < 400
        });

        fileSize = Number(res.headers["content-length"] || 0);
        contentType = String(res.headers["content-type"] || "");

        const cd = String(res.headers["content-disposition"] || "");
        const match = cd.match(/filename\*?=(?:UTF-8''|["']?)([^"';\n]+)/i);
        if (match?.[1]) fileName = decodeURIComponent(match[1].replace(/["']/g, ""));
    } catch {
        // Some servers block HEAD. Direct send can still work.
    }

    const fileInfo = getFileInfo(url, contentType);
    fileName = sanitizeFileName(fileName);

    if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) {
        fileName = `${fileName}.${fileInfo.ext}`;
    }

    return { fileSize, fileName, ...fileInfo };
}

async function directDownloadHandler({ client, m, args }) {
    try {
        const input = getArgsText(args, m);
        const url = extractUrl(input);

        if (!url) {
            return await m.reply(
                "❌ Valid direct URL එකක් දෙන්න.\n\n" +
                "උදා:\n.dl https://example.com/file.mp4"
            );
        }

        await m.react?.("⬇️");

        const meta = await getRemoteFileMeta(url);

        if (meta.fileSize > 1950 * 1024 * 1024) {
            await m.react?.("❌");
            return await m.reply(
                `❌ File එක 2GB වලට වඩා ලොකුයි.\n\nSize: ${formatSize(meta.fileSize)}`
            );
        }

        await m.reply(
            `⬇️ *Direct Download Started*\n\n` +
            `📄 File: ${meta.fileName}\n` +
            `📦 Size: ${formatSize(meta.fileSize)}\n\n` +
            `_WhatsApp upload වෙන්න ටිකක් වෙලා යන්න පුළුවන්._`
        );

        await conn.sendMessage(from, {
            document: { url },
            mimetype: meta.mimetype,
            fileName: meta.fileName,
            caption:
                `✅ *Download Complete*\n\n` +
                `📄 ${meta.fileName}\n` +
                `📦 ${formatSize(meta.fileSize)}`
        }, { quoted: m });

        await m.react?.("✅");
    } catch (err) {
        console.log("Direct DL error:", err);
        await m.react?.("❌");

        await m.reply(
            "❌ Download failed මචං.\n\n" +
            "හේතුව: " + err.message + "\n\n" +
            "Link එක expire වෙලා, private වෙලා, නැත්නම් server එක WhatsApp upload block කරනවා වෙන්න පුළුවන්."
        );
    }
}

cmd({
    name: "dl",
    category: "downloader",
    fromMe: false,
    desc: "Direct URL එකක file එක WhatsApp document එකක් විදිහට send කරන්න"
}, directDownloadHandler);

cmd({
    name: "download",
    category: "downloader",
    fromMe: false,
    desc: "Direct URL downloader"
}, directDownloadHandler);
