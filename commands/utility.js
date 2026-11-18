const { EmbedBuilder } = require('discord.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // ၂။ စကားပြန်ပြောခိုင်းခြင်း (Krepeat / Krep / Ksay)
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

      // မူရင်း Command စာသားကို ဖျက်ပေးခြင်း (Permission ရှိလျှင်)
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

  // ၃။ Command စာရင်းကြည့်ရန် (Khelp)
  {
    names: ['help'],
    async execute(message) {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Keo Bot အသုံးပြုနည်း Command လမ်းညွှန်')
        .addFields(
          { name: '💰 Economy (စီးပွားရေး)', value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kinv`, `Kgive @user <amount>`, `Ktop`' },
          { name: '🏹 Hunting & Box', value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Ksellall`, `Kopen` (`Kbox`)' },
          { name: '🎲 Gambling (ကျားဖြန့်)', value: '`Kcf <amount/all> [heads/tails]`, `Ks <amount/all>`, `Kd <amount/all> <s/b/t>`, `Kbj <amount/all>`' },
          { name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)', value: '`Kbattle` (`Kb`) သို့မဟုတ် `Kbattle @user`' },
          { name: '🤗 Actions (လှုပ်ရှားမှု ၂၂ မျိုး)', value: '`Kcuddle`, `Khug`, `Kkiss`, `Klick`, `Knom`, `Kpat`, `Kpoke`, `Kslap`, `Kstare`, `Khighfive`, `Kbite`, `Kgreet`, `Kpunch`, `Khandholding`, `Ktickle`, `Kkill`, `Khold`, `Kpats`, `Kwave`, `Kboop`, `Ksnuggle`, `Kbully` (`@user`)' },
          { name: '🛠️ Utility & Profile', value: '`Kprofile` (`Klvl`), `Krepeat [အကြိမ်ရေ] <စာသား>`, `Khelp`' }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    },
  },
];