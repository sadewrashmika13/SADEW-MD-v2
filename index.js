// ================= Required Modules =================
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
  proto,
  generateWAMessageFromContent,
} = require("@whiskeysockets/baileys");

// ── Suppress libsignal / Baileys noise logs ──
const _origWrite    = process.stdout.write.bind(process.stdout);
const _origErrWrite = process.stderr.write.bind(process.stderr);
const SUPPRESS_PATTERNS = [
  "Bad MAC","Failed to decrypt","Session error","Closing open session",
  "Closing session","Decrypted message with closed session","closed session",
  "SessionEntry","no session","No session","Invalid PreKey",
  "decryptWithSessions","ephemeralKeyPair","lastRemoteEphemeralKey",
  "pendingPreKey","remoteIdentityKey","currentRatchet","indexInfo",
  "baseKeyType","_chains","registrationId","useNewUrlParser",
  "useUnifiedTopology","session_cipher","queue_job",
  "verifyMAC","at async _asyncQueue","at async SessionCipher","at Object.verifyMAC",
];
function shouldSuppress(str) {
  if (typeof str !== "string") return false;
  return SUPPRESS_PATTERNS.some(p => str.includes(p));
}
process.stdout.write = function(chunk, encoding, cb) {
  try {
    if (shouldSuppress(String(chunk))) {
      if (typeof encoding === "function") encoding(); else if (typeof cb === "function") cb();
      return true;
    }
    return _origWrite(chunk, encoding, cb);
  } catch (e) { return true; }
};
process.stderr.write = function(chunk, encoding, cb) {
  try {
    if (shouldSuppress(String(chunk))) {
      if (typeof encoding === "function") encoding(); else if (typeof cb === "function") cb();
      return true;
    }
    return _origErrWrite(chunk, encoding, cb);
  } catch (e) { return true; }
};

const fs      = require("fs");
const P       = require("pino");
const path    = require("path");
const express = require("express");
const config  = require("./config");
const connectDB = require("./lib/mongodb");
const { loadSettingsFromDB } = require("./lib/settings");
const { File } = require("megajs");

let sms;
let handleAutoForward;
const { initAntiCrash } = require('./lib/anticrash');

// ================= Global Variables =================
const ownerNumber = (config.OWNER_NUMBER || "94783360267")
  .split(",")
  .map(n => n.replace(/[^0-9]/g, "").trim())
  .filter(Boolean);

const botName = "SADEW MD";
let activeSessions     = new Set();
const reconnectingSessions = new Set();
const sentConnectMsg   = new Set();
let _cachedWAVersion   = null;

// ================= Bot Context =================
const chama = {
  key: { remoteJid:"status@broadcast", participant:"0@s.whatsapp.net", fromMe:false, id:"SADEW_MD_FAKE_ID" },
  message: {
    contactMessage: {
      displayName: botName,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:SADEW MD\nTEL;type=CELL;type=VOICE;waid=94783360267:+94783360267\nEND:VCARD`,
    },
  },
};

// ====================== MEGA SESSION DOWNLOADER ======================
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadMegaNode(node, targetPath) {
  if (node.directory) {
    ensureDirSync(targetPath);
    for (const child of (node.children || [])) {
      await downloadMegaNode(child, path.join(targetPath, child.name));
    }
    return;
  }
  ensureDirSync(path.dirname(targetPath));
  if (fs.existsSync(targetPath) && node.size) {
    if (fs.statSync(targetPath).size >= node.size) return;
  }
  await new Promise((resolve, reject) => {
    const stream = node.download();
    const w = fs.createWriteStream(targetPath);
    stream.on("error", reject);
    w.on("error", reject);
    w.on("finish", resolve);
    stream.pipe(w);
  });
}

// ====================== SESSION LOADER ======================
async function loadSession() {
  let sessionId = config.SESSION_ID;
  if (!sessionId) {
    console.log("[SADEW MD] No SESSION_ID found. Please set it in .env");
    return false;
  }

  const authDir   = path.join(__dirname, "auth_info_baileys");
  ensureDirSync(authDir);
  const credsPath = path.join(authDir, "creds.json");

  if (fs.existsSync(credsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      if (existing && existing.noiseKey) {
        console.log("[SESSION] Valid creds.json found — skipping decode.");
        return true;
      }
    } catch {}
  }

  // ── Normalize sadew& prefix to MEGA link ──
  if (sessionId.startsWith("sadew&") && sessionId.length < 100) {
    sessionId = "https://mega.nz/file/" + sessionId.slice(6);
    console.log("[SESSION] sadew& prefix → MEGA link.");
  } else if (sessionId.startsWith("ranu&")) {
    sessionId = "https://mega.nz/file/" + sessionId.slice(5);
  }

  // ── MEGA link ──
  if (sessionId.startsWith("https://mega.nz") || sessionId.startsWith("mega://")) {
    try {
      console.log("[SESSION] Downloading session from MEGA...");
      const megaFile = File.fromURL(sessionId);
      await megaFile.loadAttributes();
      if (megaFile.directory) {
        await downloadMegaNode(megaFile, authDir);
      } else {
        await new Promise((resolve, reject) => {
          const stream = megaFile.download();
          const w = fs.createWriteStream(credsPath);
          stream.on("error", reject);
          w.on("error", reject);
          w.on("finish", resolve);
          stream.pipe(w);
        });
      }
      console.log("[SESSION] MEGA session downloaded.");
      return true;
    } catch (e) {
      console.log("[SESSION] MEGA download failed:", e.message);
      return false;
    }
  }

  // ── Base64 ──
  try {
    let raw = sessionId.trim();
    for (const prefix of ["SADEW-MD_","SADEW_MD_","sadew&","ranu&"]) {
      if (raw.startsWith(prefix)) { raw = raw.slice(prefix.length); break; }
    }
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed  = JSON.parse(decoded);
    if (!parsed || !parsed.noiseKey) throw new Error("Missing noiseKey");
    fs.writeFileSync(credsPath, JSON.stringify(parsed, null, 2));
    console.log("[SESSION] Base64 session decoded → creds.json");
    return true;
  } catch (e) {
    console.log("[SESSION] Base64 decode failed:", e.message);
  }

  // ── Raw JSON ──
  try {
    const parsed = JSON.parse(sessionId);
    if (parsed && parsed.noiseKey) {
      fs.writeFileSync(credsPath, JSON.stringify(parsed, null, 2));
      console.log("[SESSION] Raw JSON session saved.");
      return true;
    }
  } catch {}

  console.log("[SESSION] Could not load session. Set SESSION_ID to a base64 string or MEGA link (sadew&...).");
  return false;
}

async function ensureBotFiles() {
  ["plugins","lib","data","cookies","auth_info_baileys"].forEach(f =>
    ensureDirSync(path.join(__dirname, f))
  );
  console.log("[SADEW MD] Local folders verified.");
  await loadSession();
}

function loadLocalSessions() {
  const baseDir = path.join(__dirname, "auth_info_baileys");
  const sessions = [];
  if (!fs.existsSync(baseDir)) return sessions;
  const rootCreds = path.join(baseDir, "creds.json");
  if (fs.existsSync(rootCreds)) {
    sessions.push({ sessionId: "main", authPath: baseDir });
    console.log("Single session found: main");
    return sessions;
  }
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subPath  = path.join(baseDir, entry.name);
    const credFile = path.join(subPath, "creds.json");
    if (fs.existsSync(credFile)) {
      sessions.push({ sessionId: entry.name, authPath: subPath });
      console.log(`Session found: ${entry.name}`);
    }
  }
  return sessions;
}

// ================= Body Extractor =================
function extractBody(message) {
  if (!message) return "";
  const type = getContentType(message);
  if (type === "conversation")               return message.conversation || "";
  if (type === "extendedTextMessage")        return message.extendedTextMessage?.text || "";
  if (type === "buttonsResponseMessage")     return message.buttonsResponseMessage?.selectedButtonId || "";
  if (type === "listResponseMessage")        return message.listResponseMessage?.singleSelectReply?.selectedRowId || "";
  if (type === "templateButtonReplyMessage") return message.templateButtonReplyMessage?.selectedId || "";
  if (type === "interactiveResponseMessage") {
    try {
      const nativeReply = message.interactiveResponseMessage?.nativeFlowResponseMessage;
      if (nativeReply) {
        const parsed = JSON.parse(nativeReply.paramsJson || "{}");
        return parsed.id || nativeReply.name || "";
      }
    } catch {}
    return message.interactiveResponseMessage?.body?.text || "";
  }
  if (type === "imageMessage") return message.imageMessage?.caption || "";
  if (type === "videoMessage") return message.videoMessage?.caption || "";
  return "";
}

// ================= Global Button State =================
const buttonStateMap = new Map();
const buttonStateDir = path.join(__dirname, "./data");

function getButtonStateFile(sid) {
  return path.join(buttonStateDir, "button_state_" + sid + ".json");
}

global.isButtonEnabled = function(sessionId) {
  if (buttonStateMap.has(sessionId)) return buttonStateMap.get(sessionId);
  try {
    const file = getButtonStateFile(sessionId);
    if (fs.existsSync(file)) {
      const val = JSON.parse(fs.readFileSync(file, "utf8")).enabled;
      buttonStateMap.set(sessionId, val);
      return val;
    }
  } catch {}
  return true;
};

global.setButtonState = function(sessionId, value) {
  buttonStateMap.set(sessionId, value);
  try {
    if (!fs.existsSync(buttonStateDir)) fs.mkdirSync(buttonStateDir, { recursive: true });
    fs.writeFileSync(getButtonStateFile(sessionId), JSON.stringify({ enabled: value }, null, 2));
  } catch (e) { console.error("Button state save error:", e.message); }
};

function buildFallback(options) {
  let text = "";
  if (options.header) text += `*${options.header}*\n\n`;
  text += (options.body || "");
  if (options.buttons?.length) {
    text += "\n\n";
    options.buttons.forEach((b, i) => { text += `*${i + 1}.* ${b.text}\n`; });
    text += "\n_Reply with number_";
  }
  if (options.sections?.length) {
    text += "\n\n";
    let c = 1;
    options.sections.forEach(sec => {
      if (sec.title) text += `*${sec.title}*\n`;
      sec.rows?.forEach(row => {
        text += `*${c}.* ${row.title}`;
        if (row.description) text += ` — ${row.description}`;
        text += "\n";
        c++;
      });
    });
    text += "\n_Reply with number_";
  }
  if (options.footer) text += `\n\n${options.footer}`;
  return text;
}

global.sendInteractiveButtons = async function(conn, jid, options, quotedMsg) {
  const _sid = options._sessionId;
  if (!global.isButtonEnabled(_sid)) {
    return await conn.sendMessage(jid, { text: buildFallback(options) }, { quoted: quotedMsg });
  }
  try {
    const buttons = [];
    if (options.buttons?.length) {
      options.buttons.forEach(btn => {
        buttons.push({ name: "cta_reply", buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id }) });
      });
    }
    if (options.sections?.length) {
      buttons.push({ name: "single_select", buttonParamsJson: JSON.stringify({ title: options.listTitle || "Select", sections: options.sections }) });
    }
    if (options.url) {
      buttons.push({ name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: options.url.text || "Open Link", url: options.url.link, merchant_url: options.url.link }) });
    }
    if (options.copy) {
      buttons.push({ name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: options.copy.text || "Copy", copy_code: options.copy.value }) });
    }
    const interactiveMsg = generateWAMessageFromContent(jid, {
      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
      interactiveMessage: proto.Message.InteractiveMessage.create({
        body:   proto.Message.InteractiveMessage.Body.create({ text: options.body || "" }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: options.footer || botName }),
        header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: false, title: options.header || "" }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons, messageParamsJson: "" })
      })
    }, { quoted: quotedMsg, userJid: conn.user?.id });
    await conn.relayMessage(jid, interactiveMsg.message, { messageId: interactiveMsg.key.id });
    return interactiveMsg;
  } catch (err) {
    return await conn.sendMessage(jid, { text: buildFallback(options) }, { quoted: quotedMsg });
  }
};

// ================= Anti-Spam Cooldown =================
const _accessDeniedCooldown = new Map();
const ACCESS_DENIED_COOLDOWN_MS = 60 * 1000;

function shouldSendDenied(sid, num) {
  const key = `${sid}:${num}`;
  const last = _accessDeniedCooldown.get(key) || 0;
  if (Date.now() - last < ACCESS_DENIED_COOLDOWN_MS) return false;
  _accessDeniedCooldown.set(key, Date.now());
  return true;
}

// ================= Single Bot Instance =================
async function startBot(sessionId, authPath, envConfig) {
  if (activeSessions.has(sessionId)) return;
  activeSessions.add(sessionId);

  const prefix = envConfig?.PREFIX || ".";
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  if (!_cachedWAVersion) {
    try { const r = await fetchLatestBaileysVersion(); _cachedWAVersion = r.version; }
    catch (_) { _cachedWAVersion = [2, 3000, 1015901307]; }
  }
  const version = _cachedWAVersion;

  const conn = makeWASocket({
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    syncFullHistory: false,
    auth: state,
    version,
    getMessage: async (key) => ({ conversation: "" }),
    shouldIgnoreJid: (jid) => false,
  });

  console.log(`Starting session: ${sessionId}`);

  if (!global._activeConns) global._activeConns = new Map();
  global._activeConns.set(sessionId, conn);

  initAntiCrash(conn, sessionId, ownerNumber);

  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log(`Reconnecting: ${sessionId}`);
        activeSessions.delete(sessionId);
        reconnectingSessions.add(sessionId);
        setTimeout(async () => {
          await startBot(sessionId, authPath, envConfig);
          reconnectingSessions.delete(sessionId);
        }, 8000);
      } else {
        console.log(`Logged Out: ${sessionId}`);
        activeSessions.delete(sessionId);
      }
    } else if (connection === "open") {
      console.log(`Connected: ${sessionId} (${conn.user.id.split(":")[0]})`);
      if (!global._activeConns) global._activeConns = new Map();
      global._activeConns.set(sessionId, conn);

      if (typeof global.attachCinesubzListener === 'function') {
        global.attachCinesubzListener(conn, sessionId);
      }

      try {
        const { getSetting } = require('./lib/settings');
        const alwaysOffline = getSetting('alwaysOffline');
        if (alwaysOffline === true || alwaysOffline === 'true') {
          conn.sendPresenceUpdate('unavailable').catch(() => {});
        }
      } catch (e) {}

      // ── Connect message to the BOT number (not owner) ──
      if (!sentConnectMsg.has(sessionId)) {
        sentConnectMsg.add(sessionId);
        ;(async () => {
          try {
            await new Promise(r => setTimeout(r, 3000));

            const now = new Date().toLocaleString('en-US', {
              timeZone: 'Asia/Colombo',
              hour: '2-digit', minute: '2-digit',
              day: '2-digit', month: 'short', year: 'numeric'
            });

            const botNum  = conn.user.id.split(":")[0];
            const modeStr = (config.MODE || "public").toUpperCase();

            const upMsg =
`✦ ──────────────────── ✦
    🌙 *𝗦𝗔𝗗𝗘𝗪 𝗠𝗗* 🌙
✦ ──────────────────── ✦

> 💠 *ᴄᴏɴɴᴇᴄᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ* ✅

⊹ 🤖 *Bot*        ➤  SADEW MD
⊹ 📱 *Number*     ➤  +${botNum}
⊹ 🔑 *Prefix*     ➤  [ ${prefix} ]
⊹ 💎 *Version*    ➤  V1.0
⊹ 🌐 *Mode*       ➤  ${modeStr}
⊹ 🎯 *Platform*   ➤  Heroku
⊹ 🛡️ *Security*   ➤  Active
⊹ 🕐 *Time*       ➤  ${now}

✦ ──────────────────── ✦
  🌟 *Pᴏᴡᴇʀᴅ Bʏ Sᴀᴅᴇᴡ* 💐
✦ ──────────────────── ✦`;

            // Connect msg goes to the BOT's own number (inbox)
            await conn.sendMessage(
              botNum + "@s.whatsapp.net",
              {
                image: { url: "https://whiteshadow-uploder.zone.id/files/5wv.png" },
                caption: upMsg,
              },
              { quoted: chama }
            );
          } catch (e) {
            console.log(`[CONNECT MSG] Failed: ${e.message}`);
          }
        })();
      }
    }
  });

  conn.ev.on("creds.update", saveCreds);

  const { getSetting: _getSettingStatus } = require("./lib/settings");

  conn.ev.on("messages.upsert", (mkk) => {
    const { messages, type } = mkk;

    // ── STATUS PATH ──
    const autoRead = _getSettingStatus("autoStatusRead");
    const autoLike = _getSettingStatus("autoStatusLike");
    for (const mek of messages) {
      if (mek?.key?.remoteJid !== "status@broadcast") continue;
      if (mek.key.fromMe) continue;
      if (!mek.key.id) continue;
      if (autoRead !== false && autoRead !== "false") {
        conn.readMessages([mek.key]).catch(() => {});
      }
      if (autoLike !== false && autoLike !== "false" && autoLike) {
        const statusSender = mek.key.participant || mek.key.remoteJid;
        const msg = mek.message || {};
        const msgType = Object.keys(msg)[0] || "";
        const isProtocol = (msgType === "senderKeyDistributionMessage" || msgType === "protocolMessage" || msgType === "messageContextInfo");
        if (!isProtocol && statusSender) {
          setTimeout(() => {
            const { getSetting: _getEmoji } = require("./lib/settings");
            const reactEmoji = _getEmoji("autoStatusEmoji") || "❤️";
            conn.sendMessage(
              "status@broadcast",
              { react: { text: reactEmoji, key: { remoteJid: "status@broadcast", id: mek.key.id, participant: statusSender, fromMe: false } } },
              { statusJidList: [statusSender] }
            ).catch(() => {});
          }, 1500);
        }
      }
    }

    // ── CMD PATH ──
    if (type !== "notify" && type !== "append") return;
    const nonStatusMessages = messages.filter(m => m?.key?.remoteJid !== "status@broadcast");
    if (nonStatusMessages.length === 0) return;

    (async (mkk) => {
    try {
      let mek = mkk.messages[0];
      if (!mek?.key) return;
      if (!mek?.message) return;

      const msgKeys = Object.keys(mek.message);
      if (
        msgKeys.includes("senderKeyDistributionMessage") ||
        msgKeys.includes("protocolMessage") ||
        (msgKeys.length === 1 && msgKeys[0] === "messageContextInfo")
      ) return;

      if (mek.key.remoteJid === "status@broadcast") return;

      {
        const _type = getContentType(mek.message);
        if (_type === "ephemeralMessage") {
          mek.message = mek.message.ephemeralMessage?.message || mek.message;
        } else if (_type === "deviceSentMessage") {
          mek.message = mek.message.deviceSentMessage?.message || mek.message;
        }
      }

      if (!mek.message) return;

      if (handleAutoForward) handleAutoForward(conn, mek, sessionId).catch(() => {});

      const m    = sms(conn, mek);
      const from = mek.key.remoteJid;
      if (!from) return;

      const body        = extractBody(mek.message);
      const isCmd       = body.startsWith(prefix);
      const commandText = isCmd ? body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase() : "";
      const args        = body.trim().split(/ +/).slice(1);
      const q           = args.join(" ");

      let sender = mek.key.fromMe
        ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
        : mek.key.participant || mek.key.remoteJid;

      if (sender && sender.endsWith("@lid")) {
        try {
          const contacts = conn.contacts || {};
          const resolved = Object.values(contacts).find(c =>
            c.lid && c.lid.split("@")[0] === sender.split("@")[0] && c.id && c.id.endsWith("@s.whatsapp.net")
          );
          if (resolved?.id) sender = resolved.id;
        } catch {}
      }

      const senderNumber = sender.split("@")[0].split(":")[0];
      const botNumber    = conn.user.id.split(":")[0].split("@")[0];
      const pushname     = mek.pushName || senderNumber || "User";
      const isOwner      = ownerNumber.includes(senderNumber) || botNumber === senderNumber;
      const reply        = (text) => conn.sendMessage(from, { text }, { quoted: mek });

      if (isOwner && !mek.key.fromMe && !isCmd) {
        conn.sendMessage(from, { react: { text: "👑", key: mek.key } }).catch(() => {});
      }

      if (isCmd) console.log(`[CMD] ${sessionId} | ${commandText} | ${senderNumber} | owner:${isOwner}`);

      const _hasActiveState = typeof global._cinesubzHasState === "function"
        ? global._cinesubzHasState(from, sessionId) : false;

      if (!isOwner && !_hasActiveState && typeof global.checkAccess === "function") {
        const isGroup = from.endsWith("@g.us");
        const access  = global.checkAccess(sessionId, senderNumber, isOwner, isGroup);
        if (!access.allowed) {
          if (isCmd && shouldSendDenied(sessionId, senderNumber)) {
            conn.sendMessage(from, { text: access.reason }, { quoted: mek }).catch(() => {});
          }
          return;
        }
      }

      // ── Built-in Restart ──
      if (isCmd && commandText === "restart") {
        if (!isOwner) return reply("❌ Only the bot owner can use this command.");
        await conn.sendMessage(from, { text: "🔄 *SADEW MD* is restarting...\n\n_Please wait a few seconds._" }, { quoted: mek });
        setTimeout(() => process.exit(0), 2000);
        return;
      }

      conn.sendButton = (jid, options, quoted) =>
        global.sendInteractiveButtons(conn, jid, { ...options, _sessionId: sessionId }, quoted || mek);

      const events = require("./command");

      if (!global._pluginsLoaded || events.commands.length === 0) {
        (async () => {
          let tries = 0;
          while ((!global._pluginsLoaded || require("./command").commands.length === 0) && tries < 20) {
            await new Promise(r => setTimeout(r, 500));
            tries++;
          }
          const ev2 = require("./command");
          if (!ev2.commands.length) return;
          const cmd2 = ev2.commands.find(c => c.pattern === commandText || (c.alias && c.alias.includes(commandText)));
          if (cmd2) {
            if (cmd2.react) conn.sendMessage(from, { react: { text: cmd2.react, key: mek.key } }).catch(() => {});
            try {
              await cmd2.function(conn, mek, m, { from, body, isCmd, command: commandText, args, q, sender, senderNumber, botNumber, isOwner, pushname, reply, sessionId, prefix });
            } catch (e) { console.error(`[CMD RETRY ERROR] ${sessionId}:`, e.message); }
          }
        })().catch(e => console.error(`[CMD WAIT ERROR] ${sessionId}:`, e.message));
        return;
      }

      const cmd = events.commands.find(c => c.pattern === commandText || (c.alias && c.alias.includes(commandText)));

      if (cmd) {
        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } }).catch(() => {});
        try {
          await cmd.function(conn, mek, m, { from, body, isCmd, command: commandText, args, q, sender, senderNumber, botNumber, isOwner, pushname, reply, sessionId, prefix });
        } catch (err) {
          console.error(`[CMD ERROR] ${sessionId}:`, err);
        }
      }

      // ── on:"body" handlers ──
      const bodyHandlers = events.commands.filter(c => c.on === "body");
      if (bodyHandlers.length > 0) {
        Promise.allSettled(
          bodyHandlers.map(h =>
            h.function(conn, mek, m, { from, body, isCmd, command: commandText, args, q, sender, senderNumber, botNumber, isOwner, pushname, reply, sessionId, prefix })
          )
        ).catch(() => {});
      }

    } catch (err) {
      if (!err.message?.includes("Bad MAC") && !err.message?.includes("decrypt")) {
        console.error(`[MSG ERROR] ${sessionId}:`, err.message);
      }
    }
  })({ messages: nonStatusMessages, type }).catch(() => {});
  });
}

// ================= Express Server =================
const app  = express();
const port = process.env.PORT || 8080;
app.get("/", (req, res) => res.send(`🌙 SADEW MD is Running ✅ | Sessions: ${activeSessions.size}`));
app.listen(port, () => console.log(`🚀 SADEW MD Server running on port ${port}`));

// ================= Plugin Loader =================
function loadPlugins() {
  if (global._pluginsLoaded) return;
  global._pluginsLoaded = true;
  const pluginFolder = "./plugins/";
  let loadedCount = 0;
  if (fs.existsSync(pluginFolder)) {
    fs.readdirSync(pluginFolder).forEach(plugin => {
      if (path.extname(plugin).toLowerCase() === ".js") {
        try {
          delete require.cache[require.resolve(pluginFolder + plugin)];
          require(pluginFolder + plugin);
          loadedCount++;
        } catch (e) { console.log(`Plugin load error [${plugin}]:`, e.message); }
      }
    });
  }
  console.log(`✅ Loaded ${loadedCount} plugins, ${require("./command").commands.length} commands`);

  if (typeof global.attachCinesubzListener === 'function') {
    for (const [sessionId, conn] of global._activeConns || []) {
      try { global.attachCinesubzListener(conn, sessionId); } catch (e) {}
    }
  }
}

// ================= Main =================
async function connectToWA() {
  try {
    const envConfig = config;
    const sessions = loadLocalSessions();
    if (sessions.length === 0) {
      console.log("No sessions found in auth_info_baileys.");
      console.log("→ Set SESSION_ID in .env (base64 creds or sadew&...) and restart.");
      return;
    }
    await Promise.all(sessions.map(s => startBot(s.sessionId, s.authPath, envConfig)));
    console.log(`✅ Started ${sessions.length} session(s).`);
    setTimeout(() => loadPlugins(), 3000);
  } catch (err) {
    console.error("Startup Error:", err);
  }
}

setTimeout(async () => {
  await ensureBotFiles();
  try {
    sms        = require("./lib/msg").sms;
    try { handleAutoForward = require("./plugins/forward").handleAutoForward; } catch {}
    console.log("Lib modules loaded.");
  } catch (e) {
    console.error("Lib load error:", e.message);
    process.exit(1);
  }
  await connectDB();
  await loadSettingsFromDB();
  await connectToWA();
}, 500);
