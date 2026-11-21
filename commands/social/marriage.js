const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../models/User');
const { RINGS, findRing } = require('../../data/rings');

// တစ်ချိန်တည်း လက်ထပ်ခွင့်တောင်းမှု ထပ်မဖြစ်စေရန် ထိန်းချုပ်ခြင်း
const pendingProposals = new Set();

module.exports = [
  // ၁။ လက်ထပ်ခွင့်တောင်းခြင်း & လက်စွပ် Upgrade တင်ခြင်း (Kmarry @user <ringId>)
  {
    names: ['marry', 'propose'],
    async execute(message, args, user) {
      const target = message.mentions.users.first();
      const ringArg = args.find((a) => !a.startsWith('<@'));

      if (!target || !ringArg) {
        const ringIds = RINGS.map((r) => `\`${r.id}\` (${r.emoji} ${r.mmName})`).join(' | ');
        return message.reply(
          '💍 အသုံးပြုပုံ — `Kmarry @user <ringId>` (ဥပမာ - `Kmarry @user ring1`)\n' +
          `လက်စွပ်များ: ${ringIds}\n*(လက်စွပ်မရှိသေးပါက \`Kbuy <ringId>\` ဖြင့် အရင်ဝယ်ယူပါ)*`
        );
      }

      if (target.bot) {
        return message.reply('❌ Bot များနှင့် လက်ထပ်၍ မရပါ!');
      }
      if (target.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်လက်ထပ်၍ မရပါ!');
      }

      const ring = findRing(ringArg);
      if (!ring) {
        return message.reply('❌ လက်စွပ် ID မမှန်ပါ! (`ring1`, `ring2`, `ring3`, `ring4`, `ring5` ထဲမှ တစ်ခုထည့်ပါ)');
      }

      const ownedCount = Number((user.rings && user.rings[ring.id]) || 0);
      if (ownedCount < 1) {
        return message.reply(
          `❌ သင့် Inventory ထဲမှာ ${ring.emoji} **${ring.name}** (${ring.mmName}) မရှိသေးပါဘူး!\n` +
          `\`Kbuy ${ring.id}\` (💵 **${ring.price.toLocaleString()} coins**) ဖြင့် အရင်ဝယ်ယူပြီးမှ လက်ထပ်ခွင့်တောင်းပါ။`
        );
      }

      const targetUser = await getUser(target.id, target.username);
      const isUpgrade =
        user.marriedTo === target.id && targetUser.marriedTo === message.author.id;

      if (isUpgrade) {
        const currentRing = RINGS.find((r) => r.id === user.marriedRing);
        if (currentRing && ring.rank <= currentRing.rank) {
          return message.reply(
            `❌ လက်ရှိ တပ်ဆင်ထားသော ${currentRing.emoji} **${currentRing.name}** (Rank ${currentRing.rank}) ထက် ပိုမြင့်သော လက်စွပ်ဖြင့်သာ Upgrade တင်နိုင်ပါသည်!`
          );
        }
      } else {
        if (user.marriedTo) {
          return message.reply('❌ သင်သည် လက်ထပ်ပြီးသား ဖြစ်နေပါတယ်! တခြားသူနှင့် လက်ထပ်လိုပါက `Kdivorce` အရင်လုပ်ပါ။');
        }
        if (targetUser.marriedTo) {
          return message.reply(`❌ **${target.username}** သည် တခြားသူနှင့် လက်ထပ်ပြီးသား ဖြစ်နေပါတယ်!`);
        }
      }

      if (pendingProposals.has(message.author.id) || pendingProposals.has(target.id)) {
        return message.reply('⏳ လက်ထပ်ခွင့်တောင်းဆိုမှုတစ်ခု လုပ်ဆောင်နေဆဲ ဖြစ်ပါတယ်! ခဏစောင့်ပေးပါ။');
      }

      pendingProposals.add(message.author.id);
      pendingProposals.add(target.id);

      try {
        const proposalEmbed = new EmbedBuilder()
          .setColor(ring.color)
          .setTitle(
            isUpgrade
              ? `✨ လက်စွပ် Upgrade တင်ခြင်း — ${ring.emoji} ${ring.name}`
              : `💍 လက်ထပ်ခွင့်တောင်းဆိုမှု — ${ring.emoji} ${ring.name}`
          )
          .setDescription(
            isUpgrade
              ? `**${message.author.username}** က ဇနီး/ခင်ပွန်းဖြစ်သူ <@${target.id}> ကို ${ring.emoji} **${ring.name}** (${ring.mmName}) သို့ Upgrade တင်ပေးလိုပါတယ်!\n\n<@${target.id}> အနေဖြင့် **၆၀ စက္ကန့်အတွင်း** လက်ခံမလား ရွေးချယ်ပါ —`
              : `**${message.author.username}** က <@${target.id}> ကို ${ring.emoji} **${ring.name}** (${ring.mmName}) ဖြင့် လက်ထပ်ခွင့်တောင်းလိုက်ပါပြီ!\n\n<@${target.id}> အနေဖြင့် **၆၀ စက္ကန့်အတွင်း** လက်ခံမလား၊ ငြင်းပယ်မလား ရွေးချယ်ပါ —`
          )
          .addFields(
            { name: '💍 လက်စွပ်အဆင့်', value: `Rank ${ring.rank} — ${ring.emoji} **${ring.name}**`, inline: true },
            { name: '💵 တန်ဖိုး', value: `**${ring.price.toLocaleString()} coins**`, inline: true }
          )
          .setFooter({ text: 'လက်ခံမှသာ Inventory ထဲမှ လက်စွပ် ၁ ကွင်းကို အသုံးပြုပါမည်' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('marry_accept')
            .setLabel('💍 Accept (လက်ခံမည်)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('marry_reject')
            .setLabel('❌ Reject (ငြင်းပယ်မည်)')
            .setStyle(ButtonStyle.Danger)
        );

        const proposalMsg = await message.reply({
          content: `<@${target.id}>`,
          embeds: [proposalEmbed],
          components: [row],
        });

        const collector = proposalMsg.createMessageComponentCollector({ time: 60000 });
        let handled = false;

        collector.on('collect', async (i) => {
          try {
            if (i.user.id !== target.id) {
              return i.reply({ content: '❌ ဒီလက်ထပ်ခွင့်တောင်းဆိုမှုက သင့်အတွက် မဟုတ်ပါဘူး!', ephemeral: true });
            }
            if (handled) return;
            handled = true;

            if (i.customId === 'marry_reject') {
              collector.stop('rejected');
              const rejectEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('💔 ငြင်းပယ်လိုက်ပါပြီ')
                .setDescription(
                  `**${target.username}** က **${message.author.username}** ၏ တောင်းဆိုမှုကို ငြင်းပယ်လိုက်ပါပြီ။\n*(${ring.emoji} **${ring.name}** သည် Inventory ထဲတွင် ပြန်ကျန်နေပါသည်)*`
                );
              return i.update({ content: '', embeds: [rejectEmbed], components: [] });
            }

            if (i.customId === 'marry_accept') {
              collector.stop('accepted');

              const freshProposer = await getUser(message.author.id, message.author.username);
              const freshTarget = await getUser(target.id, target.username);

              const freshOwned = Number((freshProposer.rings && freshProposer.rings[ring.id]) || 0);
              if (freshOwned < 1) {
                const errEmbed = new EmbedBuilder()
                  .setColor('#E74C3C')
                  .setDescription(`❌ **${message.author.username}** ၏ Inventory ထဲတွင် ${ring.emoji} **${ring.name}** မရှိတော့ပါ!`);
                return i.update({ content: '', embeds: [errEmbed], components: [] });
              }

              const freshIsUpgrade =
                freshProposer.marriedTo === target.id && freshTarget.marriedTo === message.author.id;

              if (!freshIsUpgrade && (freshProposer.marriedTo || freshTarget.marriedTo)) {
                const errEmbed = new EmbedBuilder()
                  .setColor('#E74C3C')
                  .setDescription('❌ ကစားသမားတစ်ဦးသည် လက်ထပ်ပြီးသား ဖြစ်သွားသဖြင့် လုပ်ဆောင်ချက် ပျက်ပြယ်သွားပါပြီ။');
                return i.update({ content: '', embeds: [errEmbed], components: [] });
              }

              // Rollback အတွက် မူလအခြေအနေ မှတ်ထားခြင်း
              const prevProposerState = {
                marriedTo: freshProposer.marriedTo,
                marriedToName: freshProposer.marriedToName,
                marriedRing: freshProposer.marriedRing,
                marriedAt: freshProposer.marriedAt,
                ringCount: freshOwned,
              };

              freshProposer.rings = freshProposer.rings || {};
              const remaining = freshOwned - 1;
              if (remaining > 0) {
                freshProposer.rings[ring.id] = remaining;
              } else {
                delete freshProposer.rings[ring.id];
              }
              freshProposer.markModified('rings');

              const marriedDate =
                freshIsUpgrade && freshProposer.marriedAt ? freshProposer.marriedAt : new Date();

              freshProposer.marriedTo = target.id;
              freshProposer.marriedToName = target.username;
              freshProposer.marriedRing = ring.id;
              freshProposer.marriedAt = marriedDate;

              freshTarget.marriedTo = message.author.id;
              freshTarget.marriedToName = message.author.username;
              freshTarget.marriedRing = ring.id;
              freshTarget.marriedAt = marriedDate;

              await freshProposer.save();
              try {
                await freshTarget.save();
              } catch (saveErr) {
                // တစ်ဖက် Save မအောင်မြင်ပါက မူလအတိုင်း ပြန်ပြင်ခြင်း
                freshProposer.marriedTo = prevProposerState.marriedTo;
                freshProposer.marriedToName = prevProposerState.marriedToName;
                freshProposer.marriedRing = prevProposerState.marriedRing;
                freshProposer.marriedAt = prevProposerState.marriedAt;
                freshProposer.rings[ring.id] = prevProposerState.ringCount;
                freshProposer.markModified('rings');
                await freshProposer.save().catch(() => {});
                throw saveErr;
              }

              const successEmbed = new EmbedBuilder()
                .setColor(ring.color)
                .setTitle(
                  freshIsUpgrade
                    ? '✨ လက်စွပ် Upgrade အောင်မြင်ပါပြီ!'
                    : '🎊 ဂုဏ်ယူပါတယ်! လက်ထပ်ပွဲ အောင်မြင်ပါပြီ!'
                )
                .setDescription(
                  freshIsUpgrade
                    ? `<@${message.author.id}> နှင့် <@${target.id}> တို့၏ လက်စွပ်သည် ${ring.emoji} **${ring.name}** (${ring.mmName}) သို့ အဆင့်တက်သွားပါပြီ!\n🎨 \`Kprofile\` ဘေးဘောင်အရောင်လည်း ပြောင်းလဲသွားပါပြီ!`
                    : `<@${message.author.id}> နှင့် <@${target.id}> တို့သည် ${ring.emoji} **${ring.name}** (${ring.mmName}) ဖြင့် တရားဝင် လက်ထပ်လိုက်ကြပါပြီ!\n🎨 နှစ်ဦးလုံး၏ \`Kprofile\` တွင် လက်စွပ်နှင့် အထူး Border Color ပေါ်နေပါပြီ!`
                );

              return i.update({ content: '', embeds: [successEmbed], components: [] });
            }
          } catch (err) {
            console.error('Marry Collect Error:', err);
          }
        });

        collector.on('end', async (_, reason) => {
          pendingProposals.delete(message.author.id);
          pendingProposals.delete(target.id);

          if (reason === 'time' && !handled) {
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription(
                `⏳ **${target.username}** မှ ၆၀ စက္ကန့်အတွင်း ပြန်လည်ဖြေကြားခြင်း မရှိသဖြင့် တောင်းဆိုမှု ပျက်ပြယ်သွားပါပြီ။\n*(လက်စွပ်သည် Inventory ထဲတွင် ပြန်ကျန်နေပါသည်)*`
              );
            await proposalMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
          }
        });
      } catch (err) {
        pendingProposals.delete(message.author.id);
        pendingProposals.delete(target.id);
        throw err;
      }
    },
  },

  // ၂။ ကွာရှင်းခြင်း (Kdivorce)
  {
    names: ['divorce'],
    async execute(message, args, user) {
      if (!user.marriedTo) {
        return message.reply('💔 သင်သည် လက်ထပ်ထားခြင်း မရှိပါဘူး!');
      }

      const currentRing = RINGS.find((r) => r.id === user.marriedRing);
      const ringLabel = currentRing ? `${currentRing.emoji} **${currentRing.name}**` : 'လက်စွပ်';

      const confirmEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('💔 ကွာရှင်းရန် အတည်ပြုပါ')
        .setDescription(
          `<@${user.marriedTo}> နှင့် ကွာရှင်းမှာ သေချာပါသလား?\n⚠️ ကွာရှင်းလိုက်ပါက နှစ်ဦးလုံး၏ Profile မှ ${ringLabel} နှင့် အထူး Border Color များ ပျောက်သွားမည်ဖြစ်ပြီး **လက်စွပ်ပြန်မအမ်းပါ**။`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('divorce_confirm')
          .setLabel('💔 ကွာရှင်းမည် (Confirm)')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('divorce_cancel')
          .setLabel('❌ မလုပ်တော့ပါ (Cancel)')
          .setStyle(ButtonStyle.Secondary)
      );

      const msg = await message.reply({ embeds: [confirmEmbed], components: [row] });
      const collector = msg.createMessageComponentCollector({ time: 30000 });
      let handled = false;

      collector.on('collect', async (i) => {
        try {
          if (i.user.id !== message.author.id) {
            return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Command မဟုတ်ပါဘူး!', ephemeral: true });
          }
          if (handled) return;
          handled = true;

          if (i.customId === 'divorce_cancel') {
            collector.stop('cancelled');
            return i.update({
              embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('✅ ကွာရှင်းခြင်းကို ပယ်ဖျက်လိုက်ပါပြီ။')],
              components: [],
            });
          }

          if (i.customId === 'divorce_confirm') {
            collector.stop('confirmed');

            const freshUser = await getUser(message.author.id, message.author.username);
            if (!freshUser.marriedTo) {
              return i.update({
                embeds: [new EmbedBuilder().setColor('#95A5A6').setDescription('💔 သင်သည် ကွာရှင်းပြီးသား ဖြစ်နေပါသည်။')],
                components: [],
              });
            }

            const oldPartnerId = freshUser.marriedTo;
            const partnerUser = await getUser(oldPartnerId, freshUser.marriedToName || 'Unknown');

            freshUser.marriedTo = null;
            freshUser.marriedToName = null;
            freshUser.marriedRing = null;
            freshUser.marriedAt = null;
            await freshUser.save();

            if (partnerUser.marriedTo === message.author.id) {
              partnerUser.marriedTo = null;
              partnerUser.marriedToName = null;
              partnerUser.marriedRing = null;
              partnerUser.marriedAt = null;
              await partnerUser.save();
            }

            return i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor('#95A5A6')
                  .setTitle('💔 ကွာရှင်းပြီးစီးပါပြီ')
                  .setDescription(`<@${message.author.id}> နှင့် <@${oldPartnerId}> တို့သည် တရားဝင် ကွာရှင်းလိုက်ကြပါပြီ။`),
              ],
              components: [],
            });
          }
        } catch (err) {
          console.error('Divorce Collect Error:', err);
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time' && !handled) {
          await msg.edit({ components: [] }).catch(() => {});
        }
      });
    },
  },
];