const ANIMALS = require('../data/animals');

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

const ANIMAL_NAME_TO_ID = new Map(ANIMALS.map((a) => [a.name, a.id]));
const ANIMAL_PRICE_MAP = new Map(ANIMALS.map((a) => [a.name, a.price]));
const VALID_ANIMAL_IDS = new Set(ANIMALS.map((a) => a.id));

// တိရစ္ဆာန်၏ Rank၊ Rank Emoji နှင့် နာမည်အတို ခွဲထုတ်ခြင်း
function getAnimalMeta(animal) {
  const match = animal.name.match(/\(([^)]+)\)$/);
  const rank = match ? match[1] : 'Common';
  const rankObj = RANKS.find((r) => r.name === rank);
  const rankEmoji = rankObj ? rankObj.emoji : '🟢';
  const shortName = animal.name.replace(/\s*\([^)]+\)$/, '');
  return { rank, rankEmoji, shortName };
}

// Pokédex Collection ထဲသို့ ဖမ်းမိဖူးသော တိရစ္ဆာန်များ မှတ်တမ်းတင်ခြင်း
function syncCollection(user) {
  const set = new Set((user.collectedAnimals || []).filter((id) => VALID_ANIMAL_IDS.has(id)));
  for (const [name, rawCount] of Object.entries(user.zoo || {})) {
    if ((Number(rawCount) || 0) > 0 && ANIMAL_NAME_TO_ID.has(name)) {
      set.add(ANIMAL_NAME_TO_ID.get(name));
    }
  }
  const nextArr = Array.from(set);
  const changed =
    nextArr.length !== (user.collectedAnimals || []).length ||
    user.collectedCount !== nextArr.length;

  if (changed) {
    user.collectedAnimals = nextArr;
    user.collectedCount = nextArr.length;
    user.markModified('collectedAnimals');
  }
  return changed;
}

// Leaderboard (Ktop zoo) အမြန်ထွက်စေရန် Zoo တန်ဖိုးနှင့် အကောင်ရေ တွက်သိမ်းခြင်း
function syncZooStats(user) {
  let totalValue = 0;
  let totalCount = 0;

  for (const [name, rawCount] of Object.entries(user.zoo || {})) {
    const count = Number(rawCount) || 0;
    const price = ANIMAL_PRICE_MAP.get(name);
    if (count > 0 && price !== undefined) {
      totalCount += count;
      totalValue += price * count;
    }
  }

  user.zooValue = totalValue;
  user.zooCount = totalCount;
}

// ရောင်းလိုက်သော အကောင်များ လက်ကျန်မရှိတော့ပါက battleTeam ထဲမှ ဖယ်ရှားပေးခြင်း
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

module.exports = {
  RANKS,
  SHORT_RANK_LABELS,
  getAnimalMeta,
  syncCollection,
  syncZooStats,
  syncBattleTeam,
};