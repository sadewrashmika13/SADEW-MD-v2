const {delay} = require('@whiskeysockets/baileys');
const { cmd } = require('../command');
const {getString} = require('./pluginsCore');
const lang = getString('group');


cmd({
	name: 'tag',
	fromMe: true,
	desc: lang.TAG_DESC,
	category: 'group',
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	args = args || m.quoted;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if (!args) return await m.reply(lang.TAG_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	const groupMetadata = await conn.groupMetadata(from);
	const jids = groupMetadata.participants.map(p => p.id);
	const content = typeof args === 'string' ? {
		text: args ? args : m.quoted.text,
		mentions: jids
	} : args;
	const options = {
		contextInfo: {
			mentionedJid: jids
		}
	};
	return typeof args === 'string' ? await conn.sendMessage(from, content, {
		quoted: m
	}) : await m.forwardMessage(from, content, options);
});


cmd({
	name: "tagall",
	fromMe: true,
	desc: lang.TAGALL_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
		const {
			participants
		} = await conn.groupMetadata(from).catch(() => ({
			participants: []
		}));
		if (!participants.length) return await m.reply(lang.ERROR_METADATA);
		const msg = participants.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join("\n");
		const jids = participants.map(p => p.id);
		return await conn.sendMessage(from, msg, {
			mentions: jids,
			quoted: m
		});
});


// cmd({
// 	name: "add",
// 	fromMe: true,
// 	desc: lang.ADD_DESC,
// 	category: "group",
// }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
// 	args = args || m.quoted;
// 	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
// 	if (!args) return await m.reply(lang.ADD_ALERT);
// 	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
// 	let jid = m.quoted ? m.quoted.sender : await m.formatNumberToJid(args);
// 	await conn.groupParticipantsUpdate(from, [jid], 'add');
// 	return await conn.sendMessage(from, lang.ADDED.replace("{}", `@${jid.split("@")[0]}`), {
// 		mentions: [jid],
// 		quoted: m
// 	});
// });


cmd({
	name: "kick",
	fromMe: true,
	desc: lang.KICK_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	args = args || m.quoted;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if (!args) return await m.reply(lang.KICK_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	let jid = m.quoted ? m.quoted.sender : await m.formatNumberToJid(args);
	await conn.groupParticipantsUpdate(from, [jid], 'remove');
	return await conn.sendMessage(from, lang.KICKED.replace("{}", `@${jid.split("@")[0]}`), {
		mentions: [jid],
		quoted: m
	});
});


cmd({
	name: "promote",
	fromMe: true,
	desc: lang.PROMOTE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	args = args || m.quoted;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if (!args) return await m.reply(lang.PROMOTE_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	let jid = m.quoted ? m.quoted.sender : await m.formatNumberToJid(args);
	if(await m.isAdmin(jid)) return await m.reply(lang.ALREADY_PROMOTED);
	await conn.groupParticipantsUpdate(from, [jid], 'promote');
	return await conn.sendMessage(from, lang.PROMOTED.replace("{}", `@${jid.split("@")[0]}`), {
		mentions: [jid],
		quoted: m
	});
});


cmd({
	name: "demote",
	fromMe: true,
	desc: lang.DEMOTE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	args = args || m.quoted;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if (!args) return await m.reply(lang.DEMOTE_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	let jid = m.quoted ? m.quoted.sender : await m.formatNumberToJid(args);
	if(!await m.isAdmin(jid)) return await m.reply(lang.ALREADY_DEMOTED);
	await conn.groupParticipantsUpdate(from, [jid], 'demote');
	return await conn.sendMessage(from, lang.DEMOTED.replace("{}", `@${jid.split("@")[0]}`), {
		mentions: [jid],
		quoted: m
	});
});


cmd({
	name: "mute",
	fromMe: true,
	desc: lang.MUTE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupSettingUpdate(from, 'announcement');
	return await conn.sendMessage(from, lang.MUTED);
});


cmd({
	name: "unmute",
	fromMe: true,
	desc: lang.UNMUTE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupSettingUpdate(from, 'not_announcement');
	return await conn.sendMessage(from, lang.UNMUTED);
});


cmd({
	name: "glock",
	fromMe: true,
	desc: lang.GLOCK_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupSettingUpdate(from, 'locked');
	return await conn.sendMessage(from, lang.GLOCKED);
});


cmd({
	name: "gunlock",
	fromMe: true,
	desc: lang.GUNLOCK_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupSettingUpdate(from, 'unlocked');
	return await conn.sendMessage(from, lang.GUNLOCKED);
});


cmd({
	name: "invite",
	fromMe: true,
	desc: lang.INVITE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	return await m.reply(lang.INVITE.replace("{}", `https://chat.whatsapp.com/${await conn.groupInviteCode(from)}`));
});


cmd({
	name: "revoke",
	fromMe: true,
	desc: lang.REVOKE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupRevokeInvite(from)
	return await m.reply(lang.REVOKED);
});


cmd({
	name: "gname",
	fromMe: true,
	desc: lang.GNAME_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if(!args) return await m.reply(lang.GNAME_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupUpdateSubject(from, args)
	return await conn.sendMessage(from, lang.GNAME_SUCCESS.replace("{}", args));
});


cmd({
	name: "gdesc",
	fromMe: true,
	desc: lang.GDESC_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if(!args) return await m.reply(lang.GDESC_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.groupUpdateDescription(from, args)
	return await conn.sendMessage(from, lang.GDESC_SUCCESS.replace("{}", args));
});


cmd({
	name: "joinrequests",
	fromMe: true,
	desc: lang.JOINREQUESTS_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	const allJoinRequests = await conn.groupRequestParticipantsList(from);
	if(allJoinRequests.length === 0) {
	return await m.reply(lang.JOINREQUESTS_NULL);
	}
	if(args) {
	switch(args.toLowerCase()) {
	case 'approve all': {
	await conn.sendMessage(from, lang.JOINREQUESTS_APPROVING.replace("{}", allJoinRequests.length));
	for(let i of allJoinRequests) {
	await conn.groupRequestParticipantsUpdate(from, [i.jid], "approve");
	await delay(900);
	}
	break;
	}
	case 'reject all': {
	await conn.sendMessage(from, lang.JOINREQUESTS_REJECTING.replace("{}", allJoinRequests.length));
	for(let i of allJoinRequests) {
	await conn.groupRequestParticipantsUpdate(from, [i.jid], "reject");
	await delay(900);
	}
	break;
	}
	default: {
	return await m.reply(lang.JOINREQUESTS_INVAILD_PARAMS);
	}
	}
	return;
	}
	const formattedList = allJoinRequests
    .map((item, index) => {
	    const requestVia = item.request_method === "linked_group_join" ? "community_" : item.request_method === "invite_link" ? "invite link_" : `added by @${item.requestor?.split("@")[0]}_`;
	    return `_${index + 1}. @${item.jid.split("@")[0]}_\n_• Request via: ${requestVia}\n_• Requested time: ${new Date(parseInt(item.request_time) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}_`})
    .join('\n\n');
	const jids = allJoinRequests.map(i => i.jid);
	return await conn.sendMessage(from,lang.JOINREQUESTS_FOUND.replace("{}", formattedList), { mentions: jids });
});


cmd({
	name: "leave",
	fromMe: true,
	desc: lang.LEAVE_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	await conn.sendMessage(from, lang.LEAVE_MSG);
	return await conn.groupLeave(from);
});


cmd({
	name: "removegpp",
	fromMe: true,
	desc: lang.REMOVEGPP_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	await conn.removeProfilePicture(from);
	return await conn.sendMessage(from, lang.REMOVEGPP_SUCCESS);
});


cmd({
	name: "gpp",
	fromMe: true,
	desc: lang.GPP_DESC,
	category: "group",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    args = args || m.quoted;
	if (!m.isGroup) return await m.reply(lang.NOT_GROUP);
	
	if(!args) return await m.reply(lang.GPP_ALERT);
	//if (!m.botIsAdmin) return await m.reply(lang.NOT_ADMIN);
	if(m.quoted && !m.quoted.message.imageMessage) return await m.reply(lang.GPP_NOTIMAGE);
	try {
	await conn.updateProfilePicture(from, m.quoted ? await m.quoted.download() : { url: args });
	return await conn.sendMessage(from, lang.GPP_SUCCESS);
	} catch {
	return await m.reply(lang.GPP_FAILED);
	}
});
