const { cmd } = require('../command');
const axios = require("axios");

cmd(
  {
    name: "ai2",
    fromMe: false,
    category: "ai",
    desc: "Chat with FeelBetter AI naturally in Sinhala.",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    if (!args || args.trim() === "") {
      return await conn.sendMessage(
        from, 
        { text: "❌ *Usage:* `.ai2 ඔයාට දැනගන්න ඕනේ දේ ටයිප් කරන්න.*" }, 
        { quoted: m }
      );
    }

    const queryText = args.trim();
    await m.react('🧠');

    try {
      // සිංහලෙන් විතරක් උත්තර ගන්න දාපු සරල Instruction එක
      const systemPrompt = "Instruction: Answer the following user question strictly and naturally in Sinhala language. User Question: ";
      const finalQuery = systemPrompt + queryText;

      const response = await axios.get("https://whiteshadow-x-api.onrender.com/api/ai/feelbetter", {
        params: {
          text: finalQuery,
          apitoken: "VK4fry"
        },
        timeout: 15000
      });

      if (!response || !response.data) {
        await m.react('❌');
        return await conn.sendMessage(
          from,
          { text: "⚠️ *AI Error:* API සර්වර් එකෙන් කිසිම ප්‍රතිචාරයක් ලැබුණේ නැහැ මචං." },
          { quoted: m }
        );
      }

      let replyAnswer = "";
      let resData = response.data;

      // JSON String එකක් ආවොත් Object එකක් බවට පත් කිරීම
      if (typeof resData === "string") {
        try {
          resData = JSON.parse(resData);
        } catch (e) {
          replyAnswer = resData;
        }
      }

      // 🌟 FeelBetter API එකේ "answer" කෑල්ල විතරක් වෙන් කරලා ගන්නා සුපිරි Logic එක
      if (resData && typeof resData === "object") {
        let mainData = resData.answer || resData.response || resData.result || resData.reply || resData.data;
        
        if (mainData && typeof mainData === "object") {
          replyAnswer = mainData.text || mainData.answer || mainData.response || JSON.stringify(mainData);
        } else if (mainData) {
          replyAnswer = String(mainData);
        }
      }

      // Regex Extraction එකත් "answer" එක අල්ලන විදිහට අප්ඩේට් කරා මචං
      if (!replyAnswer || replyAnswer === "[object Object]" || replyAnswer === "{}") {
        const rawString = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        const match = rawString.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/) || rawString.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (match && match[1]) {
          replyAnswer = match[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
        }
      }

      // අවසාන පියවර
      if (!replyAnswer || replyAnswer === "[object Object]" || replyAnswer === "{}") {
        replyAnswer = typeof resData === "object" ? (resData.answer || JSON.stringify(resData)) : String(resData);
      }

      await m.react('💬');
      
      const captionText = `🤖 *AI ANSWER (FEELBETTER AI)*\n\n${replyAnswer}\n\n*POWERED BY SADEW-MD*`;
      
      await conn.sendMessage(from, { text: captionText }, { quoted: m });

    } catch (error) {
      await m.react('❌');
      console.error("FeelBetter API Error:", error.message);
      
      let errorMsg = `❌ *AI Error:* ${error.message}`;
      if (error.message.includes("timeout")) {
        errorMsg = "❌ *Timeout:* සර්වර් එකෙන් Response එක එන්න ගොඩක් වෙලා යනවා මචං.";
      }
      
      await conn.sendMessage(from, { text: errorMsg }, { quoted: m });
    }
  }
);
