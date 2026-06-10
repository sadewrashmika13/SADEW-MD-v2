// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   lib/settings.js — SADEW MD
//
//   ✅ MongoDB PRIMARY save  (survives Heroku/Railway restarts)
//   ✅ Local file FALLBACK   (works without MongoDB)
//   ✅ RAM cache             (zero DB reads per command)
//   ✅ FIX: Model init retried after mongoose connects (no readyState race)
//   ✅ FIX: setSetting always saves to both MongoDB + file
//   Priority: MongoDB → file → env → hardcoded default
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

const fs   = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
const DATA_DIR      = path.dirname(SETTINGS_FILE);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Env helpers ──────────────────────────────────────────────
function envBool(key, fallback = false) {
    const v = process.env[key];
    // If env var not set at all → use fallback
    if (v === undefined || v === null || v === '') return fallback;
    // Explicit false override
    if (v === 'false' || v === '0') return false;
    return v === 'true' || v === '1';
}
function envStr(key, fallback = '') {
    return process.env[key] || fallback;
}

// ── Defaults (env vars used as boot-time seed) ───────────────
const DEFAULTS = {
    mode:           envStr('MODE', 'public'),
    prefix:         envStr('PREFIX', '.'),
    autoVoice:      envBool('AUTO_VOICE'),
    autoAI:         envBool('AUTO_AI'),
    autoReadStatus: true, // DEFAULT ON
    autoStatusRead: true,   // DEFAULT ON — user must explicitly .autostatus off to disable
    autoStatusLike: envBool('AUTO_REACT_STATUS', true), // default ON
    autoStatusEmoji: '❤️',                                   // default react emoji
    autoReadCmd:    envBool('AUTO_READ_CMD'),
    antiLink:       envBool('ANTILINK'),
    antiBot:        envBool('ANTI_BOT'),
    antidelete:     envBool('ANTI_DELETE'),
    antiBadWords:   envBool('ANTI_BAD_WORDS_ENABLED'),
    badWordList:    envStr('ANTI_BAD_WORDS', '').split(',').filter(Boolean),
    alwaysOffline:  false,
    antiCall:       envBool('ANTI_CALL'),
    autoViewOnce:   envBool('AUTO_VIEW_ONCE', false),
    welcome:        envBool('WELCOME', false),
    adminEvents:    envBool('ADMIN_EVENTS', false),
    button:         false,
    buttonStyle:    'default',
    footer:         'Powered By Sʜᴀᴠɪʏᴀ-Xᴍᴅ 💎',
    thumb:          '',
    fname:          '',
    moviedoc:       false,
    premiumUsers:   [],
    sudoUsers:      [],
    bannedUsers:    [],
    allowedGroups:  [],
    lastUpdated:    Date.now(),
};

// ── MongoDB model (lazy — re-attempted every call until connected) ──
let _SettingsModel = null;

function getModel() {
    // Re-attempt model creation every time until mongoose is connected
    // This fixes the race condition where getModel() was called before connect()
    if (_SettingsModel) return _SettingsModel;
    try {
        const mongoose = require('mongoose');
        // readyState: 0=disconnected 1=connected 2=connecting 3=disconnecting
        if (mongoose.connection.readyState !== 1) return null;

        const schema = new mongoose.Schema(
            { _id: String, data: mongoose.Schema.Types.Mixed },
            { collection: 'bot_settings' }
        );
        _SettingsModel = mongoose.models.BotSettings ||
                         mongoose.model('BotSettings', schema);
        return _SettingsModel;
    } catch (_) {
        return null;
    }
}

// ── RAM cache ─────────────────────────────────────────────────
let _cache = null;

// ── Load from MongoDB ─────────────────────────────────────────
async function loadFromMongo() {
    try {
        const Model = getModel();
        if (!Model) return null;
        const doc = await Model.findById('sadew_settings').lean();
        if (doc && doc.data && typeof doc.data === 'object') {
            return doc.data;
        }
        return null;
    } catch (e) {
        console.log('[SETTINGS] MongoDB load error:', e.message);
        return null;
    }
}

// ── Save to MongoDB ───────────────────────────────────────────
async function saveToMongo(settings) {
    try {
        const Model = getModel();
        if (!Model) {
            // Retry after mongoose connects (delayed 3s)
            setTimeout(async () => {
                try {
                    const M2 = getModel();
                    if (M2) {
                        await M2.findByIdAndUpdate(
                            'sadew_settings',
                            { $set: { data: settings } },
                            { upsert: true, new: true }
                        );
                        console.log('[SETTINGS] ✅ Delayed MongoDB save OK');
                    }
                } catch (_) {}
            }, 3000);
            return false;
        }
        await Model.findByIdAndUpdate(
            'sadew_settings',
            { $set: { data: settings } },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.log('[SETTINGS] MongoDB save error:', e.message);
        return false;
    }
}

// ── Load from local file ──────────────────────────────────────
function loadFromFile() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.log('[SETTINGS] File load error:', e.message);
    }
    return null;
}

// ── Save to local file ────────────────────────────────────────
function saveToFile(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (e) {
        console.log('[SETTINGS] File save error:', e.message);
        return false;
    }
}

// ── Boot loader: MongoDB first, file fallback ─────────────────
//    Called once at startup AFTER connectDB() (await loadSettingsFromDB())
async function loadSettingsFromDB() {
    try {
        // Try MongoDB first
        const mongoData = await loadFromMongo();
        if (mongoData) {
            _cache = { ...DEFAULTS, ...mongoData };
            saveToFile(_cache); // sync to file as local backup
            console.log('[SETTINGS] ✅ Loaded from MongoDB');
            return _cache;
        }
    } catch (_) {}

    // Fallback: local file
    const fileData = loadFromFile();
    if (fileData) {
        _cache = { ...DEFAULTS, ...fileData };
        // push to MongoDB so next restart gets it from DB
        await saveToMongo(_cache).catch(() => {});
        console.log('[SETTINGS] ✅ Loaded from local file → synced to MongoDB');
        return _cache;
    }

    // Nothing found — use defaults
    _cache = { ...DEFAULTS };
    await saveToMongo(_cache).catch(() => {});
    saveToFile(_cache);
    console.log('[SETTINGS] ✅ Loaded defaults → saved to MongoDB + file');
    return _cache;
}

// ── Sync load (RAM cache only — for hot path) ────────────────
function loadSettings() {
    if (_cache) return _cache;
    // fallback for first-use before loadSettingsFromDB() finishes
    const fileData = loadFromFile();
    _cache = { ...DEFAULTS, ...(fileData || {}) };
    return _cache;
}

// ── Save (MongoDB + file + RAM) — ALWAYS saves both ──────────
async function saveSettings(settings) {
    settings.lastUpdated = Date.now();
    _cache = settings;
    // Save to file immediately (sync — fast, guaranteed)
    saveToFile(settings);
    // Save to MongoDB (will retry if not connected yet)
    await saveToMongo(settings).catch(() => {});
    return true;
}

// ── Public API ────────────────────────────────────────────────
function getSetting(key) {
    const val = loadSettings()[key];
    // Return undefined for missing keys — callers must handle undefined as "not set"
    return val;
}

async function setSetting(key, value) {
    const settings  = loadSettings();
    settings[key]   = value;
    await saveSettings(settings);
    return true;
}

async function setSettings(obj) {
    const settings = loadSettings();
    Object.assign(settings, obj);
    await saveSettings(settings);
    return true;
}

async function resetSetting(key) {
    return setSetting(key, DEFAULTS[key]);
}

async function resetAllSettings() {
    _cache = null;
    await saveSettings({ ...DEFAULTS });
    return true;
}

function reloadSettings() {
    _cache = null;
    return loadSettings();
}

function getAllSettings() {
    return { ...loadSettings() };
}

// ── Config bridge (used by plugins via getConfig) ─────────────
function getConfig(key) {
    const dynamicKeys = {
        AUTO_VOICE:             'autoVoice',
        AUTO_READ_STATUS:       'autoReadStatus',
        AUTO_READ_CMD:          'autoReadCmd',
        AUTO_AI:                'autoAI',
        ANTILINK:               'antiLink',
        ANTI_BOT:               'antiBot',
        ANTI_DELETE:            'antidelete',
        ANTI_BAD_WORDS_ENABLED: 'antiBadWords',
        MODE:                   'mode',
        PREFIX:                 'prefix',
    };
    if (dynamicKeys[key] !== undefined) {
        return getSetting(dynamicKeys[key]);
    }
    const config = require('../config');
    return config[key];
}

module.exports = {
    loadSettings,
    loadSettingsFromDB,   // ← call this once at startup AFTER connectDB()
    saveSettings,
    getSetting,
    setSetting,
    setSettings,
    resetSetting,
    resetAllSettings,
    reloadSettings,
    getAllSettings,
    getConfig,
    DEFAULTS,
};
