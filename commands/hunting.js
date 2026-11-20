const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, addProfileExp } = require('../models/User');
const ANIMALS = require('../data/animals');
const {
  ITEM_RANKS,
  SHOP_ITEMS,
  rollRandomItem,
  receiveDroppedItem,
  getActiveHuntItems,
  consumeActiveHuntItems,
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

      // တပ်ဆင်ထားသော Item ၃ မျိုး (luck, extra, multiplier) မှ စွမ်းရည်များ တွက်ချက်ခြင်း (အများဆုံး ၁၀ ကောင် မကျော်စေရ)
      const activeItems = getActiveHuntItems(user);
      const totalLuck = activeItems.luck ? activeItems.luck.luckBonus : 0;
      const extraCatch = activeItems.extra ? activeItems.extra.extraCatch : 0;
      const catchMultiplier = activeItems.multiplier ? activeItems.multiplier.catchMultiplier : 1;
      const catchCount = Math.min((1 + extraCatch) * catchMultiplier, 10);

      if (!user.zoo) user.zoo = {};
      const caughtSummary = {};

      // Rank နာမည်အလိုက် Luck Bonus တွက်ချက်ခြင်း (Celestial/Divine အလွယ်တကူမမိစေရန်)
      const weightedAnimals = ANIMALS.map((animal) => {
        const { rank } = getAnimalMeta(animal);
        let multiplier = 1;
        if (['Mythical', 'Divine', 'Celestial'].includes(rank)) {
          multiplier = 1 + totalLuck * 0.015;
        } else if (rank === 'Legendary') {
          multiplier = 1 + totalLuck * 0.025;
        } else if (['Epic', 'Ultra Epic'].includes(rank)) {
          multiplier = 1 + totalLuck * 0.03;
        } else if (['Rare', 'Super Rare'].includes(rank)) {
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
        const dropResult = receiveDroppedItem(user, foundItem);
        user.dailyHuntItemCount += 1;
        const rInfo = ITEM_RANKS[foundItem.rank];
        const statusNote = dropResult.equipped
          ? `*(အလိုအလျောက် တပ်ဆင်ပြီး — **${dropResult.uses} ကြိမ်**)*`
          : `*(အိတ်ထဲ သိမ်းဆည်းပြီး — လက်ရှိ \`${dropResult.activeItem.id}\` ကုန်မှ \`Kuse ${foundItem.id}\` ဖြင့် သုံးပါ)*`;
        foundItemText =
          `\n🎒 တောထဲမှ ${rInfo.emoji} **[Rank ${foundItem.rank}] ${foundItem.name}** (\`${foundItem.id}\`) ရှာတွေ့ပါတယ်! ` +
          `${statusNote} *(ယနေ့ Limit: **${user.dailyHuntItemCount}/3**)*`;
      }

      // အသုံးပြုလိုက်သော Active Item များ၏ အကြိမ်ရေကို ၁ ကြိမ်စီ လျှော့ချခြင်း
      const brokenItemText = consumeActiveHuntItems(user, activeItems);

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

 // ၂။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (Kzoo / Kz / Kzoo id / Kzooid)
  {
    names: ['zoo', 'z', 'zooid'],
    async execute(message, args, user, commandName) {
      const zooData = user.zoo || {};
      const hasAnimals = ANIMALS.some((a) => (Number(zooData[a.name]) || 0) > 0);

      if (!hasAnimals) {
        return message.reply('🏞️ သင့်တိရစ္ဆာန်ရုံထဲမှာ ဘာမှ မရှိသေးပါဘူး။ `Khunt` ရိုက်ပြီး ဖမ်းကြည့်ပါ!');
      }

      const SHORT_RANK_LABELS = {
        Common: 'Common',
        Uncommon: 'Uncommon',
        Rare: 'Rare',
        'Super Rare': 'S.Rare',
        Epic: 'Epic',
        'Ultra Epic': 'U.Epic',
        Legendary: 'Legend',
        Mythical: 'Mythic',
        Divine: 'Divine',
        Celestial: 'Celestial',
      };

      let showIds = commandName === 'zooid' || ['id', 'ids', 'list'].includes(args[0]?.toLowerCase());
      let page = 0;

      const buildZooView = () => {
        let totalValue = 0;
        let totalAnimals = 0;
        const rankLines = [];

        // ID ပြသည့်အခါ Kteam ရွေးရလွယ်အောင် အားအကောင်းဆုံး Rank (Celestial) မှ အပေါ်ဆုံး စီပြမည်
        const ranksOrder = showIds ? [...RANKS].reverse() : RANKS;

        for (const rankInfo of ranksOrder) {
          const rankTag = `(${rankInfo.name})`;
          const ownedInRank = ANIMALS.filter(
            (a) => a.name.endsWith(rankTag) && (Number(zooData[a.name]) || 0) > 0
          );

          if (ownedInRank.length > 0) {
            const listText = ownedInRank
              .map((a) => {
                const count = Number(zooData[a.name]) || 0;
                totalValue += a.price * count;
                totalAnimals += count;
                return showIds
                  ? `${a.emoji}\`${a.id}\`×${count}`
                  : `${a.emoji}×${count}`;
              })
              .join(' ');

            const label = SHORT_RANK_LABELS[rankInfo.name] || rankInfo.name;
            rankLines.push(`${rankInfo.emoji}**${label}** ➔ ${listText}`);
          }
        }

        // စာလုံး 3,800 ထက်ကျော်ပါက Page ခွဲပြမည် (Celestial နှင့် အောက်ဆုံးအတန်းများ မပြတ်စေရန်)
        const pages = [];
        let currentLines = [];
        let currentLen = 0;

        for (const line of rankLines) {
          if (currentLen + line.length + 1 > 3800 && currentLines.length > 0) {
            pages.push(currentLines.join('\n'));
            currentLines = [line];
            currentLen = line.length;
          } else {
            currentLines.push(line);
            currentLen += line.length + 1;
          }
        }
        if (currentLines.length > 0) {
          pages.push(currentLines.join('\n'));
        }

        const totalPages = Math.max(1, pages.length);
        if (page >= totalPages) page = totalPages - 1;
        if (page < 0) page = 0;

        const pageNote = totalPages > 1 ? ` • စာမျက်နှာ ${page + 1}/${totalPages}` : '';

        const embed = new EmbedBuilder()
          .setColor(showIds ? '#3498DB' : '#2ECC71')
          .setAuthor({
            name: `${message.author.username} ၏ တိရစ္ဆာန်ရုံ (${showIds ? 'ID စာရင်း' : 'Zoo'}${pageNote})`,
            iconURL: message.author.displayAvatarURL(),
          })
          .setDescription(pages[page])
          .addFields(
            { name: '🐾 စုစုပေါင်း အကောင်ရေ', value: `**${totalAnimals.toLocaleString()} ကောင်**`, inline: true },
            { name: '💵 စုစုပေါင်း တန်ဖိုး', value: `**${totalValue.toLocaleString()} coins**`, inline: true }
          )
          .setFooter({
            text: showIds
              ? 'အဖွဲ့ရွေးရန်: Kteam <id1> [id2] [id3] | ရောင်းရန်: Ksell <id> [အရေအတွက်]'
              : 'ID ကြည့်ရန်: Kzoo id | အဖွဲ့ရွေးရန်: Kteam <id1> [id2] [id3] | ရောင်းရန်: Ksell all',
          });

        const buttons = [
          new ButtonBuilder()
            .setCustomId('zoo_toggle_id')
            .setLabel(showIds ? '🐾 အကျဉ်းကြည့်ရန်' : '🆔 ID များကြည့်ရန်')
            .setStyle(showIds ? ButtonStyle.Secondary : ButtonStyle.Primary),
        ];

        if (totalPages > 1) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId('zoo_prev')
              .setLabel('◀️ ရှေ့')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('zoo_next')
              .setLabel('နောက် ▶️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1)
          );
        }

        const row = new ActionRowBuilder().addComponents(buttons);
        return { embed, row };
      };

      const initial = buildZooView();
      const zooMsg = await message.reply({
        embeds: [initial.embed],
        components: [initial.row],
      });

      const collector = zooMsg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ ဒါက သင့်ရဲ့ တိရစ္ဆာန်ရုံ မဟုတ်ပါဘူး!', ephemeral: true });
        }

        if (i.customId === 'zoo_toggle_id') {
          showIds = !showIds;
          page = 0;
        } else if (i.customId === 'zoo_prev') {
          page -= 1;
        } else if (i.customId === 'zoo_next') {
          page += 1;
        }

        const updated = buildZooView();
        await i.update({
          embeds: [updated.embed],
          components: [updated.row],
        });
      });

      collector.on('end', async () => {
        await zooMsg.edit({ components: [] }).catch(() => {});
      });
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
        // Battle Team ထဲတွင် ထည့်ထားသော အကောင်အရေအတွက်များကို ရေတွက်ချန်ထားခြင်း
        const protectedCounts = {};
        for (const id of user.battleTeam || []) {
          const info = ANIMALS.find((a) => a.id === id);
          if (!info) continue;
          const owned = (user.zoo && user.zoo[info.name]) || 0;
          const alreadyProtected = protectedCounts[info.name] || 0;
          if (owned > alreadyProtected) {
            protectedCounts[info.name] = alreadyProtected + 1;
          }
        }

        let totalEarned = 0;
        let soldTotal = 0;
        let keptTotal = 0;
        const newZoo = {};

        for (const [name, count] of entries) {
          const info = ANIMALS.find((a) => a.name === name);
          const keepCount = Math.min(count, protectedCounts[name] || 0);
          const sellCount = count - keepCount;

          if (keepCount > 0) {
            newZoo[name] = keepCount;
            keptTotal += keepCount;
          }

          if (sellCount > 0 && info) {
            totalEarned += info.price * sellCount;
            soldTotal += sellCount;
          }
        }

        if (soldTotal === 0) {
          return message.reply(
            '🛡️ ရောင်းစရာ တိရစ္ဆာန် မရှိပါဘူး! လက်ကျန်အကောင်အားလုံးက **Battle Team** ထဲမှာ တပ်ဆင်ထားတဲ့ အကောင်တွေ ဖြစ်နေပါတယ်။\n' +
            '*(အဲဒီအကောင်တွေကိုပါ ရောင်းချင်ရင် `Kteam clear` အရင်ရိုက်ပါ)*'
          );
        }

        user.zoo = newZoo;
        syncBattleTeam(user);
        user.balance += totalEarned;
        user.markModified('zoo');
        await user.save();

        const keepNote = keptTotal > 0
          ? `\n🛡️ *(Battle Team ထဲမှ အကောင် **${keptTotal} ကောင်** ကို မရောင်းဘဲ ချန်ထားပေးထားပါသည်)*`
          : '';

        return message.reply(
          `💵 တိရစ္ဆာန် စုစုပေါင်း **${soldTotal.toLocaleString()} ကောင်** ကို ရောင်းချလိုက်ရာ **+${totalEarned.toLocaleString()} coins** ရရှိပါပြီ!${keepNote}`
        );
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

        // Battle Team ထဲတွင် ထည့်ထားသော အကောင်အရေအတွက်များကို ရေတွက်ချန်ထားခြင်း
        const protectedCounts = {};
        for (const id of user.battleTeam || []) {
          const info = ANIMALS.find((a) => a.id === id);
          if (!info) continue;
          const owned = (user.zoo && user.zoo[info.name]) || 0;
          const alreadyProtected = protectedCounts[info.name] || 0;
          if (owned > alreadyProtected) {
            protectedCounts[info.name] = alreadyProtected + 1;
          }
        }

        let rankEarned = 0;
        let soldTotal = 0;
        let keptTotal = 0;

        for (const [name, count] of entries) {
          if (name.includes(rankTag)) {
            const info = ANIMALS.find((a) => a.name === name);
            if (!info) continue;

            const keepCount = Math.min(count, protectedCounts[name] || 0);
            const sellCount = count - keepCount;

            if (keepCount > 0) {
              user.zoo[name] = keepCount;
              keptTotal += keepCount;
            } else {
              delete user.zoo[name];
            }

            if (sellCount > 0) {
              rankEarned += info.price * sellCount;
              soldTotal += sellCount;
            }
          }
        }

        if (soldTotal === 0) {
          if (keptTotal > 0) {
            return message.reply(
              `🛡️ ရောင်းစရာ **${rankTag}** အကောင် မရှိပါဘူး! လက်ကျန် **${keptTotal} ကောင်** လုံးက **Battle Team** ထဲမှာ တပ်ဆင်ထားပါတယ်။\n` +
              '*(အဲဒီအကောင်တွေကိုပါ ရောင်းချင်ရင် `Kteam clear` အရင်ရိုက်ပါ)*'
            );
          }
          return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ **${rankTag}** အကောင် မရှိပါဘူး။`);
        }

        syncBattleTeam(user);
        user.balance += rankEarned;
        user.markModified('zoo');
        await user.save();

        const keepNote = keptTotal > 0
          ? `\n🛡️ *(Battle Team ထဲမှ **${rankTag}** အကောင် **${keptTotal} ကောင်** ကို မရောင်းဘဲ ချန်ထားပေးထားပါသည်)*`
          : '';

        return message.reply(
          `💵 **${rankTag}** တိရစ္ဆာန် စုစုပေါင်း **${soldTotal.toLocaleString()} ကောင်** ကို ရောင်းချလိုက်ရာ **+${rankEarned.toLocaleString()} coins** ရရှိပါပြီ!${keepNote}`
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

      const rarePool = ANIMALS.filter((a) => !['Common', 'Uncommon'].includes(getAnimalMeta(a).rank)); // Rare မှ Celestial အထိ
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