const { cmd } = require('../command');

cmd({
    name: "online",
    fromMe: true,
    category: "whatsapp",
    desc: "Changes the user's online privacy settings. Use *all* to allow all users or *match_last_seen* to only allow those who match your last seen."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return await m.reply(`_*Example:-* online all_\n_to change *online* privacy settings_`);
    const available_privacy = ['all', 'match_last_seen'];
    if (!available_privacy.includes(args)) return await m.reply(`_action must be *${available_privacy.join('/')}* values_`);
    await conn.updateOnlinePrivacy(args)
    await m.reply(`_Privacy Updated to *${args}*_`);
});

cmd({
    name: "lastseen",
    fromMe: true,
    category: "whatsapp",
    desc: "Changes the user's last seen privacy settings. Options include *all*, *contacts*, *contact_blacklist*, or *none*."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return await m.reply(`_*Example:-* lastseen all_\n_to change last seen privacy settings_`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(args)) return await m.reply(`_action must be *${available_privacy.join('/')}* values_`);
    await conn.updateLastSeenPrivacy(args)
    await m.reply(`_Privacy settings *last seen* Updated to *${args}*_`);
});

cmd({
    name: "profile",
    fromMe: true,
    category: "whatsapp",
    desc: "Changes the user's profile picture privacy settings. Options include *all*, *contacts*, *contact_blacklist*, or *none*."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return await m.reply(`_*Example:-* profile all_\n_to change *profile picture* privacy settings_`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(args)) return await m.reply(`_action must be *${available_privacy.join('/')}* values_`);
    await conn.updateProfilePicturePrivacy(args)
    await m.reply(`_Privacy Updated to *${args}*_`);
});

cmd({
    name: "status",
    fromMe: true,
    category: "whatsapp",
    desc: "Changes the user's status privacy settings. Options include *all*, *contacts*, *contact_blacklist*, or *none*."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return await m.reply(`_*Example:-* status all_\n_to change *status* privacy settings_`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(args)) return await m.reply(`_action must be *${available_privacy.join('/')}* values_`);
    await conn.updateStatusPrivacy(args)
    await m.reply(`_Privacy Updated to *${args}*_`);
});

cmd({
    name: "readreceipt",
    fromMe: true,
    category: "whatsapp",
    desc: "Changes the user's read receipt privacy settings. Options are *all* or *none*."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return await m.reply(`_*Example:-* readreceipt all_\n_to change *read and receipts message* privacy settings_`);
    const available_privacy = ['all', 'none'];
    if (!available_privacy.includes(args)) return await m.reply(`_action must be *${available_privacy.join('/')}* values_`);
    await conn.updateReadReceiptsPrivacy(args)
    await m.reply(`_Privacy Updated to *${args}*_`);
});

cmd({
    name: "groupadd",
    fromMe: true,
    category: "whatsapp",
    desc: "Changes the user's group addition privacy settings. Options include *all*, *contacts*, *contact_blacklist*, or *none*."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args) return await m.reply(`_*Example:-* groupadd all_\n_to change *group add* privacy settings_`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(args)) return await m.reply(`_action must be *${available_privacy.join('/')}* values_`);
    await conn.updateGroupsAddPrivacy(args)
    await m.reply(`_Privacy Updated to *${args}*_`);
});

cmd({
    name: "getprivacy",
    fromMe: true,
    category: "whatsapp",
    desc: "Fetches and displays the privacy settings of the user, including online status, profile, last seen, read receipts, and more."
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const { readreceipts, profile, status, online, last, groupadd, calladd } = await conn.fetchPrivacySettings(true);
    const msg = `Privacy Information:
---------------------
Name                 : ${conn.user.name}
Online Status        : ${online}
Profile              : ${profile}
Last Seen            : ${last}
Read Receipts        : ${readreceipts}
Status Privacy       : ${status}
Group Addition       : ${groupadd}
Call Addition        : ${calladd}
`
    let img;
    try {
        img = {
            url: await conn.profilePictureUrl(from, 'image')
        };
    } catch (e) {
        img = {
            url: "https://i.ibb.co/sFjZh7S/6883ac4d6a92.jpg"
        };
    }
    await conn.sendMessage(from, {
        image: img,
        caption: msg
    })
});

cmd({
    name: "dlt",
    fromMe: true,
    desc: "Deletes the replied message from the chat.",
    category: "whatsapp",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if(!m.quoted) return m.reply("Reply to a message to delete it.");
        await conn.sendMessage(from, {
            delete: {
                remoteJid: from,
                fromMe: false,
                id: m.quoted.key.id,
                participant: m.quoted.key.participant || m.quoted.key.remoteJid
            }
        });
        await conn.sendMessage(from, {
            delete: {
                remoteJid: from,
                fromMe: true,
                id: m.quoted.key.id
            }
        });
        await conn.sendMessage(from, {
            delete: {
                remoteJid: from,
                fromMe: true,
                id: m.key.id
            }
        });
    } catch (e) {}
});