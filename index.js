require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Anti-Spam Cooldown Map & Active Games
const cooldowns = new Map();
const activeBlackjack = new Set();

// MongoDB Cloud Database ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Database ချိတ်ဆက်မှု အောင်မြင်ပါသည်!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// ကစားသမား အချက်အလက် ပုံစံ (Schema)
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, default: 'Unknown' },
  balance: { type: Number, default: 200 },
  lastDaily: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastWork: { type: Number, default: 0 },
  zoo: { type: Object, default: {} },
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

// အမဲလိုက်လျှင် ရနိုင်သော တိရစ္ဆာန် ၃၀ မျိုး (စုစုပေါင်း chance = 100%)
const ANIMALS = [
  // 🟢 Common (စုစုပေါင်း 50%)
  { name: 'ပုရွက်ဆိတ် (Common)', emoji: '🐜', price: 5, chance: 10 },
  { name: 'ပိုးတောင်မာ (Common)', emoji: '🪲', price: 8, chance: 9 },
  { name: 'ဖားကလေး (Common)', emoji: '🐸', price: 10, chance: 8 },
  { name: 'ကြွက်ဖြူလေး (Common)', emoji: '🐭', price: 12, chance: 8 },
  { name: 'ကြက်ကလေး (Common)', emoji: '🐤', price: 15, chance: 8 },
  { name: 'ဘဲကလေး (Common)', emoji: '🦆', price: 18, chance: 7 },

  // 🔵 Uncommon (စုစုပေါင်း 28%)
  { name: 'ယုန်ဖြူလေး (Uncommon)', emoji: '🐇', price: 25, chance: 6 },
  { name: 'ရှဉ့်ကလေး (Uncommon)', emoji: '🐿️', price: 30, chance: 5 },
  { name: 'ဖြူကောင် (Uncommon)', emoji: '🦔', price: 35, chance: 5 },
  { name: 'လိပ်ကလေး (Uncommon)', emoji: '🐢', price: 40, chance: 4 },
  { name: 'ခိုဖြူလေး (Uncommon)', emoji: '🕊️', price: 45, chance: 4 },
  { name: 'ကြောင်ကလေး (Uncommon)', emoji: '🐱', price: 50, chance: 4 },

  // 🟣 Rare (စုစုပေါင်း 14%)
  { name: 'မြေခွေး (Rare)', emoji: '🦊', price: 70, chance: 3 },
  { name: 'ရက်ကွန်း (Rare)', emoji: '🦝', price: 85, chance: 3 },
  { name: 'ဇီးကွက် (Rare)', emoji: '🦉', price: 100, chance: 2.5 },
  { name: 'သမင် (Rare)', emoji: '🦌', price: 120, chance: 2 },
  { name: 'ဝံပုလွေ (Rare)', emoji: '🐺', price: 150, chance: 2 },
  { name: 'တောဝက် (Rare)', emoji: '🐗', price: 180, chance: 1.5 },

  // 🟠 Epic (စုစုပေါင်း 6.5%)
  { name: 'သိမ်းငှက် (Epic)', emoji: '🦅', price: 2500, chance: 1.5 },
  { name: 'မိကျောင်း (Epic)', emoji: '🐊', price: 3000, chance: 1.2 },
  { name: 'ဝက်ဝံညို (Epic)', emoji: '🐻', price: 3500, chance: 1.1 },
  { name: 'ပန်ဒါဝက်ဝံ (Epic)', emoji: '🐼', price: 4200, chance: 1 },
  { name: 'ကျားသစ် (Epic)', emoji: '🐆', price: 5000, chance: 0.9 },
  { name: 'ဂေါ်ရီလာ (Epic)', emoji: '🦍', price: 6000, chance: 0.8 },

  // 🔴 Legendary & Mythical (စုစုပေါင်း 1.5%)
  { name: 'ခြင်္သေ့မင်း (Legendary)', emoji: '🦁', price: 8000, chance: 0.5 },
  { name: 'ကျားရဲ (Legendary)', emoji: '🐅', price: 10000, chance: 0.4 },
  { name: 'ဆင်ပြောင်ကြီး (Legendary)', emoji: '🐘', price: 13000, chance: 0.3 },
  { name: 'ကြံ့သူတော် (Legendary)', emoji: '🦏', price: 16000, chance: 0.15 },
  { name: 'ယူနီကွန်း (Mythical)', emoji: '🦄', price: 25000, chance: 0.1 },
  { name: 'နဂါးမင်း (Mythical)', emoji: '🐉', price: 50000, chance: 0.05 },
];

// ဆိုင်တွင် ဝယ်ယူနိုင်သော ပစ္စည်းများ (အကြိမ်ရေ Limit ပါဝင်သည်)
const SHOP_ITEMS = [
  { id: 'bow', name: 'လေးနှင့်မြား (Hunting Bow)', price: 500, luckBonus: 5, powerBonus: 0, maxUses: 15, category: 'hunt', desc: 'အမဲလိုက်လျှင် ရှားပါးကောင် မိနိုင်ခြေ +5% တိုးပေးသည် (၁၅ ကြိမ်သုံး)' },
  { id: 'rifle', name: 'အမဲလိုက်သေနတ် (Hunting Rifle)', price: 2000, luckBonus: 12, powerBonus: 0, maxUses: 25, category: 'hunt', desc: 'အမဲလိုက်လျှင် ရှားပါးကောင် မိနိုင်ခြေ +12% တိုးပေးသည် (၂၅ ကြိမ်သုံး)' },
  { id: 'charm', name: 'နဂါးအဆောင် (Dragon Charm)', price: 5000, luckBonus: 25, powerBonus: 0, maxUses: 40, category: 'hunt', desc: 'အမဲလိုက်လျှင် ရှားပါးကောင် မိနိုင်ခြေ +25% အထိ တိုးပေးသည် (၄၀ ကြိမ်သုံး)' },
  { id: 'net', name: 'အမဲလိုက်ပိုက်ကွန် (Hunting Net)', price: 3000, luckBonus: 0, powerBonus: 0, maxUses: 20, category: 'hunt', desc: 'အမဲလိုက်လျှင် ဖမ်းမိမည့် အကောင်ရေ +1 ကောင် ပိုတိုးပေးသည် (၂၀ ကြိမ်သုံး)' },
  { id: 'cage', name: 'အမဲလိုက်လှောင်အိမ်ကြီး (Mega Cage)', price: 10000, luckBonus: 0, powerBonus: 0, maxUses: 15, category: 'hunt', desc: 'အမဲလိုက်လျှင် ဖမ်းမိမည့် အကောင်ရေ 2x နှစ်ဆ တိုးပေးသည် (၁၅ ကြိမ်သုံး)' },
  { id: 'sword', name: 'သံမဏိဓား (Iron Sword)', price: 1500, luckBonus: 0, powerBonus: 150, maxUses: 15, category: 'battle', desc: 'တိုက်ပွဲဝင်လျှင် Battle Power +150 တိုးပေးသည် (၁၅ ကြိမ်သုံး)' },
  { id: 'shield', name: 'နဂါးဒိုင်းကာ (Dragon Shield)', price: 4000, luckBonus: 0, powerBonus: 350, maxUses: 20, category: 'battle', desc: 'တိုက်ပွဲဝင်လျှင် Battle Power +350 တိုးပေးသည် (၂၀ ကြိမ်သုံး)' },
  { id: 'box', name: 'လျှို့ဝှက်သေတ္တာ (Mystery Box)', price: 1000, luckBonus: 0, powerBonus: 0, isConsumable: true, desc: 'Kopen ဖြင့် ဖွင့်ပြီး Coins, EXP နှင့် ရှားပါးကောင်များ ဖောက်ယူနိုင်သည်' },
];

// Action Command ၂၂ မျိုးလုံး အချက်အလက် (OwO Style)
const ACTIONS = {
  cuddle: { nekos: 'cuddle', waifu: 'cuddle', title: '💞 ချစ်ခင်စွာ ပွေ့ဖက်လိုက်ပါပြီ!', actionText: 'ကို ရင်ခွင်ထဲ ထည့်ပြီး ပွေ့ဖက်ထားပါတယ်!', countLabel: 'ပွေ့ဖက်ပြီးပါပြီ 🌸', color: '#FF85A2', fallbackGif: 'https://nekos.best/api/v2/cuddle/001.gif' },
  hug: { nekos: 'hug', waifu: 'hug', title: '🤗 နွေးထွေးစွာ ဖက်လိုက်ပါပြီ!', actionText: 'ကို တင်းတင်းကျပ်ကျပ် ဖက်လိုက်ပါတယ်!', countLabel: 'ဖက်ပြီးပါပြီ ❤️', color: '#FF69B4', fallbackGif: 'https://nekos.best/api/v2/hug/001.gif' },
  kiss: { nekos: 'kiss', waifu: 'kiss', title: '😘 ချစ်စနိုးနဲ့ နမ်းလိုက်ပါပြီ!', actionText: 'ကို ကြင်ကြင်နာနာ နမ်းလိုက်ပါတယ်!', countLabel: 'နမ်းပြီးပါပြီ 💕', color: '#E91E63', fallbackGif: 'https://nekos.best/api/v2/kiss/001.gif' },
  lick: { waifu: 'lick', title: '👅 လျှာနဲ့ လျက်လိုက်ပါပြီ!', actionText: 'ကို ရုတ်တရက် လျှာနဲ့ လျက်လိုက်ပါတယ်!', countLabel: 'လျက်ပြီးပါပြီ 😋', color: '#FF7043', fallbackGif: 'https://nekos.best/api/v2/nom/001.gif' },
  nom: { nekos: 'nom', waifu: 'nom', title: '🍪 အားရပါးရ ကိုက်စားလိုက်ပါပြီ!', actionText: 'ကို မုန့်လေးလို ငုံပြီး ကိုက်လိုက်ပါတယ်!', countLabel: 'ကိုက်စားပြီးပါပြီ 🍩', color: '#FFA726', fallbackGif: 'https://nekos.best/api/v2/nom/001.gif' },
  pat: { nekos: 'pat', waifu: 'pat', title: '🥰 ခေါင်းလေး ပုတ်ပေးလိုက်ပါပြီ!', actionText: 'ရဲ့ ခေါင်းလေးကို ချစ်စနိုးနဲ့ ပုတ်ပေးလိုက်ပါတယ်!', countLabel: 'ခေါင်းပုတ်ပြီးပါပြီ ✨', color: '#F1C40F', fallbackGif: 'https://nekos.best/api/v2/pat/001.gif' },
  pats: { nekos: 'pat', waifu: 'pat', title: '🥰 ခေါင်းလေး ပုတ်ပေးလိုက်ပါပြီ!', actionText: 'ရဲ့ ခေါင်းလေးကို ညင်ညင်သာသာ ပုတ်ပေးလိုက်ပါတယ်!', countLabel: 'ခေါင်းပုတ်ပြီးပါပြီ ✨', color: '#F1C40F', fallbackGif: 'https://nekos.best/api/v2/pat/001.gif' },
  poke: { nekos: 'poke', waifu: 'poke', title: '👉 စနောက်ပြီး တို့လိုက်ပါပြီ!', actionText: 'ကို စချင်လို့ လက်ညှိုးနဲ့ တို့လိုက်ပါတယ်!', countLabel: 'တို့ပြီးပါပြီ 👀', color: '#3498DB', fallbackGif: 'https://nekos.best/api/v2/poke/001.gif' },
  slap: { nekos: 'slap', waifu: 'slap', title: '🖐️ ဖြန်းခနဲ ပါးရိုက်လိုက်ပါပြီ!', actionText: 'ကို အားရပါးရ ပါးရိုက်ချလိုက်ပါတယ်!', countLabel: 'ပါးရိုက်ပြီးပါပြီ 💥', color: '#E74C3C', fallbackGif: 'https://nekos.best/api/v2/slap/001.gif' },
  stare: { nekos: 'stare', title: '👀 စူးစူးစိုက်စိုက် စိုက်ကြည့်နေပါပြီ!', actionText: 'ကို မျက်တောင်မခတ်ဘဲ စိုက်ကြည့်နေပါတယ်!', countLabel: 'စိုက်ကြည့်ပြီးပါပြီ 👁️', color: '#9B59B6', fallbackGif: 'https://nekos.best/api/v2/stare/001.gif' },
  highfive: { nekos: 'highfive', waifu: 'highfive', title: '🙌 လက်ဝါးချင်း ရိုက်လိုက်ပါပြီ!', actionText: 'နဲ့ အားရပါးရ High-Five လုပ်လိုက်ပါတယ်!', countLabel: 'High-Five လုပ်ပြီးပါပြီ ⭐', color: '#2ECC71', fallbackGif: 'https://nekos.best/api/v2/highfive/001.gif' },
  bite: { nekos: 'bite', waifu: 'bite', title: '😬 ဂျွတ်ခနဲ ကိုက်ချလိုက်ပါပြီ!', actionText: 'ကို နာနာလေး ကိုက်ချလိုက်ပါတယ်!', countLabel: 'ကိုက်ပြီးပါပြီ 🦷', color: '#E67E22', fallbackGif: 'https://nekos.best/api/v2/bite/001.gif' },
  greet: { nekos: 'wave', waifu: 'wave', title: '👋 ဝမ်းသာအားရ နှုတ်ဆက်လိုက်ပါပြီ!', actionText: 'ကို လက်ပြပြီး နှုတ်ဆက်လိုက်ပါတယ်!', countLabel: 'နှုတ်ဆက်ပြီးပါပြီ 😊', color: '#1ABC9C', fallbackGif: 'https://nekos.best/api/v2/wave/001.gif' },
  punch: { nekos: 'punch', title: '👊 ပြင်းပြင်းထန်ထန် ထိုးချလိုက်ပါပြီ!', actionText: 'ကို လက်သီးနဲ့ ပစ်ထိုးလိုက်ပါတယ်!', countLabel: 'ထိုးပြီးပါပြီ 🔥', color: '#C0392B', fallbackGif: 'https://nekos.best/api/v2/punch/001.gif' },
  handholding: { nekos: 'handhold', waifu: 'handhold', title: '🤝 လက်ကလေး ကိုင်ထားလိုက်ပါပြီ!', actionText: 'ရဲ့ လက်ကလေးကို နွေးနွေးထွေးထွေး ကိုင်ထားလိုက်ပါတယ်!', countLabel: 'လက်ကိုင်ပြီးပါပြီ 💖', color: '#FF80AB', fallbackGif: 'https://nekos.best/api/v2/handhold/001.gif' },
  tickle: { nekos: 'tickle', title: '🤣 ကလိထိုးလိုက်ပါပြီ!', actionText: 'ကို ရယ်မောသွားအောင် ကလိထိုးလိုက်ပါတယ်!', countLabel: 'ကလိထိုးပြီးပါပြီ 😆', color: '#FFCA28', fallbackGif: 'https://nekos.best/api/v2/tickle/001.gif' },
  kill: { waifu: 'kill', nekos: 'shoot', title: '💀 အပြတ်ရှင်းပစ်လိုက်ပါပြီ!', actionText: 'ကို ဂိမ်းထဲမှာ အပြတ်ရှင်းပစ်လိုက်ပါတယ်!', countLabel: 'ရှင်းပစ်ပြီးပါပြီ ⚔️', color: '#2C3E50', fallbackGif: 'https://nekos.best/api/v2/shoot/001.gif' },
  hold: { nekos: 'handhold', waifu: 'cuddle', title: '🫂 တင်းတင်းကျပ်ကျပ် ဖက်တွယ်ထားပါပြီ!', actionText: 'ကို မလွတ်တမ်း ဖက်တွယ်ထားလိုက်ပါတယ်!', countLabel: 'ဖက်တွယ်ပြီးပါပြီ 💗', color: '#F06292', fallbackGif: 'https://nekos.best/api/v2/cuddle/001.gif' },
  wave: { nekos: 'wave', waifu: 'wave', title: '👋 လက်ဝှေ့ယမ်းပြလိုက်ပါပြီ!', actionText: 'ဆီကို လက်ဝှေ့ယမ်းပြလိုက်ပါတယ်!', countLabel: 'လက်ပြပြီးပါပြီ 🌟', color: '#29B6F6', fallbackGif: 'https://nekos.best/api/v2/wave/001.gif' },
  boop: { nekos: 'poke', waifu: 'poke', title: '👃 နှာခေါင်းလေးကို တို့လိုက်ပါပြီ!', actionText: 'ရဲ့ နှာခေါင်းလေးကို ချစ်စနိုးနဲ့ Boop လုပ်လိုက်ပါတယ်!', countLabel: 'Boop လုပ်ပြီးပါပြီ 🐾', color: '#AB47BC', fallbackGif: 'https://nekos.best/api/v2/poke/001.gif' },
  snuggle: { nekos: 'cuddle', waifu: 'glomp', title: '🧸 ချစ်စဖွယ် တိုးဝှေ့ဖက်လိုက်ပါပြီ!', actionText: 'နားကို တိုးဝှေ့ပြီး ချစ်ခင်စွာ ဖက်လိုက်ပါတယ်!', countLabel: 'တိုးဝှေ့ဖက်ပြီးပါပြီ 💓', color: '#EC407A', fallbackGif: 'https://nekos.best/api/v2/cuddle/001.gif' },
  bully: { waifu: 'bully', nekos: 'smug', title: '😈 အနိုင်ကျင့် စနောက်လိုက်ပါပြီ!', actionText: 'ကို ဆိုးဆိုးဝါးဝါး စနောက်အနိုင်ကျင့်လိုက်ပါတယ်!', countLabel: 'အနိုင်ကျင့်ပြီးပါပြီ 😜', color: '#8E44AD', fallbackGif: 'https://nekos.best/api/v2/smug/001.gif' },
};

// ပစ္စည်းတစ်ခုချင်းစီ၏ အသုံးပြုခွင့် အကြိမ်ရေကို ၁ ကြိမ်စီ လျှော့ချပေးမည့် Function
function useCategoryItems(user, category) {
  if (!user.items || user.items.length === 0) return '';
  if (!user.itemUses) user.itemUses = {};

  let brokenMessages = [];
  const activeItems = [...user.items];

  for (const itemId of activeItems) {
    const itemInfo = SHOP_ITEMS.find((i) => i.id === itemId && i.category === category);
    if (!itemInfo || !itemInfo.maxUses) continue;

    const currentUses = user.itemUses[itemId] !== undefined ? user.itemUses[itemId] : itemInfo.maxUses;
    const remaining = currentUses - 1;

    if (remaining <= 0) {
      user.items = user.items.filter((id) => id !== itemId);
      delete user.itemUses[itemId];
      brokenMessages.push(`⚠️ သင်၏ **${itemInfo.name}** အသုံးပြုခွင့် ပြည့်သွား၍ ပျက်စီးသွားပါပြီ!`);
    } else {
      user.itemUses[itemId] = remaining;
    }
  }

  user.markModified('itemUses');
  return brokenMessages.length > 0 ? `\n${brokenMessages.join('\n')}` : '';
}

// တိရစ္ဆာန်အဖွဲ့ (Top 3) နှင့် ပစ္စည်း Power တွက်ချက်ပေးမည့် Helper Function
function getBattleStats(userObj) {
  const entries = Object.entries(userObj.zoo || {});
  let team = [];
  for (const [name, count] of entries) {
    const info = ANIMALS.find((a) => a.name === name);
    if (info) {
      for (let i = 0; i < count; i++) {
        team.push(info);
      }
    }
  }
  team.sort((a, b) => b.price - a.price);
  team = team.slice(0, 3);

  let itemPower = 0;
  for (const itemId of userObj.items || []) {
    const itemInfo = SHOP_ITEMS.find((i) => i.id === itemId);
    if (itemInfo && itemInfo.powerBonus) {
      itemPower += itemInfo.powerBonus;
    }
  }

  const basePower = team.reduce((sum, a) => sum + a.price, 0);
  const levelBonus = (userObj.level || 1) * 25;
  const totalPower = basePower + levelBonus + itemPower + Math.floor(Math.random() * 200);

  return { team, totalPower, itemPower };
}

client.once('clientReady', () => {
  console.log(`${client.user.tag} အနေဖြင့် Keo Bot စနစ်အပြည့်အစုံ စတင်ပါပြီ!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.toLowerCase().startsWith('k')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const validCommands = [
    'cash', 'bal', 'daily', 'work', 'give', 'top', 'lb',
    'hunt', 'h', 'zoo', 'z', 'sellall', 'cf', 'coinflip',
    's', 'slots', 'shop', 'buy', 'box', 'open', 'help',
    'battle', 'b', 'd', 'dice', 'profile', 'lvl', 'level',
    'obj', 'item', 'use', 'inv', 'inventory', 'reset', 'clear',
    'bj', 'blackjack',
    'cuddle', 'hug', 'kiss', 'lick', 'nom', 'pat', 'poke', 'slap',
    'stare', 'highfive', 'bite', 'greet', 'punch',
    'handholding', 'tickle', 'kill', 'hold', 'pats', 'wave',
    'boop', 'snuggle', 'bully',
  ];
  if (!validCommands.includes(command)) return;

  // Anti-Spam Cooldown စစ်ဆေးခြင်း (၅ စက္ကန့် - အကြိမ်အရေအတွက်အလိုက် စာသားပြောင်းမည်)
  const nowTime = Date.now();
  const cooldownAmount = 5000;

  if (cooldowns.has(message.author.id)) {
    const userData = cooldowns.get(message.author.id);
    const expirationTime = userData.timestamp + cooldownAmount;

    if (nowTime < expirationTime) {
      userData.spamCount += 1;
      const timeLeft = ((expirationTime - nowTime) / 1000).toFixed(1);

      if (userData.spamCount === 1) {
        return message.reply(`⏳ ဖြည်းဖြည်းရိုက်ပါခင်ဗျာ! နောက်ထပ် **${timeLeft} စက္ကန့်** စောင့်ပြီးမှ ပြန်ရိုက်ပါ။`);
      } else if (userData.spamCount === 2) {
        return message.reply('သေချင်းဆိုး ဖြည်းဖြည်းရိုက်ဟ');
      } else {
        return message.reply('သေချင်းဆိုး နားလေးနေလား');
      }
    }
    clearTimeout(userData.timeoutId);
  }

  const timeoutId = setTimeout(() => cooldowns.delete(message.author.id), cooldownAmount);
  cooldowns.set(message.author.id, { timestamp: nowTime, spamCount: 0, timeoutId });

  try {
    const user = await getUser(message.author.id, message.author.username);

    // ၁။ လက်ကျန်ငွေ စစ်ဆေးခြင်း (Kcash / Kbal)
    if (command === 'cash' || command === 'bal') {
      await user.save();
      const cashEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ name: `${message.author.username} ၏ ပိုက်ဆံအိတ်`, iconURL: message.author.displayAvatarURL() })
        .setDescription(
          `💰 လက်ကျန်ငွေ: **${user.balance.toLocaleString()} coins**\n` +
          `🎁 Mystery Boxes: **${user.boxes || 0} လုံး**`
        )
        .setTimestamp();

      return message.reply({ embeds: [cashEmbed] });
    }

    // ၂။ နေ့စဉ် အခမဲ့ငွေ ထုတ်ယူခြင်း (Kdaily - Level, EXP & Streak Bonus, Max 10,000)
    if (command === 'daily') {
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;

      if (now - user.lastDaily < cooldown) {
        const remaining = cooldown - (now - user.lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`⏳ နေ့စဉ်ဆုကြေး ထုတ်ပြီးသား ဖြစ်ပါတယ်။ နောက်ထပ် **${hours} နာရီ ${minutes} မိနစ်** နေမှ ပြန်ထုတ်နိုင်ပါမယ်။`);
      }

      if (user.lastDaily > 0 && now - user.lastDaily <= 48 * 60 * 60 * 1000) {
        user.dailyStreak = (user.dailyStreak || 0) + 1;
      } else {
        user.dailyStreak = 1;
      }

      const MAX_DAILY = 10000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const baseReward = 500;
      const levelBonus = (currentLevel - 1) * 200;
      const expBonus = Math.floor(currentExp * 0.5);
      const streakBonus = (user.dailyStreak - 1) * 100;
      const reward = Math.min(baseReward + levelBonus + expBonus + streakBonus, MAX_DAILY);

      let boxBonusText = '';
      if (user.dailyStreak % 3 === 0) {
        user.boxes = (user.boxes || 0) + 1;
        boxBonusText = `\n🎁 **${user.dailyStreak} ရက်ဆက် Streak ဆု:** **Mystery Box +1** အပိုရရှိပါတယ်! (\`Kopen\` ဖြင့်ဖွင့်ပါ)`;
      }

      user.balance += reward;
      user.lastDaily = now;
      await user.save();

      const maxNote = reward >= MAX_DAILY ? ' *(MAX)*' : '';
      return message.reply(
        `🎁 **Lv.${currentLevel}** | 🔥 Streak: **${user.dailyStreak} ရက်** — နေ့စဉ်ဆုကြေး **${reward.toLocaleString()} coins**${maxNote} ရရှိပါပြီ!` +
        `${boxBonusText}\n💰 လက်ကျန်ငွေ: **${user.balance.toLocaleString()} coins**`
      );
    }

    // ၃။ အလုပ်လုပ်ပြီး ပိုက်ဆံရှာခြင်း (Kwork - Level & EXP Bonus, Max 3,000)
    if (command === 'work') {
      const now = Date.now();
      const cooldown = 30 * 60 * 1000;

      if (now - user.lastWork < cooldown) {
        const remaining = cooldown - (now - user.lastWork);
        const minutes = Math.ceil(remaining / (1000 * 60));
        return message.reply(`😓 အလုပ်လုပ်ထားတာ မောနေပါပြီ။ နောက်ထပ် **${minutes} မိနစ်** နေမှ ပြန်လုပ်နိုင်ပါမယ်။`);
      }

      const MAX_WORK = 3000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const jobs = ['ပီဇာပို့ခြင်း', 'ကားရေဆေးခြင်း', 'Coding ရေးပေးခြင်း', 'ကော်ဖီဖျော်ခြင်း', 'Delivery ပို့ခြင်း'];
      const job = jobs[Math.floor(Math.random() * jobs.length)];

      const baseEarned = Math.floor(Math.random() * 151) + 50;
      const levelBonus = (currentLevel - 1) * 60;
      const expBonus = Math.floor(currentExp * 0.15);
      const earned = Math.min(baseEarned + levelBonus + expBonus, MAX_WORK);

      user.balance += earned;
      user.lastWork = now;
      await user.save();

      const maxNote = earned >= MAX_WORK ? ' *(MAX)*' : '';
      return message.reply(
        `💼 **Lv.${currentLevel}** — သင်သည် **${job}** ဖြင့် လုပ်အားခ **${earned.toLocaleString()} coins**${maxNote} ရရှိခဲ့ပါတယ်!\n` +
        `💰 လက်ကျန်ငွေ: **${user.balance.toLocaleString()} coins**`
      );
    }

    // ၄။ သူငယ်ချင်းဆီ ပိုက်ဆံလွှဲပေးခြင်း (Kgive @user 100)
    if (command === 'give') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!target || target.bot) {
        return message.reply('❌ ပိုက်ဆံလွှဲပေးမယ့် သူကို Mention ခေါ်ပါ။ (ဥပမာ - `Kgive @User 100`)');
      }
      if (target.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်လွှဲလို့ မရပါဘူး။');
      }
      if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ လွှဲမယ့် ပမာဏ မှန်ကန်စွာ ထည့်ပါ။');
      }
      if (amount > user.balance) {
        return message.reply(`❌ လက်ကျန်ငွေ မလုံလောက်ပါ! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`);
      }

      const targetUser = await getUser(target.id, target.username);
      user.balance -= amount;
      targetUser.balance += amount;
      await user.save();
      await targetUser.save();

      return message.reply(`💸 **${message.author.username}** က **${target.username}** ထံသို့ **${amount.toLocaleString()} coins** လွှဲပေးလိုက်ပါပြီ!`);
    }

    // ၅။ အချမ်းသာဆုံးစာရင်း (Ktop / Klb)
    if (command === 'top' || command === 'lb') {
      const sorted = await User.find().sort({ balance: -1 }).limit(5);
      if (sorted.length === 0) return message.reply('စာရင်း မရှိသေးပါ။');

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const leaderboard = sorted
        .map((u, index) => `${medals[index]} **${u.username}** (Lv.${u.level}) — 💰 **${u.balance.toLocaleString()} coins**`)
        .join('\n');

      const topEmbed = new EmbedBuilder()
        .setColor('#FF4500')
        .setTitle('🏆 အချမ်းသာဆုံး ကစားသမားများ (Top 5)')
        .setDescription(leaderboard)
        .setFooter({ text: 'အလုပ်လုပ်ပြီး ပိုက်ဆံရှာရန် Kwork ကို ရိုက်ပါ' })
        .setTimestamp();

      return message.reply({ embeds: [topEmbed] });
    }

    // ၆။ အမဲလိုက်ခြင်း (Khunt / Kh)
    if (command === 'hunt' || command === 'h') {
      const cost = 10;
      if (user.balance < cost) {
        return message.reply(`❌ အမဲလိုက်ဖို့ ကျည်ဆန်ဖိုး **${cost} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= cost;

      let totalLuck = 0;
      for (const itemId of user.items || []) {
        const itemInfo = SHOP_ITEMS.find((i) => i.id === itemId);
        if (itemInfo && itemInfo.luckBonus) {
          totalLuck += itemInfo.luckBonus;
        }
      }

      let catchCount = 1;
      if ((user.items || []).includes('net')) catchCount += 1;
      if ((user.items || []).includes('cage')) catchCount *= 2;

      if (!user.zoo) user.zoo = {};
      const caughtSummary = {};

      for (let i = 0; i < catchCount; i++) {
        let roll = Math.random() * 100 + totalLuck;
        if (roll > 100) roll = 100;
        let cumulative = 0;
        let caught = ANIMALS[0];

        for (const animal of ANIMALS) {
          cumulative += animal.chance;
          if (roll <= cumulative) {
            caught = animal;
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
        `🏹 သင်သည် တောထဲသို့ အမဲလိုက်ထွက်ရာ... ${caughtListText} ဖမ်းမိခဲ့ပါတယ်! ` +
        `(ကျန်ငွေ: **${user.balance.toLocaleString()} coins**)${foundBoxText}${brokenItemText}`
      );
    }

    // ၇။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (Kzoo / Kz)
    if (command === 'zoo' || command === 'z') {
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
    }

    // ၈။ တိရစ္ဆာန်အားလုံး ပြန်ရောင်းခြင်း (Ksellall)
    if (command === 'sellall') {
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

      return message.reply(`💵 ဖမ်းထားသော တိရစ္ဆာန်အားလုံးကို ရောင်းချလိုက်ရာ **+${totalEarned.toLocaleString()} coins** ရရှိပါပြီ! စုစုပေါင်း လက်ကျန်: **${user.balance.toLocaleString()} coins**`);
    }

    // ၉။ Coinflip ကစားခြင်း (Kcf / Kcoinflip - 'all' Max 250,000)
    if (command === 'cf' || command === 'coinflip') {
      const MAX_BET = 250000;
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kcf 100` သို့မဟုတ် `Kcf all`)');
      }
      if (bet > user.balance) {
        return message.reply(`❌ လက်ကျန်ငွေ မလုံလောက်ပါ! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`);
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      let choice = 'heads';
      if (args[1] && (args[1].toLowerCase() === 't' || args[1].toLowerCase() === 'tails')) {
        choice = 'tails';
      }

      const choiceText = choice === 'heads' ? 'ခေါင်း (Heads)' : 'ပန်း (Tails)';
      const msg = await message.reply(`🪙 **${choiceText}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး အကြွေစေ့ မြှောက်လိုက်ပါပြီ...\n🔄 *အကြွေစေ့ လည်နေပါသည်...*`);

      await sleep(1200);

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const resultText = result === 'heads' ? '👑 ခေါင်း (Heads)' : '🌸 ပန်း (Tails)';

      if (choice === result) {
        user.balance += bet;
        await user.save();
        return msg.edit(`🪙 အကြွေစေ့ ကျသွားပါပြီ — **${resultText}**!\n🎉 **နိုင်ပါတယ်!** **+${bet.toLocaleString()} coins** ရရှိပြီး စုစုပေါင်း **${user.balance.toLocaleString()} coins** ရှိသွားပါပြီ။`);
      } else {
        user.balance -= bet;
        await user.save();
        return msg.edit(`🪙 အကြွေစေ့ ကျသွားပါပြီ — **${resultText}**!\n😢 **ရှုံးသွားပါတယ်!** **-${bet.toLocaleString()} coins** ဆုံးရှုံးပြီး လက်ကျန် **${user.balance.toLocaleString()} coins** သာ ကျန်ပါတော့တယ်။`);
      }
    }

    // ၁၀။ Slots ကစားခြင်း (Ks / Kslots - 'all' Max 250,000)
    if (command === 's' || command === 'slots') {
      const MAX_BET = 250000;
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kslots 100` သို့မဟုတ် `Kslots all`)');
      }
      if (bet > user.balance) {
        return message.reply(`❌ လက်ကျန်ငွေ မလုံလောက်ပါ! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`);
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const items = ['🍒', '🍋', '🍇', '🍉', '🔔', '💎', '7️⃣'];
      const spinEmoji = '🔄';

      const slot1 = items[Math.floor(Math.random() * items.length)];
      const slot2 = items[Math.floor(Math.random() * items.length)];
      const slot3 = items[Math.floor(Math.random() * items.length)];

      const msg = await message.reply(`🎰 **[ ${spinEmoji} | ${spinEmoji} | ${spinEmoji} ]** 🎰\n*Slot စက်လှည့်နေပါသည်...*`);

      await sleep(700);
      await msg.edit(`🎰 **[ ${slot1} | ${spinEmoji} | ${spinEmoji} ]** 🎰\n*Slot စက်လှည့်နေပါသည်...*`);

      await sleep(700);
      await msg.edit(`🎰 **[ ${slot1} | ${slot2} | ${spinEmoji} ]** 🎰\n*Slot စက်လှည့်နေပါသည်...*`);

      await sleep(700);
      const board = `🎰 **[ ${slot1} | ${slot2} | ${slot3} ]** 🎰`;

      if (slot1 === slot2 && slot2 === slot3) {
        const winnings = bet * 5;
        user.balance += winnings;
        await user.save();
        return msg.edit(`${board}\n🔥 **JACKPOT!** ၃ ခုလုံး တူသွားလို့ **+${winnings.toLocaleString()} coins** အနိုင်ရရှိပါတယ်! လက်ကျန်: **${user.balance.toLocaleString()} coins**`);
      } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
        const winnings = Math.floor(bet * 1.5);
        user.balance += winnings;
        await user.save();
        return msg.edit(`${board}\n✨ ၂ ခု တူသွားလို့ **+${winnings.toLocaleString()} coins** အနိုင်ရရှိပါတယ်! လက်ကျန်: **${user.balance.toLocaleString()} coins**`);
      } else {
        user.balance -= bet;
        await user.save();
        return msg.edit(`${board}\n💸 ဘာမှ မတူလို့ **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။ လက်ကျန်: **${user.balance.toLocaleString()} coins**`);
      }
    }

    // အံစာတုံး အသေး/အကြီး/လန့် ကစားခြင်း (Kd / Kdice - 'all' Max 250,000)
    if (command === 'd' || command === 'dice') {
      const MAX_BET = 250000;
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kd 1000 s` / `Kd all b` / `Kd 500 t`)');
      }
      if (bet > user.balance) {
        return message.reply(`❌ လက်ကျန်ငွေ မလုံလောက်ပါ! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`);
      }

      const rawChoice = args[1]?.toLowerCase();
      let choice = null;
      if (['s', 'small', 'အသေး'].includes(rawChoice)) choice = 'small';
      else if (['b', 'big', 'အကြီး'].includes(rawChoice)) choice = 'big';
      else if (['t', 'triple', 'lan', 'လန့်'].includes(rawChoice)) choice = 'triple';

      if (!choice) {
        return message.reply('❌ ရွေးချယ်မှု ထည့်ပေးပါ! (`s` = အသေး | `b` = အကြီး | `t` = လန့်)\nဥပမာ - `Kd 1000 s` သို့မဟုတ် `Kd all b`');
      }

      const choiceMap = {
        small: '🔽 အသေး (4-10)',
        big: '🔼 အကြီး (11-17)',
        triple: '🔥 လန့် (3 လုံးတူ)',
      };

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const diceEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

      const msg = await message.reply(
        `🎲 **${choiceMap[choice]}** ကို **${bet.toLocaleString()} coins** လောင်းပြီး အံစာခေါက်လိုက်ပါပြီ...\n` +
        `**[ 🔄 | 🔄 | 🔄 ]** *အံစာတုံး လှိမ့်နေပါသည်...*`
      );

      await sleep(1200);

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2 + d3;

      const isTriple = d1 === d2 && d2 === d3;
      let actualResult = '';
      let resultLabel = '';

      if (isTriple) {
        actualResult = 'triple';
        resultLabel = `🔥 လန့် (${d1}-${d2}-${d3})`;
      } else if (sum >= 4 && sum <= 10) {
        actualResult = 'small';
        resultLabel = `🔽 အသေး (ပေါင်းလဒ်: ${sum})`;
      } else {
        actualResult = 'big';
        resultLabel = `🔼 အကြီး (ပေါင်းလဒ်: ${sum})`;
      }

      const board = `🎲 **[ ${diceEmojis[d1 - 1]} | ${diceEmojis[d2 - 1]} | ${diceEmojis[d3 - 1]} ]** ➔ **${resultLabel}**`;

      if (choice === actualResult) {
        const multiplier = choice === 'triple' ? 20 : 1;
        const winnings = bet * multiplier;
        user.balance += winnings;
        await user.save();

        const tripleNote = choice === 'triple' ? ' (**20x JACKPOT!**)' : '';
        return msg.edit(
          `${board}\n🎉 **အနိုင်ရရှိပါတယ်!**${tripleNote} **+${winnings.toLocaleString()} coins** ရရှိပြီး လက်ကျန် **${user.balance.toLocaleString()} coins** ရှိသွားပါပြီ။`
        );
      } else {
        user.balance -= bet;
        await user.save();

        const lanLossNote = isTriple && choice !== 'triple' ? ' *(လန့် ကျသွားသဖြင့် အသေး/အကြီး ရှုံးပါသည်)*' : '';
        return msg.edit(
          `${board}\n💸 **ရှုံးသွားပါတယ်!**${lanLossNote} **-${bet.toLocaleString()} coins** ဆုံးရှုံးပြီး လက်ကျန် **${user.balance.toLocaleString()} coins** သာ ကျန်ပါတော့တယ်။`
        );
      }
    }

    // ၁၁။ ဆိုင်ခန်း ကြည့်ခြင်း (Kshop)
    if (command === 'shop') {
      const shopList = SHOP_ITEMS.map((item) => {
        let status = `💰 **${item.price.toLocaleString()} coins**`;
        if (item.isConsumable) {
          status += ` *(လက်ရှိ: ${user.boxes || 0} လုံး)*`;
        } else if ((user.items || []).includes(item.id)) {
          const left = (user.itemUses && user.itemUses[item.id] !== undefined) ? user.itemUses[item.id] : item.maxUses;
          status = `✅ *(ဝယ်ပြီး — ကျန်: **${left}/${item.maxUses}** ကြိမ်)*`;
        }
        return `🛒 **${item.name}** (ID: \`${item.id}\`)\n└ ${item.desc} — ${status}`;
      }).join('\n\n');

      const shopEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏪 Keo အရောင်းဆိုင် (Item & Weapon Shop)')
        .setDescription(shopList)
        .setFooter({ text: 'ဝယ်ယူရန် Kbuy <ID> ကို ရိုက်ပါ (ဥပမာ - Kbuy sword)' });

      return message.reply({ embeds: [shopEmbed] });
    }

    // Blackjack ဖဲကစားခြင်း (Kbj / Kblackjack - Button စနစ် | 'all' Max 250,000)
    if (command === 'bj' || command === 'blackjack') {
      if (activeBlackjack.has(message.author.id)) {
        return message.reply('🃏 သင်သည် Blackjack ကစားနေဆဲ ဖြစ်ပါတယ်! အပေါ်က Message မှ ခလုတ်ကို နှိပ်ပြီး အရင်ပြီးအောင် ဆော့ပါ။');
      }

      const MAX_BET = 250000;
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);

      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - `Kbj 1000` သို့မဟုတ် `Kbj all`)');
      }
      if (bet > user.balance) {
        return message.reply(`❌ လက်ကျန်ငွေ မလုံလောက်ပါ! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`);
      }

      const suits = ['♠️', '♥️', '♦️', '♣️'];
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const deck = [];
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank });
        }
      }
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      const calcHand = (hand) => {
        let total = 0;
        let aces = 0;
        for (const card of hand) {
          if (card.rank === 'A') {
            aces += 1;
            total += 11;
          } else if (['K', 'Q', 'J'].includes(card.rank)) {
            total += 10;
          } else {
            total += parseInt(card.rank);
          }
        }
        while (total > 21 && aces > 0) {
          total -= 10;
          aces -= 1;
        }
        return total;
      };

      const formatHand = (hand, hideSecond = false) => {
        if (hideSecond) {
          return `\`[ ${hand[0].rank}${hand[0].suit} ]\` \`[ ❓ ]\``;
        }
        return hand.map((c) => `\`[ ${c.rank}${c.suit} ]\``).join(' ');
      };

      user.balance -= bet;
      await user.save();

      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];
      const playerTotal = calcHand(playerHand);
      const dealerTotal = calcHand(dealerHand);

      if (playerTotal === 21) {
        if (dealerTotal === 21) {
          user.balance += bet;
          await user.save();
          const pushEmbed = new EmbedBuilder()
            .setColor('#95A5A6')
            .setTitle(`🃏 Blackjack — သရေကျပါသည် (Push)!`)
            .addFields(
              { name: `🧑 ${message.author.username} (21)`, value: formatHand(playerHand), inline: true },
              { name: `🤖 Dealer (21)`, value: formatHand(dealerHand), inline: true }
            )
            .setDescription(`နှစ်ဖက်လုံး Blackjack ကျသဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** အရင်းပြန်ရပါတယ်။`);
          return message.reply({ embeds: [pushEmbed] });
        }

        const payout = Math.floor(bet * 2.5);
        const profit = payout - bet;
        user.balance += payout;
        await user.save();

        const bjEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🃏 BLACKJACK! (1.5x WIN)`)
          .addFields(
            { name: `🧑 ${message.author.username} (21)`, value: formatHand(playerHand), inline: true },
            { name: `🤖 Dealer (${dealerTotal})`, value: formatHand(dealerHand), inline: true }
          )
          .setDescription(`🔥 **BLACKJACK!** **+${profit.toLocaleString()} coins** အနိုင်ရရှိပြီး လက်ကျန် **${user.balance.toLocaleString()} coins** ရှိသွားပါပြီ!`);
        return message.reply({ embeds: [bjEmbed] });
      }

      activeBlackjack.add(message.author.id);

      const buildGameEmbed = (statusText, color = '#2B2D31', revealDealer = false) => {
        const pScore = calcHand(playerHand);
        const dScore = revealDealer ? calcHand(dealerHand) : '?';
        return new EmbedBuilder()
          .setColor(color)
          .setTitle(`🃏 ${message.author.username} ၏ Blackjack (လောင်းကြေး: ${bet.toLocaleString()} coins)`)
          .addFields(
            { name: `🧑 သင့်ဖဲ (${pScore})`, value: formatHand(playerHand), inline: true },
            { name: `🤖 Dealer (${dScore})`, value: formatHand(dealerHand, !revealDealer), inline: true }
          )
          .setDescription(statusText);
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('bj_hit')
          .setLabel('🃏 Hit (ထပ်ဆွဲမည်)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('bj_stand')
          .setLabel('🛑 Stand (ရပ်မည်)')
          .setStyle(ButtonStyle.Danger)
      );

      const gameMsg = await message.reply({
        embeds: [buildGameEmbed('အောက်ပါ ခလုတ်များကို နှိပ်၍ ကစားပါ *(၃၀ စက္ကန့်အတွင်း)*')],
        components: [row]
      });

      const collector = gameMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Blackjack ပွဲမဟုတ်ပါဘူး!', ephemeral: true });
        }

        if (i.customId === 'bj_hit') {
          playerHand.push(deck.pop());
          const newTotal = calcHand(playerHand);

          if (newTotal > 21) {
            collector.stop('bust');
            const freshUser = await getUser(message.author.id, message.author.username);
            return i.update({
              embeds: [buildGameEmbed(
                `💥 **BUST! (${newTotal} မှတ် — 21 ကျော်သွားပါပြီ)**\n💸 **-${bet.toLocaleString()} coins** ရှုံးသွားပါတယ်။ လက်ကျန်: **${freshUser.balance.toLocaleString()} coins**`,
                '#E74C3C',
                true
              )],
              components: []
            });
          }

          if (newTotal === 21) {
            await i.deferUpdate();
            collector.stop('stand');
          } else {
            await i.update({
              embeds: [buildGameEmbed('အောက်ပါ ခလုတ်များကို နှိပ်၍ ဆက်ကစားပါ')],
              components: [row]
            });
          }
        } else if (i.customId === 'bj_stand') {
          await i.deferUpdate();
          collector.stop('stand');
        }
      });

      collector.on('end', async (_, reason) => {
        activeBlackjack.delete(message.author.id);
        if (reason === 'bust') return;

        while (calcHand(dealerHand) < 17) {
          dealerHand.push(deck.pop());
        }

        const finalPlayer = calcHand(playerHand);
        const finalDealer = calcHand(dealerHand);
        const freshUser = await getUser(message.author.id, message.author.username);

        if (finalDealer > 21 || finalPlayer > finalDealer) {
          freshUser.balance += bet * 2;
          await freshUser.save();
          const winReason = finalDealer > 21 ? `Dealer Bust (${finalDealer}) ဖြစ်သွားပါတယ်!` : `${finalPlayer} ဖြင့် Dealer (${finalDealer}) ကို အနိုင်ရပါတယ်!`;
          return gameMsg.edit({
            embeds: [buildGameEmbed(
              `🎉 **အနိုင်ရရှိပါတယ်!** ${winReason}\n💰 **+${bet.toLocaleString()} coins** ရရှိပြီး လက်ကျန် **${freshUser.balance.toLocaleString()} coins** ရှိသွားပါပြီ!`,
              '#2ECC71',
              true
            )],
            components: []
          });
        } else if (finalPlayer === finalDealer) {
          freshUser.balance += bet;
          await freshUser.save();
          return gameMsg.edit({
            embeds: [buildGameEmbed(
              `🛡️ **သရေကျပါတယ် (Push)!** နှစ်ဖက်လုံး **${finalPlayer}** မှတ် တူနေသဖြင့် အရင်းပြန်ရပါတယ်။ (လက်ကျန်: **${freshUser.balance.toLocaleString()} coins**)`,
              '#95A5A6',
              true
            )],
            components: []
          });
        } else {
          const timeoutNote = reason === 'time' ? '*(အချိန်စေ့သွားသဖြင့် အလိုအလျောက် Stand လုပ်လိုက်ပါသည်)*\n' : '';
          return gameMsg.edit({
            embeds: [buildGameEmbed(
              `${timeoutNote}💸 **ရှုံးသွားပါတယ်!** Dealer က **${finalDealer}** မှတ်ဖြင့် အနိုင်ရသွားပါတယ်။ (**-${bet.toLocaleString()} coins** | လက်ကျန်: **${freshUser.balance.toLocaleString()} coins**)`,
              '#E74C3C',
              true
            )],
            components: []
          });
        }
      });
    }

    // ၁၂။ ပစ္စည်း ဝယ်ယူခြင်း (Kbuy <id>)
    if (command === 'buy') {
      const itemId = args[0] ? args[0].toLowerCase() : null;
      const item = SHOP_ITEMS.find((i) => i.id === itemId);

      if (!item) {
        return message.reply('❌ ပစ္စည်း ID မှားယွင်းနေပါတယ်။ ဆိုင်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kshop` ကို ရိုက်ပါ။');
      }
      if (!item.isConsumable && (user.items || []).includes(item.id)) {
        return message.reply(`✅ သင်သည် **${item.name}** ကို ဝယ်ယူပြီးသား ဖြစ်ပါတယ်!`);
      }
      if (user.balance < item.price) {
        return message.reply(`❌ ပိုက်ဆံ မလုံလောက်ပါ! **${item.name}** အတွက် **${item.price.toLocaleString()} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= item.price;
      if (item.isConsumable) {
        user.boxes = (user.boxes || 0) + 1;
        await user.save();
        return message.reply(`🎉 **${item.name}** ၁ လုံး ဝယ်ယူပြီးပါပြီ! (စုစုပေါင်း: **${user.boxes} လုံး** — ဖွင့်ရန် \`Kopen\` ရိုက်ပါ)`);
      } else {
        user.items.push(item.id);
        if (!user.itemUses) user.itemUses = {};
        user.itemUses[item.id] = item.maxUses;
        user.markModified('itemUses');
        await user.save();
        return message.reply(`🎉 **${item.name}** ကို **${item.price.toLocaleString()} coins** ဖြင့် ဝယ်ယူပြီးပါပြီ! (အသုံးပြုခွင့်: **${item.maxUses} ကြိမ်**)`);
      }
    }

    // ၁၃။ Mystery Lootbox ဖောက်ယူခြင်း (Kopen / Kbox)
    if (command === 'open' || command === 'box') {
      if ((user.boxes || 0) <= 0) {
        return message.reply('📦 ဖွင့်စရာ **Mystery Box** မရှိသေးပါဘူး! `Kbuy box` ဖြင့် ဝယ်ယူနိုင်သလို `Khunt` နှင့် `Kbattle` ကနေလည်း ကံစမ်းရရှိနိုင်ပါတယ်။');
      }

      user.boxes -= 1;
      const roll = Math.random();
      let rewardMessage = '';

      if (roll < 0.45) {
        const coinsWon = Math.floor(Math.random() * 2001) + 500;
        user.balance += coinsWon;
        rewardMessage = `💰 ရွှေဒင်္ဂါး **+${coinsWon.toLocaleString()} coins** ရရှိပါတယ်! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`;
      } else if (roll < 0.75) {
        const expWon = Math.floor(Math.random() * 101) + 50;
        const isLevelUp = addExp(user, expWon);
        rewardMessage = `✨ အတွေ့အကြုံ **+${expWon} EXP** ရရှိပါတယ်! (${user.exp}/${user.level * 100} EXP)`;
        if (isLevelUp) {
          rewardMessage += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }
      } else {
        const rarePool = ANIMALS.slice(12);
        const prizeAnimal = rarePool[Math.floor(Math.random() * rarePool.length)];
        if (!user.zoo) user.zoo = {};
        user.zoo[prizeAnimal.name] = (user.zoo[prizeAnimal.name] || 0) + 1;
        user.markModified('zoo');
        rewardMessage = `🐾 ရှားပါးတိရစ္ဆာန် ${prizeAnimal.emoji} **${prizeAnimal.name}** တစ်ကောင် ပေါက်ပါတယ်!`;
      }

      await user.save();
      return message.reply(`🎁 **Mystery Box** ကို ဖွင့်လိုက်ရာ...\n${rewardMessage}\n*(ကျန်ရှိသော Box: **${user.boxes} လုံး**)*`);
    }

    // ၁၄။ Command စာရင်းကြည့်ရန် (Khelp)
    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Keo Bot အသုံးပြုနည်း Command လမ်းညွှန်')
        .addFields(
          { name: '💰 Economy (စီးပွားရေး)', value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kgive @user <amount>`, `Ktop`' },
          { name: '🏹 Hunting & Box', value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Ksellall`, `Kopen` (`Kbox`)' },
          { name: '🎲 Gambling (ကျားဖြန့်)', value: '`Kcf <amount/all> [heads/tails]`, `Ks <amount/all>`, `Kd <amount/all> <s/b/t>`, `Kbj <amount/all>`' },
          { name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)', value: '`Kbattle` (`Kb`) သို့မဟုတ် `Kbattle @user`' },
          { name: '🤗 Actions (လှုပ်ရှားမှု ၂၂ မျိုး)', value: '`Kcuddle`, `Khug`, `Kkiss`, `Kclick`, `Knom`, `Kpat`, `Kpoke`, `Kslap`, `Kstare`, `Khighfive`, `Kbite`, `Kgreet`, `Kpunch`, `Khandholding`, `Ktickle`, `Kkill`, `Khold`, `Kpats`, `Kwave`, `Kboop`, `Ksnuggle`, `Kbully` (`@user`)' },
          { name: '📈 Level & Profile', value: '`Kprofile`, `Klvl`, `Klevel`' }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    }

    // ၁၅။ တိရစ္ဆာန် တိုက်ခိုက်ရေး စနစ် - Solo & PvP (Kbattle / Kb / Kbattle @user)
    if (command === 'battle' || command === 'b') {
      const myStats = getBattleStats(user);
      if (myStats.team.length === 0) {
        return message.reply('❌ တိုက်ပွဲဝင်ဖို့ တိရစ္ဆာန် တစ်ကောင်မှ မရှိသေးပါဘူး! `Khunt` ရိုက်ပြီး အရင်ဖမ်းပါ။');
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const myTeamText = myStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
      const opponentMention = message.mentions.users.first();

      if (opponentMention) {
        if (opponentMention.bot) {
          return message.reply('❌ Bot များကို စိန်ခေါ်၍ မရပါ။');
        }
        if (opponentMention.id === message.author.id) {
          return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်စိန်ခေါ်၍ မရပါ။');
        }

        const oppUser = await getUser(opponentMention.id, opponentMention.username);
        const oppStats = getBattleStats(oppUser);
        if (oppStats.team.length === 0) {
          return message.reply(`❌ **${opponentMention.username}** တွင် တိုက်ပွဲဝင်ရန် တိရစ္ဆာန် မရှိသေးပါ။`);
        }

        const oppTeamText = oppStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
        const pvpEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`⚔️ PvP: ${message.author.username} (Lv.${user.level}) VS ${opponentMention.username} (Lv.${oppUser.level})`)
          .addFields(
            { name: `🛡️ ${message.author.username}`, value: myTeamText, inline: true },
            { name: `🔥 ${opponentMention.username}`, value: oppTeamText, inline: true }
          )
          .setFooter({ text: 'PvP တိုက်ပွဲ ပြင်းထန်စွာ တိုက်ခိုက်နေပါသည်...' });

        const msg = await message.reply({ embeds: [pvpEmbed] });
        await sleep(1500);

        const brokenItemText = useCategoryItems(user, 'battle');

        if (myStats.totalPower >= oppStats.totalPower) {
          const gainedExp = Math.floor(Math.random() * 31) + 45;
          const isLevelUp = addExp(user, gainedExp);
          addExp(oppUser, 10);

          let boxDropText = '';
          if (Math.random() < 0.20) {
            user.boxes = (user.boxes || 0) + 1;
            boxDropText = `\n🎁 PvP အောင်ပွဲဆု **Mystery Box +1** ရရှိပါတယ်!`;
          }

          await user.save();
          await oppUser.save();

          let resultText = `🏆 **${message.author.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${myStats.totalPower}\` vs \`${oppStats.totalPower}\`)\n✨ **+${gainedExp} EXP** ရရှိပါတယ်!${boxDropText}`;
          if (isLevelUp) {
            resultText += `\n🎊 **LEVEL UP!** **${message.author.username}** သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
          }
          resultText += brokenItemText;

          pvpEmbed.setColor('#2ECC71').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
        } else {
          const gainedExp = Math.floor(Math.random() * 31) + 45;
          const oppLevelUp = addExp(oppUser, gainedExp);
          addExp(user, 10);

          await user.save();
          await oppUser.save();

          let resultText = `🏆 **${opponentMention.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${oppStats.totalPower}\` vs \`${myStats.totalPower}\`)\n✨ **${opponentMention.username}** က **+${gainedExp} EXP** ရရှိပြီး သင်သည် **+10 EXP** ရရှိပါတယ်။`;
          if (oppLevelUp) {
            resultText += `\n🎊 **LEVEL UP!** **${opponentMention.username}** သည် **Level ${oppUser.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
          }
          resultText += brokenItemText;

          pvpEmbed.setColor('#E74C3C').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
        }

        return msg.edit({ embeds: [pvpEmbed] });
      }

      const enemyTeam = [
        ANIMALS[Math.floor(Math.random() * 20)],
        ANIMALS[Math.floor(Math.random() * 25)],
        ANIMALS[Math.floor(Math.random() * ANIMALS.length)],
      ];

      const enemyPower = enemyTeam.reduce((sum, a) => sum + a.price, 0) + Math.floor(Math.random() * 200);
      const enemyTeamText = enemyTeam.map((a) => `${a.emoji} ${a.name}`).join('\n');

      const battleEmbed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle(`⚔️ ${message.author.username} (Lv.${user.level}) ၏ တိရစ္ဆာန်တိုက်ပွဲ`)
        .addFields(
          { name: '🛡️ သင့်အဖွဲ့ (Your Team)', value: myTeamText, inline: true },
          { name: '👹 ရန်သူ့အဖွဲ့ (Wild Team)', value: enemyTeamText, inline: true }
        )
        .setFooter({ text: 'တိုက်ခိုက်နေပါသည်...' });

      const msg = await message.reply({ embeds: [battleEmbed] });
      await sleep(1500);

      const brokenItemText = useCategoryItems(user, 'battle');

      if (myStats.totalPower >= enemyPower) {
        const gainedExp = Math.floor(Math.random() * 31) + 30;
        const isLevelUp = addExp(user, gainedExp);

        let boxDropText = '';
        if (Math.random() < 0.15) {
          user.boxes = (user.boxes || 0) + 1;
          boxDropText = `\n🎁 ရန်သူ့စခန်းမှ **Mystery Box +1** သိမ်းပိုက်ရရှိပါတယ်!`;
        }

        await user.save();

        let winText = `🎉 **အနိုင်ရရှိပါတယ်!** (Power: \`${myStats.totalPower}\` vs \`${enemyPower}\`)\n✨ အတွေ့အကြုံ **+${gainedExp} EXP** ရရှိပါတယ်! (${user.exp}/${user.level * 100} EXP)${boxDropText}`;
        if (isLevelUp) {
          winText += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }
        winText += brokenItemText;

        battleEmbed.setColor('#2ECC71').setDescription(winText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      } else {
        const loseExp = 5;
        const isLevelUp = addExp(user, loseExp);
        await user.save();

        let loseText = `💀 **ရှုံးနိမ့်သွားပါတယ်!** (Power: \`${myStats.totalPower}\` vs \`${enemyPower}\`)\n📖 တိုက်ပွဲအတွေ့အကြုံ **+${loseExp} EXP** ရရှိပါတယ်။ (${user.exp}/${user.level * 100} EXP)`;
        if (isLevelUp) {
          loseText += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }
        loseText += brokenItemText;

        battleEmbed.setColor('#E74C3C').setDescription(loseText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      }

      return msg.edit({ embeds: [battleEmbed] });
    }

    // ၁၆။ Level, EXP နှင့် Profile ကြည့်ရှုခြင်း (Kprofile / Klvl / Klevel)
    if (command === 'profile' || command === 'lvl' || command === 'level') {
      const neededExp = user.level * 100;
      const progress = Math.min(10, Math.floor((user.exp / neededExp) * 10));
      const progressBar = '🟦'.repeat(progress) + '⬜'.repeat(10 - progress);

      const profileEmbed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: `${message.author.username} ၏ ကိုယ်ရေးအကျဉ်း (Profile)`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: '🏅 Level', value: `**Level ${user.level}**`, inline: true },
          { name: '✨ EXP', value: `**${user.exp} / ${neededExp} EXP**`, inline: true },
          { name: '💰 လက်ကျန်ငွေ', value: `**${user.balance.toLocaleString()} coins**`, inline: true },
          { name: '🔥 Daily Streak', value: `**${user.dailyStreak || 0} ရက်**`, inline: true },
          { name: '🎁 Mystery Boxes', value: `**${user.boxes || 0} လုံး**`, inline: true },
          { name: '🎒 ပိုင်ဆိုင်သော ပစ္စည်း', value: `**${(user.items || []).length} မျိုး**`, inline: true },
          { name: '📊 Level တက်ရန် တိုးတက်မှု', value: `${progressBar} (${Math.floor((user.exp / neededExp) * 100)}%)` }
        )
        .setFooter({ text: 'EXP ရရှိရန် Kbattle ကို ကစားပါ' });

      return message.reply({ embeds: [profileEmbed] });
    }

    // ၁၇။ Action Commands (Khug, Kpat, Kslap, Kkiss, Kcuddle, Kpoke, Kpunch)
    if (ACTIONS[command]) {
      const target = message.mentions.users.first();
      if (!target) {
        return message.reply(`❌ လုပ်ဆောင်မယ့် သူကို Mention ခေါ်ပေးပါ! (ဥပမာ - \`K${command} @User\`)`);
      }
      if (target.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်လုပ်လို့ မရပါဘူး! တခြားတစ်ယောက်ကို Mention ခေါ်ပါ။');
      }

      const actionData = ACTIONS[command];

      // MongoDB ထဲတွင် တစ်ဦးချင်းစီ အကြိမ်ရေ မှတ်သားခြင်း
      if (!user.actions) user.actions = {};
      const pairKey = `${command}_${target.id}`;
      user.actions[pairKey] = (user.actions[pairKey] || 0) + 1;
      user.markModified('actions');
      await user.save();

      const totalCount = user.actions[pairKey];

      // nekos.best နှင့် waifu.pics API များမှ Anime GIF လှမ်းယူခြင်း
      let gifUrl = actionData.fallbackGif;
      try {
        let fetched = false;
        if (actionData.nekos) {
          const res = await fetch(`https://nekos.best/api/v2/${actionData.nekos}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.results?.[0]?.url) {
              gifUrl = data.results[0].url;
              fetched = true;
            }
          }
        }
        if (!fetched && actionData.waifu) {
          const res = await fetch(`https://api.waifu.pics/sfw/${actionData.waifu}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.url) gifUrl = data.url;
          }
        }
      } catch (apiErr) {
        console.error('Action GIF Fetch Error:', apiErr);
      }

      const actionEmbed = new EmbedBuilder()
        .setColor(actionData.color)
        .setTitle(actionData.title)
        .setDescription(`**${message.author.username}** က **${target.username}** ${actionData.actionText}`)
        .setImage(gifUrl)
        .setFooter({ text: `စုစုပေါင်း ${totalCount.toLocaleString()} ကြိမ် ${actionData.countLabel}` })
        .setTimestamp();

      return message.reply({ content: `<@${target.id}>`, embeds: [actionEmbed] });
    }
  } catch (err) {
    console.error('Command Error:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);

// Error တစ်ခုခု တက်လာပါက Bot တစ်ခုလုံး ရပ်မသွားစေရန် ကာကွယ်ခြင်း
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Render & UptimeRobot 24/7 Health Check Server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Keo Bot is running 24/7!');
}).listen(process.env.PORT || 8000);