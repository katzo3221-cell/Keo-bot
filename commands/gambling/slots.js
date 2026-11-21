const { getUser } = require('../../models/User');
const { activeGambling, sleep, validateBet } = require('../../utils/gamblingState');

module.exports = [
  // Slots ကစားခြင်း (Ks / Kslots) — ၂ ခုတူ 1.5x | ၃ ခုတူ 5x
  {
    names: ['s', 'slots'],
    async execute(message, args, user) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
      }

      const { bet, error } = validateBet(args[0], user.balance, 'ဥပမာ - `Kslots 100` သို့မဟုတ် `Kslots all`');
      if (error) return message.reply(error);

      activeGambling.add(message.author.id);
      try {
        user.balance -= bet;
        await user.save();

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
          const freshUser = await getUser(message.author.id, message.author.username);
          freshUser.balance += bet + winnings;
          await freshUser.save();
          return msg.edit(
            `${board}\n🔥 **JACKPOT! (5x)** ၃ ခုလုံး တူသွားလို့ **+${winnings.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`
          );
        }

        if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
          const winnings = Math.floor(bet * 1.5);
          const freshUser = await getUser(message.author.id, message.author.username);
          freshUser.balance += bet + winnings;
          await freshUser.save();
          return msg.edit(
            `${board}\n✨ **2 Match! (1.5x)** ၂ ခု တူသွားလို့ **+${winnings.toLocaleString()} coins** အနိုင်ရရှိပါတယ်!`
          );
        }

        return msg.edit(`${board}\n💸 ဘာမှ မတူလို့ **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။`);
      } finally {
        activeGambling.delete(message.author.id);
      }
    },
  },
];