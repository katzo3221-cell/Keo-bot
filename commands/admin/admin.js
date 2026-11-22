const { isOwner, findAnimal } = require('../../utils/helpers');
const { resolveAdminTarget, parseAmount } = require('../../utils/adminHelper');
const { getAnimalMeta, syncCollection, syncZooStats } = require('../../utils/huntingHelper');
const { ITEM_RANKS, findItemById, receiveDroppedItem } = require('../../data/shopItems');
const { findRing } = require('../../data/rings');

module.exports = [
  // ၁။ Coins ထည့်ပေးခြင်း (Kaddcoin <@user/ID> <amount>)
  {
    names: ['addcoin', 'addcoins'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const amount = parseAmount(args[1]);
      if (!target || isNaN(amount)) {
        return message.reply('❌ အသုံးပြုပုံ: `Kaddcoin <@user/ID> <amount>`');
      }

      target.dbUser.balance += amount;
      await target.dbUser.save();

      return message.reply(
        `✅ **${target.username}** ထံသို့ **+${amount.toLocaleString()} coins** ထည့်ပေးပြီးပါပြီ! (လက်ကျန်: **${target.dbUser.balance.toLocaleString()} coins**)`
      );
    },
  },

  // ၂။ Coins နုတ်ယူခြင်း (Kremovecoin <@user/ID> <amount>)
  {
    names: ['removecoin', 'removecoins', 'takecoin'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const amount = parseAmount(args[1]);
      if (!target || isNaN(amount)) {
        return message.reply('❌ အသုံးပြုပုံ: `Kremovecoin <@user/ID> <amount>`');
      }

      target.dbUser.balance = Math.max(0, target.dbUser.balance - amount);
      await target.dbUser.save();

      return message.reply(
        `✅ **${target.username}** ထံမှ **-${amount.toLocaleString()} coins** နုတ်ယူပြီးပါပြီ! (လက်ကျန်: **${target.dbUser.balance.toLocaleString()} coins**)`
      );
    },
  },

  // ၃။ Coins ပမာဏ တိုက်ရိုက်သတ်မှတ်ခြင်း (Ksetcoin <@user/ID> <amount>)
  {
    names: ['setcoin', 'setcoins'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const amount = parseAmount(args[1], true);
      if (!target || isNaN(amount)) {
        return message.reply('❌ အသုံးပြုပုံ: `Ksetcoin <@user/ID> <amount>`');
      }

      target.dbUser.balance = amount;
      await target.dbUser.save();

      return message.reply(
        `✅ **${target.username}** ၏ လက်ကျန်ငွေကို **${amount.toLocaleString()} coins** သို့ သတ်မှတ်ပြီးပါပြီ!`
      );
    },
  },

  // ၄။ Lucky Crate ထည့်ပေးခြင်း (Kaddcrate <@user/ID> <count>)
  {
    names: ['addcrate', 'addcrates', 'addlc'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const count = parseAmount(args[1]);
      if (!target || isNaN(count)) {
        return message.reply('❌ အသုံးပြုပုံ: `Kaddcrate <@user/ID> <count>`');
      }

      target.dbUser.boxes = (target.dbUser.boxes || 0) + count;
      await target.dbUser.save();

      return message.reply(
        `🎁 **${target.username}** ထံသို့ **Lucky Crate (\`lc\`) +${count.toLocaleString()} လုံး** ထည့်ပေးပြီးပါပြီ! (စုစုပေါင်း: **${target.dbUser.boxes.toLocaleString()} လုံး**)`
      );
    },
  },

  // ၅။ တိရစ္ဆာန် တိုက်ရိုက်ထည့်ပေးခြင်း (Kaddanimal <@user/ID> <animalId> [qty])
  {
    names: ['addanimal', 'giveanimal'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const animal = findAnimal(args[1]);
      const qty = args[2] !== undefined ? parseAmount(args[2]) : 1;

      if (!target || !animal || isNaN(qty)) {
        return message.reply('❌ အသုံးပြုပုံ: `Kaddanimal <@user/ID> <animalId> [အရေအတွက်]` (ဥပမာ - `Kaddanimal @user celestiallord 1`)');
      }

      if (!target.dbUser.zoo) target.dbUser.zoo = {};
      target.dbUser.zoo[animal.name] = (Number(target.dbUser.zoo[animal.name]) || 0) + qty;
      target.dbUser.markModified('zoo');
      syncCollection(target.dbUser);
      syncZooStats(target.dbUser);
      await target.dbUser.save();

      const meta = getAnimalMeta(animal);
      return message.reply(
        `🐾 **${target.username}** ထံသို့ ${meta.rankEmoji} ${animal.emoji} **${animal.name}** × **${qty}** ထည့်ပေးပြီးပါပြီ!`
      );
    },
  },

  // ၆။ Hunt Item တိုက်ရိုက်ထည့်ပေးခြင်း (Kadditem <@user/ID> <itemId>)
  {
    names: ['additem', 'giveitem'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const item = findItemById(args[1]);
      if (!target || !item) {
        return message.reply('❌ အသုံးပြုပုံ: `Kadditem <@user/ID> <itemId>` (ဥပမာ - `Kadditem @user luck7`)');
      }

      const res = receiveDroppedItem(target.dbUser, item);
      await target.dbUser.save();

      const rInfo = ITEM_RANKS[item.rank] || ITEM_RANKS[1];
      const note = res.equipped ? 'တိုက်ရိုက် တပ်ဆင်ပြီး' : 'အိတ် (Storage) ထဲ သိမ်းဆည်းပြီး';
      return message.reply(
        `🎒 **${target.username}** ထံသို့ ${rInfo.emoji} **[R${item.rank}] ${item.name}** (\`${item.id}\`) ထည့်ပေးပြီးပါပြီ! *(${note})*`
      );
    },
  },

  // ၇။ Marriage Ring တိုက်ရိုက်ထည့်ပေးခြင်း (Kaddring <@user/ID> <ringId> [qty])
  {
    names: ['addring', 'givering'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const ring = findRing(args[1]);
      const qty = args[2] !== undefined ? parseAmount(args[2]) : 1;

      if (!target || !ring || isNaN(qty)) {
        return message.reply('❌ အသုံးပြုပုံ: `Kaddring <@user/ID> <ring1-5> [အရေအတွက်]`');
      }

      target.dbUser.rings = target.dbUser.rings || {};
      target.dbUser.rings[ring.id] = (Number(target.dbUser.rings[ring.id]) || 0) + qty;
      target.dbUser.markModified('rings');
      await target.dbUser.save();

      return message.reply(
        `💍 **${target.username}** ထံသို့ ${ring.emoji} **${ring.name}** (${ring.mmName}) × **${qty}** ထည့်ပေးပြီးပါပြီ!`
      );
    },
  },

  // ၈။ Profile Level သို့မဟုတ် Battle Level သတ်မှတ်ခြင်း (Ksetlvl <@user/ID> <profile/battle> <level>)
  {
    names: ['setlvl', 'setlevel'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = await resolveAdminTarget(message, args[0]);
      const type = args[1]?.toLowerCase();
      const lvl = parseAmount(args[2]);

      if (!target || !['profile', 'p', 'battle', 'b'].includes(type) || isNaN(lvl) || lvl > 999) {
        return message.reply('❌ အသုံးပြုပုံ: `Ksetlvl <@user/ID> <profile|battle> <1-999>`');
      }

      if (type === 'profile' || type === 'p') {
        target.dbUser.level = lvl;
        target.dbUser.exp = 0;
        await target.dbUser.save();
        return message.reply(`🏅 **${target.username}** ၏ **Profile Level** ကို **Lv.${lvl}** သို့ ပြောင်းလဲပြီးပါပြီ!`);
      }

      target.dbUser.battleLevel = lvl;
      target.dbUser.battleExp = 0;
      await target.dbUser.save();
      return message.reply(`⚔️ **${target.username}** ၏ **Battle Level** ကို **Lv.${lvl}** သို့ ပြောင်းလဲပြီးပါပြီ!`);
    },
  },
];