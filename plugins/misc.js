const { cmd } = require("../command");
const config = require("../config.js");


cmd({
		name: "jid",
		fromMe: false,
		category: "misc",
		desc: "Gets the unique ID of a whatsapp chat or user."
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		return await m.reply(`${m?.quoted ? m?.quoted?.sender : from}`);
	});


cmd({
		name: "runtime",
		fromMe: false,
		category: "misc",
		desc: "Shows the bot's current runtime."
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		return await m.reply(`_Runtime : ${await m.runtime()}_`);
	});


cmd({
		name: "ping",
		fromMe: false,
		category: "misc",
		desc: "Checks if the bot is online and responsive."
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		const start = new Date().getTime();
		let pong = await conn.sendMessage(from, "_Checking Ping..._", {
			quoted: m
		});
		const end = new Date().getTime();
		return await conn.sendMessage(from, `_${config.PING} : ${end - start} ms_`, {
			edit: pong.key
		});
	});


cmd({
		name: "wame",
		fromMe: false,
		category: "misc",
		desc: "Converts a phone number into a whatsapp link."
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		return await m.reply(`https://wa.me/${m?.quoted ? m?.quoted?.sender?.split("@")[0] : m?.sender?.split("@")[0]}${args ? `?text=${args}` : ''}`);
	});
