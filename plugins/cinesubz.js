const { cmd } = require('../command');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const axios = require('axios');

// ── Helper: message text ඕනෑම type එකෙන් ලබා ගැනීම ──────────────
const getMsgText = (m) =>
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.buttonsResponseMessage?.selectedButtonId ||
    m?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m?.message?.imageMessage?.caption ||
    m?.message?.videoMessage?.caption ||
    "";

// ── Helper: reply කළ message ID ලබා ගැනීම ───────────────────────
const getQuotedId = (m) =>
    m?.message?.extendedTextMessage?.contextInfo?.stanzaId ||
    m?.message?.buttonsResponseMessage?.contextInfo?.stanzaId ||
    null;

const BOT_NAME = "WHITESHADOW-MD";
const makeQuote = (id) => ({
    key: {
        remoteJid  : "status@broadcast",
        participant: "0@s.whatsapp.net",
        fromMe     : false,
        id,
    },
    message: {
        contactMessage: {
            displayName: BOT_NAME,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME}\nORG:Cinesubz\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD`,
        },
    },
});

// =============================================
// CINESUBZ SEARCH  →  .cz / .cinesubz
// =============================================
cmd(
    {
        pattern: /(cz|cinesubz) ?(.*)/i,
        fromMe: false,
        desc: "Cinesubz Movie Search",
        type: "downloader",
    },
    async (msg, match) => {
        const socket = msg.client;
        const sender = msg.jid;
        const query  = match[2]?.trim();

        if (!query) {
            return socket.sendMessage(sender,
                { text: "🎬 *Movie නම දෙන්න!*\n_උදා: .cz batman_" },
                { quoted: msg }
            );
        }

        try {
            await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

            // 1. Search
            const res  = await fetch(`https://cinesubz-api-cnw.vercel.app/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (!data.status || !data.data?.length) {
                return socket.sendMessage(sender,
                    { text: "❌ *ඒ නමින් Movies හමු නොවූණා.*" },
                    { quoted: msg }
                );
            }

            const results = data.data.slice(0, 10);

            // 2. List text
            let listText = `🎬 *CINESUBZ SEARCH*\n🔍 *Keywords:* ${query}\n\n`;
            results.forEach((mv, i) => {
                listText += `*${i + 1}.* ${mv.title} _(${mv.year || "?"})_\n`;
            });
            listText += `\n_Reply with 1 - ${results.length} to select_`;

            const listMsg = await socket.sendMessage(sender,
                { text: listText },
                { quoted: makeQuote("CZ_LIST_" + Date.now()) }
            );

            const listMsgId = listMsg.key.id;

            // 3. Reply listener — prefix නැතිව plain number reply ද catch කරනවා
            const listener = async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
                const replyMsg = messages[0];
                if (!reply?.message) return;

                // reply sender ම check කරනවා (group chat වල වෙනත් කෙනෙකුගේ reply block)
                const replySender = replyMsg.key.remoteJid;
                if (replySender !== sender) return;

                // quoted message ID check — extendedText හෝ buttonsResponse දෙකෙන්ම
                const quotedId = getQuotedId(reply);
                if (quotedId !== listMsgId) return;

                // Text ලබා ගැනීම
                const raw = getMsgText(reply)?.trim();
                const idx = parseInt(raw) - 1;

                if (isNaN(idx) || idx < 0 || idx >= results.length) {
                    return socket.sendMessage(sender,
                        { text: "❌ *1 සිට " + results.length + " දක්වා නිවැරදි අංකයක් Reply කරන්න.*" },
                        { quoted: reply }
                    );
                }

                // Listener ඉවත් කිරීම
                socket.ev.off("messages.upsert", listener);

                const movie = results[idx];

                try {
                    await socket.sendMessage(sender, { react: { text: "🎬", key: replyMsg.key } });

                    // 4. Extract links
                    const extRes  = await fetch(`https://cinesubz-api-cnw.vercel.app/api/extract?id=${movie.id}&type=mv`);
                    const extData = await extRes.json();

                    if (!extData.status || !extData.data?.length) {
                        return socket.sendMessage(sender,
                            { text: "❌ *Direct Links ලබා ගැනීමට නොහැකිවිය.*" },
                            { quoted: reply }
                        );
                    }

                    const direct   = extData.data.find(v => v.is_direct_mp4) || extData.data[0];
                    const baseLink = direct.link;

                    const shortTitle = movie.title
                        .substring(0, 20)
                        .replace(/[^a-zA-Z0-9 ]/g, "")
                        .trim();

                    const caption =
                        `🎬 *${movie.title}*\n\n` +
                        `📅 *Year:* ${movie.year || "N/A"}\n` +
                        `🎭 *Genres:* ${movie.genres || "N/A"}\n` +
                        `⭐ *IMDB:* ${movie.imdb || "N/A"}\n\n` +
                        `> *Quality select කරන්න* ⬇️`;

                    const buttons = [
                        {
                            buttonId : `cz_dl ${shortTitle} || 480p || ${baseLink}`,
                            buttonText: { displayText: "🎥 480p (SD)" },
                            type: 1,
                        },
                        {
                            buttonId : `cz_dl ${shortTitle} || 720p || ${baseLink}`,
                            buttonText: { displayText: "🎥 720p (HD)" },
                            type: 1,
                        },
                    ];

                    await socket.sendMessage(sender,
                        {
                            image     : { url: movie.img },
                            caption,
                            footer    : "Whiteshadow MD | Cinesubz",
                            buttons,
                            headerType: 4,
                        },
                        { quoted: makeQuote("CZ_DETAIL_" + Date.now()) }
                    );

                } catch (e) {
                    console.error("[CZ] Detail error:", e.message);
                    socket.sendMessage(sender,
                        { text: "❌ *Movie details ලබා ගැනීමේ Error!*" },
                        { quoted: reply }
                    );
                }
            };

            socket.ev.on("messages.upsert", listener);
            // 90s ට listener remove
            setTimeout(() => socket.ev.off("messages.upsert", listener), 90_000);

        } catch (e) {
            console.error("[CZ] Search error:", e.message);
            socket.sendMessage(sender,
                { text: "❌ *Search Error. පසුව නැවත උත්සාහ කරන්න.*" },
                { quoted: msg }
            );
        }
    }
);

// =============================================
// CINESUBZ DOWNLOAD  →  cz_dl (button callback)
// Note: button ID prefix dot නැහැ — Baileys button IDs
//       dot strip කරන නිසා "cz_dl ..." විදිහට ලිවීම හරිම.
// =============================================
cmd(
    {
        pattern: /^cz_dl (.*)/i,
        fromMe: false,
        desc: "Cinesubz Download Handler",
        type: "downloader",
    },
    async (msg, match) => {
        const socket = msg.client;
        const sender = msg.jid;

        // Button callback text
        const raw = getMsgText(msg)?.replace(/^[.\/!#]?cz_dl\s*/i, "").trim() || match[1]?.trim() || "";

        if (!raw.includes("||")) return;

        const parts = raw.split(" || ");
        if (parts.length < 3) return;

        const [title, quality, originalUrl] = parts;

        try {
            await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
            await socket.sendMessage(sender,
                {
                    text:
                        `⬇️ *Downloading ${title} (${quality})...*\n` +
                        `_විශාල file නිසා upload වෙන්නට ටිකක් time යාවි._`,
                },
                { quoted: makeQuote("CZ_DL_START") }
            );

            // Quality URL fix
            let finalUrl = originalUrl;
            if (quality === "480p") {
                finalUrl = originalUrl.replace(/(1080p?|720p?)/i, "480p");
            } else if (quality === "720p") {
                finalUrl = originalUrl.replace(/(1080p?|480p?)/i, "720p");
            }

            // Size check
            try {
                const head   = await axios.head(finalUrl, { timeout: 10_000 });
                const cl     = head.headers?.["content-length"];
                if (cl) {
                    const sizeMB = parseInt(cl) / (1024 * 1024);
                    if (sizeMB > 1950) {
                        await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                        return socket.sendMessage(sender,
                            {
                                text:
                                    `❌ *File 2GB ට වඩා විශාලයි! (${sizeMB.toFixed(2)} MB)*\n` +
                                    `WhatsApp හරහා send කළ නොහැක.`,
                            },
                            { quoted: msg }
                        );
                    }
                }
            } catch (_) {
                console.log("[CZ DL] Size check skipped.");
            }

            // Send
            await socket.sendMessage(sender,
                {
                    document : { url: finalUrl },
                    mimetype : "video/mp4",
                    fileName : `${title} - ${quality}.mp4`,
                    caption  : `🎬 *${title}* [${quality}]\n\n> **𝕨𝕙𝕚𝕥𝕖𝕤𝕙𝕒𝕕𝕠𝕨-𝕞𝕕 ✨**`,
                },
                { quoted: makeQuote("CZ_DL_END") }
            );

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.error("[CZ DL] Error:", e.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            socket.sendMessage(sender,
                { text: "❌ *Download Failed! Link expire වී ඇත.*" },
                { quoted: msg }
            );
        }
    }
);
