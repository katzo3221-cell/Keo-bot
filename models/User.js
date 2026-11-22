const mongoose = require('mongoose');
const { getTodayMyanmarDate } = require('../utils/helpers');

const DAILY_PROFILE_EXP_LIMIT = 3000;
const DAILY_BATTLE_CRATE_LIMIT = 5;

// နေ့စဉ် Mission (Daily Quests) သတ်မှတ်ချက်များ
const DAILY_QUESTS_LIST = [
  {
    id: 'hunt',
    title: '🏹 အမဲ ၁၀ ကြိမ်လိုက်ပါ (Khunt)',
    target: 10,
    rewardCoins: 1500,
    rewardCrates: 1,
    rewardExp: 50,
  },
  {
    id: 'battleWin',
    title: '⚔️ တိုက်ပွဲ ၃ ပွဲ အနိုင်ရအောင်တိုက်ပါ (Kbattle)',
    target: 3,
    rewardCoins: 2000,
    rewardCrates: 1,
    rewardExp: 60,
  },
  {
    id: 'work',
    title: '💼 အလုပ် ၂ ကြိမ်လုပ်ပါ (Kwork)',
    target: 2,
    rewardCoins: 1000,
    rewardCrates: 0,
    rewardExp: 50,
  },
];

// ကစားသမား အချက်အလက် ပုံစံ (Schema)
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, default: 'Unknown' },
  balance: { type: Number, default: 200 },
  lastDaily: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastWork: { type: Number, default: 0 },
  zoo: { type: Object, default: {} },
  zooValue: { type: Number, default: 0 },
  zooCount: { type: Number, default: 0 },
  battleTeam: { type: [String], default: [] },

  // Marriage & Ring System
  rings: { type: Object, default: {} },
  marriedTo: { type: String, default: null },
  marriedToName: { type: String, default: null },
  marriedRing: { type: String, default: null },
  marriedAt: { type: Date, default: null },

  // Animal Collection (Pokédex)
  collectedAnimals: { type: [String], default: [] },
  collectedCount: { type: Number, default: 0 },

  // လက်ရှိ တပ်ဆင်အသုံးပြုနေသော Item များ နှင့် ကျန်ရှိအကြိမ်ရေ
  items: { type: [String], default: [] },
  itemUses: { type: Object, default: {} },
  // Drop မှ အပိုရထားပြီး အိတ်ထဲတွင် သိမ်းထားသော Item များ ({ itemId: count })
  storedItems: { type: Object, default: {} },

  dailyHuntItemCount: { type: Number, default: 0 },
  dailyHuntItemDate: { type: String, default: '' },
  huntCount: { type: Number, default: 0 },
  amvLocked: { type: Boolean, default: false },
  actions: { type: Object, default: {} },
  boxes: { type: Number, default: 0 }, // Lucky Crates (lc) အရေအတွက်

  // Kprofile Level & EXP (Daily Limit 3,000)
  exp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dailyProfileExpCount: { type: Number, default: 0 },
  dailyProfileExpDate: { type: String, default: '' },

  // Kbattle Level & EXP + Battle Crate နေ့စဉ် Limit
  battleExp: { type: Number, default: 0 },
  battleLevel: { type: Number, default: 1 },
  dailyBattleCrateCount: { type: Number, default: 0 },
  dailyBattleCrateDate: { type: String, default: '' },

  // Bot အသုံးပြုခွင့် ပိတ်ပင်ခြင်း (Admin Ban)
  isBanned: { type: Boolean, default: false },
  isHiddenTop: { type: Boolean, default: false },

  // Daily Quest စနစ်
  dailyQuestDate: { type: String, default: '' },
  dailyQuests: {
    type: Object,
    default: () => ({ hunt: 0, battleWin: 0, work: 0, claimed: [] }),
  },
});

// Leaderboard (Ktop) များ အမြန်ရှာနိုင်ရန် MongoDB Indexes
userSchema.index({ isBanned: 1, balance: -1 });
userSchema.index({ isBanned: 1, level: -1, exp: -1 });
userSchema.index({ isBanned: 1, battleLevel: -1, battleExp: -1 });
userSchema.index({ isBanned: 1, zooValue: -1, zooCount: -1 });
userSchema.index({ isBanned: 1, collectedCount: -1 });

const User = mongoose.model('User', userSchema);

// Database ထဲမှ User ရှာခြင်း (မရှိသေးရင် အသစ်ဆောက်ပေးမည်)
async function getUser(userId, username = 'Unknown') {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({ userId, username });
    await user.save();
  } else if (username !== 'Unknown' && user.username !== username) {
    user.username = username;
  }
  return user;
}

// နေ့စဉ် Quest ရက်စွဲစစ်၍ အသစ်ပြန်စပေးခြင်း
function ensureDailyQuests(user) {
  const todayStr = getTodayMyanmarDate();
  if (user.dailyQuestDate !== todayStr || !user.dailyQuests) {
    user.dailyQuestDate = todayStr;
    user.dailyQuests = { hunt: 0, battleWin: 0, work: 0, claimed: [] };
    user.markModified('dailyQuests');
  } else if (!Array.isArray(user.dailyQuests.claimed)) {
    user.dailyQuests.claimed = [];
    user.markModified('dailyQuests');
  }
}

// Quest အကြိမ်ရေ တိုးပေးခြင်း
function updateQuestProgress(user, questId, amount = 1) {
  ensureDailyQuests(user);
  user.dailyQuests[questId] = (user.dailyQuests[questId] || 0) + amount;
  user.markModified('dailyQuests');
}

// Kprofile Level တက်တိုင်း ရရှိမည့် Coins နှင့် Lucky Crate နှုန်းထား
function getProfileLevelReward(level) {
  let coins = 10000;
  if (level <= 2) coins = 10000;
  else if (level === 3) coins = 12500;
  else if (level === 4) coins = 15000;
  else if (level === 5) coins = 17500;
  else if (level === 6) coins = 20000;
  else if (level === 7) coins = 25000;
  else if (level === 8) coins = 30000;
  else if (level === 9) coins = 35000;
  else if (level === 10) coins = 40000;
  else coins = 40000 + (level - 10) * 5000;

  const crates = level % 5 === 0 ? 2 : 1;
  return { coins, crates };
}

// Kprofile EXP ပေါင်းပေးခြင်း (တစ်ရက် 3,000 Limit + Level တက်လျှင် Coins နှင့် Lucky Crate ပေးမည်)
function addProfileExp(user, amount) {
  const todayStr = getTodayMyanmarDate();
  if (user.dailyProfileExpDate !== todayStr) {
    user.dailyProfileExpDate = todayStr;
    user.dailyProfileExpCount = 0;
  }

  const remainingDaily = Math.max(0, DAILY_PROFILE_EXP_LIMIT - (user.dailyProfileExpCount || 0));
  const actualAdded = Math.min(amount, remainingDaily);
  const hitDailyLimit = actualAdded <= 0;

  if (actualAdded > 0) {
    user.exp = (user.exp || 0) + actualAdded;
    user.dailyProfileExpCount = (user.dailyProfileExpCount || 0) + actualAdded;
  }

  let leveledUp = false;
  let totalRewardCoins = 0;
  let totalRewardCrates = 0;
  let neededExp = (user.level || 1) * 150;

  while (user.exp >= neededExp) {
    user.exp -= neededExp;
    user.level = (user.level || 1) + 1;
    leveledUp = true;

    const reward = getProfileLevelReward(user.level);
    totalRewardCoins += reward.coins;
    totalRewardCrates += reward.crates;
    neededExp = user.level * 150;
  }

  let levelUpText = '';
  if (leveledUp) {
    user.balance = (user.balance || 0) + totalRewardCoins;
    user.boxes = (user.boxes || 0) + totalRewardCrates;
    levelUpText =
      `\n🎊 **PROFILE LEVEL UP!** သင်သည် **Profile Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!\n` +
      `🎁 Level ဆုလက်ဆောင်: **+${totalRewardCoins.toLocaleString()} coins** နှင့် **Lucky Crate (\`lc\`) +${totalRewardCrates} လုံး** ရရှိပါတယ်!`;
  }

  return {
    addedExp: actualAdded,
    hitDailyLimit,
    dailyTotal: user.dailyProfileExpCount,
    leveledUp,
    levelUpText,
  };
}

// Battle Level တက်တိုင်း ပေးမည့် ဆုလက်ဆောင် (Level * 1,000 coins + 5 Level တစ်ခါ Lucky Crate 1 လုံး)
function getBattleLevelReward(level) {
  const coins = Math.min(level * 1000, 50000);
  const crates = level % 5 === 0 ? 1 : 0;
  return { coins, crates };
}

// Battle EXP ပေါင်းပေးပြီး Level တက်ပါက ဆုလက်ဆောင်ပါ ထည့်ပေးမည့် Function (Part 3 တွင် သုံးမည်)
function addBattleExpReward(user, amount) {
  user.battleExp = (user.battleExp || 0) + amount;
  let leveledUp = false;
  let totalRewardCoins = 0;
  let totalRewardCrates = 0;
  let neededExp = (user.battleLevel || 1) * 100;

  while (user.battleExp >= neededExp) {
    user.battleExp -= neededExp;
    user.battleLevel = (user.battleLevel || 1) + 1;
    leveledUp = true;

    const reward = getBattleLevelReward(user.battleLevel);
    totalRewardCoins += reward.coins;
    totalRewardCrates += reward.crates;
    neededExp = user.battleLevel * 100;
  }

  let levelUpText = '';
  if (leveledUp) {
    user.balance = (user.balance || 0) + totalRewardCoins;
    user.boxes = (user.boxes || 0) + totalRewardCrates;
    const crateNote = totalRewardCrates > 0 ? ` နှင့် **Lucky Crate (\`lc\`) +${totalRewardCrates} လုံး**` : '';
    levelUpText =
      `\n🔥 **BATTLE LEVEL UP!** **Battle Level ${user.battleLevel}** သို့ ရောက်ရှိသွားပါပြီ! ` +
      `(ဆု: **+${totalRewardCoins.toLocaleString()} coins**${crateNote})`;
  }

  return {
    leveledUp,
    rewardCoins: totalRewardCoins,
    rewardCrates: totalRewardCrates,
    levelUpText,
  };
}

// Battle မှ Lucky Crate Drop စစ်ဆေးခြင်း (တစ်ရက် အများဆုံး ၅ လုံး Limit)
function tryDropBattleCrate(user, chance) {
  const todayStr = getTodayMyanmarDate();
  if (user.dailyBattleCrateDate !== todayStr) {
    user.dailyBattleCrateDate = todayStr;
    user.dailyBattleCrateCount = 0;
  }

  if (user.dailyBattleCrateCount >= DAILY_BATTLE_CRATE_LIMIT) {
    return { dropped: false, limitReached: true, dailyCount: user.dailyBattleCrateCount };
  }

  if (Math.random() < chance) {
    user.boxes = (user.boxes || 0) + 1;
    user.dailyBattleCrateCount += 1;
    return { dropped: true, limitReached: false, dailyCount: user.dailyBattleCrateCount };
  }

  return { dropped: false, limitReached: false, dailyCount: user.dailyBattleCrateCount };
}

// ယခင် battle.js နှင့် တွဲဖက်အလုပ်လုပ်နိုင်ရန် ချန်ထားသော Function
function addBattleExp(user, amount) {
  return addBattleExpReward(user, amount).leveledUp;
}

module.exports = {
  User,
  getUser,
  addProfileExp,
  addBattleExp,
  addBattleExpReward,
  tryDropBattleCrate,
  ensureDailyQuests,
  updateQuestProgress,
  DAILY_PROFILE_EXP_LIMIT,
  DAILY_BATTLE_CRATE_LIMIT,
  DAILY_QUESTS_LIST,
};