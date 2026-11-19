const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User, getUser, addProfileExp, updateQuestProgress } = require('../models/User');
const ANIMALS = require('../data/animals');
const {
  ITEM_RANKS,
  ITEM_TYPE_LABELS,
  SHOP_ITEMS,
  findItemById,
  getActiveItemByType,
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
          `🎁 Lucky Crates (\`lc\`): **${user.boxes || 0} လုံး**`
        )
        .setTimestamp();

      return message.reply({ embeds: [cashEmbed] });
    },
  },

  // ၂။ နေ့စဉ် အခမဲ့ငွေ၊ Profile EXP နှင့် Lucky Crate (lc) ၂ လုံး ထုတ်ယူခြင်း (Kdaily)
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

      let dailyCrates = 2;
      let streakBonusText = '';
      if (user.dailyStreak % 3 === 0) {
        dailyCrates += 1;
        streakBonusText = ` *(🔥 ${user.dailyStreak} ရက်ဆက် Streak Bonus +1 အပါအဝင်)*`;
      }

      user.boxes = (user.boxes || 0) + dailyCrates;
      user.balance += reward;
      user.lastDaily = now;

      const expRes = addProfileExp(user, 100);
      await user.save();

      const maxNote = reward >= MAX_DAILY ? ' *(MAX)*' : '';
      return message.reply(
        `🎁 **Profile Lv.${currentLevel}** | 🔥 Streak: **${user.dailyStreak} ရက်** — နေ့စဉ်ဆုကြေး **${reward.toLocaleString()} coins**${maxNote} နှင့် **+${expRes.addedExp} Profile EXP** ရရှိပါပြီ!\n` +
        `🎁 **Daily Lucky Crate (\`lc\`):** **+${dailyCrates} လုံး** ရရှိပါတယ်!${streakBonusText} *(\`Kopen lc\` ဖြင့် ဖွင့်ပါ)*${expRes.levelUpText}`
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

      // Daily Quest Progress တိုးပေးခြင်း
      updateQuestProgress(user, 'work', 1);

      const expRes = addProfileExp(user, 35);
      await user.save();

      const maxNote = earned >= MAX_WORK ? ' *(MAX)*' : '';
      return message.reply(
        `💼 **Profile Lv.${currentLevel}** — သင်သည် **${job}** ဖြင့် လုပ်အားခ **${earned.toLocaleString()} coins**${maxNote} နှင့် **+${expRes.addedExp} Profile EXP** ရရှိခဲ့ပါတယ်!${expRes.levelUpText}`
      );
    },
  },

  // ၄။ သူငယ်ချင်းဆီ ပိုက်ဆံလွှဲပေးခြင်း (Kgive @user 100)
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

  // ၅။ ထိပ်တန်းစာရင်း Top 10 (Ktop [cash / lvl / battle / zoo])
  {
    names: ['top', 'lb'],
    async execute(message, args) {
      const category = (args[0] || 'cash').toLowerCase();
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const activeFilter = { isBanned: { $ne: true } };

      let title = '';
      let color = '#FF4500';
      let lines = [];

      if (['lvl', 'level', 'profile', 'exp'].includes(category)) {
        const sorted = await User.find(activeFilter).sort({ level: -1, exp: -1 }).limit(10);
        title = '🏅 Profile Level အမြင့်ဆုံး ကစားသမားများ (Top 10)';
        color = '#3498DB';
        lines = sorted.map(
          (u, idx) => `${medals[idx]} **${u.username}** — 🏅 **Lv.${u.level || 1}** (${(u.exp || 0).toLocaleString()} EXP)`
        );
      } else if (['battle', 'b', 'blvl', 'pvp'].includes(category)) {
        const sorted = await User.find(activeFilter).sort({ battleLevel: -1, battleExp: -1 }).limit(10);
        title = '⚔️ Battle Level အမြင့်ဆုံး ကစားသမားများ (Top 10)';
        color = '#E67E22';
        lines = sorted.map(
          (u, idx) => `${medals[idx]} **${u.username}** — ⚔️ **Battle Lv.${u.battleLevel || 1}** (${(u.battleExp || 0).toLocaleString()} EXP)`
        );
      } else if (['zoo', 'z', 'animal', 'animals'].includes(category)) {
        const allUsers = await User.find(activeFilter, 'username zoo');
        const animalPriceMap = new Map(ANIMALS.map((a) => [a.name, a.price]));

        const scored = allUsers
          .map((u) => {
            let totalValue = 0;
            let totalCount = 0;
            for (const [name, count] of Object.entries(u.zoo || {})) {
              if (count > 0) {
                totalCount += count;
                totalValue += (animalPriceMap.get(name) || 0) * count;
              }
            }
            return { username: u.username, totalValue, totalCount };
          })
          .filter((u) => u.totalCount > 0)
          .sort((a, b) => b.totalValue - a.totalValue || b.totalCount - a.totalCount)
          .slice(0, 10);

        title = '🐾 တိရစ္ဆာန်ရုံ တန်ဖိုးအမြင့်ဆုံး ကစားသမားများ (Top 10)';
        color = '#2ECC71';
        lines = scored.map(
          (u, idx) => `${medals[idx]} **${u.username}** — 💵 **${u.totalValue.toLocaleString()} coins** (${u.totalCount.toLocaleString()} ကောင်)`
        );
      } else {
        const sorted = await User.find(activeFilter).sort({ balance: -1 }).limit(10);
        title = '🏆 အချမ်းသာဆုံး ကစားသမားများ (Top 10)';
        color = '#FF4500';
        lines = sorted.map(
          (u, idx) => `${medals[idx]} **${u.username}** (Lv.${u.level || 1}) — 💰 **${(u.balance || 0).toLocaleString()} coins**`
        );
      }

      if (lines.length === 0) {
        return message.reply('စာရင်း မရှိသေးပါ။');
      }

      const topEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'အခြားစာရင်းများ: Ktop cash | Ktop lvl | Ktop battle | Ktop zoo' })
        .setTimestamp();

      return message.reply({ embeds: [topEmbed] });
    },
  },

  // ၆။ ဆိုင်ခန်း ကြည့်ခြင်း (Kshop)
  {
    names: ['shop'],
    async execute(message, args, user) {
      const shopOnlyItems = SHOP_ITEMS.filter((item) => item.shopAvailable);
      const types = ['luck', 'extra', 'multiplier'];

      const sections = types.map((t) => {
        const header = `**${ITEM_TYPE_LABELS[t]}**`;
        const rows = shopOnlyItems
          .filter((item) => item.type === t)
          .map((item) => {
            const rInfo = ITEM_RANKS[item.rank];
            let status = `💰 **${item.price.toLocaleString()} coins**`;
            if ((user.items || []).includes(item.id)) {
              const left = (user.itemUses && user.itemUses[item.id] !== undefined) ? user.itemUses[item.id] : item.maxUses;
              status = `✅ *(သုံးနေဆဲ — ကျန်: **${left}/${item.maxUses}** ကြိမ်)*`;
            }
            return `${rInfo.emoji} **[R${item.rank}] ${item.name}** (\`${item.id}\`) — ${item.desc} • ${status}`;
          })
          .join('\n');
        return `${header}\n${rows}`;
      });

      const shopEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏪 Keo အရောင်းဆိုင် (Rank 1 - 3 Hunt Items)')
        .setDescription(sections.join('\n\n'))
        .setFooter({ text: 'ဝယ်ရန်: Kbuy <id> | Rank 4 (🟠) - Rank 7 (🌌) ကို Khunt နှင့် Kopen lc မှသာ ရနိုင်ပါသည်' });

      return message.reply({ embeds: [shopEmbed] });
    },
  },

  // ၇။ ပစ္စည်း ဝယ်ယူခြင်း (Kbuy <id>)
  {
    names: ['buy'],
    async execute(message, args, user) {
      const itemId = args[0] ? args[0].toLowerCase().trim() : null;
      const item = SHOP_ITEMS.find((i) => i.id === itemId);

      if (!item) {
        return message.reply('❌ ပစ္စည်း ID မှားယွင်းနေပါတယ်။ ဆိုင်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kshop` ကို ရိုက်ပါ။');
      }

      if (!item.shopAvailable) {
        const rInfo = ITEM_RANKS[item.rank];
        return message.reply(
          `🚫 ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** ကို ဆိုင်မှာ ဝယ်ယူ၍ မရပါ!\n` +
          `Rank 4 (🟠) မှ Rank 7 (🌌) အထိ အဆင့်မြင့်ပစ္စည်းများကို \`Khunt\` နှင့် \`Kopen lc\` မှသာ ရရှိနိုင်ပါမယ်။`
        );
      }

      const activeSameType = getActiveItemByType(user, item.type);
      if (activeSameType) {
        const activeRank = ITEM_RANKS[activeSameType.rank] || ITEM_RANKS[1];
        const usesLeft = (user.itemUses && user.itemUses[activeSameType.id] !== undefined)
          ? user.itemUses[activeSameType.id]
          : activeSameType.maxUses;
        return message.reply(
          `❌ **${ITEM_TYPE_LABELS[item.type]}** ထဲမှ တစ်မျိုးကို တစ်ခုသာ တပ်ဆင်အသုံးပြုခွင့် ရှိပါတယ်!\n` +
          `လက်ရှိတွင် ${activeRank.emoji} **${activeSameType.name}** (\`${activeSameType.id}\`) *(ကျန်: **${usesLeft}/${activeSameType.maxUses}** ကြိမ်)* ရှိနေပါသေးတယ်။ အကြိမ်ရေ ကုန်သွားမှ နောက်တစ်ခု ထပ်ဝယ်/ထပ်သုံးနိုင်ပါမယ်။`
        );
      }

      if (user.balance < item.price) {
        return message.reply(`❌ ပိုက်ဆံ မလုံလောက်ပါ! **${item.name}** အတွက် **${item.price.toLocaleString()} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= item.price;
      if (!user.items) user.items = [];
      if (!user.itemUses) user.itemUses = {};
      user.items.push(item.id);
      user.itemUses[item.id] = item.maxUses;
      user.markModified('itemUses');
      await user.save();

      const rInfo = ITEM_RANKS[item.rank];
      return message.reply(
        `🎉 ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** (\`${item.id}\`) ကို **${item.price.toLocaleString()} coins** ဖြင့် ဝယ်ယူတပ်ဆင်ပြီးပါပြီ! (အသုံးပြုခွင့်: **${item.maxUses} ကြိမ်**)`
      );
    },
  },

  // ၈။ အိတ်ထဲ သိမ်းထားသော အပို Item ကို ပြောင်းတပ်ဆင်ခြင်း (Kuse <id> / Kequip <id>)
  {
    names: ['use', 'equip'],
    async execute(message, args, user) {
      const itemId = args[0] ? args[0].toLowerCase().trim() : null;
      if (!itemId) {
        return message.reply('❌ တပ်ဆင်အသုံးပြုမယ့် Item ID ထည့်ပေးပါ! (ဥပမာ - `Kuse luck5` — အိတ်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kinv` ရိုက်ပါ)');
      }

      const storedCount = (user.storedItems && user.storedItems[itemId]) || 0;
      if (storedCount <= 0) {
        return message.reply(`❌ သင့်အိတ် (Storage) ထဲမှာ \`${itemId}\` ပစ္စည်း မရှိပါဘူး! \`Kinv\` တွင် စစ်ဆေးပါ။`);
      }

      const item = findItemById(itemId);
      if (!item) {
        return message.reply(`❌ \`${itemId}\` ပစ္စည်း အချက်အလက် မတွေ့ပါဘူး။`);
      }

      const activeSameType = getActiveItemByType(user, item.type);
      if (activeSameType) {
        const activeRank = ITEM_RANKS[activeSameType.rank] || ITEM_RANKS[1];
        const usesLeft = (user.itemUses && user.itemUses[activeSameType.id] !== undefined)
          ? user.itemUses[activeSameType.id]
          : activeSameType.maxUses;
        return message.reply(
          `❌ **${ITEM_TYPE_LABELS[item.type]}** ထဲမှ ${activeRank.emoji} **${activeSameType.name}** (\`${activeSameType.id}\`) ကို လက်ရှိသုံးနေဆဲ ဖြစ်ပါတယ်! *(ကျန်: **${usesLeft}/${activeSameType.maxUses}** ကြိမ်)*\n` +
          `အဲဒီပစ္စည်း အကြိမ်ရေ ကုန်သွားမှ \`Kuse ${item.id}\` ဖြင့် ပြောင်းလဲအသုံးပြုနိုင်ပါမယ်။`
        );
      }

      if (storedCount - 1 <= 0) {
        delete user.storedItems[itemId];
      } else {
        user.storedItems[itemId] = storedCount - 1;
      }
      user.markModified('storedItems');

      if (!user.items) user.items = [];
      if (!user.itemUses) user.itemUses = {};
      user.items.push(item.id);
      user.itemUses[item.id] = item.maxUses;
      user.markModified('itemUses');

      await user.save();

      const rInfo = ITEM_RANKS[item.rank] || ITEM_RANKS[1];
      return message.reply(
        `✅ ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** (\`${item.id}\`) ကို တပ်ဆင်အသုံးပြုလိုက်ပါပြီ! (အသုံးပြုခွင့်: **${item.maxUses} ကြိမ်**)`
      );
    },
  },

  // ၉။ ပိုင်ဆိုင်သော ပစ္စည်းများ စစ်ဆေးခြင်း (Kinv / Kinventory / Kbag)
  {
    names: ['inv', 'inventory', 'bag'],
    async execute(message, args, user) {
      const crateCount = user.boxes || 0;
      const sections = [];

      if (crateCount > 0) {
        sections.push(`🎁 **Lucky Crate (\`lc\`)** — **${crateCount} လုံး** *(\`Kopen lc [အရေအတွက်/all]\` ဖြင့် ဖွင့်ပါ)*`);
      }

      const activeLines = [];
      for (const t of ['luck', 'extra', 'multiplier']) {
        const activeItem = getActiveItemByType(user, t);
        if (activeItem) {
          const rInfo = ITEM_RANKS[activeItem.rank] || ITEM_RANKS[1];
          const left = (user.itemUses && user.itemUses[activeItem.id] !== undefined)
            ? user.itemUses[activeItem.id]
            : activeItem.maxUses;
          activeLines.push(
            `${rInfo.emoji} **[R${activeItem.rank}] ${activeItem.name}** (\`${activeItem.id}\`) — ကျန်: **${left}/${activeItem.maxUses} ကြိမ်**\n` +
            `└ ${activeItem.desc}`
          );
        }
      }

      if (activeLines.length > 0) {
        sections.push(`⚔️ **လက်ရှိ အသုံးပြုနေသော ပစ္စည်းများ (Active — 1 Per Type):**\n${activeLines.join('\n')}`);
      }

      const storedEntries = Object.entries(user.storedItems || {}).filter(([, count]) => count > 0);
      if (storedEntries.length > 0) {
        const storedLines = storedEntries
          .map(([id, count]) => {
            const info = findItemById(id);
            if (!info) return `• \`${id}\` × ${count}`;
            const rInfo = ITEM_RANKS[info.rank] || ITEM_RANKS[1];
            return `${rInfo.emoji} **[R${info.rank}] ${info.name}** (\`${info.id}\`) × **${count} ခု** — *(${info.desc})*`;
          })
          .join('\n');

        sections.push(`🎒 **အိတ်ထဲ သိမ်းထားသော အပိုပစ္စည်းများ (\`Kuse <id>\` ဖြင့် သုံးရန်):**\n${storedLines}`);
      }

      if (sections.length === 0) {
        return message.reply('🎒 သင့်ကျောပိုးအိတ် (Inventory) ထဲမှာ ဘာပစ္စည်းမှ မရှိသေးပါဘူး! `Kshop`၊ `Kdaily` သို့မဟုတ် `Khunt` မှ ရယူနိုင်ပါတယ်။');
      }

      const invEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setAuthor({ name: `${message.author.username} ၏ ကျောပိုးအိတ် (Inventory)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(sections.join('\n\n'))
        .setFooter({ text: 'တစ်မျိုးလျှင် တစ်ခုသာ သုံးခွင့်ရှိပြီး အကြိမ်ရေကုန်မှ နောက်တစ်ခု ထပ်သုံးနိုင်ပါသည်' })
        .setTimestamp();

      return message.reply({ embeds: [invEmbed] });
    },
  },
];