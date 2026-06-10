const { cmd } = require('../command');
const axios = require("axios");

// යූසර් දෙන ටෙක්ස්ට් එක හරියටම ෆිල්ටර් කරලා ගන්න ෆන්ක්ෂන් එක
function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

cmd({
    name: "fancy",
    alias: ["font", "style", "fancytext"],
    category: "tools",
    fromMe: false,
    desc: "✨ සාමාන්‍ය අකුරු Fancy Fonts බවට පත් කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        let text = getQuery(args);
        
        if (!text) {
            return m.reply(`✨ *Fancy Text Generator*

*Usage:* ${m.prefix}fancy <text>
*Example:* ${m.prefix}fancy Sadew`);
        }

        await m.react("⏳");
        await conn.sendPresenceUpdate('composing', from);

        const query = encodeURIComponent(text);
        
        // 1 වෙනි එක ඔයාගේ API එක
        const apis = [
            `https://apex-xx.vercel.app/api/fancy?text=${query}`,
            `https://bk9.fun/tools/fancy?text=${query}`,
            `https://api.vreden.my.id/api/fancytext?text=${query}`,
            `https://api.vreden.my.id/api/styletext?text=${query}`
        ];

        let fancyResult = null;

        for (let i = 0; i < apis.length; i++) {
            try {
                console.log(`[Fancy] ට්‍රයි කරන්නේ API ${i + 1}: ${apis[i]}`);
                const response = await axios.get(apis[i], { timeout: 15000 });
                
                if (response.status === 200 && response.data) {
                    // API එකේ පවතින දත්ත ව්‍යුහය උකහා ගැනීම
                    let result = response.data.result || response.data.data || response.data;
                    if (result) {
                        fancyResult = result;
                        console.log(`[Fancy] API ${i + 1} එක සාර්ථකයි!`);
                        break; 
                    }
                }
            } catch (error) {
                console.log(`[Fancy] API ${i + 1} වැඩ කළේ නැහැ. ඊළඟ එක බලනවා...`);
            }
        }

        // කිසිම API එකක් වැඩ නොකළොත් මුල් ටෙක්ස්ට් එක දානවා
        if (!fancyResult) {
            fancyResult = text;
        }

        // 🛠️ ලැබුණු දත්ත Baileys Crash නොවෙන විදිහට String එකක් බවට පත් කිරීමේ කොටස
        let finalOutput = "";

        if (Array.isArray(fancyResult)) {
            // Array එකක් ආවොත් (ලිස්ට් එකක් නම්)
            finalOutput = fancyResult.map(v => {
                if (typeof v === 'object' && v !== null) {
                    return v.result || v.styled || v.text || Object.values(v)[0] || JSON.stringify(v);
                }
                return String(v);
            }).join('\n\n');
        } 
        else if (typeof fancyResult === 'object' && fancyResult !== null) {
            // ඔයාගේ API එකෙන් වගේ සාමාන්‍ය Object එකක් (JSON) ආවොත් ඒකෙන් Text ටික වෙන් කරගන්නවා
            let styles = [];
            for (let key in fancyResult) {
                if (typeof fancyResult[key] === 'string') {
                    styles.push(fancyResult[key]);
                } else if (typeof fancyResult[key] === 'object' && fancyResult[key] !== null) {
                    let nestedVal = fancyResult[key].result || fancyResult[key].styled || Object.values(fancyResult[key])[0];
                    if (nestedVal) styles.push(String(nestedVal));
                }
            }
            
            if (styles.length > 0) {
                finalOutput = styles.join('\n\n');
            } else {
                finalOutput = JSON.stringify(fancyResult, null, 2);
            }
        } 
        else {
            // කෙලින්ම String එකක් ආවොත්
            finalOutput = String(fancyResult);
        }

        // දැන් බය නැතුව WhatsApp එකට Message එක යවනවා
        await m.reply(finalOutput);
        await m.react("✅");

    } catch (e) {
        console.error("Fancy Command Error:", e);
        await m.react("❌");
        m.reply("❌ Error එකක් ආවා මචං! කරුණාකර නැවත උත්සාහ කරන්න.");
    }
});
