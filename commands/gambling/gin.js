const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { getUser } = require('../../models/User');
const { isOwner } = require('../../utils/helpers');
const { activeGambling, sleep, validateBet } = require('../../utils/gamblingState');

// နှိပ်သူတစ်ဦးတည်းသာ မြင်ရစေမည့် Ephemeral Flag (64)
const EPHEMERAL_FLAG = MessageFlags?.Ephemeral ?? 64;

const GIN_ANIMALS = [
  { id: 'tiger', emoji: '🐯', name: 'ကျား', aliases: ['tiger', 't', 'ကျား'] },
  { id: 'rooster', emoji: '🐓', name: 'ကြက်', aliases: ['rooster', 'chicken', 'r', 'c', 'ကြက်'] },
  { id: 'fish', emoji: '🐟', name: 'ငါး', aliases: ['fish', 'f', 'ငါး'] },
  { id: 'crab', emoji: '🦀', name: 'ဂဏန်း', aliases: ['crab', 'cr', 'ဂဏန်း'] },
  { id: 'shrimp', emoji: '🦐', name: 'ပုစွန်', aliases: ['shrimp', 'prawn', 's', 'p', 'ပုစွန်'] },
  { id: 'gourd', emoji: '🍐', name: 'ဘူးသီး', aliases: ['gourd', 'calabash', 'g', 'b', 'ဘူးသီး'] },
];

const GIN_RULES_TEXT =
  'ℹ️ **ခြောက်ကောင်ဂျင် ကစားနည်း**\n' +
  '• 🐯 ကျား • 🐓 ကြက် • 🐟 ငါး • 🦀 ဂဏန်း • 🦐 ပုစွန် • 🍐 ဘူးသီး ထဲမှ ၁ ကောင်ရွေးလောင်းပါ။\n' +
  '• ၁ ကောင်တူ = **1x** | ၂ ကောင်တူ = **2x** | ၃ ကောင်လုံးတူ = **5x JACKPOT!**\n' +
  '• အမြန်လောင်းရန်: `Kgin <amount> <အကောင်>` သို့မဟုတ် `Kgin <အကောင်> <amount>`';

// User တစ်ဦးချင်းစီအတွက် နောက်တစ်လှည့်ကျမည့် အံစာ ၃ လုံး ကြိုသိမ်းထားခြင်း
const nextGinQueue = new Map();

function findGinAnimal(raw) {
  if (!raw) return null;
  const q = raw.toLowerCase().trim();
  return GIN_ANIMALS.find((a) => a.aliases.includes(q)) || null;
}

function rollFairGinDie() {
  return GIN_ANIMALS[Math.floor(Math.random() * GIN_ANIMALS.length)];
}

function rollThreeGinDice() {
  return [rollFairGinDie(), rollFairGinDie(), rollFairGinDie()];
}

function peekNextGinRoll(userId) {
  if (!nextGinQueue.has(userId)) {
    nextGinQueue.set(userId, rollThreeGinDice());
  }
  return nextGinQueue.get(userId);
}

function consumeNextGinRoll(userId) {
  const rolls = peekNextGinRoll(userId);
  nextGinQueue.delete(userId);
  return rolls;
}

// Owner ကြည့်ရန် ကြိုတင်ရလဒ်နှင့် အကောင်းဆုံးအကွက် စာသားထုတ်ပေးခြင်း
function formatOwnerGinPeek(rolls, title) {
  const [r1, r2, r3] = rolls;
  const counts = new Map();
  for (const r of rolls) {
    counts.set(r.id, (counts.get(r.id) || 0) + 1);
  }

  let bestCount = 0;
  for (const c of counts.values()) {
    if (c > bestCount) bestCount = c;
  }

  const bestAnimals = GIN_ANIMALS.filter((a) => counts.get(a.id) === bestCount);
  const multLabel = bestCount === 3 ? '5x JACKPOT!' : `${bestCount}x`;
  const bestText = bestAnimals.map((a) => `${a.emoji} ${a.name}`).join(' / ');

  return (
    `👁️ **${title}**\n` +
    `🎲 **[ ${r1.emoji} ${r1.name} | ${r2.emoji} ${r2.name} | ${r3.emoji} ${r3.name} ]**\n` +
    `🏆 အကောင်းဆုံးအကွက်: **${bestText} (${multLabel})**`
  );
}

// ရလဒ်ထွက်ပြီးနောက် Direct Mode အတွက် Next Spin ကြိုကြည့်နိုင်မည့် ℹ️ ခလုတ် ချိတ်ဆက်ခြင်း
function attachResultInfoCollector(msg) {
  const infoCollector = msg.createMessageComponentCollector({ time: 60000 });

  infoCollector.on('collect', async (btn) => {
    try {
      if (btn.customId !== 'gin_next_info') {
        return btn.deferUpdate().catch(() => {});
      }

      if (isOwner(btn.user.id)) {
        const nextRolls = peekNextGinRoll(btn.user.id);
        return btn.reply({
          content: formatOwnerGinPeek(nextRolls, 'သင့်နောက်တစ်လှည့် ဂျင်ရလဒ် (Next Spin)'),
          flags: EPHEMERAL_FLAG,
        });
      }

      return btn.reply({
        content: GIN_RULES_TEXT,
        flags: EPHEMERAL_FLAG,
      });
    } catch (err) {
      console.error('Gin Info Collect Error:', err);
    }
  });

  infoCollector.on('end', async () => {
    await msg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = [
  // ခြောက်ကောင်ဂျင် (Kgin / Kkl / K6animal) — 1x / 2x / 5x (Winrate 42.1% | RTP 93.1%)
  {
    names: ['gin', 'kl', '6animal'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      // Kgin 1000 tiger ရော Kgin tiger 1000 ပါ နှစ်မျိုးလုံး လက်ခံခြင်း
      let betArg = args[0];
      let directAnimal = findGinAnimal(args[1]);
      if (!directAnimal && findGinAnimal(args[0])) {
        directAnimal = findGinAnimal(args[0]);
        betArg = args[1];
      }

      const { bet, error } = validateBet(betArg, user.balance, 'ဥပမာ - `Kgin 1000` သို့မဟုတ် `Kgin 1000 tiger`');
      if (error) return message.reply(error);

      const runGinRoll = async (chosenAnimal, msgOrInteraction, isInteraction = false) => {
        try {
          if (isInteraction) {
            await msgOrInteraction.deferUpdate();
          }

          const freshUser = await getUser(message.author.id, message.author.username);
          if (freshUser.balance < bet) {
            const errText = '❌ လက်ကျန်ငွေ မလုံလောက်တော့ပါ!';
            return isInteraction
              ? msgOrInteraction.editReply({ content: errText, embeds: [], components: [] })
              : message.reply(errText);
          }

          freshUser.balance -= bet;
          await freshUser.save();

          const spinningText =
            `🎲 **${chosenAnimal.emoji} ${chosenAnimal.name}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး ခြောက်ကောင်ဂျင် ခေါက်လိုက်ပါပြီ...\n` +
            `**[ 🔄 | 🔄 | 🔄 ]** *အံစာ ၃ လုံး လှိမ့်နေပါသည်...*`;

          let msg;
          if (isInteraction) {
            msg = await msgOrInteraction.editReply({ content: spinningText, embeds: [], components: [] });
          } else {
            msg = await message.reply(spinningText);
          }

          await sleep(1200);

          const rolls = consumeNextGinRoll(message.author.id);
          const [r1, r2, r3] = rolls;

          const matches = rolls.filter((a) => a.id === chosenAnimal.id).length;
          const board = `🎲 **[ ${r1.emoji} ${r1.name} | ${r2.emoji} ${r2.name} | ${r3.emoji} ${r3.name} ]**`;

          const resultInfoRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('gin_next_info')
              .setEmoji('ℹ️')
              .setStyle(ButtonStyle.Secondary)
          );

          if (matches > 0) {
            const mult = matches === 3 ? 5 : matches; // 1 ကောင်=1x | 2 ကောင်=2x | 3 ကောင်=5x
            const profit = bet * mult;
            const winUser = await getUser(message.author.id, message.author.username);
            winUser.balance += bet + profit;
            await winUser.save();

            const jackpotNote = matches === 3 ? ' 🔥 **(TRIPLE 5x JACKPOT!)**' : '';
            await msg.edit({
              content:
                `${board}\n🎉 **${chosenAnimal.emoji} ${chosenAnimal.name} ${matches} ကောင် တူသွားပါတယ်!**${jackpotNote}\n` +
                `💰 **+${profit.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`,
              components: [resultInfoRow],
            });
            attachResultInfoCollector(msg);
            return;
          }

          await msg.edit({
            content: `${board}\n💸 **${chosenAnimal.emoji} ${chosenAnimal.name}** တစ်ကောင်မှ မပါသဖြင့် **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။`,
            components: [resultInfoRow],
          });
          attachResultInfoCollector(msg);
        } catch (err) {
          console.error('Gin Roll Error:', err);
        } finally {
          activeGambling.delete(message.author.id);
        }
      };

      if (directAnimal) {
        activeGambling.add(message.author.id);
        return runGinRoll(directAnimal, message, false);
      }

      activeGambling.add(message.author.id);
      let picked = false;

      try {
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
        const row3 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('gin_info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary)
        );

        const pickMsg = await message.reply({ embeds: [pickEmbed], components: [row1, row2, row3] });
        const collector = pickMsg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
          try {
            // ℹ️ ခလုတ် — Owner နှိပ်လျှင် အခုလှည့်မည့် အံစာ ၃ လုံးကို ကြိုပြမည်
            if (i.customId === 'gin_info') {
              if (isOwner(i.user.id)) {
                const upcoming = peekNextGinRoll(message.author.id);
                return i.reply({
                  content: formatOwnerGinPeek(upcoming, `${message.author.username} ၏ လက်ရှိလှည့်မည့် ဂျင်ရလဒ်`),
                  flags: EPHEMERAL_FLAG,
                });
              }

              return i.reply({
                content: GIN_RULES_TEXT,
                flags: EPHEMERAL_FLAG,
              });
            }

            if (i.user.id !== message.author.id) {
              return i.reply({
                content: '❌ ဒါက သင့်ရဲ့ ခြောက်ကောင်ဂျင်ပွဲ မဟုတ်ပါဘူး!',
                flags: EPHEMERAL_FLAG,
              });
            }

            if (picked) {
              return i.deferUpdate().catch(() => {});
            }

            const chosenId = i.customId.replace('gin_', '');
            const chosenAnimal = GIN_ANIMALS.find((a) => a.id === chosenId);
            if (!chosenAnimal) {
              return i.deferUpdate().catch(() => {});
            }

            picked = true;
            collector.stop('picked');
            await runGinRoll(chosenAnimal, i, true);
          } catch (err) {
            console.error('Gin Pick Collect Error:', err);
          }
        });

        collector.on('end', async (_, reason) => {
          if (!picked) {
            activeGambling.delete(message.author.id);
          }
          if (reason === 'time') {
            await pickMsg
              .edit({ content: '⏳ အချိန်စေ့သွားသဖြင့် ခြောက်ကောင်ဂျင်ပွဲ ပျက်ပြယ်သွားပါပြီ။', embeds: [], components: [] })
              .catch(() => {});
          }
        });
      } catch (err) {
        activeGambling.delete(message.author.id);
        throw err;
      }
    },
  },
];