const { cmd } = require('../command');
const { getJson, extractUrlsFromText, getString, isUrl } = require("./pluginsCore");
const axios = require('axios');
const fetch = require('node-fetch');
const gis = require("g-i-s");
const config = require("../config.js");
const lang = getString('download');


cmd(
    {
        name: "insta",
        fromMe: false,
        desc: "Instagram media downloader - download images and videos from Instagram",
        category: "downloader",
    }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
        args = args || m.quoted?.text;
        if (!args) return await m.reply(lang.NEED_URL);
        //if (isUrl(args)) return await m.reply(lang.NOT_URL);
        try {
            await m.react('⬇️');
            let response = await getJson(config.API + "/api/downloader/igdl?url=" + args);
            for (let i of response.data) {
                await conn.sendMessage(from, i.url, { quoted: m }, i.type)
            }
            await m.react('✅');
        } catch (e) {
            console.log(e);
            await m.react('❌');
        }
    }
);

cmd({
    name: "sparky",
    fromMe: false,
    category: "misc",
    desc: "AI chat with memory"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if(!config.GROQ_API_KEY) return m.reply(lang.ERROR);
    args = args || m.quoted?.text;
    if (!args) return m.reply(lang.AI_HI);

    try {
        const chatId = from;
        let history = getMessages(chatId) || [];
        history = history
            .filter(msg => msg && msg.role && msg.content)
            .map(msg => ({
                role: msg.role,
                content: String(msg.content)
            }))
        const messages = [
            {
                role: "system",
                content: lang.AI_SYS
            },
            ...history,
            { role: "user", content: args }
        ];
        addMessage(chatId, "user", args);
        const getResult = await askGroq(messages);
        addMessage(chatId, "assistant", getResult);
        return m.reply(getResult);
    } catch (err) {
        console.log("ERROR:", err.message);
        return m.reply(lang.ERROR);
    }
});



// cmd(
//     {
//         name: "img",
//         fromMe: false,
//         desc: "Google Image search",
//         category: "downloader",
//     },
//     async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
//         try {
//             async function gimage(query, amount = 5) {
//                 let list = [];
//                 return new Promise((resolve, reject) => {
//                     gis(query, async (error, result) => {
//                         for (
//                             var i = 0;
//                             i < (result.length < amount ? result.length : amount);
//                             i++
//                         ) {
//                             list.push(result[i].url);
//                             resolve(list);
//                         }
//                     });
//                 });
//             }
//             if (!args) return await m.reply("Enter Query,Number");
//             let [query,
//                 amount] = args.split(",");
//             let result = await gimage(query, amount);
//             await m.reply(
//                 `_Downloading ${amount || 5} images for ${query}_`
//             );
//             for (let i of result) {
//                 await conn.sendMessage(from, i, {}, "image")
//             }

//         } catch (e) {
//             console.log(e)
//         }
//     }
// );

cmd({
    name: "pintrest",
    fromMe: false,
    category: "downloader",
    desc: "Download images and content from Pinterest",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let match = args || m.quoted?.text;
        if (!match) return await m.reply(lang.NEED_URL);
        await m.react('⬇️');
        //if (!match.includes("pin.it")) return await m.reply("_Please provide a valid Pinterest URL_");
        const result = await getJson(config.API + "/api/downloader/pin?url=" + match);
        await m.sendFromUrl(result.data.url, { caption: result.data.created_at });
        await m.react('✅');
    } catch (error) {
        await m.react('❌');
        console.error(error);
    }
});

cmd({
    name: "fb",
    fromMe: false,
    category: "downloader",
    desc: "Download files from Facebook by providing a valid URL",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let match = args || m.quoted?.text;
        if (!match) return await m.reply(lang.NEED_URL);
        await m.react('⬇️');
        const data = await getJson(config.API + "/api/downloader/fbdl?url=" + match);
        await m.sendFromUrl(data.data.high, { caption: data.data.title });
        await m.react('✅');
    } catch (error) {
        await m.react('❌');
        return m.reply(error);
    }
});

cmd({
    name: "spotify",
    fromMe: false,
    category: "downloader",
    desc: "play a song"
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        args = args || m.quoted?.text;
        if(!args) return await m.reply(lang.NEED_Q);
  await m.react('🔎');
  const ser = await getJson(config.API + "/api/search/spotify?search=" + args)
  const play = ser.data[0];
        await m.react('⬇️');
        await m.reply(`${lang.WAIT} ${play.name} By ${play.artists}`)
  const url = await spdl(play.link);
  await conn.sendMessage(from , url, { mimetype: "audio/mpeg" } , "audio")
   await m.react('✅');     
    } catch (error) {
        await m.react('❌');
        m.reply(error);
    }
  });

  cmd({
    name: "spotifydl",
    fromMe: false,
    category: "downloader",
    desc: "play a song"
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        args = args || m.quoted?.text;
        if(!args) return await m.reply(lang.NEED_URL);
        await m.react('⬇️');
  const url = await spdl(args);
  await conn.sendMessage(from , url, { mimetype: "audio/mpeg" } , "audio")
   await m.react('✅');     
    } catch (error) {
        await m.react('❌');
        m.reply(error);
    }
  });

// cmd({
//     name: "xnxx",
//     fromMe: false,
//     category: "downloader",
//     desc: "Download media from XNXX by search or URL",
// },
// async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
//     try {
//         let match = args || m.quoted?.text;
//         if (!match) return await m.reply(lang.NEED_Q);
//             await m.react('🔎');
//             const { result } = await getJson(config.API + "/api/search/xnxx?search=" + match);
//             await m.react('⬇️');
//             var xnxx = result.result[0].link
//             const xdl = await getJson(`${config.API}/api/downloader/xnxx?url=${xnxx}`)
//             await m.sendFromUrl(xdl.data.files.high, { caption: xdl.data.title });
//         await m.react('✅');
//     } catch (error) {
//         await m.react('❌');
//         m.reply(error);
//     }
// });


cmd({
    name: "terabox",
    fromMe: false,
    category: "downloader",
    desc: "Download files from TeraBox by providing a valid URL",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let match = args || m.quoted?.text;
        if (!match) return await m.reply(lang.NEED_URL);
        await m.react('⬇️');
        const { data } = await getJson(config.API + "/api/downloader/terrabox?url=" + match);
        await m.sendFromUrl(data.data.url, { caption: data.data.title });
        await m.react('✅');
    } catch (error) {
        await m.react('❌');
        console.error(error);
    }
});


cmd({
    name: "gitclone",
    fromMe: false,
    category: "downloader",
    desc: "Download GitHub repositories as ZIP files",
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let match = args || m.quoted?.text;
        if (!isUrl(match)) return await m.reply(lang.NEED_URL)
        await m.react('⬇️');
        let user = match.split("/")[3];
        let repo = match.split("/")[4];
        const msg = await m.reply(lang.DOWNLOADING);
        await conn.sendMessage(from, {
            document: {
                url: `https://api.github.com/repos/${user}/${repo}/zipball`
            },
            fileName: repo,
            mimetype: "application/zip"
        }, {
            quoted: m
        });
        await m.react('✅');
    } catch (error) {
        await m.react('❌');
        console.error(error);
    }
});
