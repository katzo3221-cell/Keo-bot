const { EmbedBuilder } = require('discord.js');
const ACTIONS = require('../data/actions');

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
      await user.save();

      const totalCount = user.actions[pairKey];

      // nekos.best နှင့် waifu.pics API များမှ Anime GIF လှမ်းယူခြင်း
      let gifUrl = actionData.fallbackGif;
      try {
        let fetched = false;
        if (actionData.nekos) {
          const res = await fetch(`https://nekos.best/api/v2/${actionData.nekos}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.results?.[0]?.url) {
              gifUrl = data.results[0].url;
              fetched = true;
            }
          }
        }
        if (!fetched && actionData.waifu) {
          const res = await fetch(`https://api.waifu.pics/sfw/${actionData.waifu}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.url) gifUrl = data.url;
          }
        }
      } catch (apiErr) {
        console.error('Action GIF Fetch Error:', apiErr);
      }

      const actionEmbed = new EmbedBuilder()
        .setColor(actionData.color)
        .setTitle(actionData.title)
        .setDescription(`**${message.author.username}** က **${target.username}** ${actionData.actionText}`)
        .setImage(gifUrl)
        .setFooter({ text: `စုစုပေါင်း ${totalCount.toLocaleString()} ကြိမ် ${actionData.countLabel}` })
        .setTimestamp();

      return message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed] });
    },
  },
];