const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../models/User');

const activeBlackjack = new Set();
const MAX_BET = 250000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = [
  // ၁။ Coinflip ကစားခြင်း (Kcf / Kcoinflip)
  {
    names: ['cf', 'coinflip'],
    async execute(message, args, user) {
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kcf 100` သို့မဟုတ် `Kcf all`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      let choice = 'heads';
      if (args[1] && (args[1].toLowerCase() === 't' || args[1].toLowerCase() === 'tails')) {
        choice = 'tails';
      }

      const choiceText = choice === 'heads' ? 'ခေါင်း (Heads)' : 'ပန်း (Tails)';
      const msg = await message.reply(`🪙 **${choiceText}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး အကြွေစေ့ မြှောက်လိုက်ပါပြီ...\n🔄 *အကြွေစေ့ လည်နေပါသည်...*`);

      await sleep(1200);

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const resultText = result === 'heads' ? '👑 ခေါင်း (Heads)' : '🌸 ပန်း (Tails)';

      if (choice === result) {
        user.balance += bet;
        await user.save();
        return msg.edit(`🪙 အကြွေစေ့ ကျသွားပါပြီ — **${resultText}**!\n🎉 **နိုင်ပါတယ်!** **+${bet.toLocaleString()} coins** ရရှိပါတယ်။`);
      } else {
        user.balance -= bet;
        await user.save();
        return msg.edit(`🪙 အကြွေစေ့ ကျသွားပါပြီ — **${resultText}**!\n😢 **ရှုံးသွားပါတယ်!** **-${bet.toLocaleString()} coins** ဆုံးရှုံးသွားပါတယ်။`);
      }
    },
  },

  // ၂။ Slots ကစားခြင်း (Ks / Kslots)
  {
    names: ['s', 'slots'],
    async execute(message, args, user) {
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kslots 100` သို့မဟုတ် `Kslots all`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      const items = ['🍒', '🍋', '🍇', '🍉', '🔔', '💎', '7️⃣'];
      const spinEmoji = '🔄';

      const slot1 = items[Math.floor(Math.random() * items.length)];
      const slot2 = items[Math.floor(Math.random() * items.length)];
      const slot3 = items[Math.floor(Math.random() * items.length)];

      const msg = await message.reply(`🎰 **[ ${spinEmoji} | ${spinEmoji} | ${spinEmoji} ]** 🎰\n*Slot စက်လှည့်နေပါသည်...*`);

      await sleep(700);
      await msg.edit(`🎰 **[ ${slot1} | ${spinEmoji} | ${spinEmoji} ]** 🎰\n*Slot စက်လှည့်နေပါသည်...*`);

      await sleep(700);
      await msg.edit(`🎰 **[ ${slot1} | ${slot2} | ${spinEmoji} ]** 🎰\n*Slot စက်လှည့်နေပါသည်...*`);

      await sleep(700);
      const board = `🎰 **[ ${slot1} | ${slot2} | ${slot3} ]** 🎰`;

      if (slot1 === slot2 && slot2 === slot3) {
        const winnings = bet * 5;
        user.balance += winnings;
        await user.save();
        return msg.edit(`${board}\n🔥 **JACKPOT!** ၃ ခုလုံး တူသွားလို့ **+${winnings.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`);
      } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
        const winnings = Math.floor(bet * 1.5);
        user.balance += winnings;
        await user.save();
        return msg.edit(`${board}\n✨ ၂ ခု တူသွားလို့ **+${winnings.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`);
      } else {
        user.balance -= bet;
        await user.save();
        return msg.edit(`${board}\n💸 ဘာမှ မတူလို့ **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။`);
      }
    },
  },

  // ၃။ အံစာတုံး အသေး/အကြီး/လန့် ကစားခြင်း (Kd / Kdice)
  {
    names: ['d', 'dice'],
    async execute(message, args, user) {
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kd 1000 s` / `Kd all b` / `Kd 500 t`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      const rawChoice = args[1]?.toLowerCase();
      let choice = null;
      if (['s', 'small', 'အသေး'].includes(rawChoice)) choice = 'small';
      else if (['b', 'big', 'အကြီး'].includes(rawChoice)) choice = 'big';
      else if (['t', 'triple', 'lan', 'လန့်'].includes(rawChoice)) choice = 'triple';

      if (!choice) {
        return message.reply('❌ ရွေးချယ်မှု ထည့်ပေးပါ! (`s` = အသေး | `b` = အကြီး | `t` = လန့်)\nဥပမာ - `Kd 1000 s` သို့မဟုတ် `Kd all b`');
      }

      const choiceMap = {
        small: '🔽 အသေး (4-10)',
        big: '🔼 အကြီး (11-17)',
        triple: '🔥 လန့် (3 လုံးတူ)',
      };

      const diceEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

      const msg = await message.reply(
        `🎲 **${choiceMap[choice]}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး အံစာခေါက်လိုက်ပါပြီ...\n` +
        `**[ 🔄 | 🔄 | 🔄 ]** *အံစာတုံး လှိမ့်နေပါသည်...*`
      );

      await sleep(1200);

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2 + d3;

      const isTriple = d1 === d2 && d2 === d3;
      let actualResult = '';
      let resultLabel = '';

      if (isTriple) {
        actualResult = 'triple';
        resultLabel = `🔥 လန့် (${d1}-${d2}-${d3})`;
      } else if (sum >= 4 && sum <= 10) {
        actualResult = 'small';
        resultLabel = `🔽 အသေး (ပေါင်းလဒ်: ${sum})`;
      } else {
        actualResult = 'big';
        resultLabel = `🔼 အကြီး (ပေါင်းလဒ်: ${sum})`;
      }

      const board = `🎲 **[ ${diceEmojis[d1 - 1]} | ${diceEmojis[d2 - 1]} | ${diceEmojis[d3 - 1]} ]** ➔ **${resultLabel}**`;

      if (choice === actualResult) {
        const multiplier = choice === 'triple' ? 20 : 1;
        const winnings = bet * multiplier;
        user.balance += winnings;
        await user.save();

        const tripleNote = choice === 'triple' ? ' (**20x JACKPOT!**)' : '';
        return msg.edit(
          `${board}\n🎉 **အနိုင်ရရှိပါတယ်!**${tripleNote} **+${winnings.toLocaleString()} coins** ရရှိပါတယ်။`
        );
      } else {
        user.balance -= bet;
        await user.save();

        const lanLossNote = isTriple && choice !== 'triple' ? ' *(လန့် ကျသွားသဖြင့် အသေး/အကြီး ရှုံးပါသည်)*' : '';
        return msg.edit(
          `${board}\n💸 **ရှုံးသွားပါတယ်!**${lanLossNote} **-${bet.toLocaleString()} coins** ဆုံးရှုံးသွားပါတယ်။`
        );
      }
    },
  },

  // ၄။ Blackjack ဖဲကစားခြင်း (Kbj / Kblackjack)
  {
    names: ['bj', 'blackjack'],
    async execute(message, args, user) {
      if (activeBlackjack.has(message.author.id)) {
        return message.reply('🃏 သင်သည် Blackjack ကစားနေဆဲ ဖြစ်ပါတယ်! အပေါ်က Message မှ ခလုတ်ကို နှိပ်ပြီး အရင်ပြီးအောင် ဆော့ပါ။');
      }

      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kbj 1000` သို့မဟုတ် `Kbj all`)');
      }
      if (bet > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      const suits = ['♠️', '♥️', '♦️', '♣️'];
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const deck = [];
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank });
        }
      }
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      const calcHand = (hand) => {
        let total = 0;
        let aces = 0;
        for (const card of hand) {
          if (card.rank === 'A') {
            aces += 1;
            total += 11;
          } else if (['K', 'Q', 'J'].includes(card.rank)) {
            total += 10;
          } else {
            total += parseInt(card.rank);
          }
        }
        while (total > 21 && aces > 0) {
          total -= 10;
          aces -= 1;
        }
        return total;
      };

      const formatHand = (hand, hideSecond = false) => {
        if (hideSecond) {
          return `\`[ ${hand[0].rank}${hand[0].suit} ]\` \`[ ❓ ]\``;
        }
        return hand.map((c) => `\`[ ${c.rank}${c.suit} ]\``).join(' ');
      };

      user.balance -= bet;
      await user.save();

      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];
      const playerTotal = calcHand(playerHand);
      const dealerTotal = calcHand(dealerHand);

      if (playerTotal === 21) {
        if (dealerTotal === 21) {
          user.balance += bet;
          await user.save();
          const pushEmbed = new EmbedBuilder()
            .setColor('#95A5A6')
            .setTitle(`🃏 Blackjack — သရေကျပါသည် (Push)!`)
            .addFields(
              { name: `🧑 ${message.author.username} (21)`, value: formatHand(playerHand), inline: true },
              { name: `🤖 Dealer (21)`, value: formatHand(dealerHand), inline: true }
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
          .setTitle(`🃏 BLACKJACK! (1.5x WIN)`)
          .addFields(
            { name: `🧑 ${message.author.username} (21)`, value: formatHand(playerHand), inline: true },
            { name: `🤖 Dealer (${dealerTotal})`, value: formatHand(dealerHand), inline: true }
          )
          .setDescription(`🔥 **BLACKJACK!** **+${profit.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`);
        return message.reply({ embeds: [bjEmbed] });
      }

      activeBlackjack.add(message.author.id);

      const buildGameEmbed = (statusText, color = '#2B2D31', revealDealer = false) => {
        const pScore = calcHand(playerHand);
        const dScore = revealDealer ? calcHand(dealerHand) : '?';
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
        new ButtonBuilder()
          .setCustomId('bj_hit')
          .setLabel('🃏 Hit (ထပ်ဆွဲမည်)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('bj_stand')
          .setLabel('🛑 Stand (ရပ်မည်)')
          .setStyle(ButtonStyle.Danger)
      );

      const gameMsg = await message.reply({
        embeds: [buildGameEmbed('အောက်ပါ ခလုတ်များကို နှိပ်၍ ကစားပါ *(၃၀ စက္ကန့်အတွင်း)*')],
        components: [row],
      });

      const collector = gameMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Blackjack ပွဲမဟုတ်ပါဘူး!', ephemeral: true });
        }

        if (i.customId === 'bj_hit') {
          playerHand.push(deck.pop());
          const newTotal = calcHand(playerHand);

          if (newTotal > 21) {
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
      });

      collector.on('end', async (_, reason) => {
        activeBlackjack.delete(message.author.id);
        if (reason === 'bust') return;

        while (calcHand(dealerHand) < 17) {
          dealerHand.push(deck.pop());
        }

        const finalPlayer = calcHand(playerHand);
        const finalDealer = calcHand(dealerHand);
        const freshUser = await getUser(message.author.id, message.author.username);

        if (finalDealer > 21 || finalPlayer > finalDealer) {
          freshUser.balance += bet * 2;
          await freshUser.save();
          const winReason = finalDealer > 21 ? `Dealer Bust (${finalDealer}) ဖြစ်သွားပါတယ်!` : `${finalPlayer} ဖြင့် Dealer (${finalDealer}) ကို အနိုင်ရပါတယ်!`;
          return gameMsg.edit({
            embeds: [buildGameEmbed(
              `🎉 **အနိုင်ရရှိပါတယ်!** ${winReason}\n💰 **+${bet.toLocaleString()} coins** ရရှိပါတယ်!`,
              '#2ECC71',
              true
            )],
            components: [],
          });
        } else if (finalPlayer === finalDealer) {
          freshUser.balance += bet;
          await freshUser.save();
          return gameMsg.edit({
            embeds: [buildGameEmbed(
              `🛡️ **သရေကျပါတယ် (Push)!** နှစ်ဖက်လုံး **${finalPlayer}** မှတ် တူနေသဖြင့် အရင်းပြန်ရပါတယ်။`,
              '#95A5A6',
              true
            )],
            components: [],
          });
        } else {
          const timeoutNote = reason === 'time' ? '*(အချိန်စေ့သွားသဖြင့် အလိုအလျောက် Stand လုပ်လိုက်ပါသည်)*\n' : '';
          return gameMsg.edit({
            embeds: [buildGameEmbed(
              `${timeoutNote}💸 **ရှုံးသွားပါတယ်!** Dealer က **${finalDealer}** မှတ်ဖြင့် အနိုင်ရသွားပါတယ်။ (**-${bet.toLocaleString()} coins**)`,
              '#E74C3C',
              true
            )],
            components: [],
          });
        }
      });
    },
  },
];