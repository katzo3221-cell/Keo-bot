const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User, getUser } = require('../../models/User');
const { isOwner } = require('../../utils/helpers');
const { resolveAdminTarget } = require('../../utils/adminHelper');
const { syncCollection, syncZooStats } = require('../../utils/huntingHelper');
const ANIMALS = require('../../data/animals');

module.exports = [
  // ၁။ Ktop စာရင်းအားလုံးမှ ဖျောက်ထားခြင်း (Khidetop <@user/ID>)
  {
    names: ['hidetop', 'tophide'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Khidetop <@user/ID>`');
      }

      target.dbUser.isHiddenTop = true;
      await target.dbUser.save();

      return message.reply(`👻 **${target.username}** (\`${target.id}\`) ကို \`Ktop\` စာရင်းအားလုံးမှ ဖျောက်ထားလိုက်ပါပြီ! *(Bot ကို ပုံမှန် ဆက်ကစားနိုင်ပါသည်)*`);
    },
  },

  // ၂။ Ktop စာရင်းထဲ ပြန်ပေါ်စေခြင်း (Kunhidetop <@user/ID>)
  {
    names: ['unhidetop', 'showtop', 'topshow'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kunhidetop <@user/ID>`');
      }

      target.dbUser.isHiddenTop = false;
      await target.dbUser.save();

      return message.reply(`👁️ **${target.username}** (\`${target.id}\`) ကို \`Ktop\` စာရင်းများတွင် ပြန်လည်ပြသပေးလိုက်ပါပြီ!`);
    },
  },

  // ၃။ Ktop မှ ဖျောက်ထားသူစာရင်း ကြည့်ခြင်း (Khiddentop)
  {
    names: ['hiddentop', 'hidetoplist'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const hiddenUsers = await User.find({ isHiddenTop: true }, 'userId username balance level').lean();
      if (hiddenUsers.length === 0) {
        return message.reply('👁️ လက်ရှိ `Ktop` စာရင်းမှ ဖျောက်ထားသော ကစားသမား မရှိပါ။');
      }

      const lines = hiddenUsers
        .slice(0, 30)
        .map((u, idx) => `${idx + 1}. **${u.username || 'Unknown'}** (\`${u.userId}\`) — 💰 ${(u.balance || 0).toLocaleString()} • Lv.${u.level || 1}`);

      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`👻 Ktop မှ ဖျောက်ထားသူများ (${hiddenUsers.length} ဦး)`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ပြန်ဖော်ရန်: Kunhidetop <@user/ID>' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    },
  },

  // ၄။ Bot အသုံးပြုခွင့် ပိတ်ပင်ခြင်း (Kban <@user/ID>)
  {
    names: ['ban', 'botban'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kban <@user/ID>`');
      }
      if (isOwner(target.id)) {
        return message.reply('❌ Bot Owner ကို ပိတ်ပင်၍ မရပါ။');
      }

      target.dbUser.isBanned = true;
      await target.dbUser.save();

      return message.reply(`🚫 **${target.username}** (\`${target.id}\`) ကို Keo Bot အသုံးပြုခွင့် ပိတ်ပင်လိုက်ပါပြီ။`);
    },
  },

  // ၅။ Bot အသုံးပြုခွင့် ပြန်ဖွင့်ပေးခြင်း (Kunban <@user/ID>)
  {
    names: ['unban', 'botunban'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kunban <@user/ID>`');
      }

      target.dbUser.isBanned = false;
      await target.dbUser.save();

      return message.reply(`✅ **${target.username}** (\`${target.id}\`) ကို Keo Bot အသုံးပြုခွင့် ပြန်ဖွင့်ပေးလိုက်ပါပြီ။`);
    },
  },

  // ၆။ Ban ထားသူ စာရင်းကြည့်ခြင်း (Kbanlist)
  {
    names: ['banlist', 'banned'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const bannedUsers = await User.find({ isBanned: true }, 'userId username balance').lean();
      if (bannedUsers.length === 0) {
        return message.reply('✅ လက်ရှိ Ban ထားသော ကစားသမား မရှိပါ။');
      }

      const lines = bannedUsers
        .slice(0, 30)
        .map((u, idx) => `${idx + 1}. **${u.username || 'Unknown'}** (\`${u.userId}\`) — 💰 ${(u.balance || 0).toLocaleString()}`);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`🚫 Bot Ban ထားသူများ (${bannedUsers.length} ဦး)`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ပြန်ဖွင့်ရန်: Kunban <@user/ID>' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    },
  },

  // ၇။ ကစားသမား Data အသေးစိတ် စစ်ဆေးခြင်း (Kcheck <@user/ID>)
  {
    names: ['check', 'inspect', 'userinfo'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kcheck <@user/ID>`');
      }

      const u = target.dbUser;
      syncCollection(u);
      syncZooStats(u);

      const statusBadges = [
        u.isBanned ? '🚫 Banned' : '✅ Active',
        u.isHiddenTop ? '👻 Hidden from Ktop' : '👁️ Visible on Ktop',
        u.amvLocked ? '🔒 AMV Locked' : `🛡️ AMV (${u.huntCount || 0}/100)`,
      ].join(' • ');

      const teamText = (u.battleTeam && u.battleTeam.length > 0)
        ? u.battleTeam.map((id) => `\`${id}\``).join(', ')
        : 'မရွေးရသေး';

      const embed = new EmbedBuilder()
        .setColor(u.isBanned ? '#E74C3C' : u.isHiddenTop ? '#95A5A6' : '#3498DB')
        .setTitle(`🔍 Admin Inspect — ${target.username}`)
        .setDescription(`**User ID:** \`${target.id}\`\n**Status:** ${statusBadges}`)
        .addFields(
          { name: '💰 Balance', value: `**${(u.balance || 0).toLocaleString()} coins**`, inline: true },
          { name: '🎁 Lucky Crates', value: `**${(u.boxes || 0).toLocaleString()} လုံး**`, inline: true },
          { name: '🔥 Daily Streak', value: `**${u.dailyStreak || 0} ရက်**`, inline: true },
          { name: '🏅 Profile Level', value: `**Lv.${u.level || 1}** (${u.exp || 0} EXP)`, inline: true },
          { name: '⚔️ Battle Level', value: `**Lv.${u.battleLevel || 1}** (${u.battleExp || 0} EXP)`, inline: true },
          { name: '📖 Collection', value: `**${u.collectedCount || 0} / ${ANIMALS.length}**`, inline: true },
          { name: '🐾 Zoo', value: `**${(u.zooCount || 0).toLocaleString()} ကောင်** (${(u.zooValue || 0).toLocaleString()} coins)`, inline: true },
          { name: '🛡️ Battle Team', value: teamText, inline: true },
          { name: '💍 Marriage', value: u.marriedTo ? `<@${u.marriedTo}> (\`${u.marriedRing || 'none'}\`)` : 'Single', inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    },
  },

  // ၈။ Cooldown နှင့် နေ့စဉ် Limit များ ပြန်ဖြည်ပေးခြင်း (Kresetcd <@user/ID>)
  {
    names: ['resetcd', 'clearcd'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kresetcd <@user/ID>`');
      }

      const u = target.dbUser;
      u.lastDaily = 0;
      u.lastWork = 0;
      u.dailyHuntItemCount = 0;
      u.dailyBattleCrateCount = 0;
      u.dailyProfileExpCount = 0;
      await u.save();

      return message.reply(`♻️ **${target.username}** ၏ Cooldown (\`Kdaily\`, \`Kwork\`) နှင့် နေ့စဉ် Limit များအားလုံးကို ပြန်လည်ဖြည်ပေးပြီးပါပြီ!`);
    },
  },

  // ၉။ AMV Lock ဖြည်ပေးခြင်း (Kunlockamv <@user/ID>)
  {
    names: ['unlockamv', 'clearamv'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kunlockamv <@user/ID>`');
      }

      target.dbUser.amvLocked = false;
      target.dbUser.huntCount = 0;
      await target.dbUser.save();

      return message.reply(`🔓 **${target.username}** ၏ AMV Verification Lock ကို ဖွင့်ပေးလိုက်ပါပြီ!`);
    },
  },

  // ၁၀။ ကစားသမား Data အားလုံး Reset ချခြင်း (Kresetuser <@user/ID>) — Confirm ခလုတ်ပါ
  {
    names: ['resetuser', 'wipeuser'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      if (!target) {
        return message.reply('❌ အသုံးပြုပုံ: `Kresetuser <@user/ID>`');
      }
      if (isOwner(target.id)) {
        return message.reply('❌ Bot Owner အကောင့်ကို Reset ချ၍ မရပါ။');
      }

      const confirmEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('⚠️ Account Reset အတည်ပြုချက်')
        .setDescription(
          `**${target.username}** (\`${target.id}\`) ၏ Coins, Zoo, Collection, Levels, Items, Rings နှင့် Marriage Data အားလုံးကို အစမှ ပြန်စ (Reset) မှာ သေချာပါသလား?\n` +
          `*(၃၀ စက္ကန့်အတွင်း ရွေးချယ်ပါ — ပြန်ယူ၍ မရပါ)*`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_reset_ok').setLabel('🗑️ Reset ချမည်').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_reset_no').setLabel('❌ ပယ်ဖျက်မည်').setStyle(ButtonStyle.Secondary)
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

          if (i.customId === 'admin_reset_no') {
            collector.stop('cancelled');
            return i.update({
              embeds: [new EmbedBuilder().setColor('#95A5A6').setDescription('✅ Account Reset ကို ပယ်ဖျက်လိုက်ပါပြီ။')],
              components: [],
            });
          }

          if (i.customId === 'admin_reset_ok') {
            collector.stop('confirmed');

            const fresh = await getUser(target.id, target.username);

            // လက်ထပ်ထားပါက တစ်ဖက်လူ၏ Marriage ကိုပါ ရှင်းလင်းပေးခြင်း
            if (fresh.marriedTo) {
              const partner = await User.findOne({ userId: fresh.marriedTo });
              if (partner && partner.marriedTo === target.id) {
                partner.marriedTo = null;
                partner.marriedToName = null;
                partner.marriedRing = null;
                partner.marriedAt = null;
                await partner.save();
              }
            }

            const keepBanned = fresh.isBanned;
            const keepHidden = fresh.isHiddenTop;

            await User.deleteOne({ userId: target.id });
            const recreated = await getUser(target.id, target.username);
            recreated.isBanned = keepBanned;
            recreated.isHiddenTop = keepHidden;
            await recreated.save();

            return i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor('#2ECC71')
                  .setDescription(`🗑️ **${target.username}** (\`${target.id}\`) ၏ Data အားလုံးကို Reset ချပြီးပါပြီ!`),
              ],
              components: [],
            });
          }
        } catch (err) {
          console.error('Admin Reset Collect Error:', err);
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time' && !handled) {
          await promptMsg.edit({ components: [] }).catch(() => {});
        }
      });
    },
  },
];