const axios = require("axios");
const {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto,
} = require("@whiskeysockets/baileys");
const { cmd } = require('../command');

const API_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";
const WHITESHADOW_API =
  "https://whiteshadow-x-api.onrender.com/api/search/tiktok";
const TIKWM_SEARCH_API = "https://tikwm.com/api/feed/search";
const MAX_RESULTS = Number(process.env.TS_MAX_RESULTS || 6);
const MAX_VIDEO_MB = Number(process.env.TS_MAX_VIDEO_MB || 45);
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

const EMOJI_SEARCH = "\uD83D\uDD0D";
const EMOJI_SUCCESS = "\u26A1";
const EMOJI_ERROR = "\u274C";
const EMOJI_DOWNLOAD = "\uD83D\uDCE5";
const OUTER_HEADER_TITLE = toFullWidth("LOADING... WHITESHADOW");
const OUTER_FOOTER_TEXT = "| POWERED BY SADEW-MD";
const CARD_FOOTER_TEXT = "WHITESHADOW LITE BOT";

function toFullWidth(text) {
  return String(text).replace(/[A-Z0-9.]/g, (char) => {
    if (char === ".") return "\uFF0E";
    return String.fromCharCode(char.charCodeAt(0) + 0xfee0);
  });
}

function getJid(m) {
  return from || m.chat || m.from || m.key?.remoteJid;
}

function getSearchQuery(args) {
  if (Array.isArray(args)) return args.join(" ").trim();
  if (typeof args === "string") return args.trim();
  return "";
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}\u2026`;
}

function pickResultsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.videos)) return payload.data.videos;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toAbsoluteTikwmUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `https://tikwm.com${url}`;
  return url;
}

function createProto(type, value) {
  if (type?.fromObject) return type.fromObject(value);
  if (type?.create) return type.create(value);
  return value;
}

function buildTikTokPageUrl(video) {
  const id = pickFirstString(video.id, video.video_id, video.aweme_id);
  const username = pickFirstString(
    video.author?.unique_id,
    video.author?.username,
    video.author_unique_id,
    video.username,
    video.unique_id
  );

  if (id && username) return `https://www.tiktok.com/@${username}/video/${id}`;
  return "";
}

function normalizeVideo(rawVideo, index) {
  const title = pickFirstString(
    rawVideo.title,
    rawVideo.caption,
    rawVideo.desc,
    rawVideo.description,
    rawVideo.text,
    `TikTok Result ${index + 1}`
  );
  const author = pickFirstString(
    rawVideo.author?.nickname,
    rawVideo.author?.unique_id,
    rawVideo.nickname,
    rawVideo.username
  );
  const body = pickFirstString(
    rawVideo.caption,
    rawVideo.desc,
    rawVideo.description,
    rawVideo.hashtags,
    author ? `Creator: ${author}` : "",
    title
  );
  const thumbnail = toAbsoluteTikwmUrl(
    pickFirstString(
      rawVideo.thumbnail,
      rawVideo.cover,
      rawVideo.dynamic_cover,
      rawVideo.origin_cover,
      rawVideo.image,
      rawVideo.thumb
    )
  );
  const directVideo = toAbsoluteTikwmUrl(
    pickFirstString(
      rawVideo.play,
      rawVideo.wmplay,
      rawVideo.hdplay,
      rawVideo.video,
      rawVideo.video_url,
      rawVideo.play_url,
      rawVideo.download,
      rawVideo.download_url,
      rawVideo.no_watermark,
      rawVideo.nowm,
      rawVideo.nwm_video_url
    )
  );
  const pageUrl = pickFirstString(
    rawVideo.url,
    rawVideo.link,
    rawVideo.share_url,
    rawVideo.shareUrl,
    rawVideo.webpage_url,
    buildTikTokPageUrl(rawVideo)
  );

  return {
    title,
    body,
    thumbnail,
    directVideo,
    url: pageUrl || directVideo,
  };
}

async function safeReact(m, emoji) {
  try {
    await m.react?.(emoji);
  } catch (error) {
    console.error("ts command react error:", error);
  }
}

async function sendText(m, client, text) {
  const jid = getJid(m);

  if (typeof m.reply === "function") return m.reply(text);
  if (typeof m.sendMsg === "function") return m.sendMsg(jid, text, { quoted: m });
  if (typeof client?.sendMessage === "function") {
    return conn.sendMessage(jid, { text }, { quoted: m });
  }

  throw new Error("No supported text send method found");
}

async function fetchWhiteShadowResults(searchQuery) {
  const endpoint = `${WHITESHADOW_API}?query=${encodeURIComponent(
    searchQuery
  )}&apitoken=${API_TOKEN}`;

  const { data } = await axios.get(endpoint, { timeout: 15000 });
  return pickResultsArray(data).map(normalizeVideo);
}

async function fetchTikwmResults(searchQuery) {
  const body = new URLSearchParams({
    keywords: searchQuery,
    count: String(MAX_RESULTS),
    cursor: "0",
  });

  const { data } = await axios.post(TIKWM_SEARCH_API, body, {
    timeout: 15000,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      Referer: "https://tikwm.com/",
    },
  });

  return pickResultsArray(data).map(normalizeVideo);
}

async function fetchTikTokResults(searchQuery) {
  try {
    console.log(`Searching TikTok via TikWM for: ${searchQuery}`);
    const videos = await fetchTikwmResults(searchQuery);
    const usable = videos
      .filter((video) => video.url && video.directVideo)
      .slice(0, MAX_RESULTS);
    if (usable.length) return usable;
  } catch (error) {
    console.error("TikWM Search API error:", error.message);
  }

  console.log(`Searching TikTok via WhiteShadow for: ${searchQuery}`);
  const videos = await fetchWhiteShadowResults(searchQuery);
  const usable = videos
    .filter((video) => video.url && video.directVideo)
    .slice(0, MAX_RESULTS);

  if (!usable.length) throw new Error("No downloadable TikTok videos found");
  return usable;
}

async function downloadVideoBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 25000,
    maxContentLength: MAX_VIDEO_BYTES,
    maxBodyLength: MAX_VIDEO_BYTES,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      Referer: "https://tikwm.com/",
      Accept: "video/mp4,video/*,*/*",
    },
  });

  const buffer = Buffer.from(response.data);
  if (!buffer.length) throw new Error("Downloaded video buffer is empty");
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error(`Video is bigger than ${MAX_VIDEO_MB}MB`);
  }

  return buffer;
}

async function prepareVideoHeader(client, video) {
  if (!video.directVideo) throw new Error("Missing direct video URL");

  console.log(`Downloading carousel video buffer for: ${video.title}`);
  const buffer = await downloadVideoBuffer(video.directVideo);
  const media = await prepareWAMessageMedia(
    {
      video: buffer,
      mimetype: "video/mp4",
    },
    {
      upload: conn.waUploadToServer,
    }
  );

  if (!media.videoMessage) throw new Error("Baileys did not create videoMessage");

  media.videoMessage.mimetype = "video/mp4";
  media.videoMessage.gifPlayback = false;

  return media.videoMessage;
}

async function buildCarouselCards(client, videos) {
  const InteractiveMessage = proto.Message.InteractiveMessage;
  const cards = [];

  for (const video of videos) {
    try {
      const videoMessage = await prepareVideoHeader(client, video);
      const card = createProto(InteractiveMessage, {
        header: createProto(InteractiveMessage.Header, {
          title: truncateText(video.title, 30),
          hasMediaAttachment: true,
          videoMessage,
        }),
        body: createProto(InteractiveMessage.Body, {
          text: truncateText(video.body, 60),
        }),
        footer: createProto(InteractiveMessage.Footer, {
          text: CARD_FOOTER_TEXT,
        }),
        nativeFlowMessage: createProto(InteractiveMessage.NativeFlowMessage, {
          buttons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `${EMOJI_DOWNLOAD} Download Video`,
                id: `.tiktok ${video.url}`,
              }),
            },
          ],
        }),
      });

      cards.push(card);
    } catch (error) {
      console.error(`TS video card skipped: ${video.title}`, error.message);
    }
  }

  return cards;
}

async function sendCarousel(m, client, searchQuery, videos) {
  const jid = getJid(m);
  const InteractiveMessage = proto.Message.InteractiveMessage;
  const CarouselMessage =
    InteractiveMessage?.CarouselMessage || proto.Message.CarouselMessage;

  if (!InteractiveMessage) throw new Error("InteractiveMessage proto not found");
  if (!CarouselMessage) throw new Error("CarouselMessage proto not found");
  if (typeof client?.relayMessage !== "function") {
    throw new Error("conn.relayMessage is not available");
  }

  const cards = await buildCarouselCards(client, videos);
  if (!cards.length) throw new Error("Could not process any video cards");

  const interactiveMessage = createProto(InteractiveMessage, {
    header: createProto(InteractiveMessage.Header, {
      title: OUTER_HEADER_TITLE,
      hasMediaAttachment: false,
    }),
    body: createProto(InteractiveMessage.Body, {
      text: `${EMOJI_SEARCH} TikTok Search: ${searchQuery}`,
    }),
    footer: createProto(InteractiveMessage.Footer, {
      text: OUTER_FOOTER_TEXT,
    }),
    carouselMessage: createProto(CarouselMessage, {
      cards,
      messageVersion: 1,
    }),
  });

  const message = generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage,
        },
      },
    },
    {
      quoted: m,
    }
  );

  await conn.relayMessage(jid, message.message, {
    messageId: message.key.id,
  });
}

async function sendFallbackList(m, client, searchQuery, videos) {
  const lines = [
    `${EMOJI_SEARCH} TikTok search results for: ${searchQuery}`,
    "",
    ...videos.slice(0, MAX_RESULTS).map((video, index) => {
      const title = truncateText(video.title || `TikTok Result ${index + 1}`, 80);
      return `${index + 1}. ${title}\n${video.url}`;
    }),
  ];

  return sendText(m, client, lines.join("\n\n"));
}

cmd(
  {
    name: "ts",
    fromMe: false,
    category: "search",
    desc: "Search TikTok videos and display in a beautiful carousel grid.",
    description: "Search TikTok videos and display in a beautiful carousel grid.",
  }, async (conn, mek, m, { from, q, isOwner, reply, prefix, pushname, sessionId }) => {
    const args = q;
    const searchQuery = getSearchQuery(args);

    if (!searchQuery) {
      return sendText(m, client, `${EMOJI_ERROR} *Usage:* \`.ts sadew\``);
    }

    try {
      await safeReact(m, EMOJI_SEARCH);

      const videos = await fetchTikTokResults(searchQuery);

      try {
        await sendCarousel(m, client, searchQuery, videos);
      } catch (carouselError) {
        console.error("TS video carousel failed, sending fallback:", carouselError);
        await sendFallbackList(m, client, searchQuery, videos);
      }

      await safeReact(m, EMOJI_SUCCESS);
    } catch (error) {
      console.error("Main TS Command Error:", error);
      await safeReact(m, EMOJI_ERROR);

      return sendText(
        m,
        client,
        `${EMOJI_ERROR} TikTok search failed.\nReason: ${
          error?.response?.data?.message || error.message || "Unknown Error"
        }`
      );
    }
  }
);
