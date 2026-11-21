const { addProfileExp } = require('../../models/User');
const ANIMALS = require('../../data/animals');
const { ITEM_RANKS, SHOP_ITEMS, receiveDroppedItem } = require('../../data/shopItems');
const { getAnimalMeta, syncCollection, syncZooStats } = require('../../utils/huntingHelper');

module.exports = [
  // Lucky Crate ဖွင့်လှစ်ခြင်း (Kopen lc [အရေအတွက်/all] သို့မဟုတ် Kopen [အရေအတွက်/all])
  {
    names: ['open', 'box', 'lc'],
    async execute(message, args, user) {
      const ownedCrates = user.boxes || 0;
      if (ownedCrates <= 0) {
        return message.reply('🎁 ဖွင့်စရာ **Lucky Crate (`lc`)** မရှိသေးပါဘူး! `Kdaily`၊ `Kprofile` Level တက်ခြင်း နှင့် `Kbattle` အောင်ပွဲများမှ ရရှိနိုင်ပါတယ်။');
      }

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

      const rarePool = ANIMALS.filter((a) => !['Common', 'Uncommon'].includes(getAnimalMeta(a).rank));
      const poolWeight = rarePool.reduce((sum, a) => sum + a.chance, 0);
      const highRankItems = SHOP_ITEMS.filter((i) => i.rank >= 4);

      for (let k = 0; k < openCount; k++) {
        const roll = Math.random();

        if (roll < 0.40) {
          totalCoinsWon += Math.floor(Math.random() * 3001) + 1000;
        } else if (roll < 0.70) {
          totalRawExpWon += Math.floor(Math.random() * 121) + 80;
        } else if (roll < 0.90) {
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
          const prizeItem = highRankItems[Math.floor(Math.random() * highRankItems.length)];
          receiveDroppedItem(user, prizeItem);
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

      syncCollection(user);
      syncZooStats(user);
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