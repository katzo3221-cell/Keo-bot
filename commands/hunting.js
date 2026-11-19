const { EmbedBuilder } = require('discord.js');
const { addExp } = require('../models/User');
const ANIMALS = require('../data/animals');
const {
  ITEM_RANKS,
  rollRandomItem,
  grantItemToUser,
  getActiveHuntItem,
  consumeSingleItem,
} = require('../data/shopItems');

// Rank ၁၀ ဆင့်နှင့် Emoji အတိုလေးများ
const RANKS = [
  { name: 'Common', emoji: '🟢' },
  { name: 'Uncommon', emoji: '🔵' },
  { name: 'Rare', emoji: '🟣' },
  { name: 'Super Rare', emoji: '🩵' },
  { name: 'Epic', emoji: '🟠' },
  { name: 'Ultra Epic', emoji: '🟡' },
  { name: 'Legendary', emoji: '🔴' },
  { name: 'Mythical', emoji: '🔮' },
  { name: 'Divine', emoji: '✨' },
  { name: 'Celestial', emoji: '🌌' },
];

// မြန်မာစံတော်ချိန် (UTC+6:30) ယနေ့ရက်စွဲ
function getTodayMyanmarDate() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// တိရစ္ဆာန်၏ Rank၊ Rank Emoji အတို နှင့် နာမည်အတို ခွဲထုတ်ပေးမည့် Function
function getAnimalMeta(animal) {
  const match = animal.name.match(/\(([^)]+)\)$/);
  const rank = match ? match[1] : 'Common';
  const rankObj = RANKS.find((r) => r.name === rank);
  const rankEmoji = rankObj ? rankObj.emoji : '🟢';
  const shortName = animal.name.replace(/\s*\([^)]+\)$/, '');
  return { rank, rankEmoji, shortName };
}

// English ID သို့မဟုတ် မြန်မာနာမည်ဖြင့် တိရစ္ဆာန် ရှာဖွေပေးမည့် Function
function findAnimal(query) {
  const q = query.toLowerCase().trim();
  return (
    ANIMALS.find((a) => a.id.toLowerCase() === q) ||
    ANIMALS.find((a) => a.name.toLowerCase() === q) ||
    ANIMALS.find((a) => a.name.split(' (')[0].toLowerCase() === q)
  );
}

// ရောင်းလိုက်သော အကောင်များ လက်ကျန်မရှိတော့ပါက battleTeam ထဲမှ အလိုအလျောက် ဖယ်ရှားပေးခြင်း
function syncBattleTeam(user) {
  if (!user.battleTeam || user.battleTeam.length === 0) return;
  const usedCounts = {};
  const validTeam = [];

  for (const id of user.battleTeam) {
    const info = ANIMALS.find((a) => a.id === id);
    if (!info) continue;
    const owned = (user.zoo && user.zoo[info.name]) || 0;
    const alreadyUsed = usedCounts[info.name] || 0;
    if (owned > alreadyUsed) {
      validTeam.push(id);
      usedCounts[info.name] = alreadyUsed + 1;
    }
  }
  user.battleTeam = validTeam;
}

module.exports = [
  // ၁။ အမဲလိုက်ခြင်း (Khunt / Kh - တစ်ရက်လျှင် Item ၃ ခု Limit + မျှတသော Luck တွက်ချက်မှု)
  {
    names: ['hunt', 'h'],
    async execute(message, args, user) {
      const cost = 10;
      if (user.balance < cost) {
        return message.reply(`❌ အမဲလိုက်ဖို့ ကျည်ဆန်ဖိုး **${cost} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= cost;

      // အမြင့်ဆုံး Hunt Item တစ်မျိုးတည်း၏ Luck နှင့် Catch အရေအတွက်ကိုသာ ယူခြင်း
      const activeHuntItem = getActiveHuntItem(user);
      const totalLuck = activeHuntItem ? activeHuntItem.luckBonus : 0;
      const extraCatch = activeHuntItem ? activeHuntItem.extraCatch : 0;
      const catchMultiplier = activeHuntItem ? activeHuntItem.catchMultiplier : 1;
      const catchCount = (1 + extraCatch) * catchMultiplier;

      if (!user.zoo) user.zoo = {};
      const caughtSummary = {};

      // Item သုံးထားရင်တောင် Mythical / Divine / Celestial အမြဲမမိအောင် ချိန်ညှိထားသော Weight စနစ်
      const weightedAnimals = ANIMALS.map((animal) => {
        let multiplier = 1;
        if (animal.price >= 18000) {
          multiplier = 1 + totalLuck * 0.04; // Mythical, Divine, Celestial
        } else if (animal.price >= 8000) {
          multiplier = 1 + totalLuck * 0.045; // Legendary
        } else if (animal.price >= 1000) {
          multiplier = 1 + totalLuck * 0.035; // Epic, Ultra Epic
        } else if (animal.price >= 60) {
          multiplier = 1 + totalLuck * 0.02; // Rare, Super Rare
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
          const meta = getAnimalMeta(caught);
          caughtSummary[caught.name] = {
            emoji: caught.emoji,
            id: caught.id,
            shortName: meta.shortName,
            rankEmoji: meta.rankEmoji,
            count: 0,
          };
        }
        caughtSummary[caught.name].count += 1;
      }

      user.markModified('zoo');

      const caughtListText = Object.values(caughtSummary)
        .map((data) => `${data.rankEmoji} ${data.emoji} **${data.shortName}** (\`${data.id}\`)${data.count > 1 ? ` × \`${data.count}\`` : ''}`)
        .join('၊ ');

      // တောထဲမှ Item ရှာတွေ့ခြင်း (တစ်ရက်လျှင် အများဆုံး ၃ ခု Limit)
      const todayStr = getTodayMyanmarDate();
      if (user.dailyHuntItemDate !== todayStr) {
        user.dailyHuntItemDate = todayStr;
        user.dailyHuntItemCount = 0;
      }

      let foundItemText = '';
      if (user.dailyHuntItemCount < 3 && Math.random() < 0.15) {
        const foundItem = rollRandomItem();
        const totalUses = grantItemToUser(user, foundItem);
        user.dailyHuntItemCount += 1;
        const rInfo = ITEM_RANKS[foundItem.rank];
        foundItemText =
          `\n🎒 တောထဲမှ ${rInfo.emoji} **[Rank ${foundItem.rank}] ${foundItem.name}** (\`${foundItem.id}\`) ရှာတွေ့ပါတယ်! ` +
          `*(အသုံးပြုခွင့်: **${totalUses} ကြိမ်** | ယနေ့ Item Limit: **${user.dailyHuntItemCount}/3**)*`;
      }

      // အသုံးပြုခဲ့သော Hunt Item ၁ ခုတည်း၏ အကြိမ်ရေကိုသာ ၁ ကြိမ် လျှော့ချခြင်း
      const brokenItemText = activeHuntItem ? consumeSingleItem(user, activeHuntItem.id) : '';
      await user.save();

      return message.reply(
        `🏹 သင်သည် တောထဲသို့ အမဲလိုက်ထွက်ရာ... ${caughtListText} ဖမ်းမိခဲ့ပါတယ်!${foundItemText}${brokenItemText}`
      );
    },
  },

  // ၂။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (Kzoo / Kz - Rank ဘေးတွင် Emoji လေးများသာ ပြသသည်)
  {
    names: ['zoo', 'z'],
    async execute(message, args, user) {
      const zooData = user.zoo || {};
      let totalValue = 0;
      let totalAnimals = 0;
      const rankLines = [];

      for (const rankInfo of RANKS) {
        const rankTag = `(${rankInfo.name})`;
        const ownedInRank = ANIMALS.filter((a) => a.name.endsWith(rankTag) && (zooData[a.name] || 0) > 0);

        if (ownedInRank.length > 0) {
          const emojiList = ownedInRank
            .map((a) => {
              const count = zooData[a.name];
              totalValue += a.price * count;
              totalAnimals += count;
              return `${a.emoji}\`×${count}\``;
            })
            .join(' ');

          rankLines.push(`${rankInfo.emoji} **${rankInfo.name}** ➔ ${emojiList}`);
        }
      }

      if (rankLines.length === 0) {
        return message.reply('🏞️ သင့်တိရစ္ဆာန်ရုံထဲမှာ ဘာမှ မရှိသေးပါဘူး။ `Khunt` ရိုက်ပြီး ဖမ်းကြည့်ပါ!');
      }

      const zooEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setAuthor({ name: `${message.author.username} ၏ တိရစ္ဆာန်ရုံ (Zoo)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(rankLines.join('\n\n'))
        .addFields(
          { name: '🐾 စုစုပေါင်း အကောင်ရေ', value: `**${totalAnimals.toLocaleString()} ကောင်**`, inline: true },
          { name: '💵 စုစုပေါင်း တန်ဖိုး', value: `**${totalValue.toLocaleString()} coins**`, inline: true }
        )
        .setFooter({ text: 'ရောင်းရန်: Ksell <id> [အရေအတွက်] သို့မဟုတ် Ksell all' });

      return message.reply({ embeds: [zooEmbed] });
    },
  },

  // ၃။ တိရစ္ဆာန် ရောင်းချခြင်း (Ksell all / Ksell <id> [count/all] / Ksell <rank>)
  {
    names: ['sell', 'sellall'],
    async execute(message, args, user, commandName) {
      const entries = Object.entries(user.zoo || {}).filter(([, count]) => count > 0);
      if (entries.length === 0) {
        return message.reply('❌ ရောင်းစရာ တိရစ္ဆာန် တစ်ကောင်မှ မရှိပါဘူး။');
      }

      const firstArg = args[0]?.toLowerCase();

      // (က) အကောင်အားလုံး ရောင်းချခြင်း (Ksell all သို့မဟုတ် Ksellall)
      if (commandName === 'sellall' || firstArg === 'all') {
        let totalEarned = 0;
        for (const [name, count] of entries) {
          const info = ANIMALS.find((a) => a.name === name);
          if (info) {
            totalEarned += info.price * count;
          }
        }

        user.zoo = {};
        user.battleTeam = [];
        user.balance += totalEarned;
        user.markModified('zoo');
        await user.save();

        return message.reply(`💵 ဖမ်းထားသော တိရစ္ဆာန်အားလုံးကို ရောင်းချလိုက်ရာ **+${totalEarned.toLocaleString()} coins** ရရှိပါပြီ!`);
      }

      if (!firstArg) {
        return message.reply(
          '❌ ရောင်းမယ့် အကောင် ID သို့မဟုတ် `all` ထည့်ပေးပါ!\n' +
          'ဥပမာ - `Ksell ant` | `Ksell rabbit 3` | `Ksell rabbit all` | `Ksell all`'
        );
      }

      // (ခ) Rank အလိုက် အစုလိုက် ရောင်းချခြင်း (ဥပမာ - Ksell common, Ksell rare)
      const rankMap = {
        common: '(Common)',
        uncommon: '(Uncommon)',
        rare: '(Rare)',
        superrare: '(Super Rare)',
        epic: '(Epic)',
        ultraepic: '(Ultra Epic)',
        legendary: '(Legendary)',
        mythical: '(Mythical)',
        divine: '(Divine)',
        celestial: '(Celestial)',
      };

      if (rankMap[firstArg]) {
        const rankTag = rankMap[firstArg];
        let rankEarned = 0;
        let soldTotal = 0;

        for (const [name, count] of entries) {
          if (name.includes(rankTag)) {
            const info = ANIMALS.find((a) => a.name === name);
            if (info) {
              rankEarned += info.price * count;
              soldTotal += count;
              delete user.zoo[name];
            }
          }
        }

        if (soldTotal === 0) {
          return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ **${rankTag}** အကောင် မရှိပါဘူး။`);
        }

        syncBattleTeam(user);
        user.balance += rankEarned;
        user.markModified('zoo');
        await user.save();

        return message.reply(
          `💵 **${rankTag}** တိရစ္ဆာန် စုစုပေါင်း **${soldTotal} ကောင်** ကို ရောင်းချလိုက်ရာ **+${rankEarned.toLocaleString()} coins** ရရှိပါပြီ!`
        );
      }

      // (ဂ) တစ်ကောင်ချင်း (English ID သို့မဟုတ် မြန်မာနာမည်) ရောင်းချခြင်း
      const targetAnimal = findAnimal(firstArg);
      if (!targetAnimal) {
        return message.reply(`❌ \`${args[0]}\` ဆိုတဲ့ တိရစ္ဆာန် ID မတွေ့ပါဘူး!`);
      }

      const ownedCount = (user.zoo && user.zoo[targetAnimal.name]) || 0;
      if (ownedCount <= 0) {
        const meta = getAnimalMeta(targetAnimal);
        return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ ${meta.rankEmoji} ${targetAnimal.emoji} **${meta.shortName}** (\`${targetAnimal.id}\`) မရှိပါဘူး။`);
      }

      const qtyArg = args[1]?.toLowerCase();
      let sellCount = 1;

      if (qtyArg === 'all') {
        sellCount = ownedCount;
      } else if (qtyArg !== undefined) {
        sellCount = parseInt(qtyArg, 10);
        if (isNaN(sellCount) || sellCount <= 0) {
          return message.reply('❌ ရောင်းမယ့် အရေအတွက် မှန်ကန်စွာ ထည့်ပါ! (ဥပမာ - `Ksell rabbit 2` သို့မဟုတ် `Ksell rabbit all`)');
        }
        if (sellCount > ownedCount) {
          const meta = getAnimalMeta(targetAnimal);
          return message.reply(`❌ သင့်မှာ ${meta.rankEmoji} ${targetAnimal.emoji} **${meta.shortName}** စုစုပေါင်း **${ownedCount} ကောင်** ပဲ ရှိပါတယ်။`);
        }
      }

      const earned = targetAnimal.price * sellCount;
      if (ownedCount - sellCount <= 0) {
        delete user.zoo[targetAnimal.name];
      } else {
        user.zoo[targetAnimal.name] = ownedCount - sellCount;
      }

      syncBattleTeam(user);
      user.balance += earned;
      user.markModified('zoo');
      await user.save();

      const meta = getAnimalMeta(targetAnimal);
      return message.reply(
        `💵 ${meta.rankEmoji} ${targetAnimal.emoji} **${meta.shortName}** (\`${targetAnimal.id}\`) × \`${sellCount}\` ကောင်ကို ရောင်းချလိုက်ရာ **+${earned.toLocaleString()} coins** ရရှိပါပြီ!`
      );
    },
  },

  // ၄။ Mystery Lootbox ဖောက်ယူခြင်း (Kopen / Kbox)
  {
    names: ['open', 'box'],
    async execute(message, args, user) {
      if ((user.boxes || 0) <= 0) {
        return message.reply('📦 ဖွင့်စရာ **Mystery Box** မရှိသေးပါဘူး! ၃ ရက်ဆက် `Kdaily` Streak နှင့် `Kbattle` အောင်ပွဲများမှ ရရှိနိုင်ပါတယ်။');
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
        const meta = getAnimalMeta(prizeAnimal);
        rewardMessage = `🐾 ရှားပါးတိရစ္ဆာန် ${meta.rankEmoji} ${prizeAnimal.emoji} **${meta.shortName}** (\`${prizeAnimal.id}\`) တစ်ကောင် ပေါက်ပါတယ်!`;
      }

      await user.save();
      return message.reply(`🎁 **Mystery Box** ကို ဖွင့်လိုက်ရာ...\n${rewardMessage}\n*(ကျန်ရှိသော Box: **${user.boxes} လုံး**)*`);
    },
  },
];