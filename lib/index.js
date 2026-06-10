// lib/index.js - SADEW MD

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./functions');
const { sms, downloadMediaMessage } = require('./msg');
const { readEnv, updateEnv } = require('./database');

// setData / getData shim (manage.js etc use these)
const setData = async (key, value) => {
    try { await updateEnv(key, value); } catch (e) { console.error('setData error:', e.message); }
};
const getData = async (key) => {
    try {
        const env = await readEnv();
        return env[key];
    } catch (e) { return null; }
};

// DATABASE shim for backward compat
const DATABASE = { readEnv, updateEnv, setData, getData };

module.exports = {
    getBuffer,
    getGroupAdmins,
    getRandom,
    h2k,
    isUrl,
    Json,
    runtime,
    sleep,
    fetchJson,
    DATABASE,
    sms,
    downloadMediaMessage,
    setData,
    getData,
    readEnv,
    updateEnv,
};
