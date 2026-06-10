const sendMainMenu = async (conn, from, quoted) => {
  await conn.sendMessage(from, {
    text: '📂 *Select a Category*',
    buttons: [
      { buttonId: 'btn_check', buttonText: { displayText: '✅ Check' }, type: 1 },
      { buttonId: 'btn_download', buttonText: { displayText: '⬇️ Download' }, type: 1 },
      { buttonId: 'btn_search', buttonText: { displayText: '🔍 Search' }, type: 1 },
      { buttonId: 'btn_owner', buttonText: { displayText: '👑 Owner' }, type: 1 },
      { buttonId: 'btn_other', buttonText: { displayText: '✨ Other' }, type: 1 }
    ],
    footer: 'SADEW MD 💎 • Premium Edition',
    headerType: 1,
  }, { quoted });
};

const handleButtonResponse = async (conn, selected, from, quoted) => {
  switch (selected) {
    case 'btn_check':
      return conn.sendMessage(from, { text: '✅ System check complete.' }, { quoted });

    case 'btn_download':
      return conn.sendMessage(from, {
        text: '⬇️ *Choose what to download:*',
        buttons: [
          { buttonId: '.song', buttonText: { displayText: '🎶 Download Song' }, type: 1 },
          { buttonId: '.video', buttonText: { displayText: '📹 Download Video' }, type: 1 }
        ],
        footer: 'SADEW MD ▪ Download Center',
        headerType: 1
      }, { quoted });

    case 'btn_search':
      return conn.sendMessage(from, { text: '🔍 What are you looking for?' }, { quoted });

    case 'btn_owner':
      return conn.sendMessage(from, { text: '👑 Owner Contact: Sadew 💎' }, { quoted });

    case 'btn_other':
      return conn.sendMessage(from, { text: '✨ More tools coming soon…' }, { quoted });

    default:
      return conn.sendMessage(from, { text: '🤔 Unknown button pressed.' }, { quoted });
  }
};

module.exports = { sendMainMenu, handleButtonResponse };
