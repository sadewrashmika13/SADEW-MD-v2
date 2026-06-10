const { cmd } = require('../command');
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// 🧠 ෆොටෝ එකතු කරලා තියාගන්නා සර්වර් සෙෂන් එක
global.pdfSessions = global.pdfSessions || {};

cmd({
    name: "pdf",
    category: "misc",
    fromMe: false,
    desc: "Combine multiple images or a single image into a PDF"
}, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const userId = m.sender;
    
    // 🔥 බොට් ෆ්‍රේම්වර්ක් එකේ ලෙඩ බයිපාස් කරන්න කෙලින්ම මැසේජ් බොඩි එකෙන්ම වචන අල්ලනවා
    const msgText = (m.body || m.text || text || "").trim().toLowerCase();
    const isExport = msgText.includes("export") || msgText.includes("done") || msgText.includes("download");
    const isClear = msgText.includes("clear") || msgText.includes("reset");

    // 📄 1. PDF එක නිපදවා බාගත කිරීම (.pdf export)
    if (isExport) {
        if (!global.pdfSessions[userId] || global.pdfSessions[userId].length === 0) {
            await m.react("❌");
            return await m.reply("_❌ ඔයා තවම කිසිම ෆොටෝ එකක් එකතු කරලා නැහැ මචං!_");
        }

        await m.react("⏳");
        let tempPdf = path.join(__dirname, `temp_pdf_out_${Date.now()}.pdf`);
        let tempImages = [];

        try {
            const doc = new PDFDocument({ size: "A4", margin: 0 });
            const writeStream = fs.createWriteStream(tempPdf);
            doc.pipe(writeStream);

            const sessionImages = global.pdfSessions[userId];

            for (let i = 0; i < sessionImages.length; i++) {
                let imgBuffer = sessionImages[i];
                let tempImgPath = path.join(__dirname, `temp_pdf_page_${Date.now()}_${i}.jpg`);
                fs.writeFileSync(tempImgPath, imgBuffer);
                tempImages.push(tempImgPath);

                if (i > 0) doc.addPage({ size: "A4", margin: 0 });

                doc.image(tempImgPath, 0, 0, {
                    fit: [595.28, 841.89],
                    align: "center",
                    valign: "center"
                });
            }

            doc.end();

            writeStream.on("finish", async () => {
                try {
                    const pdfBuffer = fs.readFileSync(tempPdf);
                    
                    if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
                    tempImages.forEach(img => { if (fs.existsSync(img)) fs.unlinkSync(img); });
                    
                    delete global.pdfSessions[userId]; // වැඩේ ඉවර නිසා සෙෂන් එක මකනවා

                    await m.react("✅");
                    return await conn.sendMessage(from, {
                        document: pdfBuffer,
                        mimetype: "application/pdf",
                        fileName: `SADEW-MD_${Date.now()}.pdf`
                    }, { quoted: m });
                } catch (err) { console.error(err); }
            });

        } catch (error) {
            console.error(error);
            await m.react("❌");
            return await m.reply(`_❌ PDF Export Error: ${error.message}_`);
        }
        return;
    }

    // 🧹 2. ලිස්ට් එක Clear කිරීම (.pdf clear)
    if (isClear) {
        if (global.pdfSessions[userId]) {
            delete global.pdfSessions[userId];
            await m.react("🧹");
            return await m.reply("_🧹 එකතු කරපු ෆොටෝ ලිස්ට් එක සාර්ථකව අයින් කරා මචං!_");
        }
        return await m.reply("_❌ ඔයාගේ ඇක්ටිව් ලිස්ට් එකක් නැහැ._");
    }

    // 📥 3. ෆොටෝ එකින් එක එකතු කරගැනීම (.pdf)
    if (!m.quoted) {
        let usageMsg = `*📄 SADEW-MD MULTI-IMAGE PDF TOOL 📄*\n\n`;
        usageMsg += `• *ෆොටෝ එකතු කරන්න:* ඕනෑම ෆොටෝ එකකට රිප්ලයි කරලා \`*.pdf*\` ගහන්න.\n`;
        usageMsg += `• *PDF එක හදන්න:* ෆොටෝ ඔක්කොම එකතු කරලා ඉවර වුණාම \`*.pdf export*\` කියලා ටයිප් කරලා යවන්න.\n`;
        usageMsg += `• *Reset කරන්න:* එකතු කරපු ෆොටෝ අයින් කරන්න \`*.pdf clear*\` ගහන්න.\n\n`;
        if (global.pdfSessions[userId] && global.pdfSessions[userId].length > 0) {
            usageMsg += `📊 *ඔයා දැනට ෆොටෝ ${global.pdfSessions[userId].length}ක් එකතු කරලා තියෙන්නේ!*`;
        }
        return await m.reply(usageMsg);
    }

    // 🔥 BULLETPROOF IMAGE DETECTION
    const mime = m.quoted.mimetype || m.quoted.msg?.mimetype || "";
    const type = m.quoted.type || "";
    const isImage = mime.startsWith("image/") || 
                    type.includes("image") || 
                    m.quoted.msg?.imageMessage || 
                    m.quoted.message?.imageMessage;

    if (!isImage) {
        return await m.reply("_❌ කරුණාකර නිවැරදි ෆොටෝ එකකට Reply කරලා .pdf ගහන්න මචං!_");
    }

    await m.react("📥");
    const media = await m.quoted.download().catch(() => null);
    
    if (!media) {
        await m.react("❌");
        return await m.reply("_❌ ෆොටෝ එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
    }

    if (!global.pdfSessions[userId]) global.pdfSessions[userId] = [];
    global.pdfSessions[userId].push(media);
    await m.react("➕");

    return await m.reply(`*✅ ෆොටෝ එක සාර්ථකව එකතු කරගත්තා! (මුළු ගණන: ${global.pdfSessions[userId].length})*\n\n💡 _ඊළඟ ෆොටෝ එකටත් රිප්ලයි කරලා \`.pdf\` ගහන්න. ඔක්කොම එකතු කරලා ඉවර වුණාම_ \`*.pdf export*\` _කියලා මැසේජ් එකක් දාන්න මචං._`);
});