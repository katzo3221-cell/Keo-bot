const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const ACTIONS = require('../../data/actions');

const API_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const IMG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'image/gif,image/webp,image/*,*/*;q=0.8',
};

async function fetchWithTimeout(url, headers, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url, API_HEADERS, 4500);
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return res.json();
}

// URL မှ GIF ဖိုင် Buffer ကို တိုက်ရိုက် Download ဆွဲပြီး Image ဟုတ်မဟုတ် စစ်ဆေးခြင်း
async function downloadGifAsset(url) {
  const res = await fetchWithTimeout(url, IMG_HEADERS, 6000);
  if (!res.ok) throw new Error(`IMG HTTP ${res.status}`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error(`Not image (${contentType || 'unknown'})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 100 || buffer.length > 7.5 * 1024 * 1024) {
    throw new Error(`Invalid size (${buffer.length} bytes)`);
  }

  let ext = 'gif';
  if (contentType.includes('webp')) ext = 'webp';
  else if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';

  return { buffer, ext, url };
}

// API ၅ ခုမှ GIF URL များ စုရှာပြီး အမှန်တကယ် Download ရသော GIF ဖိုင်ကို ယူခြင်း
async function fetchActionGifAsset(actionData, commandName) {
  const nekosKey = actionData.nekos || commandName;
  const waifuKey = actionData.waifu || commandName;
  const commonKey = actionData.otaku || actionData.nekos || actionData.waifu || commandName;

  const jobs = [
    actionData.nekos !== null && actionData.nekos !== false
      ? fetchJson(`https://nekos.best/api/v2/${encodeURIComponent(nekosKey)}`).then((d) => d?.results?.[0]?.url)
      : Promise.reject(new Error('nekos disabled')),

    actionData.waifu !== null && actionData.waifu !== false
      ? fetchJson(`https://api.waifu.pics/sfw/${encodeURIComponent(waifuKey)}`).then((d) => d?.url)
      : Promise.reject(new Error('waifu disabled')),

    fetchJson(`https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(commonKey)}`).then((d) => d?.url),
    fetchJson(`https://nekos.life/api/v2/img/${encodeURIComponent(commonKey)}`).then((d) => d?.url),
    fetchJson(`https://api.purrbot.site/v2/img/sfw/${encodeURIComponent(commonKey)}/gif`).then((d) => (!d?.error ? d?.link : null)),
  ];

  const settled = await Promise.allSettled(jobs);
  const candidateUrls = [];
  const errors = [];

  for (const r of settled) {
    if (r.status === 'fulfilled' && typeof r.value === 'string' && r.value.startsWith('http')) {
      candidateUrls.push(r.value);
    } else if (r.status === 'rejected') {
      errors.push(r.reason?.message || String(r.reason));
    }
  }

  if (typeof actionData.fallbackGif === 'string' && actionData.fallbackGif.startsWith('http')) {
    candidateUrls.push(actionData.fallbackGif);
  }

  // ရလာသော URL များထဲမှ တကယ် GIF Buffer ဆွဲလို့ရသည့် ပထမဆုံးတစ်ခုကို ယူမည်
  for (const url of candidateUrls) {
    try {
      const asset = await downloadGifAsset(url);
      return asset;
    } catch (dlErr) {
      errors.push(`DL ${url}: ${dlErr.message}`);
    }
  }

  console.error(`Action GIF Failed (${commandName}):`, errors.join(' | '));
  return null;
}

module.exports = [
  {
    names: Object.keys(ACTIONS),
    async execute(message, args, user, commandName) {
      const target = message.mentions.users.first();
      if (!target) {
        return message.reply(`❌ လုပ်ဆောင်မယ့် သူကို Mention ခေါ်ပေးပါ! (ဥပမာ - \`K${commandName} @User\`)`);
      }
      if (target.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်လုပ်လို့ မရပါဘူး! တခြားတစ်ယောက်ကို Mention ခေါ်ပါ။');
      }

      const actionData = ACTIONS[commandName];

      // MongoDB ထဲတွင် တစ်ဦးချင်းစီ အကြိမ်ရေ မှတ်သားခြင်း
      if (!user.actions) user.actions = {};
      const pairKey = `${commandName}_${target.id}`;
      user.actions[pairKey] = (user.actions[pairKey] || 0) + 1;
      user.markModified('actions');

      // DB Save နှင့် GIF Download ကို တစ်ပြိုင်တည်း လုပ်ဆောင်ခြင်း
      const [, gifAsset] = await Promise.all([
        user.save(),
        fetchActionGifAsset(actionData, commandName),
      ]);

      const totalCount = user.actions[pairKey];

      const actionEmbed = new EmbedBuilder()
        .setColor(actionData.color)
        .setTitle(actionData.title)
        .setDescription(`**${message.author.username}** က **${target.username}** ${actionData.actionText}`)
        .setFooter({ text: `စုစုပေါင်း ${totalCount.toLocaleString()} ကြိမ် ${actionData.countLabel}` })
        .setTimestamp();

      const files = [];
      if (gifAsset) {
        const fileName = `${commandName}.${gifAsset.ext}`;
        files.push(new AttachmentBuilder(gifAsset.buffer, { name: fileName }));
        actionEmbed.setImage(`attachment://${fileName}`);
      }

      try {
        return await message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed], files });
      } catch (sendErr) {
        // Channel တွင် Attach Files ခွင့်ပြုချက်မရှိပါက URL ဖြင့် ပြန်ပို့မည်
        if (gifAsset?.url) {
          actionEmbed.setImage(gifAsset.url);
          return message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed] });
        }
        throw sendErr;
      }
    },
  },
];