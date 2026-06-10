// plugins/antidelete.js - SADEW MD
const { cmd } = require('../command');
const { getSetting } = require('../lib/settings');

const deletedMsgs = new Map();

async function onMessage(conn, mek, sessionId) {
    if (!mek?.key?.id || !mek?.message) return;
    try {
        const type = Object.keys(mek.message)[0];
        if (['protocolMessage','senderKeyDistributionMessage'].includes(type)) return;
        deletedMsgs.set(mek.key.id, {
            from: mek.key.remoteJid,
            sender: mek.key.participant || mek.key.remoteJid,
            message: mek.message,
            timestamp: Date.now(),
            pushName: mek.pushName || '',
        });
        // Keep only last 200 msgs
        if (deletedMsgs.size > 200) {
            const oldest = [...deletedMsgs.keys()][0];
            deletedMsgs.delete(oldest);
        }
    } catch {}
}

async function onDelete(conn, updates, sessionId) {
    const enabled = getSetting('antidelete');
    if (!enabled) return;
    for (const update of updates) {
        try {
            if (!update?.key?.id) continue;
            const msg = deletedMsgs.get(update.key.id);
            if (!msg) continue;
            deletedMsgs.delete(update.key.id);
            const { from, sender, message, pushName } = msg;
            if (!from || !message) continue;

            const msgType = Object.keys(message)[0];
            const content = message[msgType];
            const tag = `👁 *AntiDelete*\n👤 *${pushName || sender.split('@')[0]}*\n`;

            if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
                const text = content?.text || content || '';
                await conn.sendMessage(from, { text: `${tag}\n${text}` }).catch(() => {});
            } else if (['imageMessage','videoMessage'].includes(msgType)) {
                const media = await conn.downloadMediaMessage({ key: update.key, message }).catch(() => null);
                if (media) {
                    await conn.sendMessage(from, {
                        [msgType === 'imageMessage' ? 'image' : 'video']: media,
                        caption: tag + (content.caption ? '\n' + content.caption : ''),
                    }).catch(() => {});
                }
            } else if (msgType === 'audioMessage') {
                const media = await conn.downloadMediaMessage({ key: update.key, message }).catch(() => null);
                if (media) {
                    await conn.sendMessage(from, { audio: media, mimetype: 'audio/mpeg', ptt: content.ptt }).catch(() => {});
                }
            } else if (msgType === 'stickerMessage') {
                const media = await conn.downloadMediaMessage({ key: update.key, message }).catch(() => null);
                if (media) {
                    await conn.sendMessage(from, { sticker: media }).catch(() => {});
                }
            } else {
                await conn.sendMessage(from, { text: `${tag}\n_[${msgType} deleted]_` }).catch(() => {});
            }
        } catch {}
    }
}

// .antidelete on/off command
cmd({
    pattern: 'antidelete',
    alias: ['antidel'],
    fromMe: true,
    category: 'tools',
    desc: 'Toggle antidelete on/off',
    react: '🛡️',
}, async (conn, mek, m, { from, args, reply }) => {
    const { getSetting: gs, setSetting: ss } = require('../lib/settings');
    const input = (args || '').toLowerCase().trim();
    if (input === 'on' || input === 'true') {
        await ss('antidelete', true);
        return reply('🛡️ *AntiDelete ON* - Deleted messages will be recovered.');
    } else if (input === 'off' || input === 'false') {
        await ss('antidelete', false);
        return reply('🛡️ *AntiDelete OFF*');
    } else {
        const cur = gs('antidelete');
        return reply(`🛡️ *AntiDelete* is currently *${cur ? 'ON' : 'OFF'}*\nUsage: \`.antidelete on\` or \`.antidelete off\``);
    }
});

module.exports = { onMessage, onDelete };
