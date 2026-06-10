const { cmd } = require('../command');
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

cmd({
    name: "tourl",
    category: "misc",
    fromMe: false,
    desc: "Converts replied media into a permanent URL link"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    try {
        if (!m.quoted) {
            return await m.reply("_❌ කරුණාකර ෆොටෝ එකකට, වීඩියෝ එකකට හෝ ඕඩියෝ එකකට Reply කරලා .tourl ගහන්න!_");
        }

        await m.react("🔗");

        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ මීඩියා එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
        }

        const mime = m.quoted.mimetype || m.quoted.msg?.mimetype || "image/jpeg";
        const ext = mime.split("/")[1] || "jpeg";
        const filename = `file_${Date.now()}.${ext}`;

        let finalUrl = null;
        let usedServer = "";

        // 🚀 HOST 1: Uguu.se (Highly Reliable for Cloud Servers)
        try {
            usedServer = "Uguu.se";
            const bodyForm1 = new FormData();
            bodyForm1.append("files[]", media, { filename, contentType: mime });

            const res1 = await axios.post("https://uguu.se/api.php?d=upload-tool", bodyForm1, {
                headers: bodyForm1.getHeaders()
            });

            if (res1.data && res1.data.includes("http")) {
                finalUrl = res1.data.trim();
            }
        } catch (e) {
            console.log("Host 1 (Uguu) failed, switching to Host 2...");
        }

        // 🚀 HOST 2: Tmpfiles.org (Fallback Server)
        if (!finalUrl) {
            try {
                usedServer = "Tmpfiles.org";
                const bodyForm2 = new FormData();
                bodyForm2.append("file", media, { filename, contentType: mime });

                const res2 = await axios.post("https://tmpfiles.org/api/v1/upload", bodyForm2, {
                    headers: bodyForm2.getHeaders()
                });

                if (res2.data && res2.data.status === "success") {
                    // කෙලින්ම ඩවුන්ලෝඩ් කරගන්න පුළුවන් Direct Link එකක් බවට හරවනවා
                    finalUrl = res2.data.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
                }
            } catch (e) {
                throw new Error("Both hosting servers (Uguu & Tmpfiles) rejected the request.");
            }
        }

        // ✨ සාර්ථකව ලින්ක් එක ලැබුණා නම් යවනවා
        if (finalUrl) {
            await m.react("✅");
            let successMsg = `*🔗 YOUR URL IS READY!* \n\n`;
            successMsg += `• *Link:* ${finalUrl}\n`;
            successMsg += `• *Server:* \`${usedServer}\`\n`;
            successMsg += `• *Size:* ${(media.length / (1024 * 1024)).toFixed(2)} MB`;
            return await m.reply(successMsg);
        } else {
            throw new Error("Failed to generate URL from any provider.");
        }

    } catch (error) {
        console.error("Tourl Error:", error);
        await m.react("❌");
        
        let errorMsg = `_❌ Tourl System Error:_\n\`\`\`${error.message || error}\`\`\`\n\n`;
        errorMsg += `*📊 Debug Info:*\n`;
        errorMsg += `• Error Code: \`${error.code || "UNKNOWN"}\`\n`;
        errorMsg += `• Response: \`${error.response?.data ? JSON.stringify(error.response.data) : "No Response Data"}\`\n`;
        
        return await m.reply(errorMsg);
    }
});
