const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User, getUser } = require('../models/User');
const {
  ITEM_RANKS,
  SHOP_ITEMS,
  findItemById,
  rollRandomItem,
  grantItemToUser,
} = require('../data/shopItems');

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

  // ၂။ နေ့စဉ် အခမဲ့ငွေ နှင့် Random Item ၂ လုံး ထုတ်ယူခြင်း (Kdaily)
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

      // Daily ဆုအဖြစ် Rank 1-7 Random Item ၂ ခု ထုတ်ပေးခြင်း
      const droppedItems = [rollRandomItem(), rollRandomItem()];
      const droppedLines = droppedItems.map((item) => {
        const totalUses = grantItemToUser(user, item);
        const rInfo = ITEM_RANKS[item.rank];
        return `${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** (\`${item.id}\`) — အသုံးပြုခွင့်: **${totalUses} ကြိမ်**`;
      });

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
        `🎁 **Lv.${currentLevel}** | 🔥 Streak: **${user.dailyStreak} ရက်** — နေ့စဉ်ဆုကြေး **${reward.toLocaleString()} coins**${maxNote} ရရှိပါပြီ!\n` +
        `🎒 **Daily Item ဆုလက်ဆောင် (၂ မျိုး):**\n${droppedLines.join('\n')}${boxBonusText}`
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

  // ၄။ သူငယ်ချင်းဆီ ပိုက်ဆံလွှဲပေးခြင်း (Kgive @user 100 - Confirm / Reject ခလုတ်စနစ်)
  {
    names: ['give'],
    async execute(message, args, user) {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1], 10);

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

      const confirmEmbed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('💸 ငွေလွှဲပြောင်းမှု အတည်ပြုချက် (Confirm Transfer)')
        .setDescription(
          `**${message.author.username}** သည် **${target.username}** ထံသို့ **${amount.toLocaleString()} coins** လွှဲပေးမှာ သေချာပါသလား?\n` +
          `*(၃၀ စက္ကန့်အတွင်း အောက်ပါခလုတ်ကို နှိပ်၍ ရွေးချယ်ပါ)*`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('give_confirm')
          .setLabel('✅ Confirm (အတည်ပြုမည်)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('give_reject')
          .setLabel('❌ Reject (ပယ်ဖျက်မည်)')
          .setStyle(ButtonStyle.Danger)
      );

      const promptMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });
      const collector = promptMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ ဒါက သင့်ရဲ့ ငွေလွှဲမှု မဟုတ်ပါဘူး!', ephemeral: true });
        }

        if (i.customId === 'give_reject') {
          collector.stop('rejected');
          const rejectEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription(`❌ **${message.author.username}** က **${target.username}** ထံ ငွေလွှဲခြင်းကို ပယ်ဖျက်လိုက်ပါပြီ။`);
          return i.update({ embeds: [rejectEmbed], components: [] });
        }

        if (i.customId === 'give_confirm') {
          const freshSender = await getUser(message.author.id, message.author.username);
          const freshReceiver = await getUser(target.id, target.username);

          if (amount > freshSender.balance) {
            collector.stop('insufficient');
            const errEmbed = new EmbedBuilder()
              .setColor('#E74C3C')
              .setDescription('❌ လက်ကျန်ငွေ မလုံလောက်တော့ပါ!');
            return i.update({ embeds: [errEmbed], components: [] });
          }

          freshSender.balance -= amount;
          freshReceiver.balance += amount;
          await freshSender.save();
          await freshReceiver.save();

          collector.stop('confirmed');
          const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setDescription(`💸 **${message.author.username}** က **${target.username}** ထံသို့ **${amount.toLocaleString()} coins** လွှဲပေးလိုက်ပါပြီ!`);
          return i.update({ embeds: [successEmbed], components: [] });
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time') {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#95A5A6')
            .setDescription('⏳ အချိန်စေ့သွားသဖြင့် ငွေလွှဲမှု အလိုအလျောက် ပျက်ပြယ်သွားပါပြီ။');
          await promptMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
      });
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

  // ၆။ ဆိုင်ခန်း ကြည့်ခြင်း (Kshop - Rank အနိမ့် ၃ မျိုးသာ ရောင်းချသည်)
  {
    names: ['shop'],
    async execute(message, args, user) {
      const shopOnlyItems = SHOP_ITEMS.filter((item) => item.shopAvailable);

      const shopList = shopOnlyItems.map((item) => {
        const rInfo = ITEM_RANKS[item.rank];
        let status = `💰 **${item.price.toLocaleString()} coins**`;
        if ((user.items || []).includes(item.id)) {
          const left = (user.itemUses && user.itemUses[item.id] !== undefined) ? user.itemUses[item.id] : item.maxUses;
          status += ` *(လက်ရှိ: **${left}** ကြိမ်)*`;
        }
        return `${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** (ID: \`${item.id}\`)\n└ ${item.desc} — ${status}`;
      }).join('\n\n');

      const shopEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏪 Keo အရောင်းဆိုင် (Rank 1 - 3 Items)')
        .setDescription(shopList)
        .setFooter({ text: 'ဝယ်ရန်: Kbuy <id> | Rank 4 - 7 အဆင့်မြင့်ပစ္စည်းများကို Kdaily နှင့် Khunt မှသာ ရနိုင်ပါသည်' });

      return message.reply({ embeds: [shopEmbed] });
    },
  },

  // ၇။ ပစ္စည်း ဝယ်ယူခြင်း (Kbuy <id> - Rank 1-3 သာ ဝယ်ခွင့်ရှိသည်)
  {
    names: ['buy'],
    async execute(message, args, user) {
      const itemId = args[0] ? args[0].toLowerCase() : null;
      const item = SHOP_ITEMS.find((i) => i.id === itemId);

      if (!item) {
        return message.reply('❌ ပစ္စည်း ID မှားယွင်းနေပါတယ်။ ဆိုင်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kshop` ကို ရိုက်ပါ။');
      }

      if (!item.shopAvailable) {
        const rInfo = ITEM_RANKS[item.rank];
        return message.reply(
          `🚫 ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** ကို ဆိုင်မှာ ဝယ်ယူ၍ မရပါ!\n` +
          `Rank 4 မှ Rank 7 အထိ အဆင့်မြင့်ပစ္စည်းများကို **` + '`Kdaily`' + `** နှင့် **` + '`Khunt`' + `** မှသာ ရှာဖွေရရှိနိုင်ပါမယ်။`
        );
      }

      if ((user.items || []).includes(item.id)) {
        return message.reply(`✅ သင်သည် **${item.name}** ကို ပိုင်ဆိုင်ပြီးသား ဖြစ်ပါတယ်! (\`Kinv\` တွင် စစ်ဆေးပါ)`);
      }

      // Luck Item တစ်ခုရှိပြီးသားဆိုရင် နောက်တစ်ခု ထပ်ဝယ်ခွင့်ပိတ်ခြင်း
      if (item.luckBonus > 0) {
        const existingLuckId = (user.items || []).find((id) => {
          const owned = findItemById(id);
          return owned && owned.luckBonus > 0;
        });
        if (existingLuckId) {
          const existingItem = findItemById(existingLuckId);
          const usesLeft = (user.itemUses && user.itemUses[existingLuckId] !== undefined)
            ? user.itemUses[existingLuckId]
            : existingItem.maxUses;
          return message.reply(
            `❌ **Luck Item တစ်မျိုးတည်းသာ ဆိုင်မှ ဝယ်သုံးခွင့်ရှိပါတယ်!**\n` +
            `လက်ရှိတွင် သင်၌ **${existingItem.name}** *(ကျန်: **${usesLeft}** ကြိမ်)* ရှိနေပါသေးတယ်။ အဲဒါ ကုန်သွားမှ နောက်တစ်ခု ထပ်ဝယ်နိုင်ပါမယ်။`
          );
        }
      }

      if (user.balance < item.price) {
        return message.reply(`❌ ပိုက်ဆံ မလုံလောက်ပါ! **${item.name}** အတွက် **${item.price.toLocaleString()} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= item.price;
      const totalUses = grantItemToUser(user, item);
      await user.save();

      const rInfo = ITEM_RANKS[item.rank];
      return message.reply(
        `🎉 ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** ကို **${item.price.toLocaleString()} coins** ဖြင့် ဝယ်ယူပြီးပါပြီ! (အသုံးပြုခွင့်: **${totalUses} ကြိမ်**)`
      );
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

      // Rank အမြင့်ဆုံးမှ အနိမ့်ဆုံးသို့ စီပြီး ပြသခြင်း
      const sortedItems = ownedIds
        .map((id) => findItemById(id))
        .filter(Boolean)
        .sort((a, b) => b.rank - a.rank);

      for (const itemInfo of sortedItems) {
        const rInfo = ITEM_RANKS[itemInfo.rank] || ITEM_RANKS[1];
        const left = (user.itemUses && user.itemUses[itemInfo.id] !== undefined)
          ? user.itemUses[itemInfo.id]
          : itemInfo.maxUses;
        lines.push(
          `${rInfo.emoji} **[Rank ${itemInfo.rank}] ${itemInfo.name}** (\`${itemInfo.id}\`)\n` +
          `└ ${itemInfo.desc} — ကျန်ရှိအကြိမ်: **${left} ကြိမ်**`
        );
      }

      if (lines.length === 0) {
        return message.reply('🎒 သင့်ကျောပိုးအိတ် (Inventory) ထဲမှာ ဘာပစ္စည်းမှ မရှိသေးပါဘူး! `Kshop`၊ `Kdaily` သို့မဟုတ် `Khunt` မှ ရယူနိုင်ပါတယ်။');
      }

      const invEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setAuthor({ name: `${message.author.username} ၏ ကျောပိုးအိတ် (Inventory)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'Rank 4 - 7 အဆင့်မြင့်ပစ္စည်းများကို Kdaily နှင့် Khunt မှ ရှာဖွေရယူပါ' })
        .setTimestamp();

      return message.reply({ embeds: [invEmbed] });
    },
  },
];