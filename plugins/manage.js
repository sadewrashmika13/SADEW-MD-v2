const { cmd } = require('../command');
const { setData, getData } = require('../lib');
const {getString, getJson} = require('./pluginsCore');
const lang = getString('group');


cmd({
    name: "rentbot",
    fromMe: true,
    category: "misc",
    desc: "Get instant mini bot without deployment"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!args) {
            return await m.reply("_Example : .rentbot 917012XXXXX_");
        }

        const pair = await getJson(`https://minibot.aswinsparky.qzz.io/code?number=${args}`);

        if (!pair || !pair.code) {
            return await m.reply("Failed to generate pairing code. Please check the number and try again.");
        }

        const pairingCode = pair.code;

        await m.reply(`*🤖 RENT BOT PAIR CODE : ${pairingCode}*

⚡ *Instant Mini Bot Access*

No deployment or hosting needed.
Just pair this mini bot with your WhatsApp number and it will start instantly.

📲 *How to Connect*
1. Open WhatsApp on your phone
2. Go to *Settings > Linked Devices*
3. Tap *Link a Device*
4. Select *Link with Phone Number*
5. Enter the pair code above

✅ Bot will activate immediately after linking.

⏳ *Pair code expires in 2 minutes!*`);

        await m.reply(`${pairingCode}`);

    } catch (error) {
        console.error(error);
        await m.reply("An error occurred while generating the rent bot code. Please try again later.");
    }
});

cmd({
    name: "pair",
    fromMe: true,
    category: "misc",
    desc: ""
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!args) {
            return await m.reply("_Example : .pair 917012XXXXXX_");
        }
        const pair = await getJson(`https://x-bot-md-qr.koyeb.app/code?number=${args}`);
        if (!pair || !pair.code) {
            return await m.reply("Failed to retrieve pairing code. Please check the phone number and try again.");
        }
        const pairingCode = pair.code;
        await m.reply(`*PAIR CODE : ${pairingCode}*\n\n How to Link: 
1. Open WhatsApp on your phone.
2. Go to Settings > Linked Devices.
3. Tap Link a Device then Link with Phone.
4. Enter the pair code above.
5. Alternatively, tap the WhatsApp notification sent to your phone.
\n⏳ *Code expires in 2 minutes!*`);
        await m.reply(`${pairingCode}`);
    } catch (error) {
        console.error(error);
        await m.reply("An error occurred. Please try again later.");
    }
});


cmd({
    name: "repo",
    fromMe: true,
    category: "misc",
    desc: ""
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
const data = await getJson('https://api.github.com/repos/A-S-W-I-N-S-P-A-R-K-Y/X--BOT--MD');
        const repoInfo = `
    _*💻 BOT REPOSITORY*_
        
🔸 *Name:* ${data.name}
🔸 *Stars:* ${data.stargazers_count}
🔸 *Forks:* ${data.forks_count}
🔸 *GitHub Link:* 
https://github.com/A-S-W-I-N-S-P-A-R-K-Y/X--BOT--MD

Hey ${m.pushName}!, Don't forget to star and fork my repository!`;

return m.reply(repoInfo)

});

cmd({
    name: "sc",
    fromMe: true,
    category: "misc",
    desc: ""
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
const data = await getJson('https://api.github.com/repos/A-S-W-I-N-S-P-A-R-K-Y/X--BOT--MD');
        const repoInfo = `
    _*💻 BOT REPOSITORY*_
        
🔸 *Name:* ${data.name}
🔸 *Stars:* ${data.stargazers_count}
🔸 *Forks:* ${data.forks_count}
🔸 *GitHub Link:* 
https://github.com/A-S-W-I-N-S-P-A-R-K-Y/X--BOT--MD

Hey ${m.pushName}!, Don't forget to star and fork my repository!`;

return m.reply(repoInfo)

});
