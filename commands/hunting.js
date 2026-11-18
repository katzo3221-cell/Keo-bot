const { EmbedBuilder } = require('discord.js');
const { addExp } = require('../models/User');
const ANIMALS = require('../data/animals');
const { SHOP_ITEMS, useCategoryItems } = require('../data/shopItems');

module.exports = [
  // ၁။ အမဲလိုက်ခြင်း (Khunt / Kh)
  {
    names: ['hunt', 'h'],
    async execute(message, args, user) {
      const cost = 10;
      if (user.balance < cost) {
        return message.reply(`❌ အမဲလိုက်ဖို့ ကျည်ဆန်ဖိုး **${cost} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= cost;

      // Luck Item တစ်မျိုးတည်း၏ Luck Bonus ကိုသာ အများဆုံးယူခြင်း
      let totalLuck = 0;
      for (const itemId of user.items || []) {
        const itemInfo = SHOP_ITEMS.find((i) => i.id === itemId);
        if (itemInfo && itemInfo.luckBonus > 0) {
          totalLuck = Math.max(totalLuck, itemInfo.luckBonus);
        }
      }

      let catchCount = 1;
      if ((user.items || []).includes('net')) catchCount += 1;
      if ((user.items || []).includes('cage')) catchCount *= 2;

      if (!user.zoo) user.zoo = {};
      const caughtSummary = {};

      // အကောင်တစ်ခုချင်းစီ၏ ကျနိုင်ခြေ (Weight) ကို Luck နှင့် ချိန်ညှိတွက်ချက်ခြင်း
      const weightedAnimals = ANIMALS.map((animal) => {
        let multiplier = 1;
        if (animal.price >= 8000) {
          multiplier = 1 + totalLuck * 0.06; // Legendary, Mythical, Divine, Celestial
        } else if (animal.price >= 1000) {
          multiplier = 1 + totalLuck * 0.04; // Epic, Ultra Epic
        } else if (animal.price >= 60) {
          multiplier = 1 + totalLuck * 0.025; // Rare, Super Rare
        }
        return { animal, weight: animal.chance * multiplier };
      });

      const totalWeight = weightedAnimals.reduce((sum, item) => sum + item.weight, 0);

      for (let i = 0; i < catchCount; i++) {
        let roll = Math.random() * totalWeight;
        let cumulative = 0;
        let caught = weightedAnimals[0].animal;

        for (const item of weightedAnimals) {
          cumulative += item.weight;
          if (roll <= cumulative) {
            caught = item.animal;
            break;
          }
        }

        user.zoo[caught.name] = (user.zoo[caught.name] || 0) + 1;
        if (!caughtSummary[caught.name]) {
          caughtSummary[caught.name] = { emoji: caught.emoji, count: 0 };
        }
        caughtSummary[caught.name].count += 1;
      }

      user.markModified('zoo');

      const caughtListText = Object.entries(caughtSummary)
        .map(([name, data]) => `${data.emoji} **${name}**${data.count > 1 ? ` × \`${data.count}\`` : ''}`)
        .join('၊ ');

      let foundBoxText = '';
      if (Math.random() < 0.10) {
        user.boxes = (user.boxes || 0) + 1;
        foundBoxText = `\n🎁 တောထဲမှ **Mystery Box +1** ကောက်ရရှိပါတယ်! (\`Kopen\` ဖြင့် ဖွင့်ပါ)`;
      }

      const brokenItemText = useCategoryItems(user, 'hunt');
      await user.save();

      return message.reply(
        `🏹 သင်သည် တောထဲသို့ အမဲလိုက်ထွက်ရာ... ${caughtListText} ဖမ်းမိခဲ့ပါတယ်!${foundBoxText}${brokenItemText}`
      );
    },
  },

  // ၂။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (Kzoo / Kz)
  {
    names: ['zoo', 'z'],
    async execute(message, args, user) {
      const entries = Object.entries(user.zoo || {});
      if (entries.length === 0) {
        return message.reply('🏞️ သင့်တိရစ္ဆာန်ရုံထဲမှာ ဘာမှ မရှိသေးပါဘူး။ `Khunt` ရိုက်ပြီး ဖမ်းကြည့်ပါ!');
      }

      let totalValue = 0;
      const list = entries
        .map(([name, count]) => {
          const info = ANIMALS.find((a) => a.name === name);
          if (info) totalValue += info.price * count;
          return `${info ? info.emoji : '🐾'} **${name}** × \`${count}\``;
        })
        .join('\n');

      const zooEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setAuthor({ name: `${message.author.username} ၏ တိရစ္ဆာန်ရုံ (Zoo)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(list)
        .addFields({ name: '💵 စုစုပေါင်း တန်ဖိုး', value: `**${totalValue.toLocaleString()} coins**`, inline: true })
        .setFooter({ text: 'အကုန်ပြန်ရောင်းရန် Ksellall ကို ရိုက်ပါ' });

      return message.reply({ embeds: [zooEmbed] });
    },
  },

  // ၃။ တိရစ္ဆာန်အားလုံး ပြန်ရောင်းခြင်း (Ksellall)
  {
    names: ['sellall'],
    async execute(message, args, user) {
      const entries = Object.entries(user.zoo || {});
      if (entries.length === 0) {
        return message.reply('❌ ရောင်းစရာ တိရစ္ဆာန် တစ်ကောင်မှ မရှိပါဘူး။');
      }

      let totalEarned = 0;
      for (const [name, count] of entries) {
        const info = ANIMALS.find((a) => a.name === name);
        if (info) {
          totalEarned += info.price * count;
        }
      }

      user.zoo = {};
      user.balance += totalEarned;
      user.markModified('zoo');
      await user.save();

      return message.reply(`💵 ဖမ်းထားသော တိရစ္ဆာန်အားလုံးကို ရောင်းချလိုက်ရာ **+${totalEarned.toLocaleString()} coins** ရရှိပါပြီ!`);
    },
  },

  // ၄။ Mystery Lootbox ဖောက်ယူခြင်း (Kopen / Kbox)
  {
    names: ['open', 'box'],
    async execute(message, args, user) {
      if ((user.boxes || 0) <= 0) {
        return message.reply('📦 ဖွင့်စရာ **Mystery Box** မရှိသေးပါဘူး! `Kbuy box` ဖြင့် ဝယ်ယူနိုင်သလို `Khunt` နှင့် `Kbattle` ကနေလည်း ကံစမ်းရရှိနိုင်ပါတယ်။');
      }

      user.boxes -= 1;
      const roll = Math.random();
      let rewardMessage = '';

      if (roll < 0.45) {
        const coinsWon = Math.floor(Math.random() * 2001) + 500;
        user.balance += coinsWon;
        rewardMessage = `💰 ရွှေဒင်္ဂါး **+${coinsWon.toLocaleString()} coins** ရရှိပါတယ်!`;
      } else if (roll < 0.75) {
        const expWon = Math.floor(Math.random() * 101) + 50;
        const isLevelUp = addExp(user, expWon);
        rewardMessage = `✨ အတွေ့အကြုံ **+${expWon} EXP** ရရှိပါတယ်! (${user.exp}/${user.level * 100} EXP)`;
        if (isLevelUp) {
          rewardMessage += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }
      } else {
        const rarePool = ANIMALS.filter((a) => a.price >= 60); // Rare မှ Celestial အထိ
        const poolWeight = rarePool.reduce((sum, a) => sum + a.chance, 0);
        let boxRoll = Math.random() * poolWeight;
        let acc = 0;
        let prizeAnimal = rarePool[0];

        for (const a of rarePool) {
          acc += a.chance;
          if (boxRoll <= acc) {
            prizeAnimal = a;
            break;
          }
        }

        if (!user.zoo) user.zoo = {};
        user.zoo[prizeAnimal.name] = (user.zoo[prizeAnimal.name] || 0) + 1;
        user.markModified('zoo');
        rewardMessage = `🐾 ရှားပါးတိရစ္ဆာန် ${prizeAnimal.emoji} **${prizeAnimal.name}** တစ်ကောင် ပေါက်ပါတယ်!`;
      }

      await user.save();
      return message.reply(`🎁 **Mystery Box** ကို ဖွင့်လိုက်ရာ...\n${rewardMessage}\n*(ကျန်ရှိသော Box: **${user.boxes} လုံး**)*`);
    },
  },
];