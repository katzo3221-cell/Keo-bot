const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, addProfileExp } = require('../models/User');
const ANIMALS = require('../data/animals');
const {
  ITEM_RANKS,
  SHOP_ITEMS,
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

// Anti-Macro Verification (AMV) ခလုတ်စစ်ဆေးမှု ပေးပို့ခြင်း
async function sendAmvChallenge(message) {
  const pool = ['🐶', '🐱', '🦊', '🐻', '🐼', '🦁', '🐸', '🐵', '🐧', '🦄', '🐉', '🐢'];
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  const targetEmoji = shuffled[Math.floor(Math.random() * shuffled.length)];

  const amvEmbed = new EmbedBuilder()
    .setColor('#E67E22')
    .setTitle('🛡️ Anti-Macro Verification (AMV)')
    .setDescription(
      `**${message.author.username}** သည် အမဲလိုက်မှု **အကြိမ် ၁၀၀** ပြည့်သွားပါပြီ!\n` +
      `Auto-Typer / Macro မဟုတ်ကြောင်း အတည်ပြုရန် အောက်ပါခလုတ်များထဲမှ **【 ${targetEmoji} 】** ကို နှိပ်ပါ —\n` +
      `*(၆၀ စက္ကန့်အတွင်း နှိပ်ပေးပါ)*`
    );

  const row = new ActionRowBuilder().addComponents(
    shuffled.map((emoji, idx) =>
      new ButtonBuilder()
        .setCustomId(`amv_${idx}_${emoji === targetEmoji ? 'ok' : 'no'}`)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const promptMsg = await message.reply({ embeds: [amvEmbed], components: [row] });
  const collector = promptMsg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async (i) => {
    if (i.user.id !== message.author.id) {
      return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Verification စစ်ဆေးမှု မဟုတ်ပါဘူး!', ephemeral: true });
    }

    if (i.customId.endsWith('_ok')) {
      const freshUser = await getUser(message.author.id, message.author.username);
      freshUser.amvLocked = false;
      freshUser.huntCount = 0;
      await freshUser.save();

      collector.stop('verified');
      const passEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ အတည်ပြုမှု အောင်မြင်ပါသည်!')
        .setDescription(`ကျေးဇူးတင်ပါတယ် **${message.author.username}**! ဆက်လက်၍ \`Kh\` ရိုက်ပြီး အမဲလိုက်နိုင်ပါပြီ။`);
      return i.update({ embeds: [passEmbed], components: [] });
    } else {
      collector.stop('wrong');
      const failEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ ခလုတ်ရွေးချယ်မှု မှားယွင်းနေပါသည်!')
        .setDescription(`**【 ${targetEmoji} 】** ကို နှိပ်ရမည်ဖြစ်ပါသည်။ \`Kh\` ပြန်ရိုက်ပြီး ထပ်မံအတည်ပြုပါ။`);
      return i.update({ embeds: [failEmbed], components: [] });
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle('⏳ Verification အချိန်စေ့သွားပါပြီ')
        .setDescription('ဆက်လက်အမဲလိုက်လိုပါက `Kh` ပြန်ရိုက်ပြီး ခလုတ်နှိပ် အတည်ပြုပါ။');
      await promptMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  });
}

module.exports = [
  // ၁။ အမဲလိုက်ခြင်း (Khunt / Kh)
  {
    names: ['hunt', 'h'],
    async execute(message, args, user) {
      if (user.amvLocked) {
        return sendAmvChallenge(message);
      }

      const cost = 10;
      if (user.balance < cost) {
        return message.reply(`❌ အမဲလိုက်ဖို့ ကျည်ဆန်ဖိုး **${cost} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= cost;

      const activeHuntItem = getActiveHuntItem(user);
      const totalLuck = activeHuntItem ? activeHuntItem.luckBonus : 0;
      const extraCatch = activeHuntItem ? activeHuntItem.extraCatch : 0;
      const catchMultiplier = activeHuntItem ? activeHuntItem.catchMultiplier : 1;
      const catchCount = (1 + extraCatch) * catchMultiplier;

      if (!user.zoo) user.zoo = {};
      const caughtSummary = {};

      const weightedAnimals = ANIMALS.map((animal) => {
        let multiplier = 1;
        if (animal.price >= 18000) {
          multiplier = 1 + totalLuck * 0.04;
        } else if (animal.price >= 8000) {
          multiplier = 1 + totalLuck * 0.045;
        } else if (animal.price >= 1000) {
          multiplier = 1 + totalLuck * 0.035;
        } else if (animal.price >= 60) {
          multiplier = 1 + totalLuck * 0.02;
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

      const brokenItemText = activeHuntItem ? consumeSingleItem(user, activeHuntItem.id) : '';

      // Profile EXP +10 (Daily Limit 3,000)
      const expRes = addProfileExp(user, 10);

      // အကြိမ် ၁၀၀ ပြည့်ပါက AMV စစ်ဆေးမှု ဖွင့်ပေးခြင်း
      user.huntCount = (user.huntCount || 0) + 1;
      let triggeredAmv = false;
      if (user.huntCount >= 100) {
        user.amvLocked = true;
        user.huntCount = 0;
        triggeredAmv = true;
      }

      await user.save();

      await message.reply(
        `🏹 သင်သည် တောထဲသို့ အမဲလိုက်ထွက်ရာ... ${caughtListText} ဖမ်းမိခဲ့ပါတယ်!${foundItemText}${brokenItemText}${expRes.levelUpText}`
      );

      if (triggeredAmv) {
        await sendAmvChallenge(message);
      }
    },
  },

  // ၂။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (Kzoo / Kz)
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

  // ၄။ Lucky Crate ဖွင့်လှစ်ခြင်း (Kopen lc [အရေအတွက်/all] သို့မဟုတ် Kopen [အရေအတွက်/all])
  {
    names: ['open', 'box', 'lc'],
    async execute(message, args, user) {
      const ownedCrates = user.boxes || 0;
      if (ownedCrates <= 0) {
        return message.reply('🎁 ဖွင့်စရာ **Lucky Crate (`lc`)** မရှိသေးပါဘူး! `Kprofile` Level တက်ခြင်း၊ ၃ ရက်ဆက် `Kdaily` Streak နှင့် `Kbattle` အောင်ပွဲများမှ ရရှိနိုင်ပါတယ်။');
      }

      // Kopen lc all / Kopen lc 5 / Kopen 5 / Kopen all ပုံစံအားလုံးကို ခွဲခြမ်းစိတ်ဖြာခြင်း
      const filteredArgs = args.filter((a) => !['lc', 'lucky', 'crate', 'crates', 'box'].includes(a.toLowerCase()));
      const qtyArg = filteredArgs[0]?.toLowerCase();
      let openCount = 1;

      if (qtyArg === 'all') {
        openCount = ownedCrates;
      } else if (qtyArg !== undefined) {
        openCount = parseInt(qtyArg, 10);
        if (isNaN(openCount) || openCount <= 0) {
          return message.reply('❌ ဖွင့်မယ့် Lucky Crate အရေအတွက် မှန်ကန်စွာ ထည့်ပါ! (ဥပမာ - `Kopen lc 3` သို့မဟုတ် `Kopen lc all`)');
        }
        if (openCount > ownedCrates) {
          return message.reply(`❌ သင့်မှာ **Lucky Crate (\`lc\`)** စုစုပေါင်း **${ownedCrates} လုံး** ပဲ ရှိပါတယ်။`);
        }
      }

      user.boxes -= openCount;

      let totalCoinsWon = 0;
      let totalRawExpWon = 0;
      const wonAnimals = {};
      const wonItems = {};

      const rarePool = ANIMALS.filter((a) => a.price >= 60); // Rare မှ Celestial အထိ
      const poolWeight = rarePool.reduce((sum, a) => sum + a.chance, 0);
      const highRankItems = SHOP_ITEMS.filter((i) => i.rank >= 4); // Rank 4 မှ 7 အထိ

      for (let k = 0; k < openCount; k++) {
        const roll = Math.random();

        if (roll < 0.40) {
          // 40%: Coins (1,000 - 4,000)
          totalCoinsWon += Math.floor(Math.random() * 3001) + 1000;
        } else if (roll < 0.70) {
          // 30%: Profile EXP (80 - 200)
          totalRawExpWon += Math.floor(Math.random() * 121) + 80;
        } else if (roll < 0.90) {
          // 20%: Rare - Celestial Animal
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

          if (!wonAnimals[prizeAnimal.id]) {
            const meta = getAnimalMeta(prizeAnimal);
            wonAnimals[prizeAnimal.id] = {
              emoji: prizeAnimal.emoji,
              rankEmoji: meta.rankEmoji,
              shortName: meta.shortName,
              id: prizeAnimal.id,
              count: 0,
            };
          }
          wonAnimals[prizeAnimal.id].count += 1;
        } else {
          // 10%: Rank 4 - 7 High-Tier Hunt Item
          const prizeItem = highRankItems[Math.floor(Math.random() * highRankItems.length)];
          grantItemToUser(user, prizeItem);
          if (!wonItems[prizeItem.id]) {
            const rInfo = ITEM_RANKS[prizeItem.rank];
            wonItems[prizeItem.id] = {
              rankEmoji: rInfo.emoji,
              rank: prizeItem.rank,
              name: prizeItem.name,
              id: prizeItem.id,
              count: 0,
            };
          }
          wonItems[prizeItem.id].count += 1;
        }
      }

      if (totalCoinsWon > 0) {
        user.balance += totalCoinsWon;
      }

      let expSummaryLine = '';
      let levelUpText = '';
      if (totalRawExpWon > 0) {
        const expRes = addProfileExp(user, totalRawExpWon);
        const capNote = expRes.hitDailyLimit
          ? ' *(ယနေ့ 3,000 EXP Limit ပြည့်သွားပါပြီ)*'
          : expRes.addedExp < totalRawExpWon
            ? ` *(Daily Limit 3,000 ကြောင့် +${expRes.addedExp} EXP သာ ပေါင်းပေးထားပါသည်)*`
            : '';
        expSummaryLine = `✨ Profile EXP: **+${expRes.addedExp.toLocaleString()} EXP**${capNote}`;
        levelUpText = expRes.levelUpText;
      }

      await user.save();

      const rewardLines = [];
      if (totalCoinsWon > 0) {
        rewardLines.push(`💰 ရွှေဒင်္ဂါး: **+${totalCoinsWon.toLocaleString()} coins**`);
      }
      if (expSummaryLine) {
        rewardLines.push(expSummaryLine);
      }

      const animalEntries = Object.values(wonAnimals);
      if (animalEntries.length > 0) {
        const aText = animalEntries
          .map((a) => `${a.rankEmoji}${a.emoji} **${a.shortName}** (\`${a.id}\`)${a.count > 1 ? ` ×${a.count}` : ''}`)
          .join('၊ ');
        rewardLines.push(`🐾 ရှားပါးတိရစ္ဆာန်: ${aText}`);
      }

      const itemEntries = Object.values(wonItems);
      if (itemEntries.length > 0) {
        const iText = itemEntries
          .map((it) => `${it.rankEmoji} **[Rank ${it.rank}] ${it.name}** (\`${it.id}\`)${it.count > 1 ? ` ×${it.count}` : ''}`)
          .join('၊ ');
        rewardLines.push(`🎒 အဆင့်မြင့်ပစ္စည်း: ${iText}`);
      }

      let bodyText = rewardLines.join('\n');
      if (bodyText.length > 1700) {
        bodyText = bodyText.slice(0, 1650) + '\n... *(ဆုလက်ဆောင်များ အားလုံးကို အကောင့်ထဲသို့ ထည့်သွင်းပြီးပါပြီ)*';
      }

      return message.reply(
        `🎁 **Lucky Crate (\`lc\`) × ${openCount} လုံး** ကို ဖွင့်လှစ်လိုက်ရာ...\n` +
        `${bodyText}${levelUpText}\n` +
        `*(ကျန်ရှိသော Lucky Crate: **${user.boxes} လုံး**)*`
      );
    },
  },
];