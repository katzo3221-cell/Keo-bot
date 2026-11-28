const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { getUser } = require('../../models/User');
const { isOwner } = require('../../utils/helpers');
const { activeGambling, validateBet, extractBetAndOpponent } = require('../../utils/gamblingState');

// နှိပ်သူတစ်ဦးတည်းသာ မြင်ရစေမည့် Ephemeral Flag (64)
const EPHEMERAL_FLAG = MessageFlags?.Ephemeral ?? 64;

module.exports = [
  // သူငယ်ချင်းချင်း ကျောက်တုံး-ကတ်ကြေး-စက္ကူ လောင်းကစား (Krps / Kduel @user <amount>)
  {
    names: ['rps', 'duel'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      const { opponent, betArg } = extractBetAndOpponent(message, args);
      if (!opponent || opponent.bot) {
        return message.reply('❌ စိန်ခေါ်မယ့် သူငယ်ချင်းကို Mention ခေါ်ပါ! (ဥပမာ - `Krps @User 1000`)');
      }
      if (opponent.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်စိန်ခေါ်၍ မရပါ။');
      }
      if (activeGambling.has(opponent.id)) {
        return message.reply(`❌ **${opponent.username}** သည် လက်ရှိ အခြားလောင်းကစားပွဲ ကစားနေဆဲ ဖြစ်ပါတယ်။`);
      }

      const { bet, error } = validateBet(betArg, user.balance, 'ဥပမာ - `Krps @User 1000`');
      if (error) return message.reply(error);

      const oppUser = await getUser(opponent.id, opponent.username);
      if (oppUser.balance < bet) {
        return message.reply(`❌ **${opponent.username}** တွင် လောင်းကြေး **${bet.toLocaleString()} coins** မလုံလောက်ပါ!`);
      }

      activeGambling.add(message.author.id);

      try {
        const inviteEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`🪨✂️📄 ကျောက်တုံး-ကတ်ကြေး-စက္ကူ စိန်ခေါ်မှု — ${bet.toLocaleString()} coins`)
          .setDescription(
            `**${message.author.username}** က **${opponent.username}** ကို **${bet.toLocaleString()} coins** လောင်းကြေးဖြင့် စိန်ခေါ်လိုက်ပါပြီ!\n` +
            `<@${opponent.id}> အနေဖြင့် **၃၀ စက္ကန့်အတွင်း** လက်ခံမလား ရွေးချယ်ပါ —`
          );

        const inviteRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rps_accept').setLabel('⚔️ Accept (လက်ခံမည်)').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rps_reject').setLabel('❌ Reject (ငြင်းပယ်မည်)').setStyle(ButtonStyle.Danger)
        );

        const challengeMsg = await message.reply({
          content: `<@${opponent.id}>`,
          embeds: [inviteEmbed],
          components: [inviteRow],
        });

        const inviteCollector = challengeMsg.createMessageComponentCollector({ time: 30000 });
        let inviteHandled = false;

        inviteCollector.on('collect', async (i) => {
          try {
            if (inviteHandled) {
              return i.deferUpdate().catch(() => {});
            }

            // Reject ခလုတ်ကို စိန်ခေါ်သူရော စိန်ခေါ်ခံရသူပါ ၂ ယောက်လုံး နှိပ်၍ ဖျက်သိမ်းနိုင်မည်
            if (i.customId === 'rps_reject') {
              if (i.user.id !== opponent.id && i.user.id !== message.author.id) {
                return i.reply({
                  content: '❌ ဒီစိန်ခေါ်မှုက သင့်အတွက် မဟုတ်ပါဘူး!',
                  flags: EPHEMERAL_FLAG,
                });
              }

              inviteHandled = true;
              inviteCollector.stop('rejected');
              activeGambling.delete(message.author.id);
              const rejectText =
                i.user.id === message.author.id
                  ? `❌ **${message.author.username}** က စိန်ခေါ်မှုကို ပြန်လည်ပယ်ဖျက်လိုက်ပါပြီ။`
                  : `❌ **${opponent.username}** က စိန်ခေါ်မှုကို ငြင်းပယ်လိုက်ပါပြီ။`;
              const rejectEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setDescription(rejectText);
              return i.update({ content: '', embeds: [rejectEmbed], components: [] })
                .catch(() => challengeMsg.edit({ content: '', embeds: [rejectEmbed], components: [] }).catch(() => {}));
            }

            if (i.user.id !== opponent.id) {
              return i.reply({
                content: '❌ ဒီစိန်ခေါ်မှုက သင့်ကို ခေါ်ထားတာ မဟုတ်ပါဘူး!',
                flags: EPHEMERAL_FLAG,
              });
            }

            if (i.customId === 'rps_accept') {
              if (activeGambling.has(opponent.id)) {
                return i.reply({
                  content: '❌ သင် အခြားလောင်းကစားပွဲ ကစားနေဆဲ ဖြစ်ပါတယ်!',
                  flags: EPHEMERAL_FLAG,
                });
              }

              inviteHandled = true;
              inviteCollector.stop('accepted');
              activeGambling.add(opponent.id);

              await i.deferUpdate();

              const [freshP1, freshP2] = await Promise.all([
                getUser(message.author.id, message.author.username),
                getUser(opponent.id, opponent.username),
              ]);

              if (freshP1.balance < bet || freshP2.balance < bet) {
                activeGambling.delete(message.author.id);
                activeGambling.delete(opponent.id);
                const errEmbed = new EmbedBuilder()
                  .setColor('#E74C3C')
                  .setDescription('❌ ကစားသမားတစ်ဦးတွင် လောင်းကြေး မလုံလောက်တော့သဖြင့် ပွဲပျက်ပြယ်သွားပါပြီ။');
                return i.editReply({ content: '', embeds: [errEmbed], components: [] });
              }

              freshP1.balance -= bet;
              freshP2.balance -= bet;
              await Promise.all([freshP1.save(), freshP2.save()]);

              const choices = { [message.author.id]: null, [opponent.id]: null };
              const labels = {
                rock: '🪨 ကျောက်တုံး',
                scissors: '✂️ ကတ်ကြေး',
                paper: '📄 စက္ကူ',
              };
              const counterPick = {
                rock: '📄 စက္ကူ',
                scissors: '🪨 ကျောက်တုံး',
                paper: '✂️ ကတ်ကြေး',
              };

              const buildPlayEmbed = (statusText = 'တစ်ယောက်မမြင်အောင် အောက်ပါခလုတ်မှ ကိုယ်ကြိုက်ရာ ရွေးချယ်ပါ *(၄၅ စက္ကန့်အတွင်း)*') =>
                new EmbedBuilder()
                  .setColor('#F39C12')
                  .setTitle(`🪨✂️📄 ${message.author.username} VS ${opponent.username} (Pot: ${(bet * 2).toLocaleString()} coins)`)
                  .setDescription(statusText)
                  .addFields(
                    { name: `🧑 ${message.author.username}`, value: choices[message.author.id] ? '✅ **ရွေးချယ်ပြီး**' : '⏳ **စဉ်းစားနေဆဲ**', inline: true },
                    { name: `🧑 ${opponent.username}`, value: choices[opponent.id] ? '✅ **ရွေးချယ်ပြီး**' : '⏳ **စဉ်းစားနေဆဲ**', inline: true }
                  );

              const playRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 ကျောက်တုံး').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ ကတ်ကြေး').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 စက္ကူ').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rps_info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary)
              );

              await i.editReply({ content: '', embeds: [buildPlayEmbed()], components: [playRow] });

              const gameCollector = challengeMsg.createMessageComponentCollector({ time: 45000 });

              gameCollector.on('collect', async (btn) => {
                try {
                  // ℹ️ ခလုတ် — Owner နှိပ်လျှင် တစ်ဖက်လူ ရွေးထားတာကို Ephemeral ဖြင့် ပြမည်
                  if (btn.customId === 'rps_info') {
                    if (isOwner(btn.user.id)) {
                      const p1Pick = choices[message.author.id];
                      const p2Pick = choices[opponent.id];

                      // Owner ကိုယ်တိုင် ကစားနေပါက တစ်ဖက်လူ၏ ရွေးချယ်မှု + နိုင်မည့်အကွက် ပြပေးမည်
                      if (btn.user.id === message.author.id || btn.user.id === opponent.id) {
                        const oppId = btn.user.id === message.author.id ? opponent.id : message.author.id;
                        const oppName = btn.user.id === message.author.id ? opponent.username : message.author.username;
                        const oppChoice = choices[oppId];

                        if (!oppChoice) {
                          return btn.reply({
                            content: `👁️ **${oppName}** မရွေးချယ်ရသေးပါ! သူ \`✅ ရွေးချယ်ပြီး\` ဖြစ်မှ ထပ်နှိပ်ကြည့်ပါ။`,
                            flags: EPHEMERAL_FLAG,
                          });
                        }

                        return btn.reply({
                          content:
                            `👁️ **${oppName}** ရွေးထားတာ: **${labels[oppChoice]}**\n` +
                            `🏆 အနိုင်ရရန် ရွေးရမည့်အကွက်: **${counterPick[oppChoice]}**`,
                          flags: EPHEMERAL_FLAG,
                        });
                      }

                      // Owner က ဘေးကကြည့်နေပါက နှစ်ယောက်လုံး၏ ရွေးချယ်မှုကို ပြပေးမည်
                      return btn.reply({
                        content:
                          `👁️ **RPS Live Peek**\n` +
                          `• **${message.author.username}:** ${p1Pick ? labels[p1Pick] : '⏳ မရွေးရသေး'}\n` +
                          `• **${opponent.username}:** ${p2Pick ? labels[p2Pick] : '⏳ မရွေးရသေး'}`,
                        flags: EPHEMERAL_FLAG,
                      });
                    }

                    // သာမန်ကစားသမားများအတွက် ရိုးရိုးကစားနည်း
                    return btn.reply({
                      content:
                        `ℹ️ **ကျောက်တုံး-ကတ်ကြေး-စက္ကူ စည်းကမ်း**\n` +
                        `• 🪨 ကျောက်တုံး ➔ ✂️ ကတ်ကြေးကို နိုင်သည်\n` +
                        `• ✂️ ကတ်ကြေး ➔ 📄 စက္ကူကို နိုင်သည်\n` +
                        `• 📄 စက္ကူ ➔ 🪨 ကျောက်တုံးကို နိုင်သည်`,
                      flags: EPHEMERAL_FLAG,
                    });
                  }

                  if (!['rps_rock', 'rps_scissors', 'rps_paper'].includes(btn.customId)) {
                    return btn.deferUpdate().catch(() => {});
                  }
                  if (![message.author.id, opponent.id].includes(btn.user.id)) {
                    return btn.reply({
                      content: '❌ သင်က ဒီပွဲထဲက ကစားသမား မဟုတ်ပါဘူး!',
                      flags: EPHEMERAL_FLAG,
                    });
                  }
                  if (choices[btn.user.id]) {
                    return btn.reply({
                      content: '✅ သင် ရွေးချယ်ပြီးသား ဖြစ်ပါတယ်! တခြားတစ်ယောက်ကို စောင့်ပေးပါ။',
                      flags: EPHEMERAL_FLAG,
                    });
                  }

                  const picked = btn.customId.replace('rps_', '');
                  choices[btn.user.id] = picked;
                  const bothPicked = Boolean(choices[message.author.id] && choices[opponent.id]);

                  await btn.reply({
                    content: `✅ သင် **${labels[picked]}** ကို ရွေးချယ်လိုက်ပါပြီ!`,
                    flags: EPHEMERAL_FLAG,
                  });

                  if (bothPicked) {
                    gameCollector.stop('finished');
                  } else {
                    await challengeMsg.edit({ embeds: [buildPlayEmbed()], components: [playRow] }).catch(() => {});
                  }
                } catch (err) {
                  console.error('RPS Collect Error:', err);
                }
              });

              gameCollector.on('end', async (_, reason) => {
                try {
                  // Admin က ပွဲကစားနေတုန်း Message ဖျက်လိုက်ပါက နှစ်ဖက်လုံး ငွေပြန်အမ်းမည်
                  if (reason === 'messageDelete') {
                    const [u1, u2] = await Promise.all([
                      getUser(message.author.id, message.author.username),
                      getUser(opponent.id, opponent.username),
                    ]);
                    u1.balance += bet;
                    u2.balance += bet;
                    await Promise.all([u1.save(), u2.save()]);
                    return;
                  }

                  await challengeMsg.edit({
                    embeds: [buildPlayEmbed('⏳ *ရလဒ် တွက်ချက်နေပါသည်...*')],
                    components: [],
                  }).catch(() => {});

                  const c1 = choices[message.author.id];
                  const c2 = choices[opponent.id];

                  let winnerId = null;
                  let winnerName = '';
                  let desc = '';
                  let color = '#95A5A6';

                  if (!c1 && !c2) {
                    const [u1, u2] = await Promise.all([
                      getUser(message.author.id, message.author.username),
                      getUser(opponent.id, opponent.username),
                    ]);
                    u1.balance += bet;
                    u2.balance += bet;
                    await Promise.all([u1.save(), u2.save()]);
                    desc = `⏳ နှစ်ဖက်လုံး မရွေးချယ်သဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** စီ ပြန်အမ်းပေးလိုက်ပါပြီ။`;
                  } else if (!c2) {
                    winnerId = message.author.id;
                    winnerName = message.author.username;
                    desc = `⏳ **${opponent.username}** အချိန်မီ မရွေးချယ်သဖြင့် 🏆 **${winnerName}** အနိုင်ရပြီး **+${bet.toLocaleString()} coins** ရရှိပါတယ်!`;
                  } else if (!c1) {
                    winnerId = opponent.id;
                    winnerName = opponent.username;
                    desc = `⏳ **${message.author.username}** အချိန်မီ မရွေးချယ်သဖြင့် 🏆 **${winnerName}** အနိုင်ရပြီး **+${bet.toLocaleString()} coins** ရရှိပါတယ်!`;
                  } else if (c1 === c2) {
                    const [u1, u2] = await Promise.all([
                      getUser(message.author.id, message.author.username),
                      getUser(opponent.id, opponent.username),
                    ]);
                    u1.balance += bet;
                    u2.balance += bet;
                    await Promise.all([u1.save(), u2.save()]);
                    desc = `🛡️ **သရေကျပါတယ်!** နှစ်ဖက်လုံး **${labels[c1]}** တူနေသဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** စီ ပြန်ရပါတယ်။`;
                  } else {
                    const p1Wins =
                      (c1 === 'rock' && c2 === 'scissors') ||
                      (c1 === 'scissors' && c2 === 'paper') ||
                      (c1 === 'paper' && c2 === 'rock');

                    winnerId = p1Wins ? message.author.id : opponent.id;
                    winnerName = p1Wins ? message.author.username : opponent.username;
                    desc = `🏆 **${winnerName}** က အနိုင်ရရှိပြီး **+${bet.toLocaleString()} coins** *(စုစုပေါင်း ${(bet * 2).toLocaleString()} coins)* သိမ်းပိုက်သွားပါပြီ!`;
                  }

                  if (winnerId) {
                    const winUser = await getUser(winnerId, winnerName);
                    winUser.balance += bet * 2;
                    await winUser.save();
                    color = '#2ECC71';
                  }

                  const resultEmbed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(`🪨✂️📄 ရလဒ် — ${message.author.username} VS ${opponent.username}`)
                    .addFields(
                      { name: `🧑 ${message.author.username}`, value: c1 ? labels[c1] : '❌ မရွေးပါ', inline: true },
                      { name: `🧑 ${opponent.username}`, value: c2 ? labels[c2] : '❌ မရွေးပါ', inline: true }
                    )
                    .setDescription(desc);

                  await challengeMsg.edit({ content: '', embeds: [resultEmbed], components: [] }).catch(() => {});
                } catch (err) {
                  console.error('RPS End Error:', err);
                } finally {
                  activeGambling.delete(message.author.id);
                  activeGambling.delete(opponent.id);
                }
              });
            }
          } catch (err) {
            console.error('RPS Invite Collect Error:', err);
            activeGambling.delete(message.author.id);
            activeGambling.delete(opponent.id);
          }
        });

        inviteCollector.on('end', async (_, reason) => {
          if (reason !== 'accepted') {
            activeGambling.delete(message.author.id);
          }
          if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription(`⏳ **${opponent.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်မဖြေသဖြင့် စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
            await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
          }
        });
      } catch (err) {
        activeGambling.delete(message.author.id);
        throw err;
      }
    },
  },
];