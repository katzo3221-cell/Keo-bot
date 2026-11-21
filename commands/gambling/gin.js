const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../models/User');
const { activeGambling, sleep, validateBet } = require('../../utils/gamblingState');

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

function rollFairGinDie() {
  return GIN_ANIMALS[Math.floor(Math.random() * GIN_ANIMALS.length)];
}

module.exports = [
  // ခြောက်ကောင်ဂျင် (Kgin / Kkl / K6animal) — 1x / 2x / 5x (Winrate 42.1% | RTP 93.1%)
  {
    names: ['gin', 'kl', '6animal'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      const { bet, error } = validateBet(args[0], user.balance, 'ဥပမာ - `Kgin 1000` သို့မဟုတ် `Kgin 1000 tiger`');
      if (error) return message.reply(error);

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

          const r1 = rollFairGinDie();
          const r2 = rollFairGinDie();
          const r3 = rollFairGinDie();
          const rolls = [r1, r2, r3];

          const matches = rolls.filter((a) => a.id === chosenAnimal.id).length;
          const board = `🎲 **[ ${r1.emoji} ${r1.name} | ${r2.emoji} ${r2.name} | ${r3.emoji} ${r3.name} ]**`;

          if (matches > 0) {
            const mult = matches === 3 ? 5 : matches; // 1 ကောင်=1x | 2 ကောင်=2x | 3 ကောင်=5x
            const profit = bet * mult;
            const winUser = await getUser(message.author.id, message.author.username);
            winUser.balance += bet + profit;
            await winUser.save();

            const jackpotNote = matches === 3 ? ' 🔥 **(TRIPLE 5x JACKPOT!)**' : '';
            return msg.edit(
              `${board}\n🎉 **${chosenAnimal.emoji} ${chosenAnimal.name} ${matches} ကောင် တူသွားပါတယ်!**${jackpotNote}\n💰 **+${profit.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`
            );
          }

          return msg.edit(
            `${board}\n💸 **${chosenAnimal.emoji} ${chosenAnimal.name}** တစ်ကောင်မှ မပါသဖြင့် **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။`
          );
        } catch (err) {
          console.error('Gin Roll Error:', err);
        } finally {
          activeGambling.delete(message.author.id);
        }
      };

      const directAnimal = findGinAnimal(args[1]);
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

        const pickMsg = await message.reply({ embeds: [pickEmbed], components: [row1, row2] });
        const collector = pickMsg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
          if (i.user.id !== message.author.id) {
            return i.reply({ content: '❌ ဒါက သင့်ရဲ့ ခြောက်ကောင်ဂျင်ပွဲ မဟုတ်ပါဘူး!', ephemeral: true });
          }
          picked = true;
          const chosenId = i.customId.replace('gin_', '');
          const chosenAnimal = GIN_ANIMALS.find((a) => a.id === chosenId);
          collector.stop('picked');
          await runGinRoll(chosenAnimal, i, true);
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