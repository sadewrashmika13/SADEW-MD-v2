const { cmd } = require('../command');
const {getString, appendMp3Data, convertToMp3, addExifToWebP, getBuffer, getJson} = require('./pluginsCore');
const googleTTS = require('google-tts-api');
const config = require('../config.js');
const lang = getString('converters');

cmd({
    name: "url",
    fromMe: true,
    desc: "",
    category: "converters",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!m.quoted) {
      return m.reply('Reply to an Image/Video/Audio');
    }
    try {
        await m.react('⏫');
      const mediaBuffer = await m.quoted.download();
      const mediaUrl = await handleMediaUpload(mediaBuffer);
      await m.react('✅');
      m.reply(mediaUrl);
    } catch (error) {
        await m.react('❌');
      m.reply('An error occurred while uploading the media.');
    }
  });

cmd(
  {
    name: "trt",
    fromMe: true,
    desc: "Translate text to a given language",
    category: "converters",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
      if (!args) return await m.reply('_Reply to any text with lang_\n_Eg : trt ml_');
      const trtxt = m.quoted?.text;
      const trtlang = args;
      const trt = await getJson(`${config.API}/api/search/translate?text=${trtxt}&lang=${trtlang}`)
      return m.reply(`${trt.result}`);
    } catch (e) {
      console.error(e);
    }
  }
);

cmd(
    {
        name: "vv",
        fromMe: true,
        category: "converters",
        desc: "Resends the view Once message"
    }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
        if (!m.quoted) {
            return m.reply("_Reply to ViewOnce Message !_");
        }
        try {
            m.react("⏫");
		let buff = await m.quoted.download();
		return await m.sendFile(buff);
        } catch (e) {
            return m.react("❌");
        } 
    });

cmd({
		name: "sticker",
		fromMe: false,
		category: "converters",
		desc: lang.STICKER_DESC
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		if (!m.quoted || !(m.quoted.message.imageMessage || m.quoted.message.videoMessage)) {
			return await m.reply(lang.STICKER_ALERT);
		}
		await m.react('⏫');
		await conn.sendMessage(from, await m.quoted.download(), {
			packName: args.split(';')[0] || config.STICKER_DATA.split(';')[0],
			authorName: args.split(';')[1] || config.STICKER_DATA.split(';')[1],
			quoted: m
		}, "sticker");
		return await m.react('✅');
	});


cmd({
		name: "mp3",
		fromMe: false,
		category: "converters",
		desc: lang.MP3_DESC
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		if (!m.quoted || !(m.quoted.message.audioMessage || m.quoted.message.videoMessage || (m.quoted.message.documentMessage && m.quoted.message.documentMessage.mimetype === 'video/mp4'))) {
			return await m.reply(lang.MP3_ALERT);
		}
		await m.react('⏫');
		await conn.sendMessage(from, await convertToMp3(await m.quoted.download()), { mimetype: "audio/mpeg", quoted: m }, 'audio');
		return await m.react('✅');
	});


cmd({
		name: "take",
		fromMe: false,
		category: "converters",
		desc: lang.TAKE_DESC
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		if (!m.quoted || !(m.quoted.message.stickerMessage || m.quoted.message.audioMessage || m.quoted.message.imageMessage || m.quoted.message.videoMessage)) return m.reply('reply to a sticker/audio');
		await m.react('⏫');
        if (m.quoted.message.stickerMessage || m.quoted.message.imageMessage || m.quoted.message.videoMessage) {
            args = args || config.STICKER_DATA;
            return await conn.sendMessage(from, await m.quoted.download(), {
			packName: `${args.split(';')[0]}` || `${config.STICKER_DATA.split(';')[0]}`,
			authorName: `${args.split(';')[1]}` || `${config.STICKER_DATA.split(';')[1]}`,
			quoted: m
		}, "sticker");
        } else if (m.quoted.message.audioMessage) {
            const opt = {
                title: args ? args.split(/[|,;]/) ? args.split(/[|,;]/)[0] : args : config.AUDIO_DATA.split(/[|,;]/)[0] ? config.AUDIO_DATA.split(/[|,;]/)[0] : config.AUDIO_DATA,
                body: args ? args.split(/[|,;]/)[1] : config.AUDIO_DATA.split(/[|,;]/)[1],
                image: (args && args.split(/[|,;]/)[2]) ? args.split(/[|,;]/)[2] : config.AUDIO_DATA.split(/[|,;]/)[2]
            }
            const Data = await AudioData(await convertToMp3(await m.quoted.download()), opt);
            return await conn.sendMessage(from ,Data,{
                mimetype: 'audio/mpeg'
            },'audio');
        }
		await m.react('✅');
	});


cmd({
		name: "photo",
		fromMe: false,
		category: "converters",
		desc: lang.PHOTO_DESC
	}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
		if (!m.quoted || !m.quoted.message.stickerMessage || m.quoted.message.stickerMessage.isAnimated) {
			return await m.reply(lang.PHOTO_ALERT);
		}
		await m.react('⏫');
		await conn.sendMessage(from, await m.quoted.download(), {
			quoted: m
		}, "image");
		return await m.react('✅');
	});

	cmd(
		{
			name: "tts",
			fromMe: false,
			category: "converters",
			desc: "text to speech"
		}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
			if (!args) {
				m.reply('_Enter Query!_')
			} else {
				let [txt,
					lang] = args.split`:`
				const audio = googleTTS.getAudioUrl(`${txt}`, {
					lang: lang || "ml",
					slow: false,
					host: "https://translate.google.com",
				})
				conn.sendMessage(from, {
					audio: {
						url: audio,
					},
					mimetype: 'audio/mpeg',
					ptt: false,
					fileName: `${'tts'}.mp3`,
				}, {
					quoted: m,
				})
	
			}
		});


cmd(
		{
			name: "say",
			fromMe: false,
			category: "converters",
			desc: "text to speech"
		}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
			if (!args) {
				m.reply('_Enter Query!_')
			} else {
				let [txt,
					lang] = args.split`:`
				const audio = googleTTS.getAudioUrl(`${txt}`, {
					lang: lang || "en",
					slow: false,
					host: "https://translate.google.com",
				})
				conn.sendMessage(from, {
					audio: {
						url: audio,
					},
					mimetype: 'audio/mpeg',
					ptt: true,
					fileName: `${'tts'}.mp3`,
				}, {
					quoted: m,
				})
	
			}
		});

cmd(
  {
    name: "doc",
    fromMe: false,
    category: "converters",
    desc: "Convert replied media to document",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
      if (
        !m.quoted ||
        !(
          m.quoted.message.imageMessage ||
          m.quoted.message.videoMessage ||
          m.quoted.message.audioMessage ||
          m.quoted.message.documentMessage ||
          m.quoted.message.stickerMessage
        )
      ) {
        return await m.reply("_Replay to a meadia_");
      }
      await m.react("⏳");
      const buffer = await m.quoted.download();
      const mimetype =
        m.quoted.message.imageMessage?.mimetype ||
        m.quoted.message.videoMessage?.mimetype ||
        m.quoted.message.audioMessage?.mimetype ||
        m.quoted.message.documentMessage?.mimetype ||
        "application/octet-stream";

      let filename = args || "file";

      if (!filename.includes(".")) {
        const ext = mimetype.split("/")[1] || "bin";
        filename += `.${ext}`;
      }

      await conn.sendMessage(
        from,
        {
          document: buffer,
          mimetype,
          fileName: filename,
        },
        { quoted: m }
      );

      await m.react("✅");

    } catch (err) {
      console.log(err);
      await m.react("❌");
      m.reply("Error converting media 😅");
    }
  }
);
cmd(
  {
    name: "nondoc",
    fromMe: false,
    category: "converters",
    desc: "Return document back to original media",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
      const quoted = m.quoted;
      if (!quoted || !quoted.message?.documentMessage)
        return m.reply("_Reply to a document message_");
      const mime = quoted.message.documentMessage.mimetype;
	  await m.react("⏳");
      const buffer = await quoted.download();
      let type = "document";
      if (mime.startsWith("image")) type = "image";
      else if (mime.startsWith("video")) type = "video";
      else if (mime.startsWith("audio")) type = "audio";
      await conn.sendMessage(from,
        buffer,
        { mimetype: mime, quoted: m },
        type
      );
	  await m.react("✅");

    } catch (err) {
      console.log(err);
	  await m.react("❌");
      m.reply("Error restoring media 😅");
    }
  }
);