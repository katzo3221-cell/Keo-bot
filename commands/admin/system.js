const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User } = require('../../models/User');
const { isOwner } = require('../../utils/helpers');
const { parseAmount } = require('../../utils/adminHelper');
const { syncCollection, syncZooStats, syncBattleTeam } = require('../../utils/huntingHelper');

// ကစားသမားအားလုံးထံ Event ဆုကြေး ဝေပေးရာတွင် Confirm ခလုတ်ဖြင့် စစ်ဆေးခြင်း
async function handleGlobalEventReward(message, { type, amount, label }) {
  const activeCount = await User.countDocuments({ isBanned: { $ne: true } });

  const confirmEmbed = new EmbedBuilder()
    .setColor('#F1C40F')
    .setTitle('🎉 Global Event ဆုကြေး ဝေမျှမှု အတည်ပြုချက်')
    .setDescription(
      `Ban မခံထားရသော ကစားသမား **${activeCount.toLocaleString()} ဦး** အားလုံးထံသို့ ${label} တစ်ပြိုင်တည်း ပေးအပ်မှာ သေချာပါသလား?\n` +
      `*(၃၀ စက္ကန့်အတွင်း အတည်ပြုပါ)*`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('event_confirm').setLabel('✅ ပေးအပ်မည်').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('event_cancel').setLabel('❌ ပယ်ဖျက်မည်').setStyle(ButtonStyle.Danger)
  );

  const promptMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });
  const collector = promptMsg.createMessageComponentCollector({ time: 30000 });
  let handled = false;

  collector.on('collect', async (i) => {
    try {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: '❌ Bot Owner ကိုယ်တိုင်သာ အတည်ပြုနိုင်ပါသည်။', ephemeral: true });
      }
      if (handled) return;
      handled = true;

      if (i.customId === 'event_cancel') {
        collector.stop('cancelled');
        return i.update({
          embeds: [new EmbedBuilder().setColor('#95A5A6').setDescription('❌ Event ဆုကြေး ဝေမျှမှုကို ပယ်ဖျက်လိုက်ပါပြီ။')],
          components: [],
        });
      }

      if (i.customId === 'event_confirm') {
        collector.stop('confirmed');
        const incField = type === 'coin' ? { balance: amount } : { boxes: amount };
        const res = await User.updateMany(
          { isBanned: { $ne: true } },
          { $inc: incField }
        );

        return i.update({
          embeds: [
            new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle('🎊 Global Event ဆုကြေး ပေးအပ်ပြီးပါပြီ!')
              .setDescription(`ကစားသမား စုစုပေါင်း **${(res.modifiedCount || 0).toLocaleString()} ဦး** ထံသို့ ${label} ထည့်သွင်းပေးပြီးပါပြီ!`),
          ],
          components: [],
        });
      }
    } catch (err) {
      console.error('Event Reward Error:', err);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time' && !handled) {
      await promptMsg.edit({ components: [] }).catch(() => {});
    }
  });
}

module.exports = [
  // ၁။ Bot စနစ်နှင့် စီးပွားရေး အခြေအနေ ကြည့်ရှုခြင်း (Kbotstats)
  {
    names: ['botstats', 'stats'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const [totalUsers, bannedUsers, hiddenUsers, econAgg] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isBanned: true }),
        User.countDocuments({ isHiddenTop: true }),
        User.aggregate([
          { $match: { isBanned: { $ne: true } } },
          {
            $group: {
              _id: null,
              totalCoins: { $sum: '$balance' },
              totalCrates: { $sum: '$boxes' },
            },
          },
        ]),
      ]);

      const totalCoins = econAgg[0]?.totalCoins || 0;
      const totalCrates = econAgg[0]?.totalCrates || 0;
      const guildCount = message.client.guilds.cache.size;
      const ping = message.client.ws.ping;

      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);

      const statsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Keo Bot စနစ် အခြေအနေ (Bot Stats)')
        .addFields(
          { name: '🌐 Server အရေအတွက်', value: `**${guildCount.toLocaleString()} ခု**`, inline: true },
          { name: '👥 စုစုပေါင်း ကစားသမား', value: `**${totalUsers.toLocaleString()} ဦး**`, inline: true },
          { name: '📶 Ping', value: `**${ping} ms**`, inline: true },
          { name: '🚫 Ban ထားသူ', value: `**${bannedUsers.toLocaleString()} ဦး**`, inline: true },
          { name: '👻 Ktop ဖျောက်ထားသူ', value: `**${hiddenUsers.toLocaleString()} ဦး**`, inline: true },
          { name: '⏱️ Uptime', value: `**${days}ရက် ${hours}နာရီ ${mins}မိနစ်**`, inline: true },
          { name: '💰 လည်ပတ်နေသော Coins', value: `**${totalCoins.toLocaleString()} coins**`, inline: true },
          { name: '🎁 စုစုပေါင်း Crates', value: `**${totalCrates.toLocaleString()} လုံး**`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [statsEmbed] });
    },
  },

  // ၂။ ကစားသမားအားလုံးထံ Event Coins ဝေပေးခြင်း (Keventcoin <amount>)
  {
    names: ['eventcoin', 'eventcoins', 'giveallcoin'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const amount = parseAmount(args[0]);
      if (isNaN(amount)) {
        return message.reply('❌ အသုံးပြုပုံ: `Keventcoin <amount>` (ဥပမာ - `Keventcoin 10000`)');
      }

      return handleGlobalEventReward(message, {
        type: 'coin',
        amount,
        label: `💰 **+${amount.toLocaleString()} coins**`,
      });
    },
  },

  // ၃။ ကစားသမားအားလုံးထံ Event Lucky Crate ဝေပေးခြင်း (Keventcrate <count>)
  {
    names: ['eventcrate', 'eventcrates', 'giveallcrate'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const count = parseAmount(args[0]);
      if (isNaN(count)) {
        return message.reply('❌ အသုံးပြုပုံ: `Keventcrate <count>` (ဥပမာ - `Keventcrate 3`)');
      }

      return handleGlobalEventReward(message, {
        type: 'crate',
        amount: count,
        label: `🎁 **Lucky Crate (\`lc\`) +${count.toLocaleString()} လုံး**`,
      });
    },
  },

  // ၄။ Database ထဲရှိ Zoo Data များကို Number ပြန်ပြောင်းခြင်း နှင့် Top Index များ Sync လုပ်ခြင်း (Kfixzoo)
  {
    names: ['fixzoo', 'synczoo'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const allUsers = await User.find({});
      let updatedUsers = 0;

      for (const u of allUsers) {
        let changed = false;

        if (u.zoo && typeof u.zoo === 'object') {
          const cleanZoo = {};
          for (const [name, rawCount] of Object.entries(u.zoo)) {
            const num = Number(rawCount);
            if (typeof rawCount !== 'number' || isNaN(num) || num <= 0) {
              changed = true;
            }
            if (!isNaN(num) && num > 0) {
              cleanZoo[name] = Math.floor(num);
            }
          }
          if (changed) {
            u.zoo = cleanZoo;
            u.markModified('zoo');
          }
        }

        const prevZooVal = u.zooValue;
        const prevZooCnt = u.zooCount;
        const colChanged = syncCollection(u);
        syncZooStats(u);
        syncBattleTeam(u);

        if (changed || colChanged || prevZooVal !== u.zooValue || prevZooCnt !== u.zooCount) {
          await u.save();
          updatedUsers += 1;
        }
      }

      return message.reply(
        `✅ Database စစ်ဆေးပြီးပါပြီ! စုစုပေါင်း User **${updatedUsers} ဦး** ၏ Zoo Data နှင့် \`Ktop zoo\` / \`Ktop col\` Index များကို ပြန်လည်ညှိနှိုင်းပြီးပါပြီ။`
      );
    },
  },

  // ၅။ Owner အသုံးပြုနိုင်သော Admin Command စာရင်း (Kadminhelp / Kahelp)
  {
    names: ['adminhelp', 'ahelp', 'admin'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('👑 Keo Bot Owner Admin Commands')
        .setDescription('*`@user` သို့မဟုတ် `User ID` နှစ်မျိုးလုံးဖြင့် အသုံးပြုနိုင်ပါသည်*')
        .addFields(
          {
            name: '💰 Economy & Items',
            value:
              '`Kaddcoin <@user/ID> <amount>`\n' +
              '`Kremovecoin <@user/ID> <amount>`\n' +
              '`Ksetcoin <@user/ID> <amount>`\n' +
              '`Kaddcrate <@user/ID> <count>`\n' +
              '`Kaddanimal <@user/ID> <id> [qty]`\n' +
              '`Kadditem <@user/ID> <itemId>`\n' +
              '`Kaddring <@user/ID> <ring1-5> [qty]`\n' +
              '`Ksetlvl <@user/ID> <profile|battle> <lvl>`',
          },
          {
            name: '👻 Ktop Hide & 🛡️ Moderation',
            value:
              '`Khidetop <@user/ID>` • `Kunhidetop <@user/ID>` • `Khiddentop`\n' +
              '`Kban <@user/ID>` • `Kunban <@user/ID>` • `Kbanlist`\n' +
              '`Kcheck <@user/ID>` • `Kresetcd <@user/ID>` • `Kunlockamv <@user/ID>`\n' +
              '`Kresetuser <@user/ID>` *(Confirm ခလုတ်ပါ)*',
          },
          {
            name: '📊 Bot & Global Events',
            value:
              '`Kbotstats` • `Kfixzoo`\n' +
              '`Keventcoin <amount>` • `Keventcrate <count>` *(Confirm ခလုတ်ပါ)*',
          }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    },
  },
  // ၆။ Bot ဝင်ရောက်နေသော Server စာရင်း ကြည့်ရှုခြင်း (Kservers / Ksv)
  {
    names: ['servers', 'svlist', 'sv', 'guilds'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const guilds = Array.from(message.client.guilds.cache.values())
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

      if (guilds.length === 0) {
        return message.reply('❌ Bot ဝင်ရောက်ထားသော Server မရှိသေးပါ။');
      }

      const pageSize = 15;
      const totalPages = Math.ceil(guilds.length / pageSize);
      let page = parseInt(args[0], 10) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;

      const start = (page - 1) * pageSize;
      const pageGuilds = guilds.slice(start, start + pageSize);
      const totalMembers = guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0);

      const lines = pageGuilds.map((g, idx) => {
        const rank = start + idx + 1;
        return `**${rank}. ${g.name}**\n└ ID: \`${g.id}\` • 👥 **${(g.memberCount || 0).toLocaleString()}** ဦး`;
      });

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🌐 Keo Bot ရှိနေသော Server များ (${guilds.length} ခု)`)
        .setDescription(lines.join('\n\n'))
        .setFooter({
          text: `စာမျက်နှာ ${page}/${totalPages} • စုစုပေါင်း Member: ${totalMembers.toLocaleString()} ဦး | နောက်စာမျက်နှာ: Ksv 2`,
        })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    },
  },
];