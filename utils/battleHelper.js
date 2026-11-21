const { EmbedBuilder } = require('discord.js');
const ANIMALS = require('../data/animals');
const { findAnimal } = require('./helpers');

// Rank ၁၀ ဆင့်အလိုက် သီးသန့် Battle Power
const RANK_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Super Rare',
  'Epic',
  'Ultra Epic',
  'Legendary',
  'Mythical',
  'Divine',
  'Celestial',
];

const RANK_POWER = {
  Common: 50,
  Uncommon: 120,
  Rare: 250,
  'Super Rare': 500,
  Epic: 900,
  'Ultra Epic': 1600,
  Legendary: 2800,
  Mythical: 4500,
  Divine: 7500,
  Celestial: 12000,
};

function getAnimalRank(animal) {
  const match = animal.name.match(/\(([^)]+)\)$/);
  return match && RANK_POWER[match[1]] ? match[1] : 'Common';
}

function getAnimalRankIndex(animal) {
  const idx = RANK_ORDER.indexOf(getAnimalRank(animal));
  return idx >= 0 ? idx : 0;
}

function getAnimalPower(animal) {
  return RANK_POWER[getAnimalRank(animal)] || 50;
}

const ANIMALS_BY_RANK = RANK_ORDER.map((rankName) =>
  ANIMALS.filter((a) => getAnimalRank(a) === rankName)
);

function hasAnyAnimal(userObj) {
  return Object.values(userObj.zoo || {}).some((count) => Number(count) > 0);
}

// Battle Level နှင့် အကောင် Rank ပေါ်မူတည်၍ Solo အခက်အခဲ သတ်မှတ်ခြင်း
function getSoloDifficulty(battleLevel, avgRankIdx) {
  const score = Math.min(100, Math.floor((battleLevel - 1) * 2.2 + avgRankIdx * 5));

  if (score < 20) {
    return {
      label: '🟢 Easy (အလွယ်)',
      color: '#2ECC71',
      levelOffset: -1,
      powerScale: 0.85,
      rankChances: { lower: 0.50, same: 0.45 },
      bonusExp: 0,
      crateChance: 0.15,
    };
  }
  if (score < 40) {
    return {
      label: '🔵 Normal (ပုံမှန်)',
      color: '#3498DB',
      levelOffset: 0,
      powerScale: 0.90,
      rankChances: { lower: 0.35, same: 0.55 },
      bonusExp: 10,
      crateChance: 0.15,
    };
  }
  if (score < 60) {
    return {
      label: '🟠 Hard (ခက်ခဲ)',
      color: '#E67E22',
      levelOffset: 0,
      powerScale: 0.95,
      rankChances: { lower: 0.25, same: 0.55 },
      bonusExp: 20,
      crateChance: 0.18,
    };
  }
  if (score < 80) {
    return {
      label: '🔴 Extreme (အလွန်ခက်)',
      color: '#E74C3C',
      levelOffset: 1,
      powerScale: 0.98,
      rankChances: { lower: 0.20, same: 0.55 },
      bonusExp: 35,
      crateChance: 0.20,
    };
  }
  return {
    label: '💀 Nightmare (ငရဲအဆင့်)',
    color: '#8E44AD',
    levelOffset: 2,
    powerScale: 1.00,
    rankChances: { lower: 0.15, same: 0.55 },
    bonusExp: 50,
    crateChance: 0.22,
  };
}

// ±8% Random Power Swing တွက်ချက်ခြင်း
function applyBattleSwing(staticPower) {
  const swing = 0.92 + Math.random() * 0.16;
  return Math.max(1, Math.round(staticPower * swing));
}

// ကစားသမား၏ Battle Team နှင့် Power တွက်ချက်ခြင်း
function getBattleStats(userObj) {
  const team = [];

  if (userObj.battleTeam && userObj.battleTeam.length > 0) {
    const usedCounts = {};
    for (const id of userObj.battleTeam) {
      const info = ANIMALS.find((a) => a.id === id);
      if (!info) continue;
      const owned = (userObj.zoo && Number(userObj.zoo[info.name])) || 0;
      const used = usedCounts[info.name] || 0;
      if (owned > used) {
        team.push(info);
        usedCounts[info.name] = used + 1;
      }
    }
  }

  const bLevel = userObj.battleLevel || 1;
  const basePower = team.reduce((sum, a) => sum + getAnimalPower(a), 0);
  const avgRankIdx = team.length > 0
    ? team.reduce((sum, a) => sum + getAnimalRankIndex(a), 0) / team.length
    : 0;

  const levelPercent = (bLevel - 1) * 3;
  const levelBonus = Math.floor(basePower * (levelPercent / 100)) + (bLevel * 15);
  const staticPower = basePower + levelBonus;
  const totalPower = applyBattleSwing(staticPower);

  return {
    team,
    basePower,
    levelBonus,
    levelPercent,
    staticPower,
    totalPower,
    battleLevel: bLevel,
    avgRankIdx,
  };
}

// Wild Enemy အဖွဲ့ ဖန်တီးခြင်း
function generateWildEnemy(myStats) {
  const difficulty = getSoloDifficulty(myStats.battleLevel, myStats.avgRankIdx);
  const wildLevel = Math.max(1, myStats.battleLevel + difficulty.levelOffset);

  const enemyTeam = myStats.team.map((playerAnimal) => {
    const pRankIdx = getAnimalRankIndex(playerAnimal);
    const roll = Math.random();

    let eRankIdx = pRankIdx;
    if (roll < difficulty.rankChances.lower) {
      eRankIdx = Math.max(0, pRankIdx - 1);
    } else if (roll >= difficulty.rankChances.lower + difficulty.rankChances.same) {
      eRankIdx = Math.min(RANK_ORDER.length - 1, pRankIdx + 1);
    }

    const pool = ANIMALS_BY_RANK[eRankIdx]?.length ? ANIMALS_BY_RANK[eRankIdx] : ANIMALS;
    return pool[Math.floor(Math.random() * pool.length)];
  });

  const basePower = enemyTeam.reduce((sum, a) => sum + getAnimalPower(a), 0);
  const levelPercent = (wildLevel - 1) * 3;
  const levelBonus = Math.floor(basePower * (levelPercent / 100)) + (wildLevel * 15);
  const staticPower = Math.round((basePower + levelBonus) * difficulty.powerScale);
  const totalPower = applyBattleSwing(staticPower);

  return {
    team: enemyTeam,
    wildLevel,
    difficulty,
    basePower,
    staticPower,
    totalPower,
  };
}

// Kteam / Kb select လုပ်ဆောင်ချက်
async function handleTeamCommand(message, args, user) {
  const sub = args[0]?.toLowerCase();

  if (sub === 'clear' || sub === 'reset') {
    user.battleTeam = [];
    await user.save();
    return message.reply('✅ တိုက်ပွဲအဖွဲ့ (Battle Team) ကို ဖျက်သိမ်းလိုက်ပါပြီ! နောက်ထပ် `Kbattle` ဝင်လိုပါက `Kteam <id1> [id2] [id3]` ဖြင့် အကောင်အသစ် ပြန်ရွေးချယ်ပါ။');
  }

  const picks = sub === 'set' ? args.slice(1) : args;
  if (picks.length > 0) {
    if (picks.length > 3) {
      return message.reply('❌ တိုက်ပွဲအဖွဲ့တွင် အများဆုံး **၃ ကောင်** အထိသာ ရွေးချယ်နိုင်ပါတယ်!');
    }

    const chosenAnimals = [];
    const neededCounts = {};

    for (const rawId of picks) {
      const animal = findAnimal(rawId);
      if (!animal) {
        return message.reply(`❌ \`${rawId}\` ဆိုတဲ့ တိရစ္ဆာန် ID မတွေ့ပါဘူး! အမဲလိုက်ထားတဲ့ ID သို့မဟုတ် မြန်မာနာမည် မှန်ကန်စွာ ထည့်ပါ။`);
      }
      neededCounts[animal.name] = (neededCounts[animal.name] || 0) + 1;
      const owned = (user.zoo && Number(user.zoo[animal.name])) || 0;
      if (owned < neededCounts[animal.name]) {
        return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ ${animal.emoji} **${animal.name}** (\`${animal.id}\`) လုံလောက်အောင် မရှိပါဘူး! (ပိုင်ဆိုင်မှု: **${owned} ကောင်**)`);
      }
      chosenAnimals.push(animal);
    }

    user.battleTeam = chosenAnimals.map((a) => a.id);
    await user.save();

    const teamList = chosenAnimals
      .map((a, idx) => `${idx + 1}. ${a.emoji} **${a.name}** (\`${a.id}\`) — Battle Power: \`${getAnimalPower(a).toLocaleString()}\``)
      .join('\n');

    return message.reply(
      `⚔️ **တိုက်ပွဲဝင်မည့် အဖွဲ့ (Battle Team) ကို ရွေးချယ်သတ်မှတ်ပြီးပါပြီ!**\n${teamList}\n*(တိုက်ခိုက်ရန် \`Kbattle\` ကို ရိုက်ပါ)*`
    );
  }

  const stats = getBattleStats(user);
  if (stats.team.length === 0) {
    if (!hasAnyAnimal(user)) {
      return message.reply('❌ တိုက်ပွဲဝင်ဖို့ တိရစ္ဆာန် တစ်ကောင်မှ မရှိသေးပါဘူး! `Khunt` ရိုက်ပြီး အရင်ဖမ်းပါ။');
    }
    return message.reply(
      '❌ တိုက်ပွဲဝင်မယ့် အဖွဲ့ (Battle Team) မရွေးချယ်ရသေးပါဘူး!\n' +
      '`Kteam <id1> [id2] [id3]` ရိုက်ပြီး အများဆုံး **၃ ကောင်** ကိုယ်တိုင်ရွေးချယ်ပါ။ (ဥပမာ - `Kteam lion tiger wolf`)'
    );
  }

  const soloDiff = getSoloDifficulty(stats.battleLevel, stats.avgRankIdx);
  const currentList = stats.team
    .map((a, idx) => `${idx + 1}. ${a.emoji} **${a.name}** (\`${a.id}\`) — Power: \`${getAnimalPower(a).toLocaleString()}\``)
    .join('\n');

  const teamEmbed = new EmbedBuilder()
    .setColor('#E67E22')
    .setAuthor({ name: `${message.author.username} ၏ Battle Team (Battle Lv.${stats.battleLevel})`, iconURL: message.author.displayAvatarURL() })
    .setDescription(`**ပုံစံ:** 🎯 ကိုယ်တိုင်ရွေးထားသော အဖွဲ့\n\n${currentList}`)
    .addFields(
      { name: '💥 Base Power', value: `**${stats.basePower.toLocaleString()}**`, inline: true },
      { name: `🔥 Level Bonus (+${stats.levelPercent}%)`, value: `**+${stats.levelBonus.toLocaleString()}**`, inline: true },
      { name: '⚔️ စုစုပေါင်း Power', value: `**~${stats.staticPower.toLocaleString()}** *(±8%)*`, inline: true },
      { name: '🔥 လက်ရှိ Solo အခက်အခဲ', value: `${soloDiff.label} *(Battle Lv.${stats.battleLevel} + အကောင် Rank)*`, inline: false }
    )
    .setFooter({ text: 'ပြောင်းရွေးရန်: Kteam <id1> [id2] [id3] | ပြန်ဖျက်ရန်: Kteam clear' });

  return message.reply({ embeds: [teamEmbed] });
}

module.exports = {
  getAnimalPower,
  hasAnyAnimal,
  getSoloDifficulty,
  getBattleStats,
  generateWildEnemy,
  handleTeamCommand,
};