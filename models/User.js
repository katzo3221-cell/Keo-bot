const mongoose = require('mongoose');

const DAILY_PROFILE_EXP_LIMIT = 3000;

// မြန်မာစံတော်ချိန် (UTC+6:30) ယနေ့ရက်စွဲ
function getTodayMyanmarDate() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ကစားသမား အချက်အလက် ပုံစံ (Schema)
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, default: 'Unknown' },
  balance: { type: Number, default: 200 },
  lastDaily: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastWork: { type: Number, default: 0 },
  zoo: { type: Object, default: {} },
  battleTeam: { type: [String], default: [] },

  // လက်ရှိ တပ်ဆင်အသုံးပြုနေသော Item များ (တစ်မျိုးလျှင် ၁ ခုသာ) နှင့် ကျန်ရှိအကြိမ်ရေ
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

  // Kbattle Level & EXP (သီးခြားစနစ်)
  battleExp: { type: Number, default: 0 },
  battleLevel: { type: Number, default: 1 },
});

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

// Kbattle EXP ပေါင်းပေးခြင်း (Kprofile Level နှင့် လုံးဝမသက်ဆိုင်ပါ)
function addBattleExp(user, amount) {
  user.battleExp = (user.battleExp || 0) + amount;
  let leveledUp = false;
  let neededExp = (user.battleLevel || 1) * 100;

  while (user.battleExp >= neededExp) {
    user.battleExp -= neededExp;
    user.battleLevel = (user.battleLevel || 1) + 1;
    leveledUp = true;
    neededExp = user.battleLevel * 100;
  }
  return leveledUp;
}

module.exports = {
  User,
  getUser,
  addProfileExp,
  addBattleExp,
  DAILY_PROFILE_EXP_LIMIT,
};