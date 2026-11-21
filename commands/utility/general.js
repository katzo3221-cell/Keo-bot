const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { isOwner } = require('../../utils/helpers');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = [
  // ၁။ စကားပြန်ပြောခိုင်းခြင်း (Krepeat / Krep / Ksay) — Spam ကာကွယ်မှု ပါဝင်သည်
  {
    names: ['repeat', 'rep', 'say'],
    async execute(message, args) {
      if (args.length === 0) {
        return message.reply('❌ ပြောခိုင်းမယ့် စာသား ထည့်ပေးပါ!\nဥပမာ - `Krepeat 3 မင်္ဂလာပါ` သို့မဟုတ် `Krepeat မင်္ဂလာပါ`');
      }

      const isAdminOrOwner =
        isOwner(message.author.id) ||
        Boolean(message.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages));

      const maxRepeat = isAdminOrOwner ? 10 : 3;
      const maxLength = isAdminOrOwner ? 2000 : 300;

      let count = 1;
      let text = '';

      if (/^\d+$/.test(args[0])) {
        count = Math.min(Math.max(parseInt(args[0], 10), 1), maxRepeat);
        text = args.slice(1).join(' ');
      } else {
        text = args.join(' ');
      }

      if (!text.trim()) {
        return message.reply('❌ အကြိမ်ရေ နောက်မှာ ပြောခိုင်းမယ့် စာသားပါ ထည့်ပေးပါ! (ဥပမာ - `Krepeat 3 မင်္ဂလာပါ`)');
      }

      const cleanText = text.slice(0, maxLength);

      // Server Admin / Owner များအတွက်သာ မူရင်း Message ကို ဖျက်ပေးမည်
      if (isAdminOrOwner) {
        await message.delete().catch(() => {});
      }

      for (let i = 0; i < count; i++) {
        await message.channel.send({
          content: cleanText,
          allowedMentions: { parse: [] },
        });
        if (i < count - 1) {
          await sleep(700);
        }
      }
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
          {
            name: '💰 Economy (စီးပွားရေး)',
            value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kuse <id>`, `Kinv`, `Kgive @user <amount>`, `Ktop [cash/lvl/battle/zoo/col]`',
          },
          {
            name: '🏹 Hunting, Zoo & Collection',
            value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Kzoo id` (`Kzooid`), `Kcol [@user] [rank]`, `Ksell <id> [အရေအတွက်/all]`, `Ksell <rank>`, `Ksell all`, `Kopen lc [အရေအတွက်/all]`',
          },
          {
            name: '🎲 Gambling & PvP (Max Bet: 250,000 coins)',
            value: '`Kcf <amount/all> [h/t]`, `Ks <amount/all>`, `Kd <amount/all> <s/b/t>`, `Kbj [@user] <amount/all>`, `Kskm [@user] <amount/all>`, `Kgin <amount/all> [အကောင်]`, `Kmine <amount/all> [ဗုံး 1-6]` (3×3), `Kmines <amount/all> [ဗုံး 1-11]` (4×4), `Krps @user <amount/all>`',
          },
          {
            name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)',
            value: '`Kbattle` (`Kb`), `Kbattle @user`, `Kteam <id1> [id2] [id3]`, `Kteam clear`',
          },
          {
            name: '🤗 Actions (လှုပ်ရှားမှု ၂၂ မျိုး)',
            value: '`Kcuddle`, `Khug`, `Kkiss`, `Klick`, `Knom`, `Kpat`, `Kpoke`, `Kslap`, `Kstare`, `Khighfive`, `Kbite`, `Kgreet`, `Kpunch`, `Khandholding`, `Ktickle`, `Kkill`, `Khold`, `Kpats`, `Kwave`, `Kboop`, `Ksnuggle`, `Kbully` (`@user`)',
          },
          {
            name: '💍 Marriage (လက်ထပ်စနစ်)',
            value: '`Kbuy <ring1-5>`, `Kmarry @user <ring1-5>`, `Kdivorce`, `Kprofile [@user]`',
          },
          {
            name: '🛠️ Utility, Quest & Profile',
            value: '`Kprofile [@user]` (`Klvl`), `Kcd`, `Kquest` (`Kquest claim`), `Kavatar` (`[@user]`), `Krepeat [အကြိမ်ရေ] <စာသား>`, `Khelp`',
          }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    },
  },
];