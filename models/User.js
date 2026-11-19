const mongoose = require('mongoose');

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
  items: { type: [String], default: [] },
  itemUses: { type: Object, default: {} },
  actions: { type: Object, default: {} },
  boxes: { type: Number, default: 0 },
  exp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
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

// EXP ပေါင်းပေးပြီး Level တက်/မတက် စစ်ဆေးပေးမည့် Function
function addExp(user, amount) {
  user.exp += amount;
  let leveledUp = false;
  let neededExp = user.level * 100;

  while (user.exp >= neededExp) {
    user.exp -= neededExp;
    user.level += 1;
    leveledUp = true;
    neededExp = user.level * 100;
  }
  return leveledUp;
}

module.exports = { User, getUser, addExp };