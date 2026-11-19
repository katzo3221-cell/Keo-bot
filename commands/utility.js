const { EmbedBuilder } = require('discord.js');
const { DAILY_PROFILE_EXP_LIMIT } = require('../models/User');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getTodayMyanmarDate() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

module.exports = [
  // ၁။ Profile Level နှင့် Battle Level ခွဲပြခြင်း (Kprofile / Klvl / Klevel)
  {
    names: ['profile', 'lvl', 'level'],
    async execute(message, args, user) {
      const pLevel = user.level || 1;
      const pExp = user.exp || 0;
      const pNeeded = pLevel * 150;
      const pProgress = Math.min(10, Math.floor((pExp / pNeeded) * 10));
      const pBar = '🟦'.repeat(pProgress) + '⬜'.repeat(10 - pProgress);

      const bLevel = user.battleLevel || 1;
      const bExp = user.battleExp || 0;
      const bNeeded = bLevel * 100;
      const bProgress = Math.min(10, Math.floor((bExp / bNeeded) * 10));
      const bBar = '🟥'.repeat(bProgress) + '⬜'.repeat(10 - bProgress);

      const todayStr = getTodayMyanmarDate();
      const todayExp = user.dailyProfileExpDate === todayStr ? (user.dailyProfileExpCount || 0) : 0;

      const profileEmbed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: `${message.author.username} ၏ ကိုယ်ရေးအကျဉ်း (Profile)`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: '🏅 Profile Level', value: `**Lv.${pLevel}** (${pExp}/${pNeeded} EXP)`, inline: true },
          { name: '⚔️ Battle Level', value: `**Lv.${bLevel}** (${bExp}/${bNeeded} EXP)`, inline: true },
          { name: '🎁 Lucky Crates (`lc`)', value: `**${user.boxes || 0} လုံး**`, inline: true },
          { name: '🔥 Daily Streak', value: `**${user.dailyStreak || 0} ရက်**`, inline: true },
          { name: '🎒 ပိုင်ဆိုင်သော ပစ္စည်း', value: `**${(user.items || []).length} မျိုး**`, inline: true },
          { name: '📅 ယနေ့ Profile EXP Limit', value: `**${todayExp.toLocaleString()} / ${DAILY_PROFILE_EXP_LIMIT.toLocaleString()} EXP**`, inline: true },
          { name: '📊 Profile Level တိုးတက်မှု', value: `${pBar} (${Math.floor((pExp / pNeeded) * 100)}%)` },
          { name: '💥 Battle Level တိုးတက်မှု', value: `${bBar} (${Math.floor((bExp / bNeeded) * 100)}%)` }
        )
        .setFooter({ text: 'Profile Level တက်တိုင်း Coins နှင့် Lucky Crate (lc) ရရှိပါမည်' });

      return message.reply({ embeds: [profileEmbed] });
    },
  },

  // ၂။ Discord Profile ပုံ ကြည့်ရှုခြင်း (Kavater / Kavatar / Kav / Kpfp)
  {
    names: ['avater', 'avatar', 'av', 'pfp'],
    async execute(message) {
      const target = message.mentions.users.first() || message.author;
      const avatarUrl = target.displayAvatarURL({ size: 1024 });
      const pngUrl = target.displayAvatarURL({ extension: 'png', size: 1024 });
      const jpgUrl = target.displayAvatarURL({ extension: 'jpg', size: 1024 });
      const webpUrl = target.displayAvatarURL({ extension: 'webp', size: 1024 });

      const avatarEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🖼️ ${target.username} ၏ Profile ပုံ (Avatar)`)
        .setDescription(`[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`)
        .setImage(avatarUrl)
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      return message.reply({ embeds: [avatarEmbed] });
    },
  },

  // ၃။ စကားပြန်ပြောခိုင်းခြင်း (Krepeat / Krep / Ksay)
  {
    names: ['repeat', 'rep', 'say'],
    async execute(message, args) {
      if (args.length === 0) {
        return message.reply('❌ ပြောခိုင်းမယ့် စာသား ထည့်ပေးပါ!\nဥပမာ - `Krepeat 3 မင်္ဂလာပါ` သို့မဟုတ် `Krepeat မင်္ဂလာပါ`');
      }

      const MAX_REPEAT = 10;
      let count = 1;
      let text = '';

      if (/^\d+$/.test(args[0])) {
        count = Math.min(Math.max(parseInt(args[0], 10), 1), MAX_REPEAT);
        text = args.slice(1).join(' ');
      } else {
        text = args.join(' ');
      }

      if (!text.trim()) {
        return message.reply('❌ အကြိမ်ရေ နောက်မှာ ပြောခိုင်းမယ့် စာသားပါ ထည့်ပေးပါ! (ဥပမာ - `Krepeat 3 မင်္ဂလာပါ`)');
      }

      const cleanText = text.slice(0, 2000);

      await message.delete().catch(() => {});

      for (let i = 0; i < count; i++) {
        await message.channel.send({
          content: cleanText,
          allowedMentions: { parse: [] },
        });
        if (i < count - 1) {
          await sleep(600);
        }
      }
    },
  },

  // ၄။ Command စာရင်းကြည့်ရန် (Khelp)
  {
    names: ['help'],
    async execute(message) {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Keo Bot အသုံးပြုနည်း Command လမ်းညွှန်')
        .addFields(
          { name: '💰 Economy (စီးပွားရေး)', value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kinv`, `Kgive @user <amount>`, `Ktop`' },
          { name: '🏹 Hunting & Lucky Crate', value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Ksell <id> [အရေအတွက်/all]`, `Ksell all`, `Kopen lc [အရေအတွက်/all]`' },
          { name: '🎲 Gambling (ကျားဖြန့်)', value: '`Kcf <amount/all> [heads/tails]`, `Ks <amount/all>`, `Kd <amount/all> <s/b/t>`, `Kbj <amount/all>`' },
          { name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)', value: '`Kbattle` (`Kb`), `Kbattle @user`, `Kteam <id1> [id2] [id3]`, `Kteam clear`' },
          { name: '🤗 Actions (လှုပ်ရှားမှု ၂၂ မျိုး)', value: '`Kcuddle`, `Khug`, `Kkiss`, `Klick`, `Knom`, `Kpat`, `Kpoke`, `Kslap`, `Kstare`, `Khighfive`, `Kbite`, `Kgreet`, `Kpunch`, `Khandholding`, `Ktickle`, `Kkill`, `Khold`, `Kpats`, `Kwave`, `Kboop`, `Ksnuggle`, `Kbully` (`@user`)' },
          { name: '🛠️ Utility & Profile', value: '`Kprofile` (`Klvl`), `Kavater` (`Kavatar` `[@user]`), `Krepeat [အကြိမ်ရေ] <စာသား>`, `Khelp`' }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    },
  },
];