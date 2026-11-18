const { EmbedBuilder } = require('discord.js');
const { User, getUser } = require('../models/User');
const { SHOP_ITEMS } = require('../data/shopItems');

module.exports = [
  // ၁။ လက်ကျန်ငွေ စစ်ဆေးခြင်း (Kcash / Kbal)
  {
    names: ['cash', 'bal'],
    async execute(message, args, user) {
      await user.save();
      const cashEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ name: `${message.author.username} ၏ ပိုက်ဆံအိတ်`, iconURL: message.author.displayAvatarURL() })
        .setDescription(
          `💰 လက်ကျန်ငွေ: **${user.balance.toLocaleString()} coins**\n` +
          `🎁 Mystery Boxes: **${user.boxes || 0} လုံး**`
        )
        .setTimestamp();

      return message.reply({ embeds: [cashEmbed] });
    },
  },

  // ၂။ နေ့စဉ် အခမဲ့ငွေ ထုတ်ယူခြင်း (Kdaily)
  {
    names: ['daily'],
    async execute(message, args, user) {
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;

      if (now - user.lastDaily < cooldown) {
        const remaining = cooldown - (now - user.lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`⏳ နေ့စဉ်ဆုကြေး ထုတ်ပြီးသား ဖြစ်ပါတယ်။ နောက်ထပ် **${hours} နာရီ ${minutes} မိနစ်** နေမှ ပြန်ထုတ်နိုင်ပါမယ်။`);
      }

      if (user.lastDaily > 0 && now - user.lastDaily <= 48 * 60 * 60 * 1000) {
        user.dailyStreak = (user.dailyStreak || 0) + 1;
      } else {
        user.dailyStreak = 1;
      }

      const MAX_DAILY = 10000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const baseReward = 500;
      const levelBonus = (currentLevel - 1) * 200;
      const expBonus = Math.floor(currentExp * 0.5);
      const streakBonus = (user.dailyStreak - 1) * 100;
      const reward = Math.min(baseReward + levelBonus + expBonus + streakBonus, MAX_DAILY);

      let boxBonusText = '';
      if (user.dailyStreak % 3 === 0) {
        user.boxes = (user.boxes || 0) + 1;
        boxBonusText = `\n🎁 **${user.dailyStreak} ရက်ဆက် Streak ဆု:** **Mystery Box +1** အပိုရရှိပါတယ်! (\`Kopen\` ဖြင့်ဖွင့်ပါ)`;
      }

      user.balance += reward;
      user.lastDaily = now;
      await user.save();

      const maxNote = reward >= MAX_DAILY ? ' *(MAX)*' : '';
      return message.reply(
        `🎁 **Lv.${currentLevel}** | 🔥 Streak: **${user.dailyStreak} ရက်** — နေ့စဉ်ဆုကြေး **${reward.toLocaleString()} coins**${maxNote} ရရှိပါပြီ!${boxBonusText}`
      );
    },
  },

  // ၃။ အလုပ်လုပ်ပြီး ပိုက်ဆံရှာခြင်း (Kwork)
  {
    names: ['work'],
    async execute(message, args, user) {
      const now = Date.now();
      const cooldown = 30 * 60 * 1000;

      if (now - user.lastWork < cooldown) {
        const remaining = cooldown - (now - user.lastWork);
        const minutes = Math.ceil(remaining / (1000 * 60));
        return message.reply(`😓 အလုပ်လုပ်ထားတာ မောနေပါပြီ။ နောက်ထပ် **${minutes} မိနစ်** နေမှ ပြန်လုပ်နိုင်ပါမယ်။`);
      }

      const MAX_WORK = 3000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const jobs = ['ပီဇာပို့ခြင်း', 'ကားရေဆေးခြင်း', 'Coding ရေးပေးခြင်း', 'ကော်ဖီဖျော်ခြင်း', 'Delivery ပို့ခြင်း'];
      const job = jobs[Math.floor(Math.random() * jobs.length)];

      const baseEarned = Math.floor(Math.random() * 151) + 50;
      const levelBonus = (currentLevel - 1) * 60;
      const expBonus = Math.floor(currentExp * 0.15);
      const earned = Math.min(baseEarned + levelBonus + expBonus, MAX_WORK);

      user.balance += earned;
      user.lastWork = now;
      await user.save();

      const maxNote = earned >= MAX_WORK ? ' *(MAX)*' : '';
      return message.reply(
        `💼 **Lv.${currentLevel}** — သင်သည် **${job}** ဖြင့် လုပ်အားခ **${earned.toLocaleString()} coins**${maxNote} ရရှိခဲ့ပါတယ်!`
      );
    },
  },

  // ၄။ သူငယ်ချင်းဆီ ပိုက်ဆံလွှဲပေးခြင်း (Kgive @user 100)
  {
    names: ['give'],
    async execute(message, args, user) {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!target || target.bot) {
        return message.reply('❌ ပိုက်ဆံလွှဲပေးမယ့် သူကို Mention ခေါ်ပါ။ (ဥပမာ - `Kgive @User 100`)');
      }
      if (target.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်လွှဲလို့ မရပါဘူး။');
      }
      if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ လွှဲမယ့် ပမာဏ မှန်ကန်စွာ ထည့်ပါ။');
      }
      if (amount > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      const targetUser = await getUser(target.id, target.username);
      user.balance -= amount;
      targetUser.balance += amount;
      await user.save();
      await targetUser.save();

      return message.reply(`💸 **${message.author.username}** က **${target.username}** ထံသို့ **${amount.toLocaleString()} coins** လွှဲပေးလိုက်ပါပြီ!`);
    },
  },

  // ၅။ အချမ်းသာဆုံးစာရင်း (Ktop / Klb)
  {
    names: ['top', 'lb'],
    async execute(message) {
      const sorted = await User.find().sort({ balance: -1 }).limit(5);
      if (sorted.length === 0) return message.reply('စာရင်း မရှိသေးပါ။');

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const leaderboard = sorted
        .map((u, index) => `${medals[index]} **${u.username}** (Lv.${u.level}) — 💰 **${u.balance.toLocaleString()} coins**`)
        .join('\n');

      const topEmbed = new EmbedBuilder()
        .setColor('#FF4500')
        .setTitle('🏆 အချမ်းသာဆုံး ကစားသမားများ (Top 5)')
        .setDescription(leaderboard)
        .setFooter({ text: 'အလုပ်လုပ်ပြီး ပိုက်ဆံရှာရန် Kwork ကို ရိုက်ပါ' })
        .setTimestamp();

      return message.reply({ embeds: [topEmbed] });
    },
  },

  // ၆။ ဆိုင်ခန်း ကြည့်ခြင်း (Kshop)
  {
    names: ['shop'],
    async execute(message, args, user) {
      const shopList = SHOP_ITEMS.map((item) => {
        let status = `💰 **${item.price.toLocaleString()} coins**`;
        if (item.isConsumable) {
          status += ` *(လက်ရှိ: ${user.boxes || 0} လုံး)*`;
        } else if ((user.items || []).includes(item.id)) {
          const left = (user.itemUses && user.itemUses[item.id] !== undefined) ? user.itemUses[item.id] : item.maxUses;
          status = `✅ *(ဝယ်ပြီး — ကျန်: **${left}/${item.maxUses}** ကြိမ်)*`;
        }
        return `🛒 **${item.name}** (ID: \`${item.id}\`)\n└ ${item.desc} — ${status}`;
      }).join('\n\n');

      const shopEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏪 Keo အရောင်းဆိုင် (Item & Weapon Shop)')
        .setDescription(shopList)
        .setFooter({ text: 'ဝယ်ယူရန် Kbuy <ID> ကို ရိုက်ပါ (ဥပမာ - Kbuy sword)' });

      return message.reply({ embeds: [shopEmbed] });
    },
  },

  // ၇။ ပစ္စည်း ဝယ်ယူခြင်း (Kbuy <id>)
  {
    names: ['buy'],
    async execute(message, args, user) {
      const itemId = args[0] ? args[0].toLowerCase() : null;
      const item = SHOP_ITEMS.find((i) => i.id === itemId);

      if (!item) {
        return message.reply('❌ ပစ္စည်း ID မှားယွင်းနေပါတယ်။ ဆိုင်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kshop` ကို ရိုက်ပါ။');
      }
      if (!item.isConsumable && (user.items || []).includes(item.id)) {
        return message.reply(`✅ သင်သည် **${item.name}** ကို ဝယ်ယူပြီးသား ဖြစ်ပါတယ်!`);
      }

      // Luck Item (bow, rifle, charm) တစ်ခုရှိပြီးသားဆိုရင် နောက်တစ်ခု ထပ်ဝယ်ခွင့်ပိတ်ခြင်း
      if (item.luckBonus > 0) {
        const existingLuckId = (user.items || []).find((id) => {
          const owned = SHOP_ITEMS.find((i) => i.id === id);
          return owned && owned.luckBonus > 0;
        });
        if (existingLuckId) {
          const existingItem = SHOP_ITEMS.find((i) => i.id === existingLuckId);
          const usesLeft = (user.itemUses && user.itemUses[existingLuckId] !== undefined)
            ? user.itemUses[existingLuckId]
            : existingItem.maxUses;
          return message.reply(
            `❌ **Luck Item တစ်မျိုးတည်းသာ တစ်ပြိုင်နက် သုံးခွင့်ရှိပါတယ်!**\n` +
            `လက်ရှိတွင် သင်၌ **${existingItem.name}** *(ကျန်: **${usesLeft}/${existingItem.maxUses}** ကြိမ်)* ရှိနေပါသေးတယ်။ အဲဒါ ကုန်သွားမှ နောက်တစ်ခု ထပ်ဝယ်နိုင်ပါမယ်။`
          );
        }
      }

      if (user.balance < item.price) {
        return message.reply(`❌ ပိုက်ဆံ မလုံလောက်ပါ! **${item.name}** အတွက် **${item.price.toLocaleString()} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= item.price;
      if (item.isConsumable) {
        user.boxes = (user.boxes || 0) + 1;
        await user.save();
        return message.reply(`🎉 **${item.name}** ၁ လုံး ဝယ်ယူပြီးပါပြီ! (စုစုပေါင်း: **${user.boxes} လုံး** — ဖွင့်ရန် \`Kopen\` ရိုက်ပါ)`);
      } else {
        user.items.push(item.id);
        if (!user.itemUses) user.itemUses = {};
        user.itemUses[item.id] = item.maxUses;
        user.markModified('itemUses');
        await user.save();
        return message.reply(`🎉 **${item.name}** ကို **${item.price.toLocaleString()} coins** ဖြင့် ဝယ်ယူပြီးပါပြီ! (အသုံးပြုခွင့်: **${item.maxUses} ကြိမ်**)`);
      }
    },
  },

  // ၈။ ပိုင်ဆိုင်သော ပစ္စည်းများ စစ်ဆေးခြင်း (Kinv / Kinventory / Kbag)
  {
    names: ['inv', 'inventory', 'bag'],
    async execute(message, args, user) {
      const ownedIds = user.items || [];
      const boxCount = user.boxes || 0;
      const lines = [];

      if (boxCount > 0) {
        lines.push(`🎁 **လျှို့ဝှက်သေတ္တာ (Mystery Box)** — **${boxCount} လုံး** *(\`Kopen\` ဖြင့် ဖွင့်ပါ)*`);
      }

      for (const id of ownedIds) {
        const itemInfo = SHOP_ITEMS.find((i) => i.id === id);
        if (itemInfo) {
          const left = (user.itemUses && user.itemUses[id] !== undefined)
            ? user.itemUses[id]
            : itemInfo.maxUses;
          lines.push(`🛠️ **${itemInfo.name}** (\`${itemInfo.id}\`) — ကျန်ရှိအကြိမ်: **${left}/${itemInfo.maxUses} ကြိမ်**`);
        }
      }

      if (lines.length === 0) {
        return message.reply('🎒 သင့်ကျောပိုးအိတ် (Inventory) ထဲမှာ ဘာပစ္စည်းမှ မရှိသေးပါဘူး! `Kshop` မှာ ဝင်ရောက်ဝယ်ယူနိုင်ပါတယ်။');
      }

      const invEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setAuthor({ name: `${message.author.username} ၏ ကျောပိုးအိတ် (Inventory)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'ပစ္စည်းအသစ် ထပ်ဝယ်ရန် Kshop ကို ရိုက်ပါ' })
        .setTimestamp();

      return message.reply({ embeds: [invEmbed] });
    },
  },
];