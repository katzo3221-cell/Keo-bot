const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../models/User');
const {
  activeGambling,
  validateBet,
  extractBetAndOpponent,
  createShuffledDeck,
  formatHand,
} = require('../../utils/gamblingState');

const SKM_RANK_ORDER = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

function evaluateSkm(hand) {
  const sum = hand.reduce((acc, c) => {
    if (c.rank === 'A') return acc + 1;
    if (['10', 'J', 'Q', 'K'].includes(c.rank)) return acc;
    return acc + parseInt(c.rank, 10);
  }, 0);

  const points = sum % 10;
  const isDo = hand.length === 2 && (points === 8 || points === 9);
  const allSameSuit = hand.every((c) => c.suit === hand[0].suit);
  const allSameRank = hand.every((c) => c.rank === hand[0].rank);

  let mult = 1;
  let tag = '';
  if (hand.length === 3 && allSameRank) {
    mult = 3;
    tag = 'သုံးချပ်ပူး';
  } else if (hand.length === 3 && allSameSuit) {
    mult = 3;
    tag = 'ပွင့်တူ ၃ ချပ်';
  } else if (hand.length === 2 && allSameRank) {
    mult = 2;
    tag = 'ပူး ၂ ချပ်';
  } else if (hand.length === 2 && allSameSuit) {
    mult = 2;
    tag = 'ပွင့်တူ ၂ ချပ်';
  }

  const highestCard = Math.max(...hand.map((c) => SKM_RANK_ORDER[c.rank] || 0));
  const label = `${isDo ? `🔥 ${points} ဒို` : `${points} မှတ်`}${tag ? ` • ${tag}` : ''}`;

  return { points, isDo, mult, tag, highestCard, label };
}

function compareSkmHands(h1, h2) {
  const e1 = evaluateSkm(h1);
  const e2 = evaluateSkm(h2);

  if (e1.isDo !== e2.isDo) return e1.isDo ? 1 : -1;
  if (e1.points !== e2.points) return e1.points > e2.points ? 1 : -1;
  if (e1.mult !== e2.mult) return e1.mult > e2.mult ? 1 : -1;
  if (e1.highestCard !== e2.highestCard) return e1.highestCard > e2.highestCard ? 1 : -1;
  return 0;
}

module.exports = [
  // ရှမ်းကိုးမီး — Solo & PvP (Kskm <amount> နှင့် Kskm @user <amount>)
  {
    names: ['skm', 'shan'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🃏 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် ဆော့ပါ။');
      }

      const { opponent, betArg } = extractBetAndOpponent(message, args);
      const { bet, error } = validateBet(betArg, user.balance, 'Solo: `Kskm 1000` | PvP: `Kskm @User 1000`');
      if (error) return message.reply(error);

      // ----------------- PvP ရှမ်းကိုးမီး -----------------
      if (opponent) {
        if (opponent.bot) return message.reply('❌ Bot များကို PvP စိန်ခေါ်၍ မရပါ။');
        if (opponent.id === message.author.id) return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်စိန်ခေါ်၍ မရပါ။');
        if (activeGambling.has(opponent.id)) {
          return message.reply(`❌ **${opponent.username}** သည် လက်ရှိ အခြားလောင်းကစားပွဲ ကစားနေဆဲ ဖြစ်ပါတယ်။`);
        }

        const oppUser = await getUser(opponent.id, opponent.username);
        if (oppUser.balance < bet) {
          return message.reply(`❌ **${opponent.username}** တွင် လောင်းကြေး **${bet.toLocaleString()} coins** မလုံလောက်ပါ!`);
        }

        activeGambling.add(message.author.id);

        try {
          const inviteEmbed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle(`🎴 PvP ရှမ်းကိုးမီး စိန်ခေါ်မှု — ${bet.toLocaleString()} coins`)
            .setDescription(
              `**${message.author.username}** က **${opponent.username}** ကို လောင်းကြေး **${bet.toLocaleString()} coins** ဖြင့် ရှမ်းကိုးမီး စိန်ခေါ်လိုက်ပါပြီ!\n` +
              `🏆 အနိုင်ရသူသည် စုစုပေါင်း **${(bet * 2).toLocaleString()} coins** ရရှိပါမည်။\n` +
              `<@${opponent.id}> အနေဖြင့် **၃၀ စက္ကန့်အတွင်း** ရွေးချယ်ပါ —`
            );

          const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('skmpvp_accept').setLabel('🎴 Accept (လက်ခံမည်)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('skmpvp_reject').setLabel('❌ Reject (ငြင်းပယ်မည်)').setStyle(ButtonStyle.Danger)
          );

          const challengeMsg = await message.reply({
            content: `<@${opponent.id}>`,
            embeds: [inviteEmbed],
            components: [inviteRow],
          });

          const inviteCollector = challengeMsg.createMessageComponentCollector({ time: 30000 });

          inviteCollector.on('collect', async (i) => {
            try {
              if (i.user.id !== opponent.id) {
                return i.reply({ content: '❌ ဒီစိန်ခေါ်မှုက သင့်ကို ခေါ်ထားတာ မဟုတ်ပါဘူး!', ephemeral: true });
              }

              if (i.customId === 'skmpvp_reject') {
                inviteCollector.stop('rejected');
                const rejectEmbed = new EmbedBuilder()
                  .setColor('#E74C3C')
                  .setDescription(`❌ **${opponent.username}** က ရှမ်းကိုးမီး PvP စိန်ခေါ်မှုကို ငြင်းပယ်လိုက်ပါပြီ။`);
                return i.update({ content: '', embeds: [rejectEmbed], components: [] });
              }

              if (i.customId === 'skmpvp_accept') {
                if (activeGambling.has(opponent.id)) {
                  return i.reply({ content: '❌ သင် အခြားလောင်းကစားပွဲ ကစားနေဆဲ ဖြစ်ပါတယ်!', ephemeral: true });
                }

                const freshP1 = await getUser(message.author.id, message.author.username);
                const freshP2 = await getUser(opponent.id, opponent.username);

                if (freshP1.balance < bet || freshP2.balance < bet) {
                  inviteCollector.stop('insufficient');
                  const errEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setDescription('❌ ကစားသမားတစ်ဦးတွင် လောင်းကြေး မလုံလောက်တော့သဖြင့် ပွဲပျက်ပြယ်သွားပါပြီ။');
                  return i.update({ content: '', embeds: [errEmbed], components: [] });
                }

                inviteCollector.stop('accepted');
                activeGambling.add(opponent.id);

                freshP1.balance -= bet;
                freshP2.balance -= bet;
                await freshP1.save();
                await freshP2.save();

                const deck = createShuffledDeck();
                const players = {
                  [message.author.id]: {
                    id: message.author.id,
                    name: message.author.username,
                    hand: [deck.pop(), deck.pop()],
                    done: false,
                  },
                  [opponent.id]: {
                    id: opponent.id,
                    name: opponent.username,
                    hand: [deck.pop(), deck.pop()],
                    done: false,
                  },
                };

                const p1 = players[message.author.id];
                const p2 = players[opponent.id];

                if (evaluateSkm(p1.hand).isDo) p1.done = true;
                if (evaluateSkm(p2.hand).isDo) p2.done = true;

                const statusLabel = (p) =>
                  p.done ? `✅ **အဆင်သင့်ဖြစ်ပြီ** (${p.hand.length} ချပ်)` : `⏳ **စဉ်းစားနေဆဲ** (${p.hand.length} ချပ်)`;

                const buildPvpEmbed = () =>
                  new EmbedBuilder()
                    .setColor('#F39C12')
                    .setTitle(`🎴 PvP ရှမ်းကိုးမီး: ${p1.name} VS ${p2.name} (Pot: ${(bet * 2).toLocaleString()} coins)`)
                    .setDescription('`👁️ ကိုယ့်ဖဲကြည့်မည်` ကိုနှိပ်ပြီး **ဆွဲမည် (၁ ချပ်)** သို့မဟုတ် **ရပ်မည်** ရွေးချယ်ပါ *(၄၅ စက္ကန့်အတွင်း)*')
                    .addFields(
                      { name: `🧑 ${p1.name}`, value: statusLabel(p1), inline: true },
                      { name: `🧑 ${p2.name}`, value: statusLabel(p2), inline: true }
                    );

                const gameRow = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('skmpvp_view').setLabel('👁️ ကိုယ့်ဖဲကြည့်မည်').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder().setCustomId('skmpvp_draw').setLabel('🃏 ဆွဲမည် (Draw)').setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId('skmpvp_stay').setLabel('🛑 ရပ်မည် (Stay)').setStyle(ButtonStyle.Danger)
                );

                let resolved = false;
                const resolvePvpSkm = async (updateInteraction = null) => {
                  if (resolved) return;
                  resolved = true;

                  try {
                    const e1 = evaluateSkm(p1.hand);
                    const e2 = evaluateSkm(p2.hand);
                    const cmp = compareSkmHands(p1.hand, p2.hand);

                    let desc = '';
                    let color = '#95A5A6';

                    if (cmp > 0) {
                      const winUser = await getUser(p1.id, p1.name);
                      winUser.balance += bet * 2;
                      await winUser.save();
                      color = '#2ECC71';
                      desc = `🏆 **${p1.name}** က အနိုင်ရရှိပြီး **+${bet.toLocaleString()} coins** *(စုစုပေါင်း ${(bet * 2).toLocaleString()} coins)* သိမ်းပိုက်သွားပါပြီ!`;
                    } else if (cmp < 0) {
                      const winUser = await getUser(p2.id, p2.name);
                      winUser.balance += bet * 2;
                      await winUser.save();
                      color = '#2ECC71';
                      desc = `🏆 **${p2.name}** က အနိုင်ရရှိပြီး **+${bet.toLocaleString()} coins** *(စုစုပေါင်း ${(bet * 2).toLocaleString()} coins)* သိမ်းပိုက်သွားပါပြီ!`;
                    } else {
                      const u1 = await getUser(p1.id, p1.name);
                      const u2 = await getUser(p2.id, p2.name);
                      u1.balance += bet;
                      u2.balance += bet;
                      await u1.save();
                      await u2.save();
                      desc = `🛡️ **သရေကျပါတယ်!** နှစ်ဖက်လုံး လောင်းကြေး **${bet.toLocaleString()} coins** စီ ပြန်လည်ရရှိပါတယ်။`;
                    }

                    const finalEmbed = new EmbedBuilder()
                      .setColor(color)
                      .setTitle(`🎴 PvP ရှမ်းကိုးမီး ရလဒ် — ${p1.name} VS ${p2.name}`)
                      .addFields(
                        { name: `🧑 ${p1.name} (${e1.label})`, value: formatHand(p1.hand), inline: true },
                        { name: `🧑 ${p2.name} (${e2.label})`, value: formatHand(p2.hand), inline: true }
                      )
                      .setDescription(desc);

                    if (updateInteraction) {
                      await updateInteraction.update({ content: '', embeds: [finalEmbed], components: [] }).catch(() => {});
                    } else {
                      await challengeMsg.edit({ content: '', embeds: [finalEmbed], components: [] }).catch(() => {});
                    }
                  } catch (err) {
                    console.error('SKM PvP Resolve Error:', err);
                  } finally {
                    activeGambling.delete(p1.id);
                    activeGambling.delete(p2.id);
                  }
                };

                if (p1.done && p2.done) {
                  return resolvePvpSkm(i);
                }

                await i.update({ content: '', embeds: [buildPvpEmbed()], components: [gameRow] });

                const gameCollector = challengeMsg.createMessageComponentCollector({ time: 45000 });

                gameCollector.on('collect', async (btn) => {
                  try {
                    const actor = players[btn.user.id];
                    if (!actor) {
                      return btn.reply({ content: '❌ သင်က ဒီပွဲထဲက ကစားသမား မဟုတ်ပါဘူး!', ephemeral: true });
                    }

                    const evalNow = evaluateSkm(actor.hand);

                    if (btn.customId === 'skmpvp_view') {
                      const doNote = evalNow.isDo ? '\n🔥 *(ဒိုကျနေသဖြင့် အလိုအလျောက် ရပ်ပြီးသားဖြစ်ပါသည်)*' : '';
                      return btn.reply({
                        content: `🎴 **သင့်လက်ရှိဖဲ (${evalNow.label}):** ${formatHand(actor.hand)}${doNote}`,
                        ephemeral: true,
                      });
                    }

                    if (actor.done) {
                      return btn.reply({ content: '✅ သင် ရွေးချယ်ပြီးသား (သို့မဟုတ် ဒိုကျပြီးသား) ဖြစ်ပါတယ်! တခြားတစ်ယောက်ကို စောင့်ပေးပါ။', ephemeral: true });
                    }

                    if (btn.customId === 'skmpvp_draw') {
                      actor.hand.push(deck.pop());
                      actor.done = true;
                      const newEval = evaluateSkm(actor.hand);
                      await btn.reply({
                        content: `🃏 ၃ ချပ်မြောက် ဆွဲပြီး — **(${newEval.label}):** ${formatHand(actor.hand)}`,
                        ephemeral: true,
                      });
                    } else if (btn.customId === 'skmpvp_stay') {
                      actor.done = true;
                      await btn.reply({
                        content: `🛑 **${evalNow.label}** ဖြင့် ရပ်လိုက်ပါပြီ။ ဖဲ: ${formatHand(actor.hand)}`,
                        ephemeral: true,
                      });
                    }

                    if (p1.done && p2.done) {
                      gameCollector.stop('finished');
                    } else {
                      await challengeMsg.edit({ embeds: [buildPvpEmbed()], components: [gameRow] }).catch(() => {});
                    }
                  } catch (err) {
                    console.error('SKM PvP Collect Error:', err);
                  }
                });

                gameCollector.on('end', async () => {
                  await resolvePvpSkm();
                });
              }
            } catch (err) {
              console.error('SKM PvP Invite Error:', err);
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
                .setDescription(`⏳ **${opponent.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်မဖြေသဖြင့် ရှမ်းကိုးမီး PvP စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
              await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
          });
        } catch (err) {
          activeGambling.delete(message.author.id);
          throw err;
        }

        return;
      }

      // ----------------- SOLO ရှမ်းကိုးမီး -----------------
      activeGambling.add(message.author.id);

      try {
        const deck = createShuffledDeck();
        user.balance -= bet;
        await user.save();

        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        let resolved = false;

        const resolveSoloSkm = async (targetMsg = null, interaction = null) => {
          if (resolved) return;
          resolved = true;

          try {
            const pEval = evaluateSkm(playerHand);
            const dEvalInitial = evaluateSkm(dealerHand);
            if (!pEval.isDo && !dEvalInitial.isDo && dEvalInitial.points <= 4) {
              dealerHand.push(deck.pop());
            }

            const dEval = evaluateSkm(dealerHand);
            const freshUser = await getUser(message.author.id, message.author.username);

            // အမှတ်တူပါက အဆ (mult) ပိုကြီးသူ အနိုင်ရမည် — အဆပါတူမှသာ ဒိုင်စားမည်
            let playerWon = false;
            let tieReasonNote = '';

            if (pEval.isDo !== dEval.isDo) {
              playerWon = pEval.isDo;
            } else if (pEval.points !== dEval.points) {
              playerWon = pEval.points > dEval.points;
            } else if (pEval.mult !== dEval.mult) {
              playerWon = pEval.mult > dEval.mult;
              tieReasonNote = playerWon
                ? ' *(အမှတ်တူ အဆပိုကြီး၍ အနိုင်ရပါသည်)*'
                : ' *(အမှတ်တူ ဒိုင်အဆပိုကြီး၍ ရှုံးပါသည်)*';
            } else {
              playerWon = false;
              tieReasonNote = ' *(အမှတ်နှင့် အဆတူ ဒိုင်စားပါသည်)*';
            }

            let desc = '';
            let color = '#E74C3C';

            if (playerWon) {
              const soloMult = pEval.mult === 3 ? 2 : pEval.mult === 2 ? 1.5 : 1;
              const winProfit = Math.floor(bet * soloMult);
              freshUser.balance += bet + winProfit;
              await freshUser.save();
              color = '#2ECC71';
              const multText = soloMult > 1 ? ` (**${soloMult}x အဆ!**)` : '';
              desc = `🎉 **အနိုင်ရရှိပါတယ်!**${multText}${tieReasonNote} **+${winProfit.toLocaleString()} coins** ရရှိပါတယ်!`;
            } else {
              desc = `💸 **ရှုံးသွားပါတယ်!**${tieReasonNote} ဒိုင်က **${dEval.label}** ဖြင့် အနိုင်ရသွားပါတယ်။ (**-${bet.toLocaleString()} coins**)`;
            }

            const finalEmbed = new EmbedBuilder()
              .setColor(color)
              .setTitle(`🎴 ${message.author.username} ၏ ရှမ်းကိုးမီး ရလဒ်`)
              .addFields(
                { name: `🧑 သင့်ဖဲ (${pEval.label})`, value: formatHand(playerHand), inline: true },
                { name: `🤖 ဒိုင်ဖဲ (${dEval.label})`, value: formatHand(dealerHand), inline: true }
              )
              .setDescription(desc);

            if (interaction) {
              await interaction.update({ embeds: [finalEmbed], components: [] }).catch(() => {});
            } else if (targetMsg) {
              await targetMsg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
            } else {
              await message.reply({ embeds: [finalEmbed] }).catch(() => {});
            }
          } catch (err) {
            console.error('SKM Solo Resolve Error:', err);
          } finally {
            activeGambling.delete(message.author.id);
          }
        };

        if (evaluateSkm(playerHand).isDo || evaluateSkm(dealerHand).isDo) {
          return resolveSoloSkm();
        }

        const pNow = evaluateSkm(playerHand);
        const startEmbed = new EmbedBuilder()
          .setColor('#E67E22')
          .setTitle(`🎴 ${message.author.username} ၏ ရှမ်းကိုးမီး (လောင်းကြေး: ${bet.toLocaleString()} coins)`)
          .addFields(
            { name: `🧑 သင့်ဖဲ (${pNow.label})`, value: formatHand(playerHand), inline: true },
            { name: '🤖 ဒိုင်ဖဲ (?)', value: '`[ ❓ ]` `[ ❓ ]`', inline: true }
          )
          .setDescription('၃ ချပ်မြောက် **ဆွဲမည်** သို့မဟုတ် **ရပ်မည်** ရွေးချယ်ပါ *(၃၀ စက္ကန့်အတွင်း)*');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('skm_draw').setLabel('🃏 ဆွဲမည် (Draw)').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('skm_stay').setLabel('🛑 ရပ်မည် (Stay)').setStyle(ButtonStyle.Danger)
        );

        const gameMsg = await message.reply({ embeds: [startEmbed], components: [row] });
        const collector = gameMsg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
          try {
            if (i.user.id !== message.author.id) {
              return i.reply({ content: '❌ ဒါက သင့်ရဲ့ ရှမ်းကိုးမီးပွဲ မဟုတ်ပါဘူး!', ephemeral: true });
            }

            if (i.customId === 'skm_draw') {
              playerHand.push(deck.pop());
            }
            collector.stop('done');
            await resolveSoloSkm(gameMsg, i);
          } catch (err) {
            console.error('SKM Solo Collect Error:', err);
          }
        });

        collector.on('end', async (_, reason) => {
          if (reason === 'time') {
            await resolveSoloSkm(gameMsg);
          }
        });
      } catch (err) {
        activeGambling.delete(message.author.id);
        throw err;
      }
    },
  },
];