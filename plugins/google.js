const { cmd } = require('../command');
const googleIt = require('google-it');

cmd({
    name: "google",
    category: "search",
    fromMe: false,
    desc: "Search Google without API key"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        // args එක string එකක්ද array එකක්ද කියලා බලලා හරියට සකස් කිරීම
        let query = Array.isArray(args) ? args.join(" ") : (typeof args === 'string' ? args : "");
        
        // මීට අමතරව message එකෙන් කෙලින්ම text එක ගැනීම (Backup එකක් විදිහට)
        if (!query) {
            query = m.body ? m.body.split(" ").slice(1).join(" ") : "";
        }

        if (!query || query.trim() === "") {
            return await m.reply("*🔍 මොනවා ගැනද හොයන්න ඕනේ? (උදා: .google Sri Lanka)*");
        }

        await m.reply("*⏳ හොයමින් පවතී... පොඩ්ඩක් ඉන්න.*");

        const results = await googleIt({ query: query.trim() });

        if (!results || results.length === 0) {
            return await m.reply("*❌ ප්‍රතිඵල කිසිවක් හමුවුණේ නැහැ.*");
        }

        let msg = `*🌐 Google සෙවුම් ප්‍රතිඵල: ${query.trim()}*\n\n`;
        
        for (let i = 0; i < Math.min(5, results.length); i++) {
            msg += `*${i + 1}. ${results[i].title}*\n`;
            msg += `📝 ${results[i].snippet}\n`;
            msg += `🔗 ${results[i].link}\n\n`;
        }

        return await m.reply(msg);
        
    } catch (e) {
        console.error(e);
        return await m.reply("*❌ සෙවුම අසාර්ථකයි: " + e.message + "*");
    }
});
