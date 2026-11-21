const { getUser } = require('../../models/User');
const { activeGambling, sleep, validateBet } = require('../../utils/gamblingState');

module.exports = [
  // Coinflip ကစားခြင်း (Kcf / Kcoinflip) — Winrate 50%
  {
    names: ['cf', 'coinflip'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      const { bet, error } = validateBet(args[0], user.balance, 'ဥပမာ - `Kcf 100` သို့မဟုတ် `Kcf all`');
      if (error) return message.reply(error);

      let choice = 'heads';
      if (args[1] && ['t', 'tails', 'ပန်း'].includes(args[1].toLowerCase())) {
        choice = 'tails';
      }

      activeGambling.add(message.author.id);
      try {
        user.balance -= bet;
        await user.save();

        const choiceText = choice === 'heads' ? 'ခေါင်း (Heads)' : 'ပန်း (Tails)';
        const msg = await message.reply(
          `🪙 **${choiceText}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး အကြွေစေ့ မြှောက်လိုက်ပါပြီ...\n🔄 *အကြွေစေ့ လည်နေပါသည်...*`
        );

        await sleep(1200);

        const CF_WIN_RATE = 0.5;
        const isWin = Math.random() < CF_WIN_RATE;
        const result = isWin ? choice : (choice === 'heads' ? 'tails' : 'heads');
        const resultText = result === 'heads' ? '👑 ခေါင်း (Heads)' : '🌸 ပန်း (Tails)';

        if (isWin) {
          const freshUser = await getUser(message.author.id, message.author.username);
          freshUser.balance += bet * 2;
          await freshUser.save();
          return msg.edit(
            `🪙 အကြွေစေ့ ကျသွားပါပြီ — **${resultText}**!\n🎉 **နိုင်ပါတယ်!** **+${bet.toLocaleString()} coins** ရရှိပါတယ်။`
          );
        }

        return msg.edit(
          `🪙 အကြွေစေ့ ကျသွားပါပြီ — **${resultText}**!\n😢 **ရှုံးသွားပါတယ်!** **-${bet.toLocaleString()} coins** ဆုံးရှုံးသွားပါတယ်။`
        );
      } finally {
        activeGambling.delete(message.author.id);
      }
    },
  },
];