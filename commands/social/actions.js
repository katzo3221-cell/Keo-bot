const { EmbedBuilder } = require('discord.js');
const ACTIONS = require('../../data/actions');

const FETCH_HEADERS = {
  'User-Agent': 'KeoBot/1.0 (Discord Bot)',
  Accept: 'application/json',
};

async function fetchJson(url, timeoutMs = 4500) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

// API ၃ ခု (nekos.best, waifu.pics, otakugifs) ကို တစ်ပြိုင်တည်း ခေါ်ပြီး အမြန်ဆုံးရသော GIF URL ယူခြင်း
async function fetchActionGif(actionData, commandName) {
  const providers = [];

  if (actionData.nekos !== null && actionData.nekos !== false) {
    const nekosKey = actionData.nekos || commandName;
    providers.push(async () => {
      const data = await fetchJson(`https://nekos.best/api/v2/${encodeURIComponent(nekosKey)}`);
      const url = data?.results?.[0]?.url;
      if (!url || !url.startsWith('http')) throw new Error('Invalid nekos.best URL');
      return url;
    });
  }

  if (actionData.waifu !== null && actionData.waifu !== false) {
    const waifuKey = actionData.waifu || commandName;
    providers.push(async () => {
      const data = await fetchJson(`https://api.waifu.pics/sfw/${encodeURIComponent(waifuKey)}`);
      const url = data?.url;
      if (!url || !url.startsWith('http')) throw new Error('Invalid waifu.pics URL');
      return url;
    });
  }

  const otakuKey = actionData.otaku || actionData.nekos || actionData.waifu || commandName;
  if (otakuKey) {
    providers.push(async () => {
      const data = await fetchJson(`https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(otakuKey)}`);
      const url = data?.url;
      if (!url || !url.startsWith('http')) throw new Error('Invalid otakugifs URL');
      return url;
    });
  }

  try {
    return await Promise.any(providers.map((fn) => fn()));
  } catch (err) {
    const reasons = err?.errors?.map((e) => e.message).join(' | ') || err.message;
    console.error(`Action GIF Fetch Error (${commandName}):`, reasons);
    if (typeof actionData.fallbackGif === 'string' && actionData.fallbackGif.startsWith('http')) {
      return actionData.fallbackGif;
    }
    return null;
  }
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

      // DB Save နှင့် GIF Fetch ကို တစ်ပြိုင်တည်း လုပ်ဆောင်ခြင်း
      const [, gifUrl] = await Promise.all([
        user.save(),
        fetchActionGif(actionData, commandName),
      ]);

      const totalCount = user.actions[pairKey];

      const actionEmbed = new EmbedBuilder()
        .setColor(actionData.color)
        .setTitle(actionData.title)
        .setDescription(`**${message.author.username}** က **${target.username}** ${actionData.actionText}`)
        .setFooter({ text: `စုစုပေါင်း ${totalCount.toLocaleString()} ကြိမ် ${actionData.countLabel}` })
        .setTimestamp();

      if (gifUrl) {
        actionEmbed.setImage(gifUrl);
      }

      return message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed] });
    },
  },
];