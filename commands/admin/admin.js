const { EmbedBuilder } = require('discord.js');
const { User, getUser } = require('../../models/User');
const { isOwner } = require('../../utils/helpers');

module.exports = [
  // ၁။ ကစားသမားထံ Coins ထည့်ပေးခြင်း (Kaddcoin @user <amount>)
  {
    names: ['addcoin', 'addcoins'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[1], 10);

      if (!target || isNaN(amount) || amount <= 0) {
        return message.reply('❌ အသုံးပြုပုံ: `Kaddcoin @user <amount>`');
      }

      const targetUser = await getUser(target.id, target.username);
      targetUser.balance += amount;
      await targetUser.save();

      return message.reply(
        `✅ **${target.username}** ထံသို့ **+${amount.toLocaleString()} coins** ထည့်ပေးပြီးပါပြီ! (လက်ကျန်: **${targetUser.balance.toLocaleString()} coins**)`
      );
    },
  },

  // ၂။ ကစားသမားထံမှ Coins နုတ်ယူခြင်း (Kremovecoin @user <amount>)
  {
    names: ['removecoin', 'removecoins', 'takecoin'],
    async execute(message, args) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[1], 10);

      if (!target || isNaN(amount) || amount <= 0) {
        return message.reply('❌ အသုံးပြုပုံ: `Kremovecoin @user <amount>`');
      }

      const targetUser = await getUser(target.id, target.username);
      targetUser.balance = Math.max(0, targetUser.balance - amount);
      await targetUser.save();

      return message.reply(
        `✅ **${target.username}** ထံမှ **-${amount.toLocaleString()} coins** နုတ်ယူပြီးပါပြီ! (လက်ကျန်: **${targetUser.balance.toLocaleString()} coins**)`
      );
    },
  },

  // ၃။ Bot အသုံးပြုခွင့် ပိတ်ပင်ခြင်း (Kban @user)
  {
    names: ['ban', 'botban'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = message.mentions.users.first();
      if (!target) {
        return message.reply('❌ ပိတ်ပင်မယ့် User ကို Mention ခေါ်ပါ။ (ဥပမာ - `Kban @user`)');
      }
      if (isOwner(target.id)) {
        return message.reply('❌ Bot Owner ကို ပိတ်ပင်၍ မရပါ။');
      }

      const targetUser = await getUser(target.id, target.username);
      targetUser.isBanned = true;
      await targetUser.save();

      return message.reply(`🚫 **${target.username}** ကို Keo Bot အသုံးပြုခွင့် ပိတ်ပင်လိုက်ပါပြီ။`);
    },
  },

  // ၄။ Bot အသုံးပြုခွင့် ပြန်ဖွင့်ပေးခြင်း (Kunban @user)
  {
    names: ['unban', 'botunban'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const target = message.mentions.users.first();
      if (!target) {
        return message.reply('❌ ပြန်ဖွင့်ပေးမယ့် User ကို Mention ခေါ်ပါ။ (ဥပမာ - `Kunban @user`)');
      }

      const targetUser = await getUser(target.id, target.username);
      targetUser.isBanned = false;
      await targetUser.save();

      return message.reply(`✅ **${target.username}** ကို Keo Bot အသုံးပြုခွင့် ပြန်ဖွင့်ပေးလိုက်ပါပြီ။`);
    },
  },

  // ၅။ Bot အခြေအနေ ကြည့်ရှုခြင်း (Kbotstats)
  {
    names: ['botstats', 'stats'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const totalUsers = await User.countDocuments();
      const bannedUsers = await User.countDocuments({ isBanned: true });
      const guildCount = message.client.guilds.cache.size;
      const ping = message.client.ws.ping;

      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);

      const statsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Keo Bot စနစ် အခြေအနေ (Bot Stats)')
        .addFields(
          { name: '🌐 Server အရေအတွက်', value: `**${guildCount.toLocaleString()} ခု**`, inline: true },
          { name: '👥 စုစုပေါင်း ကစားသမား', value: `**${totalUsers.toLocaleString()} ဦး**`, inline: true },
          { name: '🚫 Ban ထားသူ', value: `**${bannedUsers.toLocaleString()} ဦး**`, inline: true },
          { name: '📶 Ping', value: `**${ping} ms**`, inline: true },
          { name: '⏱️ Uptime', value: `**${days}ရက် ${hours}နာရီ ${mins}မိနစ်**`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [statsEmbed] });
    },
  },
  // ၆။ Database ထဲရှိ Zoo String Data များကို Number စစ်စစ် ပြန်ပြောင်းခြင်း (Kfixzoo)
  {
    names: ['fixzoo'],
    async execute(message) {
      if (!isOwner(message.author.id)) {
        return message.reply('🚫 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။');
      }

      const allUsers = await User.find({});
      let fixedUsers = 0;

      for (const u of allUsers) {
        if (!u.zoo || typeof u.zoo !== 'object') continue;
        let changed = false;
        const cleanZoo = {};

        for (const [name, rawCount] of Object.entries(u.zoo)) {
          const num = Number(rawCount);
          if (typeof rawCount !== 'number' || isNaN(num)) {
            changed = true;
          }
          if (!isNaN(num) && num > 0) {
            cleanZoo[name] = Math.floor(num);
          }
        }

        if (changed) {
          u.zoo = cleanZoo;
          u.markModified('zoo');
          await u.save();
          fixedUsers += 1;
        }
      }

      return message.reply(`✅ Database စစ်ဆေးပြီးပါပြီ! စုစုပေါင်း User **${fixedUsers} ဦး** ရဲ့ Zoo Data များကို Number စစ်စစ် ပြန်ပြောင်းပေးလိုက်ပါပြီ။`);
    },
  },
];