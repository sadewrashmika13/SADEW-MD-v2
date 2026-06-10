const { cmd } = require('../command');
const figlet = require("figlet");

function getArgsText(args, m) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();

    return (
        m.text?.replace(/^[./!#]art\s*/i, "") ||
        m.body?.replace(/^[./!#]art\s*/i, "") ||
        m.quoted?.text ||
        ""
    ).trim();
}

function makeArt(text) {
    return new Promise((resolve, reject) => {
        figlet.text(text, {
            font: "Standard",
            horizontalLayout: "default",
            verticalLayout: "default",
            width: 80,
            whitespaceBreak: true
        }, (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    });
}

cmd({
    name: "art",
    alias: ["ascii", "textart"],
    category: "tools",
    fromMe: false,
    desc: "Text එක ASCII art style එකට convert කරන්න"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        const text = getArgsText(args, m);

        if (!text) {
            return await m.reply(
                "🎨 Art කරන්න text එකක් දෙන්න මචං.\n\n" +
                "උදා:\n.art sadew"
            );
        }

        if (text.length > 20) {
            return await m.reply("❌ Text එක දිග වැඩියි මචං. characters 20 ට අඩුවෙන් දෙන්න.");
        }

        await m.react?.("🎨");

        const art = await makeArt(text);

        await m.reply(
            "```" + "\n" +
            art +
            "\n" + "```" +
            "\n\n> © SADEW-MD"
        );

        await m.react?.("✅");
    } catch (err) {
        console.log("Art command error:", err);
        await m.react?.("❌");
        await m.reply("❌ Art එක හදන්න බැරි වුණා.\n\nහේතුව: " + err.message);
    }
});
