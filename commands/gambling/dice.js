const { getUser } = require('../../models/User');
const { activeGambling, sleep, validateBet } = require('../../utils/gamblingState');

module.exports = [
  // အံစာတုံး အသေး/အကြီး/လန့် ကစားခြင်း (Kd / Kdice) — Small/Big 1x (97.2% RTP) | Triple 32x (91.7% RTP)
  {
    names: ['d', 'dice'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      const { bet, error } = validateBet(args[0], user.balance, 'ဥပမာ - `Kd 1000 s` / `Kd all b` / `Kd 500 t`');
      if (error) return message.reply(error);

      const rawChoice = args[1]?.toLowerCase();
      let choice = null;
      if (['s', 'small', 'အသေး'].includes(rawChoice)) choice = 'small';
      else if (['b', 'big', 'အကြီး'].includes(rawChoice)) choice = 'big';
      else if (['t', 'triple', 'lan', 'လန့်'].includes(rawChoice)) choice = 'triple';

      if (!choice) {
        return message.reply(
          '❌ ရွေးချယ်မှု ထည့်ပေးပါ! (`s` = အသေး | `b` = အကြီး | `t` = လန့် 32x)\nဥပမာ - `Kd 1000 s` သို့မဟုတ် `Kd all b`'
        );
      }

      activeGambling.add(message.author.id);
      try {
        user.balance -= bet;
        await user.save();

        const choiceMap = {
          small: '🔽 အသေး (4-10)',
          big: '🔼 အကြီး (11-17)',
          triple: '🔥 လန့် (3 လုံးတူ • 32x)',
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
          const multiplier = choice === 'triple' ? 32 : 1;
          const winnings = bet * multiplier;
          const freshUser = await getUser(message.author.id, message.author.username);
          freshUser.balance += bet + winnings;
          await freshUser.save();

          const tripleNote = choice === 'triple' ? ' (**32x JACKPOT!**)' : '';
          return msg.edit(
            `${board}\n🎉 **အနိုင်ရရှိပါတယ်!**${tripleNote} **+${winnings.toLocaleString()} coins** ရရှိပါတယ်။`
          );
        }

        const lanLossNote = isTriple && choice !== 'triple' ? ' *(လန့် ကျသွားသဖြင့် အသေး/အကြီး ရှုံးပါသည်)*' : '';
        return msg.edit(
          `${board}\n💸 **ရှုံးသွားပါတယ်!**${lanLossNote} **-${bet.toLocaleString()} coins** ဆုံးရှုံးသွားပါတယ်။`
        );
      } finally {
        activeGambling.delete(message.author.id);
      }
    },
  },
];