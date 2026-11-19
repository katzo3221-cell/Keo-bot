const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../models/User');
const {
  activeGambling,
  sleep,
  parseBet,
  extractBetAndOpponent,
  createShuffledDeck,
  formatHand,
} = require('../utils/gamblingState');

// ================= ရှမ်းကိုးမီး တွက်ချက်မှု Helper =================
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

// ================= ခြောက်ကောင်ဂျင် အကောင်စာရင်း =================
const GIN_ANIMALS = [
  { id: 'tiger', emoji: '🐯', name: 'ကျား', aliases: ['tiger', 't', 'ကျား'] },
  { id: 'rooster', emoji: '🐓', name: 'ကြက်', aliases: ['rooster', 'chicken', 'r', 'c', 'ကြက်'] },
  { id: 'fish', emoji: '🐟', name: 'ငါး', aliases: ['fish', 'f', 'ငါး'] },
  { id: 'crab', emoji: '🦀', name: 'ဂဏန်း', aliases: ['crab', 'cr', 'ဂဏန်း'] },
  { id: 'shrimp', emoji: '🦐', name: 'ပုစွန်', aliases: ['shrimp', 'prawn', 's', 'p', 'ပုစွန်'] },
  { id: 'gourd', emoji: '🍐', name: 'ဘူးသီး', aliases: ['gourd', 'calabash', 'g', 'b', 'ဘူးသီး'] },
];

function findGinAnimal(raw) {
  if (!raw) return null;
  const q = raw.toLowerCase().trim();
  return GIN_ANIMALS.find((a) => a.aliases.includes(q)) || null;
}

// ================= Mines Multiplier တွက်ချက်ခြင်း (4x4 = 16 ကွက်) =================
function calcMinesMultiplier(revealedCount, bombsCount) {
  if (revealedCount <= 0) return 1;
  let prob = 1;
  for (let i = 0; i < revealedCount; i++) {
    prob *= (16 - bombsCount - i) / (16 - i);
  }
  return Math.max(1.05, Math.round((0.96 / prob) * 100) / 100);
}

module.exports = [
  // =========================================================================
  // ၁။ ရှမ်းကိုးမီး — Solo & PvP (Kskm <amount> နှင့် Kskm @user <amount>)
  // =========================================================================
  {
    names: ['skm', 'shan'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🃏 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် ဆော့ပါ။');
      }

      const { opponent, betArg } = extractBetAndOpponent(message, args);
      const bet = parseBet(betArg, user.balance);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။\nSolo: `Kskm 1000` | PvP: `Kskm @User 1000`');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

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
          if (i.user.id !== opponent.id) {
            return i.reply({ content: '❌ ဒီစိန်ခေါ်မှုက သင့်ကို ခေါ်ထားတာ မဟုတ်ပါဘူး!', ephemeral: true });
          }

          if (i.customId === 'skmpvp_reject') {
            inviteCollector.stop('rejected');
            activeGambling.delete(message.author.id);
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
              activeGambling.delete(message.author.id);
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

            // ၈/၉ ဒိုကျသူသည် အလိုအလျောက် ရပ်ပြီးသား ဖြစ်မည်
            if (evaluateSkm(p1.hand).isDo) p1.done = true;
            if (evaluateSkm(p2.hand).isDo) p2.done = true;

            const statusLabel = (p) => (p.done ? `✅ **အဆင်သင့်ဖြစ်ပြီ** (${p.hand.length} ချပ်)` : `⏳ **စဉ်းစားနေဆဲ** (${p.hand.length} ချပ်)`);

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

            const resolvePvpSkm = async (updateInteraction = null) => {
              activeGambling.delete(p1.id);
              activeGambling.delete(p2.id);

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
                return updateInteraction.update({ content: '', embeds: [finalEmbed], components: [] });
              }
              return challengeMsg.edit({ content: '', embeds: [finalEmbed], components: [] }).catch(() => {});
            };

            if (p1.done && p2.done) {
              return resolvePvpSkm(i);
            }

            await i.update({ content: '', embeds: [buildPvpEmbed()], components: [gameRow] });

            const gameCollector = challengeMsg.createMessageComponentCollector({ time: 45000 });

            gameCollector.on('collect', async (btn) => {
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
            });

            gameCollector.on('end', async () => {
              await resolvePvpSkm();
            });
          }
        });

        inviteCollector.on('end', async (_, reason) => {
          if (reason === 'time') {
            activeGambling.delete(message.author.id);
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription(`⏳ **${opponent.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်မဖြေသဖြင့် ရှမ်းကိုးမီး PvP စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
            await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
          }
        });

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

        const resolveSoloSkm = async (targetMsg = null, interaction = null) => {
          activeGambling.delete(message.author.id);

          // Dealer သည် ၂ ချပ်ပေါင်း ၄ မှတ်အောက်ဖြစ်ပြီး Player ဒိုမဟုတ်ပါက ၃ ချပ်မြောက် ဆွဲမည်
          const pEval = evaluateSkm(playerHand);
          const dEvalInitial = evaluateSkm(dealerHand);
          if (!pEval.isDo && !dEvalInitial.isDo && dEvalInitial.points <= 4) {
            dealerHand.push(deck.pop());
          }

          const dEval = evaluateSkm(dealerHand);
          const freshUser = await getUser(message.author.id, message.author.username);

          // Solo တွင် အမှတ်တူပါက ဒိုင်စားမည် (House Edge)
          let playerWon = false;
          let tieDealerWin = false;

          if (pEval.isDo !== dEval.isDo) {
            playerWon = pEval.isDo;
          } else if (pEval.points !== dEval.points) {
            playerWon = pEval.points > dEval.points;
          } else {
            playerWon = false;
            tieDealerWin = true;
          }

          let desc = '';
          let color = '#E74C3C';

          if (playerWon) {
            // Solo အဆနှုန်းထား: သာမန်=1x | ၂ ချပ်ပွင့်တူ/ပူး=1.5x | ၃ ချပ်ပွင့်တူ/သုံးချပ်ပူး=2x
            const soloMult = pEval.mult === 3 ? 2 : pEval.mult === 2 ? 1.5 : 1;
            const winProfit = Math.floor(bet * soloMult);
            freshUser.balance += bet + winProfit;
            await freshUser.save();
            color = '#2ECC71';
            const multText = soloMult > 1 ? ` (**${soloMult}x အဆ!**)` : '';
            desc = `🎉 **အနိုင်ရရှိပါတယ်!**${multText} **+${winProfit.toLocaleString()} coins** ရရှိပါတယ်!`;
          } else {
            const tieNote = tieDealerWin ? ' *(အမှတ်တူ ဒိုင်စားပါသည်)*' : '';
            desc = `💸 **ရှုံးသွားပါတယ်!**${tieNote} ဒိုင်က **${dEval.label}** ဖြင့် အနိုင်ရသွားပါတယ်။ (**-${bet.toLocaleString()} coins**)`;
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
            return interaction.update({ embeds: [finalEmbed], components: [] });
          }
          if (targetMsg) {
            return targetMsg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
          }
          return message.reply({ embeds: [finalEmbed] });
        };

        // တစ်ဖက်ဖက် ၈/၉ ဒို တန်းကျရင် ချက်ချင်းဖွင့်မည်
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
          if (i.user.id !== message.author.id) {
            return i.reply({ content: '❌ ဒါက သင့်ရဲ့ ရှမ်းကိုးမီးပွဲ မဟုတ်ပါဘူး!', ephemeral: true });
          }

          if (i.customId === 'skm_draw') {
            playerHand.push(deck.pop());
          }
          collector.stop('done');
          await resolveSoloSkm(gameMsg, i);
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

  // =========================================================================
  // ၂။ ခြောက်ကောင်ဂျင် (Kgin / Kkl <amount> [animal])
  // =========================================================================
  {
    names: ['gin', 'kl', '6animal'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      const bet = parseBet(args[0], user.balance);
      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kgin 1000` သို့မဟုတ် `Kgin 1000 tiger`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      // Winrate ချိန်ညှိရန် (0.12 = Winrate ~31.9% | ပိုနည်းချင်ရင် 0.10 ပြောင်းပါ)
      const CHOSEN_ANIMAL_CHANCE = 0.12;

      const rollOneGinDie = (chosen) => {
        if (Math.random() < CHOSEN_ANIMAL_CHANCE) {
          return chosen;
        }
        const others = GIN_ANIMALS.filter((a) => a.id !== chosen.id);
        return others[Math.floor(Math.random() * others.length)];
      };

      const runGinRoll = async (chosenAnimal, msgOrInteraction, isInteraction = false) => {
        try {
          const freshUser = await getUser(message.author.id, message.author.username);
          if (freshUser.balance < bet) {
            const errText = '❌ လက်ကျန်ငွေ မလုံလောက်တော့ပါ!';
            return isInteraction
              ? msgOrInteraction.update({ content: errText, embeds: [], components: [] })
              : message.reply(errText);
          }

          freshUser.balance -= bet;
          await freshUser.save();

          const spinningText =
            `🎲 **${chosenAnimal.emoji} ${chosenAnimal.name}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး ခြောက်ကောင်ဂျင် ခေါက်လိုက်ပါပြီ...\n` +
            `**[ 🔄 | 🔄 | 🔄 ]** *အံစာ ၃ လုံး လှိမ့်နေပါသည်...*`;

          let msg;
          if (isInteraction) {
            await msgOrInteraction.update({ content: spinningText, embeds: [], components: [] });
            msg = msgOrInteraction.message;
          } else {
            msg = await message.reply(spinningText);
          }

          await sleep(1200);

          const r1 = rollOneGinDie(chosenAnimal);
          const r2 = rollOneGinDie(chosenAnimal);
          const r3 = rollOneGinDie(chosenAnimal);
          const rolls = [r1, r2, r3];

          const matches = rolls.filter((a) => a.id === chosenAnimal.id).length;
          const board = `🎲 **[ ${r1.emoji} ${r1.name} | ${r2.emoji} ${r2.name} | ${r3.emoji} ${r3.name} ]**`;

          if (matches > 0) {
            const mult = matches; // 1 ကောင်=1x, 2 ကောင်=2x, 3 ကောင်=3x
            const profit = bet * mult;
            const winUser = await getUser(message.author.id, message.author.username);
            winUser.balance += bet + profit;
            await winUser.save();

            const jackpotNote = matches === 3 ? ' 🔥 **(TRIPLE 3x JACKPOT!)**' : '';
            return msg.edit(
              `${board}\n🎉 **${chosenAnimal.emoji} ${chosenAnimal.name} ${matches} ကောင် တူသွားပါတယ်!**${jackpotNote}\n💰 **+${profit.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`
            );
          } else {
            return msg.edit(
              `${board}\n💸 **${chosenAnimal.emoji} ${chosenAnimal.name}** တစ်ကောင်မှ မပါသဖြင့် **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။`
            );
          }
        } finally {
          activeGambling.delete(message.author.id);
        }
      };

      const directAnimal = findGinAnimal(args[1]);
      if (directAnimal) {
        activeGambling.add(message.author.id);
        return runGinRoll(directAnimal, message, false);
      }

      // အကောင်နာမည် မရိုက်ထားပါက ခလုတ် ၆ ခုဖြင့် ရွေးခိုင်းမည်
      activeGambling.add(message.author.id);

      const pickEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle(`🎲 ခြောက်ကောင်ဂျင် — လောင်းကြေး ${bet.toLocaleString()} coins`)
        .setDescription(
          'လောင်းမည့် အကောင်ကို အောက်ပါခလုတ်များမှ ရွေးချယ်ပါ *(၃၀ စက္ကန့်အတွင်း)*\n' +
          '• ၁ ကောင်တူ = **1x** | ၂ ကောင်တူ = **2x** | ၃ ကောင်လုံးတူ = **5x JACKPOT!**'
        );

      const row1 = new ActionRowBuilder().addComponents(
        GIN_ANIMALS.slice(0, 3).map((a) =>
          new ButtonBuilder().setCustomId(`gin_${a.id}`).setLabel(`${a.emoji} ${a.name}`).setStyle(ButtonStyle.Secondary)
        )
      );
      const row2 = new ActionRowBuilder().addComponents(
        GIN_ANIMALS.slice(3, 6).map((a) =>
          new ButtonBuilder().setCustomId(`gin_${a.id}`).setLabel(`${a.emoji} ${a.name}`).setStyle(ButtonStyle.Secondary)
        )
      );

      const pickMsg = await message.reply({ embeds: [pickEmbed], components: [row1, row2] });
      const collector = pickMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ ဒါက သင့်ရဲ့ ခြောက်ကောင်ဂျင်ပွဲ မဟုတ်ပါဘူး!', ephemeral: true });
        }
        const chosenId = i.customId.replace('gin_', '');
        const chosenAnimal = GIN_ANIMALS.find((a) => a.id === chosenId);
        collector.stop('picked');
        await runGinRoll(chosenAnimal, i, true);
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time') {
          activeGambling.delete(message.author.id);
          await pickMsg.edit({ content: '⏳ အချိန်စေ့သွားသဖြင့် ခြောက်ကောင်ဂျင်ပွဲ ပျက်ပြယ်သွားပါပြီ။', embeds: [], components: [] }).catch(() => {});
        }
      });
    },
  },

  // =========================================================================
  // ၃။ ဗုံးရှောင်ဂိမ်း (Kmines / Kmine <amount> [bombs 1-10])
  // =========================================================================
  {
    names: ['mines', 'mine'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('💣 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် ဆော့ပါ။');
      }

      const bet = parseBet(args[0], user.balance);
      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kmines 1000` သို့မဟုတ် `Kmines 1000 5`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      let bombsCount = 4; // မူလ 3 မှ 4 သို့ ပြောင်းပါ
      if (args[1] !== undefined) {
        const parsedBombs = parseInt(args[1], 10);
        if (isNaN(parsedBombs) || parsedBombs < 1 || parsedBombs > 11) {
          return message.reply('❌ ဗုံးအရေအတွက်ကို **၁ လုံးမှ ၁၁ လုံး** အတွင်းသာ ထည့်ပေးပါ! (ဥပမာ - `Kmines 1000 4`)');
        }
        bombsCount = parsedBombs;
      }

      activeGambling.add(message.author.id);

      try {
        user.balance -= bet;
        await user.save();

        // 4x4 (16 ကွက်) ထဲတွင် ဗုံးနေရာများ ကျပန်းချထားခြင်း
        const bombIndices = new Set();
        while (bombIndices.size < bombsCount) {
          bombIndices.add(Math.floor(Math.random() * 16));
        }

        const revealed = new Set();
        const safeTotal = 16 - bombsCount;

        const buildBoardRows = (gameOver = false, explodedIdx = -1) => {
          const rows = [];
          for (let r = 0; r < 4; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < 4; c++) {
              const idx = r * 4 + c;
              const isBomb = bombIndices.has(idx);
              const isOpen = revealed.has(idx);

              let emoji = '⬜';
              let style = ButtonStyle.Secondary;

              if (gameOver) {
                if (idx === explodedIdx) {
                  emoji = '💥';
                  style = ButtonStyle.Danger;
                } else if (isBomb) {
                  emoji = '💣';
                  style = ButtonStyle.Danger;
                } else if (isOpen) {
                  emoji = '💎';
                  style = ButtonStyle.Success;
                } else {
                  emoji = '🔹';
                  style = ButtonStyle.Secondary;
                }
              } else if (isOpen) {
                emoji = '💎';
                style = ButtonStyle.Success;
              }

              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`mine_${idx}`)
                  .setEmoji(emoji)
                  .setStyle(style)
                  .setDisabled(gameOver || isOpen)
              );
            }
            rows.push(row);
          }

          const mult = calcMinesMultiplier(revealed.size, bombsCount);
          const cashoutAmount = Math.floor(bet * mult);

          const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('mine_cashout')
              .setLabel(
                revealed.size > 0
                  ? `💰 ငွေသိမ်းမည် (${cashoutAmount.toLocaleString()} coins • ${mult}x)`
                  : '💰 ငွေသိမ်းမည် (အနည်းဆုံး ၁ ကွက်ဖွင့်ပါ)'
              )
              .setStyle(ButtonStyle.Primary)
              .setDisabled(gameOver || revealed.size === 0)
          );
          rows.push(controlRow);
          return rows;
        };

        const buildEmbed = (statusText, color = '#3498DB') => {
          const mult = calcMinesMultiplier(revealed.size, bombsCount);
          const nextMult = calcMinesMultiplier(revealed.size + 1, bombsCount);
          return new EmbedBuilder()
            .setColor(color)
            .setTitle(`💎 ${message.author.username} ၏ Mines (💣 ဗုံး ${bombsCount} လုံး)`)
            .setDescription(statusText)
            .addFields(
              { name: '💰 လောင်းကြေး', value: `**${bet.toLocaleString()} coins**`, inline: true },
              { name: '💎 ဖွင့်ပြီး', value: `**${revealed.size} / ${safeTotal}**`, inline: true },
              { name: '📈 လက်ရှိအဆ', value: `**${mult}x** *(နောက် ၁ ကွက်: ${nextMult}x)*`, inline: true }
            );
        };

        const gameMsg = await message.reply({
          embeds: [buildEmbed('ဗုံး 💣 မထိအောင် စိန်တုံး 💎 များကို ဖွင့်ပါ! ကြိုက်တဲ့အချိန် **ငွေသိမ်းမည်** နှိပ်နိုင်ပါတယ်။')],
          components: buildBoardRows(false),
        });

        const collector = gameMsg.createMessageComponentCollector({ time: 60000 });
        let ended = false;

        collector.on('collect', async (i) => {
          if (i.user.id !== message.author.id) {
            return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Mines ပွဲမဟုတ်ပါဘူး!', ephemeral: true });
          }

          if (i.customId === 'mine_cashout') {
            ended = true;
            collector.stop('cashout');
            const mult = calcMinesMultiplier(revealed.size, bombsCount);
            const payout = Math.floor(bet * mult);
            const profit = payout - bet;

            const freshUser = await getUser(message.author.id, message.author.username);
            freshUser.balance += payout;
            await freshUser.save();

            return i.update({
              embeds: [buildEmbed(
                `🎉 **ငွေသိမ်းလိုက်ပါပြီ! (${mult}x)**\n💰 စုစုပေါင်း **${payout.toLocaleString()} coins** *(အမြတ်: +${profit.toLocaleString()} coins)* ရရှိပါတယ်!`,
                '#2ECC71'
              )],
              components: buildBoardRows(true),
            });
          }

          const idx = parseInt(i.customId.replace('mine_', ''), 10);
          if (revealed.has(idx)) return i.deferUpdate();

          if (bombIndices.has(idx)) {
            ended = true;
            collector.stop('bomb');
            return i.update({
              embeds: [buildEmbed(
                `💥 **BOOM! ဗုံးထိသွားပါပြီ!**\n💸 **-${bet.toLocaleString()} coins** ဆုံးရှုံးသွားပါတယ်။`,
                '#E74C3C'
              )],
              components: buildBoardRows(true, idx),
            });
          }

          revealed.add(idx);

          // စိန်တုံးအားလုံး ဖွင့်နိုင်ပါက အလိုအလျောက် အနိုင်ပေးမည်
          if (revealed.size >= safeTotal) {
            ended = true;
            collector.stop('cleared');
            const mult = calcMinesMultiplier(revealed.size, bombsCount);
            const payout = Math.floor(bet * mult);
            const profit = payout - bet;

            const freshUser = await getUser(message.author.id, message.author.username);
            freshUser.balance += payout;
            await freshUser.save();

            return i.update({
              embeds: [buildEmbed(
                `🔥 **စိန်တုံးအားလုံး ရှင်းလင်းနိုင်ပါပြီ! (${mult}x MAX WIN)**\n💰 စုစုပေါင်း **${payout.toLocaleString()} coins** *(အမြတ်: +${profit.toLocaleString()} coins)* ရရှိပါတယ်!`,
                '#FFD700'
              )],
              components: buildBoardRows(true),
            });
          }

          return i.update({
            embeds: [buildEmbed('✨ စိန်တုံး 💎 တွေ့ပါပြီ! ဆက်ဖွင့်မလား၊ ငွေသိမ်းမလား ရွေးချယ်ပါ။')],
            components: buildBoardRows(false),
          });
        });

        collector.on('end', async () => {
          activeGambling.delete(message.author.id);
          if (ended) return;

          const freshUser = await getUser(message.author.id, message.author.username);
          if (revealed.size > 0) {
            const mult = calcMinesMultiplier(revealed.size, bombsCount);
            const payout = Math.floor(bet * mult);
            freshUser.balance += payout;
            await freshUser.save();

            await gameMsg.edit({
              embeds: [buildEmbed(
                `⏳ အချိန်စေ့သွားသဖြင့် **${mult}x** ဖြင့် အလိုအလျောက် ငွေသိမ်းပေးလိုက်ပါပြီ! (**${payout.toLocaleString()} coins**)`,
                '#2ECC71'
              )],
              components: buildBoardRows(true),
            }).catch(() => {});
          } else {
            freshUser.balance += bet;
            await freshUser.save();

            await gameMsg.edit({
              embeds: [buildEmbed(
                `⏳ ဘာမှမဖွင့်ဘဲ အချိန်စေ့သွားသဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** ပြန်အမ်းပေးလိုက်ပါပြီ။`,
                '#95A5A6'
              )],
              components: buildBoardRows(true),
            }).catch(() => {});
          }
        });
      } catch (err) {
        activeGambling.delete(message.author.id);
        throw err;
      }
    },
  },

  // =========================================================================
  // ၄။ သူငယ်ချင်းချင်း ကျောက်တုံး-ကတ်ကြေး-စက္ကူ လောင်းကစား (Krps / Kduel @user <amount>)
  // =========================================================================
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

      const bet = parseBet(betArg, user.balance);
      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Krps @User 1000`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      const oppUser = await getUser(opponent.id, opponent.username);
      if (oppUser.balance < bet) {
        return message.reply(`❌ **${opponent.username}** တွင် လောင်းကြေး **${bet.toLocaleString()} coins** မလုံလောက်ပါ!`);
      }

      activeGambling.add(message.author.id);

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

      inviteCollector.on('collect', async (i) => {
        if (i.user.id !== opponent.id) {
          return i.reply({ content: '❌ ဒီစိန်ခေါ်မှုက သင့်ကို ခေါ်ထားတာ မဟုတ်ပါဘူး!', ephemeral: true });
        }

        if (i.customId === 'rps_reject') {
          inviteCollector.stop('rejected');
          activeGambling.delete(message.author.id);
          const rejectEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription(`❌ **${opponent.username}** က စိန်ခေါ်မှုကို ငြင်းပယ်လိုက်ပါပြီ။`);
          return i.update({ content: '', embeds: [rejectEmbed], components: [] });
        }

        if (i.customId === 'rps_accept') {
          if (activeGambling.has(opponent.id)) {
            return i.reply({ content: '❌ သင် အခြားလောင်းကစားပွဲ ကစားနေဆဲ ဖြစ်ပါတယ်!', ephemeral: true });
          }

          const freshP1 = await getUser(message.author.id, message.author.username);
          const freshP2 = await getUser(opponent.id, opponent.username);

          if (freshP1.balance < bet || freshP2.balance < bet) {
            inviteCollector.stop('insufficient');
            activeGambling.delete(message.author.id);
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

          const choices = { [message.author.id]: null, [opponent.id]: null };
          const labels = {
            rock: '🪨 ကျောက်တုံး',
            scissors: '✂️ ကတ်ကြေး',
            paper: '📄 စက္ကူ',
          };

          const buildPlayEmbed = () =>
            new EmbedBuilder()
              .setColor('#F39C12')
              .setTitle(`🪨✂️📄 ${message.author.username} VS ${opponent.username} (Pot: ${(bet * 2).toLocaleString()} coins)`)
              .setDescription('တစ်ယောက်မမြင်အောင် အောက်ပါခလုတ်မှ ကိုယ်ကြိုက်ရာ ရွေးချယ်ပါ *(၃၀ စက္ကန့်အတွင်း)*')
              .addFields(
                { name: `🧑 ${message.author.username}`, value: choices[message.author.id] ? '✅ **ရွေးချယ်ပြီး**' : '⏳ **စဉ်းစားနေဆဲ**', inline: true },
                { name: `🧑 ${opponent.username}`, value: choices[opponent.id] ? '✅ **ရွေးချယ်ပြီး**' : '⏳ **စဉ်းစားနေဆဲ**', inline: true }
              );

          const playRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 ကျောက်တုံး').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ ကတ်ကြေး').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 စက္ကူ').setStyle(ButtonStyle.Secondary)
          );

          await i.update({ content: '', embeds: [buildPlayEmbed()], components: [playRow] });

          const gameCollector = challengeMsg.createMessageComponentCollector({ time: 30000 });

          gameCollector.on('collect', async (btn) => {
            if (![message.author.id, opponent.id].includes(btn.user.id)) {
              return btn.reply({ content: '❌ သင်က ဒီပွဲထဲက ကစားသမား မဟုတ်ပါဘူး!', ephemeral: true });
            }
            if (choices[btn.user.id]) {
              return btn.reply({ content: '✅ သင် ရွေးချယ်ပြီးသား ဖြစ်ပါတယ်! တခြားတစ်ယောက်ကို စောင့်ပေးပါ။', ephemeral: true });
            }

            const picked = btn.customId.replace('rps_', '');
            choices[btn.user.id] = picked;
            await btn.reply({ content: `✅ သင် **${labels[picked]}** ကို ရွေးချယ်လိုက်ပါပြီ!`, ephemeral: true });

            if (choices[message.author.id] && choices[opponent.id]) {
              gameCollector.stop('finished');
            } else {
              await challengeMsg.edit({ embeds: [buildPlayEmbed()], components: [playRow] }).catch(() => {});
            }
          });

          gameCollector.on('end', async () => {
            activeGambling.delete(message.author.id);
            activeGambling.delete(opponent.id);

            const c1 = choices[message.author.id];
            const c2 = choices[opponent.id];

            let winnerId = null;
            let winnerName = '';
            let desc = '';
            let color = '#95A5A6';

            if (!c1 && !c2) {
              const u1 = await getUser(message.author.id, message.author.username);
              const u2 = await getUser(opponent.id, opponent.username);
              u1.balance += bet;
              u2.balance += bet;
              await u1.save();
              await u2.save();
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
              const u1 = await getUser(message.author.id, message.author.username);
              const u2 = await getUser(opponent.id, opponent.username);
              u1.balance += bet;
              u2.balance += bet;
              await u1.save();
              await u2.save();
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
          });
        }
      });

      inviteCollector.on('end', async (_, reason) => {
        if (reason === 'time') {
          activeGambling.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#95A5A6')
            .setDescription(`⏳ **${opponent.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်မဖြေသဖြင့် စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
          await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
      });
    },
  },
];