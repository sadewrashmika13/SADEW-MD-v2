/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  🛡️  SADEW MD — ANTI-CRASH PLUGIN  v6             ║
 * ║  xbetainvis · Xdelay · CallCrash · DelayInvis            ║
 * ║  v6: correct sender · bot menu safe · zero false positive║
 * ╚═══════════════════════════════════════════════════════════╝
 */

'use strict';

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════
const CFG = {
    BLOCK_AFTER         : 1,       // instant block on first confirmed attack

    // ── text field limits ──
    MAX_TEXT_LEN        : 50000,   // raised — bot menus can be large
    MAX_REPEAT_RATIO    : 0.90,    // raised — box drawing chars safe now
    REPEAT_MIN_LEN      : 200,     // only check longer texts

    // ── byte-level limits ──
    MAX_NULL_BYTES      : 400,
    MAX_NEWLINE_BYTES   : 800,     // raised — long menus have many \n
    MAX_INVIS_CHARS     : 350,

    // ── structural limits ──
    MAX_MENTIONS        : 300,
    MAX_PARAMS_JSON_LEN : 5000,
    MAX_RAW_BYTES       : 950_000,

    // ── escaped-char limits (raw JSON) ──
    MAX_ESCAPED_NULL    : 300,
    MAX_ESCAPED_INVIS   : 200,
    MAX_ESCAPED_NEWLINE : 600,     // raised — bot menus have many \n in raw

    // ── actions ──
    AUTO_DELETE         : true,
    AUTO_BLOCK          : true,
    NOTIFY_OWNER        : true,
    LOG_ATTACKS         : true,

    EXEMPT_USERS        : [],
    EXEMPT_GROUPS       : [],
};

// ═══════════════════════════════════════════════════════════
//  SAFE JID PREFIXES — never flagged
//  120363 = WhatsApp Newsletters / Channels / Business
// ═══════════════════════════════════════════════════════════
const SAFE_JID_PREFIXES = [
    '120363',   // WhatsApp Newsletters & Channels
    '0@s',      // WA system messages
    'status@',  // Status broadcast
];

// ═══════════════════════════════════════════════════════════
//  SAFE UNICODE RANGES — normal text, never attack vectors
//  Box drawing, mathematical alphanumerics, enclosed chars,
//  arrows, decorative symbols used in bot menus
// ═══════════════════════════════════════════════════════════
//  U+2500–U+257F  Box Drawing       (─│╭╰═┃ etc.)
//  U+2580–U+259F  Block Elements
//  U+25A0–U+25FF  Geometric Shapes
//  U+2600–U+26FF  Misc Symbols      (❃ ✦ ★ etc.)
//  U+2700–U+27BF  Dingbats
//  U+1D400–U+1D7FF Math Alphanumeric (𝙱𝙸𝙽𝙶 𝚃𝙾𝙺𝙴𝙽 etc.)
//  U+1F300–U+1FFFF Emoji / Symbols
//  Sinhala, Tamil, Arabic, Devanagari (normal scripts)
const SAFE_UNICODE_RE = /[\u2500-\u27BF\u2E80-\u2EFF\u3000-\u303F]|[\uD835]|[\u0D80-\u0DFF\u0B80-\u0BFF\u0600-\u06FF\u0900-\u097F]/;

// ═══════════════════════════════════════════════════════════
//  SAFE MESSAGE TYPES — skip detection entirely
// ═══════════════════════════════════════════════════════════
const SAFE_TYPES = new Set([
    'senderKeyDistributionMessage',
    'protocolMessage',
    'messageContextInfo',
    'contactMessage',
    'contactsArrayMessage',
    'reactionMessage',
    'keepInChatMessage',
    'pinInChatMessage',
    'editedMessage',
    'newsletterAdminInviteMessage',
    'newsletterReactionMessage',
]);

// ═══════════════════════════════════════════════════════════
//  INVISIBLE / ZERO-WIDTH CHAR REGEX
// ═══════════════════════════════════════════════════════════
const INVIS_RE       = /[\u200B\u200C\u200D\u200E\u200F\u2060\u2061\u2062\u2063\u2064\uFEFF\u180E\u00AD]/g;
const LINESEP_RE     = /[\u2028\u2029]/g;
const BALINESE_RE    = /[\u1B61-\u1B7C\uA980-\uA9CD]/g;
const HANGUL_FILL_RE = /[\u115F\u1160\u3164\uFFA0]/g;

// ═══════════════════════════════════════════════════════════
//  ATTACK PATTERNS
// ═══════════════════════════════════════════════════════════
const ATTACK_PATTERNS = [
    // xbetainvis: null flood inside paramsJson / state
    /("paramsJson"\s*:\s*"[^"]*)\u0000{100,}/,
    /("state"\s*:\s*"[^"]*)\u0000{100,}/,

    // Xdelay stage 1: newline flood inside paramsJson (250K \n)
    /("paramsJson"\s*:\s*"[^"]*)\\n{500,}/,

    // Xdelay stage 2: mention bomb (300+ JIDs in array)
    /"mentionedJid"\s*:\s*\[(\s*"[^"]+"\s*,\s*){300,}/,

    // Xdelay stage 3: oversized paramsJson string
    /"paramsJson"\s*:\s*"[^"]{50000,}"/,

    // groupStatusMessageV2 / nativeFlowResponse exploit
    /"groupStatusMessageV2"[^}]{0,500}"paramsJson"\s*:\s*"[^"]{800,}"/,
    /"nativeFlowResponseMessage"[^}]{0,200}"paramsJson"\s*:\s*"[^"]{800,}"/,
    /"interactiveResponseMessage"[^}]{0,300}"paramsJson"\s*:\s*"[^"]{800,}"/,

    // buttonParamsJson overflow
    /"buttonParamsJson"\s*:\s*"[^"]{2000,}"/,

    // Poll name bomb
    /"pollCreationMessage"\s*:\s*\{[^}]*"name"\s*:\s*"[^"]{300,}"/,

    // Location overflow
    /"address"\s*:\s*"[^"]{700,}/,
    /"liveLocationMessage"[^}]{0,150}"caption"\s*:\s*"[^"]{1500,}"/,

    // Group invite overflow
    /"groupInviteMessage"[^}]{0,200}"groupName"\s*:\s*"[^"]{800,}"/,

    // Extended text mega flood
    /"extendedTextMessage"[^}]{0,100}"text"\s*:\s*"[^"]{8000,}"/,

    // viewOnce + location (IosInvisible)
    /"viewOnceMessage"[^}]{0,300}"locationMessage"/,

    // Product scan overflow
    /"firstScanLength"\s*:\s*[0-9]{11,}/,

    // Balinese / exotic Unicode extreme repeat
    /([\u1B00-\u1B7F])\1{80,}/,
    /ꦾ{25,}/,
    // Only flag extreme repeats of non-safe Unicode
    /([\uAC00-\uD7A3])\1{300,}/,   // Korean extreme repeat
];

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function isSafeJid(jid) {
    if (!jid) return false;
    return SAFE_JID_PREFIXES.some(p => jid.startsWith(p));
}

// Extract the real sender number correctly
// Handles: groups, DMs, newsletter, undefined participant
function extractSender(mek) {
    const jid = mek.key?.remoteJid || '';
    const isGroup     = jid.endsWith('@g.us');
    const isNewsletter = jid.includes('@newsletter') || isSafeJid(jid);

    if (isNewsletter) return null; // skip entirely

    if (isGroup) {
        // participant can sometimes be missing — fall back to remoteJid
        const participant = mek.key?.participant;
        if (participant && participant !== 'undefined' && participant.includes('@')) {
            return participant;
        }
        // If participant missing in group, skip this message (can't identify sender)
        return null;
    }

    // DM — sender is remoteJid itself
    return jid || null;
}

// Format sender number cleanly for owner notification
function formatSender(jid) {
    if (!jid) return 'unknown';
    // Extract numeric part only
    const num = jid.split('@')[0].split(':')[0];
    return num || jid;
}

function repeatRatio(text) {
    if (!text || text.length < CFG.REPEAT_MIN_LEN) return 0;
    const freq = {};
    const len = text.length;
    for (const ch of text) {
        freq[ch] = (freq[ch] || 0) + 1;
        if (freq[ch] / len > CFG.MAX_REPEAT_RATIO) return freq[ch] / len;
    }
    return 0;
}

function countRe(text, re) {
    if (!text) return 0;
    const m = text.match(re);
    return m ? m.length : 0;
}

function countEscaped(raw, pattern) {
    const m = raw.match(pattern);
    return m ? m.length : 0;
}

// Check if text contains safe Unicode (box drawing, math symbols, scripts)
// If yes, skip repeat ratio check — bot menus use these heavily
function hasSafeUnicode(text) {
    return SAFE_UNICODE_RE.test(text);
}

// Deep scan for oversized paramsJson at any nesting depth
function checkParamsJsonDeep(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return null;
    for (const key of Object.keys(obj)) {
        if (key === 'paramsJson' && typeof obj[key] === 'string') {
            if (obj[key].length > CFG.MAX_PARAMS_JSON_LEN)
                return `paramsJson too large: ${obj[key].length}`;
        }
        if (obj[key] && typeof obj[key] === 'object') {
            const deep = checkParamsJsonDeep(obj[key], depth + 1);
            if (deep) return deep;
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════
//  CORE DETECTION
// ═══════════════════════════════════════════════════════════
function detectAttack(mek) {
    try {
        if (!mek?.message) return { malicious: false };

        // Skip safe message types
        const msgType = Object.keys(mek.message)[0];
        if (SAFE_TYPES.has(msgType)) return { malicious: false };

        // Serialize
        let raw = '';
        try {
            raw = JSON.stringify(mek.message);
        } catch {
            return { malicious: true, reason: 'JSON.stringify failed (malformed)' };
        }

        const msg = mek.message;

        // Collect attack-relevant text fields only
        const texts = [
            msg.conversation,
            msg.extendedTextMessage?.text,
            msg.imageMessage?.caption,
            msg.videoMessage?.caption,
            msg.audioMessage?.caption,
            msg.documentMessage?.caption,
            msg.locationMessage?.address,
            msg.liveLocationMessage?.caption,
            msg.pollCreationMessage?.name,
            msg.groupInviteMessage?.groupName,
            msg.interactiveMessage?.header?.title,
            msg.interactiveMessage?.body?.text,
            ...(msg.pollCreationMessage?.options?.map(o => o.name) || []),
        ].filter(v => typeof v === 'string' && v.length > 0);

        const combined = texts.join(' ');

        // Rule 1: Text length overflow
        if (combined.length > CFG.MAX_TEXT_LEN)
            return { malicious: true, reason: `Text overflow: ${combined.length} chars` };

        // Rule 2: Repeat ratio
        // Skip if text contains safe Unicode (bot menus, Sinhala, etc.)
        if (!hasSafeUnicode(combined)) {
            const ratio = repeatRatio(combined);
            if (ratio > CFG.MAX_REPEAT_RATIO)
                return { malicious: true, reason: `Char repeat flood: ${(ratio * 100).toFixed(0)}%` };
        }

        // Rule 3: Null bytes in text
        const nullN = countRe(combined, /\u0000/g);
        if (nullN > CFG.MAX_NULL_BYTES)
            return { malicious: true, reason: `Null byte flood: ${nullN}` };

        // Rule 4: Newline flood (Xdelay stage 1)
        const newlineN = countRe(combined, /\n/g);
        if (newlineN > CFG.MAX_NEWLINE_BYTES)
            return { malicious: true, reason: `Newline flood: ${newlineN} (Xdelay)` };

        // Rule 5: Invisible chars (DelayInvis)
        const invisN = countRe(combined, INVIS_RE)
                     + countRe(combined, LINESEP_RE)
                     + countRe(combined, BALINESE_RE)
                     + countRe(combined, HANGUL_FILL_RE);
        if (invisN > CFG.MAX_INVIS_CHARS)
            return { malicious: true, reason: `Invisible char flood: ${invisN}` };

        // Rule 6: Escaped nulls in raw JSON (xbetainvis)
        const escapedNull = countEscaped(raw, /\\u0000/gi);
        if (escapedNull > CFG.MAX_ESCAPED_NULL)
            return { malicious: true, reason: `Escaped null flood: ${escapedNull} (xbetainvis)` };

        // Rule 7: Escaped newlines in raw JSON (Xdelay)
        const escapedNL = countEscaped(raw, /\\\\n/g);
        if (escapedNL > CFG.MAX_ESCAPED_NEWLINE)
            return { malicious: true, reason: `Escaped newline flood: ${escapedNL} (Xdelay)` };

        // Rule 8: Escaped invisible chars (DelayInvis)
        const escapedInvis = countEscaped(raw, /\\u(200[b-fB-F]|206[0-4]|[fF][eE][fF][fF]|2063|180[eE])/gi);
        if (escapedInvis > CFG.MAX_ESCAPED_INVIS)
            return { malicious: true, reason: `Escaped invis flood: ${escapedInvis} (DelayInvis)` };

        // Rule 9: Structural pattern match
        for (const pat of ATTACK_PATTERNS) {
            if (pat.test(raw))
                return { malicious: true, reason: `Attack pattern detected` };
        }

        // Rule 10: Mention bomb (Xdelay stage 2)
        const mentions = msg.extendedTextMessage?.contextInfo?.mentionedJid
                      || msg.contextInfo?.mentionedJid || [];
        if (mentions.length > CFG.MAX_MENTIONS)
            return { malicious: true, reason: `Mention bomb: ${mentions.length} JIDs` };

        // Rule 11: Deep paramsJson size check (Xdelay stage 3)
        const paramsResult = checkParamsJsonDeep(msg);
        if (paramsResult) return { malicious: true, reason: paramsResult };

        // Rule 12: Button params overflow
        for (const btn of (msg.interactiveMessage?.nativeFlowMessage?.buttons || [])) {
            if ((btn?.buttonParamsJson?.length || 0) > 3500)
                return { malicious: true, reason: `Button overflow: ${btn.buttonParamsJson.length}` };
        }

        // Rule 13: Total payload size
        if (raw.length > CFG.MAX_RAW_BYTES)
            return { malicious: true, reason: `Payload too large: ${raw.length} bytes` };

        return { malicious: false };

    } catch (err) {
        return { malicious: true, reason: `Detection error: ${err.message}` };
    }
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
function initAntiCrash(conn, sessionId = 'default', ownerNums = []) {

    const exempt = new Set([
        ...CFG.EXEMPT_USERS,
        ...ownerNums.map(n => n.replace(/[^0-9]/g, '') + '@s.whatsapp.net'),
    ]);

    const strikes = new Map();

    async function tryDelete(jid, key) {
        try { await conn.sendMessage(jid, { delete: key }); } catch {}
    }

    async function tryBlock(jid) {
        try {
            await conn.updateBlockStatus(jid, 'block');
            if (CFG.LOG_ATTACKS)
                console.log(`[ANTICRASH:${sessionId}] 🔨 Blocked ${jid}`);
        } catch (e) {
            if (CFG.LOG_ATTACKS)
                console.log(`[ANTICRASH:${sessionId}] ⚠️ Block failed: ${e.message}`);
        }
    }

    async function blockChat(jid) {
        try {
            await conn.chatModify({ archive: true, lastMessages: [] }, jid);
            await conn.chatModify({ mute: 365 * 24 * 60 * 60 }, jid);
        } catch {}
    }

    async function alertOwner(sender, jid, reason, blocked) {
        if (!CFG.NOTIFY_OWNER || !ownerNums.length) return;
        try {
            const ownerJid = ownerNums[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            const isGroup  = jid.endsWith('@g.us');
            const senderNum = formatSender(sender);
            await conn.sendMessage(ownerJid, { text:
`🛡️ *ANTI-CRASH* [${sessionId}]

🚨 *Attack Intercepted*
👤 Sender : wa.me/${senderNum}
📍 Chat   : ${isGroup ? 'Group\n🔗 ' + jid : 'Private DM'}
⚡ Reason : ${reason}
${blocked ? '🔨 Auto-blocked + chat muted.' : '🗑️ Message deleted.'}`
            });
        } catch {}
    }

    // ── Main protection listener ──────────────────────────
    conn.ev.on('messages.upsert', async ({ messages }) => {
        for (const mek of messages) {
            if (!mek?.message) continue;
            if (mek.key.fromMe) continue;

            // Extract sender correctly
            const sender = extractSender(mek);
            if (!sender) continue; // null = safe JID or unidentifiable

            // Safe JID check
            if (isSafeJid(sender)) continue;
            if (isSafeJid(mek.key.remoteJid)) continue;

            // Exempt check
            if (exempt.has(sender)) continue;
            if (CFG.EXEMPT_GROUPS.includes(mek.key.remoteJid)) continue;

            let result;
            try { result = detectAttack(mek); }
            catch (e) { result = { malicious: true, reason: `outer: ${e.message}` }; }

            if (!result.malicious) continue;

            const count   = (strikes.get(sender) || 0) + 1;
            const blocked = CFG.AUTO_BLOCK && count >= CFG.BLOCK_AFTER;
            strikes.set(sender, count);

            if (CFG.LOG_ATTACKS) console.log(
`╔════════════════════════════════════════╗
║  🚨 ANTICRASH — BLOCKED                ║
╠════════════════════════════════════════╣
  Session : ${sessionId}
  Sender  : ${formatSender(sender)} (${sender})
  Chat    : ${mek.key.remoteJid}
  Reason  : ${result.reason}
  Action  : ${blocked ? 'BLOCKED + CHAT MUTED' : 'MSG DELETED'}
╚════════════════════════════════════════╝`);

            ;(async () => {
                if (CFG.AUTO_DELETE) await tryDelete(mek.key.remoteJid, mek.key);
                if (blocked) {
                    await tryBlock(sender);
                    await blockChat(mek.key.remoteJid);
                    strikes.delete(sender);
                }
                await alertOwner(sender, mek.key.remoteJid, result.reason, blocked);
            })().catch(() => {});
        }
    });

    // ── CallCrash guard ───────────────────────────────────
    try {
        if (conn.ws && typeof conn.ws.emit === 'function') {
            const _orig = conn.ws.emit.bind(conn.ws);
            conn.ws.emit = function (ev, ...args) {
                if (ev === 'CB:call' || ev === 'CB:call,offer' || ev === 'CB:call,terminate') {
                    if (CFG.LOG_ATTACKS)
                        console.log(`[ANTICRASH:${sessionId}] 📵 CallCrash blocked (${ev})`);
                    return true;
                }
                return _orig(ev, ...args);
            };
        }
    } catch {}

    if (CFG.LOG_ATTACKS)
        console.log(`[ANTICRASH:${sessionId}] ✅ Anti-Crash v6 — bot menus safe · correct sender · instant block`);

    return {
        resetStrikes : (jid) => strikes.delete(jid),
        getStrikes   : (jid) => strikes.get(jid) || 0,
        exempt       : (jid) => exempt.add(jid),
    };
}

module.exports = { initAntiCrash, detectAttack };
