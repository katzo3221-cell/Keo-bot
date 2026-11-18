const { EmbedBuilder } = require('discord.js');

module.exports = [
  // ၁။ Level, EXP နှင့် Profile ကြည့်ရှုခြင်း (Kprofile / Klvl / Klevel)
  {
    names: ['profile', 'lvl', 'level'],
    async execute(message, args, user) {
      const neededExp = user.level * 100;
      const progress = Math.min(10, Math.floor((user.exp / neededExp) * 10));
      const progressBar = '🟦'.repeat(progress) + '⬜'.repeat(10 - progress);

      const profileEmbed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: `${message.author.username} ၏ ကိုယ်ရေးအကျဉ်း (Profile)`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: '🏅 Level', value: `**Level ${user.level}**`, inline: true },
          { name: '✨ EXP', value: `**${user.exp} / ${neededExp} EXP**`, inline: true },
          { name: '🔥 Daily Streak', value: `**${user.dailyStreak || 0} ရက်**`, inline: true },
          { name: '🎁 Mystery Boxes', value: `**${user.boxes || 0} လုံး**`, inline: true },
          { name: '🎒 ပိုင်ဆိုင်သော ပစ္စည်း', value: `**${(user.items || []).length} မျိုး**`, inline: true },
          { name: '📊 Level တက်ရန် တိုးတက်မှု', value: `${progressBar} (${Math.floor((user.exp / neededExp) * 100)}%)` }
        )
        .setFooter({ text: 'လက်ကျန်ငွေ စစ်ဆေးရန် Kcash ကို ရိုက်ပါ' });

      return message.reply({ embeds: [profileEmbed] });
    },
  },

  // ၂။ Command စာရင်းကြည့်ရန် (Khelp)
  {
    names: ['help'],
    async execute(message) {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Keo Bot အသုံးပြုနည်း Command လမ်းညွှန်')
        .addFields(
          { name: '💰 Economy (စီးပွားရေး)', value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kgive @user <amount>`, `Ktop`' },
          { name: '🏹 Hunting & Box', value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Ksellall`, `Kopen` (`Kbox`)' },
          { name: '🎲 Gambling (ကျားဖြန့်)', value: '`Kcf <amount/all> [heads/tails]`, `Ks <amount/all>`, `Kd <amount/all> <s/b/t>`, `Kbj <amount/all>`' },
          { name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)', value: '`Kbattle` (`Kb`) သို့မဟုတ် `Kbattle @user`' },
          { name: '🤗 Actions (လှုပ်ရှားမှု ၂၂ မျိုး)', value: '`Kcuddle`, `Khug`, `Kkiss`, `Klick`, `Knom`, `Kpat`, `Kpoke`, `Kslap`, `Kstare`, `Khighfive`, `Kbite`, `Kgreet`, `Kpunch`, `Khandholding`, `Ktickle`, `Kkill`, `Khold`, `Kpats`, `Kwave`, `Kboop`, `Ksnuggle`, `Kbully` (`@user`)' },
          { name: '📈 Level & Profile', value: '`Kprofile`, `Klvl`, `Klevel`' }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    },
  },
];