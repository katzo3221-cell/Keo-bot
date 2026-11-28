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

// API တချို့တွင် နာမည်တူ Endpoint မရှိသော Action များအတွက် Backup Endpoint ချိတ်ဆက်ခြင်း
const EXTRA_API_MAP = {
  kill: { preferWaifu: true, waifu: 'kill', nekos: ['shoot', 'punch'], otaku: 'punch' },
  bonk: { preferWaifu: true, waifu: 'bonk', nekos: ['slap', 'punch'], otaku: 'smack' },
  bully: { preferWaifu: true, waifu: 'bully', nekos: ['kick', 'poke'], otaku: 'punch' },
  punch: { nekos: ['punch'], waifu: 'bonk', otaku: 'punch' },
  shoot: { nekos: ['shoot'], waifu: 'kill', otaku: 'punch' },
  sad: { nekos: ['cry'], waifu: 'cry', otaku: 'cry' },
  angry: { nekos: ['pout', 'baka'], waifu: 'bully', otaku: 'mad' },
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

// URL မှ GIF ဖိုင် Buffer ကို တိုက်ရိုက် Download ဆွဲပြီး စစ်ဆေးခြင်း
async function downloadGifAsset(url) {
  const res = await fetchWithTimeout(url, IMG_HEADERS, 7000);
  if (!res.ok) throw new Error(`IMG HTTP ${res.status}`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const looksLikeImgUrl = /\.(gif|webp|png|jpe?g)(\?.*)?$/i.test(url);
  if (!contentType.startsWith('image/') && !looksLikeImgUrl) {
    throw new Error(`Not image (${contentType || 'unknown'})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 100 || buffer.length > 7.5 * 1024 * 1024) {
    throw new Error(`Invalid size (${buffer.length} bytes)`);
  }

  let ext = 'gif';
  if (contentType.includes('webp') || /\.webp(\?.*)?$/i.test(url)) ext = 'webp';
  else if (contentType.includes('png') || /\.png(\?.*)?$/i.test(url)) ext = 'png';
  else if (contentType.includes('jpeg') || contentType.includes('jpg') || /\.jpe?g(\?.*)?$/i.test(url)) ext = 'jpg';

  return { buffer, ext, url };
}

// API များမှ GIF URL စုရှာပြီး Download ရသော ပထမဆုံး GIF ကို ယူခြင်း
async function fetchActionGifAsset(actionData, commandName) {
  const mapped = EXTRA_API_MAP[commandName] || null;

  const nekosKeys = mapped?.nekos
    ? mapped.nekos
    : actionData.nekos
      ? [actionData.nekos]
      : [commandName];

  const waifuKey = mapped?.waifu || (actionData.waifu !== false ? actionData.waifu || commandName : null);
  const otakuKey = mapped?.otaku || actionData.otaku || nekosKeys[0] || commandName;
  const fallbackKey = nekosKeys[0] || commandName;

  const waifuJob = waifuKey
    ? () => fetchJson(`https://api.waifu.pics/sfw/${encodeURIComponent(waifuKey)}`).then((d) => d?.url)
    : null;

  const nekosJobs = nekosKeys.map(
    (key) => () => fetchJson(`https://nekos.best/api/v2/${encodeURIComponent(key)}`).then((d) => d?.results?.[0]?.url)
  );

  const otherJobs = [
    () => fetchJson(`https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(otakuKey)}`).then((d) => d?.url),
    () => fetchJson(`https://nekos.life/api/v2/img/${encodeURIComponent(fallbackKey)}`).then((d) => d?.url),
    () => fetchJson(`https://api.purrbot.site/v2/img/sfw/${encodeURIComponent(fallbackKey)}/gif`).then((d) => (!d?.error ? d?.link : null)),
  ];

  // kill / bonk / bully အတွက် waifu.pics ကို ဦးစားပေးပြီး မရပါက nekos.best Backup ယူမည်
  const orderedJobs = mapped?.preferWaifu
    ? [waifuJob, ...nekosJobs, ...otherJobs].filter(Boolean)
    : [...nekosJobs, waifuJob, ...otherJobs].filter(Boolean);

  const settled = await Promise.allSettled(orderedJobs.map((fn) => fn()));
  const candidateUrls = [];
  const errors = [];

  for (const r of settled) {
    if (r.status === 'fulfilled' && typeof r.value === 'string' && r.value.startsWith('http')) {
      if (!candidateUrls.includes(r.value)) candidateUrls.push(r.value);
    } else if (r.status === 'rejected') {
      errors.push(r.reason?.message || String(r.reason));
    }
  }

  if (typeof actionData.fallbackGif === 'string' && actionData.fallbackGif.startsWith('http')) {
    candidateUrls.push(actionData.fallbackGif);
  }

  for (const url of candidateUrls) {
    try {
      return await downloadGifAsset(url);
    } catch (dlErr) {
      errors.push(`DL ${url}: ${dlErr.message}`);
    }
  }

  // Buffer Download အကုန်မအောင်မြင်ပါက ရထားသော URL ကို တိုက်ရိုက်သုံးပေးခြင်း
  if (candidateUrls.length > 0) {
    console.warn(`Action GIF Download Fallback (${commandName}):`, errors.join(' | '));
    return { buffer: null, ext: 'gif', url: candidateUrls[0] };
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
      if (gifAsset?.buffer) {
        const fileName = `${commandName}.${gifAsset.ext}`;
        files.push(new AttachmentBuilder(gifAsset.buffer, { name: fileName }));
        actionEmbed.setImage(`attachment://${fileName}`);
      } else if (gifAsset?.url) {
        actionEmbed.setImage(gifAsset.url);
      }

      try {
        return await message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed], files });
      } catch (sendErr) {
        if (gifAsset?.url) {
          actionEmbed.setImage(gifAsset.url);
          return message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed] });
        }
        throw sendErr;
      }
    },
  },
];