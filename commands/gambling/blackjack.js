const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../models/User');
const {
  activeGambling,
  validateBet,
  extractBetAndOpponent,
  createShuffledDeck,
  formatHand,
} = require('../../utils/gamblingState');

function calcBlackjackHand(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

module.exports = [
  // Blackjack ဖဲကစားခြင်း — Solo & PvP (Kbj <amount> နှင့် Kbj @user <amount>)
  {
    names: ['bj', 'blackjack'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🃏 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် ဆော့ပါ။');
      }

      const { opponent, betArg } = extractBetAndOpponent(message, args);
      const { bet, error } = validateBet(betArg, user.balance, 'Solo: `Kbj 1000` | PvP: `Kbj @User 1000`');
      if (error) return message.reply(error);

      // ================= PvP BLACKJACK =================
      if (opponent) {
        if (opponent.bot) return message.reply('❌ Bot များကို PvP ဖဲစိန်ခေါ်၍ မရပါ။');
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
            .setColor('#9B59B6')
            .setTitle(`🃏 PvP Blackjack စိန်ခေါ်မှု — ${bet.toLocaleString()} coins`)
            .setDescription(
              `**${message.author.username}** က **${opponent.username}** ကို လောင်းကြေး **${bet.toLocaleString()} coins** ဖြင့် Blackjack စိန်ခေါ်လိုက်ပါပြီ!\n` +
              `🏆 အနိုင်ရသူသည် စုစုပေါင်း **${(bet * 2).toLocaleString()} coins** ရရှိပါမည်။\n` +
              `<@${opponent.id}> အနေဖြင့် **၃၀ စက္ကန့်အတွင်း** ရွေးချယ်ပါ —`
            );

          const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bjpvp_accept').setLabel('🃏 Accept (လက်ခံမည်)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('bjpvp_reject').setLabel('❌ Reject (ငြင်းပယ်မည်)').setStyle(ButtonStyle.Danger)
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

              if (i.customId === 'bjpvp_reject') {
                inviteCollector.stop('rejected');
                const rejectEmbed = new EmbedBuilder()
                  .setColor('#E74C3C')
                  .setDescription(`❌ **${opponent.username}** က Blackjack PvP စိန်ခေါ်မှုကို ငြင်းပယ်လိုက်ပါပြီ။`);
                return i.update({ content: '', embeds: [rejectEmbed], components: [] });
              }

              if (i.customId === 'bjpvp_accept') {
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
                    busted: false,
                    natural: false,
                  },
                  [opponent.id]: {
                    id: opponent.id,
                    name: opponent.username,
                    hand: [deck.pop(), deck.pop()],
                    done: false,
                    busted: false,
                    natural: false,
                  },
                };

                const p1 = players[message.author.id];
                const p2 = players[opponent.id];

                if (calcBlackjackHand(p1.hand) === 21) { p1.done = true; p1.natural = true; }
                if (calcBlackjackHand(p2.hand) === 21) { p2.done = true; p2.natural = true; }

                const statusLabel = (p) => {
                  if (p.natural) return `🔥 **BLACKJACK!** (${p.hand.length} ချပ်)`;
                  if (p.busted) return `💥 **BUST!** (${p.hand.length} ချပ်)`;
                  if (p.done) return `🛑 **ရပ်ပြီး** (${p.hand.length} ချပ်)`;
                  return `⏳ **ကစားနေဆဲ** (${p.hand.length} ချပ်)`;
                };

                const buildPvpEmbed = () =>
                  new EmbedBuilder()
                    .setColor('#F39C12')
                    .setTitle(`🃏 PvP Blackjack: ${p1.name} VS ${p2.name} (Pot: ${(bet * 2).toLocaleString()} coins)`)
                    .setDescription('`👁️ ကိုယ့်ဖဲကြည့်မည်` ကိုနှိပ်ပြီး ဖဲစစ်ကာ **Hit** သို့မဟုတ် **Stand** ရွေးချယ်ပါ *(၄၅ စက္ကန့်အတွင်း)*')
                    .addFields(
                      { name: `🧑 ${p1.name}`, value: statusLabel(p1), inline: true },
                      { name: `🧑 ${p2.name}`, value: statusLabel(p2), inline: true }
                    );

                const gameRow = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('bjpvp_view').setLabel('👁️ ကိုယ့်ဖဲကြည့်မည်').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder().setCustomId('bjpvp_hit').setLabel('🃏 Hit (ထပ်ဆွဲမည်)').setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId('bjpvp_stand').setLabel('🛑 Stand (ရပ်မည်)').setStyle(ButtonStyle.Danger)
                );

                let resolved = false;
                const resolvePvpGame = async (updateInteraction = null) => {
                  if (resolved) return;
                  resolved = true;

                  try {
                    const s1 = calcBlackjackHand(p1.hand);
                    const s2 = calcBlackjackHand(p2.hand);
                    const b1 = s1 > 21;
                    const b2 = s2 > 21;

                    let winner = null;
                    if (b1 && b2) {
                      winner = null;
                    } else if (b1) {
                      winner = p2;
                    } else if (b2) {
                      winner = p1;
                    } else if (s1 > s2) {
                      winner = p1;
                    } else if (s2 > s1) {
                      winner = p2;
                    } else if (p1.natural && !p2.natural) {
                      winner = p1;
                    } else if (p2.natural && !p1.natural) {
                      winner = p2;
                    }

                    let resultDesc = '';
                    let color = '#95A5A6';
                    if (winner) {
                      const winUser = await getUser(winner.id, winner.name);
                      winUser.balance += bet * 2;
                      await winUser.save();
                      color = '#2ECC71';
                      resultDesc = `🏆 **${winner.name}** က အနိုင်ရရှိပြီး **+${bet.toLocaleString()} coins** *(စုစုပေါင်း ${(bet * 2).toLocaleString()} coins)* သိမ်းပိုက်သွားပါပြီ!`;
                    } else {
                      const u1 = await getUser(p1.id, p1.name);
                      const u2 = await getUser(p2.id, p2.name);
                      u1.balance += bet;
                      u2.balance += bet;
                      await u1.save();
                      await u2.save();
                      resultDesc = `🛡️ **သရေကျပါတယ် (Push)!** နှစ်ဖက်လုံး လောင်းကြေး **${bet.toLocaleString()} coins** စီ ပြန်လည်ရရှိပါတယ်။`;
                    }

                    const finalEmbed = new EmbedBuilder()
                      .setColor(color)
                      .setTitle(`🃏 PvP Blackjack ရလဒ် — ${p1.name} VS ${p2.name}`)
                      .addFields(
                        { name: `🧑 ${p1.name} (${s1}${b1 ? ' - BUST' : ''})`, value: formatHand(p1.hand), inline: true },
                        { name: `🧑 ${p2.name} (${s2}${b2 ? ' - BUST' : ''})`, value: formatHand(p2.hand), inline: true }
                      )
                      .setDescription(resultDesc);

                    if (updateInteraction) {
                      await updateInteraction.update({ content: '', embeds: [finalEmbed], components: [] }).catch(() => {});
                    } else {
                      await challengeMsg.edit({ content: '', embeds: [finalEmbed], components: [] }).catch(() => {});
                    }
                  } catch (err) {
                    console.error('Blackjack PvP Resolve Error:', err);
                  } finally {
                    activeGambling.delete(p1.id);
                    activeGambling.delete(p2.id);
                  }
                };

                if (p1.done && p2.done) {
                  return resolvePvpGame(i);
                }

                await i.update({ content: '', embeds: [buildPvpEmbed()], components: [gameRow] });

                const gameCollector = challengeMsg.createMessageComponentCollector({ time: 45000 });

                gameCollector.on('collect', async (btn) => {
                  try {
                    const actor = players[btn.user.id];
                    if (!actor) {
                      return btn.reply({ content: '❌ သင်က ဒီပွဲထဲက ကစားသမား မဟုတ်ပါဘူး!', ephemeral: true });
                    }

                    if (btn.customId === 'bjpvp_view') {
                      const score = calcBlackjackHand(actor.hand);
                      return btn.reply({
                        content: `🃏 **သင့်လက်ရှိဖဲ (${score} မှတ်):** ${formatHand(actor.hand)}`,
                        ephemeral: true,
                      });
                    }

                    if (actor.done) {
                      return btn.reply({ content: '✅ သင် ရပ်ပြီးသား/ပြီးဆုံးပြီးသား ဖြစ်ပါတယ်! တခြားတစ်ယောက်ကို စောင့်ပေးပါ။', ephemeral: true });
                    }

                    if (btn.customId === 'bjpvp_hit') {
                      actor.hand.push(deck.pop());
                      const score = calcBlackjackHand(actor.hand);
                      if (score > 21) {
                        actor.done = true;
                        actor.busted = true;
                      } else if (score === 21) {
                        actor.done = true;
                      }

                      await btn.reply({
                        content: `🃏 ဖဲထပ်ဆွဲပြီး — **(${score} မှတ်):** ${formatHand(actor.hand)}${actor.busted ? '\n💥 **21 ကျော်သွားပါပြီ (BUST)!**' : ''}`,
                        ephemeral: true,
                      });
                    } else if (btn.customId === 'bjpvp_stand') {
                      actor.done = true;
                      const score = calcBlackjackHand(actor.hand);
                      await btn.reply({
                        content: `🛑 **${score} မှတ်** ဖြင့် ရပ်လိုက်ပါပြီ။ ဖဲ: ${formatHand(actor.hand)}`,
                        ephemeral: true,
                      });
                    }

                    if (p1.done && p2.done) {
                      gameCollector.stop('finished');
                    } else {
                      await challengeMsg.edit({ embeds: [buildPvpEmbed()], components: [gameRow] }).catch(() => {});
                    }
                  } catch (err) {
                    console.error('Blackjack PvP Collect Error:', err);
                  }
                });

                gameCollector.on('end', async () => {
                  await resolvePvpGame();
                });
              }
            } catch (err) {
              console.error('Blackjack PvP Invite Error:', err);
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
                .setDescription(`⏳ **${opponent.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်မဖြေသဖြင့် PvP Blackjack စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
              await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
          });
        } catch (err) {
          activeGambling.delete(message.author.id);
          throw err;
        }

        return;
      }

      // ================= SOLO BLACKJACK =================
      activeGambling.add(message.author.id);

      try {
        const deck = createShuffledDeck();
        user.balance -= bet;
        await user.save();

        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        const playerTotal = calcBlackjackHand(playerHand);
        const dealerTotal = calcBlackjackHand(dealerHand);

        if (playerTotal === 21) {
          activeGambling.delete(message.author.id);
          if (dealerTotal === 21) {
            user.balance += bet;
            await user.save();
            const pushEmbed = new EmbedBuilder()
              .setColor('#95A5A6')
              .setTitle('🃏 Blackjack — သရေကျပါသည် (Push)!')
              .addFields(
                { name: `🧑 ${message.author.username} (21)`, value: formatHand(playerHand), inline: true },
                { name: '🤖 Dealer (21)', value: formatHand(dealerHand), inline: true }
              )
              .setDescription(`နှစ်ဖက်လုံး Blackjack ကျသဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** အရင်းပြန်ရပါတယ်။`);
            return message.reply({ embeds: [pushEmbed] });
          }

          const payout = Math.floor(bet * 2.5);
          const profit = payout - bet;
          user.balance += payout;
          await user.save();

          const bjEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🃏 BLACKJACK! (1.5x WIN)')
            .addFields(
              { name: `🧑 ${message.author.username} (21)`, value: formatHand(playerHand), inline: true },
              { name: `🤖 Dealer (${dealerTotal})`, value: formatHand(dealerHand), inline: true }
            )
            .setDescription(`🔥 **BLACKJACK!** **+${profit.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`);
          return message.reply({ embeds: [bjEmbed] });
        }

        const buildGameEmbed = (statusText, color = '#2B2D31', revealDealer = false) => {
          const pScore = calcBlackjackHand(playerHand);
          const dScore = revealDealer ? calcBlackjackHand(dealerHand) : '?';
          return new EmbedBuilder()
            .setColor(color)
            .setTitle(`🃏 ${message.author.username} ၏ Blackjack (လောင်းကြေး: ${bet.toLocaleString()} coins)`)
            .addFields(
              { name: `🧑 သင့်ဖဲ (${pScore})`, value: formatHand(playerHand), inline: true },
              { name: `🤖 Dealer (${dScore})`, value: formatHand(dealerHand, !revealDealer), inline: true }
            )
            .setDescription(statusText);
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bj_hit').setLabel('🃏 Hit (ထပ်ဆွဲမည်)').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Stand (ရပ်မည်)').setStyle(ButtonStyle.Danger)
        );

        const gameMsg = await message.reply({
          embeds: [buildGameEmbed('အောက်ပါ ခလုတ်များကို နှိပ်၍ ကစားပါ *(၃၀ စက္ကန့်အတွင်း)*')],
          components: [row],
        });

        const collector = gameMsg.createMessageComponentCollector({ time: 30000 });
        let ended = false;

        collector.on('collect', async (i) => {
          try {
            if (i.user.id !== message.author.id) {
              return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Blackjack ပွဲမဟုတ်ပါဘူး!', ephemeral: true });
            }
            if (ended) return;

            if (i.customId === 'bj_hit') {
              playerHand.push(deck.pop());
              const newTotal = calcBlackjackHand(playerHand);

              if (newTotal > 21) {
                ended = true;
                collector.stop('bust');
                return i.update({
                  embeds: [buildGameEmbed(
                    `💥 **BUST! (${newTotal} မှတ် — 21 ကျော်သွားပါပြီ)**\n💸 **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။`,
                    '#E74C3C',
                    true
                  )],
                  components: [],
                });
              }

              if (newTotal === 21) {
                await i.deferUpdate();
                collector.stop('stand');
              } else {
                await i.update({
                  embeds: [buildGameEmbed('အောက်ပါ ခလုတ်များကို နှိပ်၍ ဆက်ကစားပါ')],
                  components: [row],
                });
              }
            } else if (i.customId === 'bj_stand') {
              await i.deferUpdate();
              collector.stop('stand');
            }
          } catch (err) {
            console.error('Blackjack Solo Collect Error:', err);
          }
        });

        collector.on('end', async (_, reason) => {
          try {
            if (ended || reason === 'bust') return;
            ended = true;

            while (calcBlackjackHand(dealerHand) < 17) {
              dealerHand.push(deck.pop());
            }

            const finalPlayer = calcBlackjackHand(playerHand);
            const finalDealer = calcBlackjackHand(dealerHand);
            const freshUser = await getUser(message.author.id, message.author.username);

            if (finalDealer > 21 || finalPlayer > finalDealer) {
              freshUser.balance += bet * 2;
              await freshUser.save();
              const winReason = finalDealer > 21
                ? `Dealer Bust (${finalDealer}) ဖြစ်သွားပါတယ်!`
                : `${finalPlayer} ဖြင့် Dealer (${finalDealer}) ကို အနိုင်ရပါတယ်!`;
              await gameMsg.edit({
                embeds: [buildGameEmbed(
                  `🎉 **အနိုင်ရရှိပါတယ်!** ${winReason}\n💰 **+${bet.toLocaleString()} coins** ရရှိပါတယ်!`,
                  '#2ECC71',
                  true
                )],
                components: [],
              }).catch(() => {});
            } else if (finalPlayer === finalDealer) {
              freshUser.balance += bet;
              await freshUser.save();
              await gameMsg.edit({
                embeds: [buildGameEmbed(
                  `🛡️ **သရေကျပါတယ် (Push)!** နှစ်ဖက်လုံး **${finalPlayer}** မှတ် တူနေသဖြင့် အရင်းပြန်ရပါတယ်။`,
                  '#95A5A6',
                  true
                )],
                components: [],
              }).catch(() => {});
            } else {
              const timeoutNote = reason === 'time' ? '*(အချိန်စေ့သွားသဖြင့် အလိုအလျောက် Stand လုပ်လိုက်ပါသည်)*\n' : '';
              await gameMsg.edit({
                embeds: [buildGameEmbed(
                  `${timeoutNote}💸 **ရှုံးသွားပါတယ်!** Dealer က **${finalDealer}** မှတ်ဖြင့် အနိုင်ရသွားပါတယ်။ (**-${bet.toLocaleString()} coins**)`,
                  '#E74C3C',
                  true
                )],
                components: [],
              }).catch(() => {});
            }
          } catch (err) {
            console.error('Blackjack Solo End Error:', err);
          } finally {
            activeGambling.delete(message.author.id);
          }
        });
      } catch (err) {
        activeGambling.delete(message.author.id);
        throw err;
      }
    },
  },
];