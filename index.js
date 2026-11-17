require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Spam မရိုက်နိုင်အောင် အချိန်မှတ်ထားမည့် Map
const cooldowns = new Map();

// MongoDB Cloud Database ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Database ချိတ်ဆက်မှု အောင်မြင်ပါသည်!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// ကစားသမား အချက်အလက် ပုံစံ (Schema) သတ်မှတ်ခြင်း
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, default: 'Unknown' },
  balance: { type: Number, default: 200 },
  lastDaily: { type: Number, default: 0 },
  lastWork: { type: Number, default: 0 },
  zoo: { type: Object, default: {} },
  items: { type: [String], default: [] },
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
  // 🟢 Common (အတွေ့များ - စုစုပေါင်း 50%)
  { name: 'ပုရွက်ဆိတ် (Common)', emoji: '🐜', price: 5, chance: 10 },
  { name: 'ပိုးတောင်မာ (Common)', emoji: '🪲', price: 8, chance: 9 },
  { name: 'ဖားကလေး (Common)', emoji: '🐸', price: 10, chance: 8 },
  { name: 'ကြွက်ဖြူလေး (Common)', emoji: '🐭', price: 12, chance: 8 },
  { name: 'ကြက်ကလေး (Common)', emoji: '🐤', price: 15, chance: 8 },
  { name: 'ဘဲကလေး (Common)', emoji: '🦆', price: 18, chance: 7 },

  // 🔵 Uncommon (အသင့်အတင့် - စုစုပေါင်း 28%)
  { name: 'ယုန်ဖြူလေး (Uncommon)', emoji: '🐇', price: 25, chance: 6 },
  { name: 'ရှဉ့်ကလေး (Uncommon)', emoji: '🐿️', price: 30, chance: 5 },
  { name: 'ဖြူကောင် (Uncommon)', emoji: '🦔', price: 35, chance: 5 },
  { name: 'လိပ်ကလေး (Uncommon)', emoji: '🐢', price: 40, chance: 4 },
  { name: 'ခိုဖြူလေး (Uncommon)', emoji: '🕊️', price: 45, chance: 4 },
  { name: 'ကြောင်ကလေး (Uncommon)', emoji: '🐱', price: 50, chance: 4 },

  // 🟣 Rare (ရှားပါး - စုစုပေါင်း 14%)
  { name: 'မြေခွေး (Rare)', emoji: '🦊', price: 70, chance: 3 },
  { name: 'ရက်ကွန်း (Rare)', emoji: '🦝', price: 85, chance: 3 },
  { name: 'ဇီးကွက် (Rare)', emoji: '🦉', price: 100, chance: 2.5 },
  { name: 'သမင် (Rare)', emoji: '🦌', price: 120, chance: 2 },
  { name: 'ဝံပုလွေ (Rare)', emoji: '🐺', price: 150, chance: 2 },
  { name: 'တောဝက် (Rare)', emoji: '🐗', price: 180, chance: 1.5 },

  // 🟠 Epic (အလွန်ရှားပါး - စုစုပေါင်း 6.5%)
  { name: 'သိမ်းငှက် (Epic)', emoji: '🦅', price: 250, chance: 1.5 },
  { name: 'မိကျောင်း (Epic)', emoji: '🐊', price: 300, chance: 1.2 },
  { name: 'ဝက်ဝံညို (Epic)', emoji: '🐻', price: 350, chance: 1.1 },
  { name: 'ပန်ဒါဝက်ဝံ (Epic)', emoji: '🐼', price: 420, chance: 1 },
  { name: 'ကျားသစ် (Epic)', emoji: '🐆', price: 500, chance: 0.9 },
  { name: 'ဂေါ်ရီလာ (Epic)', emoji: '🦍', price: 600, chance: 0.8 },

  // 🔴 Legendary & Mythical (ဒဏ္ဍာရီလာ - စုစုပေါင်း 1.5%)
  { name: 'ခြင်္သေ့မင်း (Legendary)', emoji: '🦁', price: 800, chance: 0.5 },
  { name: 'ကျားရဲ (Legendary)', emoji: '🐅', price: 1000, chance: 0.4 },
  { name: 'ဆင်ပြောင်ကြီး (Legendary)', emoji: '🐘', price: 1300, chance: 0.3 },
  { name: 'ကြံ့သူတော် (Legendary)', emoji: '🦏', price: 1600, chance: 0.15 },
  { name: 'ယူနီကွန်း (Mythical)', emoji: '🦄', price: 2500, chance: 0.1 },
  { name: 'နဂါးမင်း (Mythical)', emoji: '🐉', price: 5000, chance: 0.05 },
];

// ဆိုင်တွင် ဝယ်ယူနိုင်သော ပစ္စည်းများ
const SHOP_ITEMS = [
  { id: 'bow', name: 'လေးနှင့်မြား (Hunting Bow)', price: 500, luckBonus: 5, desc: 'အမဲလိုက်လျှင် ရှားပါးကောင် မိနိုင်ခြေ +5% တိုးပေးသည်' },
  { id: 'rifle', name: 'အမဲလိုက်သေနတ် (Hunting Rifle)', price: 2000, luckBonus: 12, desc: 'အမဲလိုက်လျှင် ရှားပါးကောင် မိနိုင်ခြေ +12% တိုးပေးသည်' },
  { id: 'charm', name: 'နဂါးအဆောင် (Dragon Charm)', price: 5000, luckBonus: 25, desc: 'အမဲလိုက်လျှင် ရှားပါးကောင် မိနိုင်ခြေ +25% အထိ တိုးပေးသည်' },
];

client.once('clientReady', () => {
  console.log(`${client.user.tag} အနေဖြင့် OwO Style စနစ်အပြည့်အစုံ စတင်ပါပြီ!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.toLowerCase().startsWith('k')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Command အစစ်ဟုတ်/မဟုတ် အရင်စစ်ခြင်း (ရိုးရိုးစကားပြောရင်း k ပါရင် Cooldown မတက်စေရန်)
  const validCommands = [
    'cash', 'bal', 'daily', 'work', 'give', 'top', 'lb',
    'hunt', 'h', 'zoo', 'z', 'sellall', 'cf', 'coinflip',
    'slots', 'shop', 'buy', 'help', 'battle', 'b', 'profile', 'lvl', 'level'
  ];
  if (!validCommands.includes(command)) return;

  // Anti-Spam Cooldown စစ်ဆေးခြင်း (၅ စက္ကန့်)
  const nowTime = Date.now();
  const cooldownAmount = 5000;

  if (cooldowns.has(message.author.id)) {
    const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;

    if (nowTime < expirationTime) {
      const timeLeft = ((expirationTime - nowTime) / 1000).toFixed(1);
      return message.reply(`⏳ ဖြည်းဖြည်းရိုက်ပါခင်ဗျာ! နောက်ထပ် **${timeLeft} စက္ကန့်** စောင့်ပြီးမှ ပြန်ရိုက်ပါ။`);
    }
  }

  cooldowns.set(message.author.id, nowTime);
  setTimeout(() => cooldowns.delete(message.author.id), cooldownAmount);

  try {
    const user = await getUser(message.author.id, message.author.username);

    // ၁။ လက်ကျန်ငွေ စစ်ဆေးခြင်း (!cash / !bal)
    if (command === 'cash' || command === 'bal') {
      await user.save();
      const cashEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ name: `${message.author.username} ၏ ပိုက်ဆံအိတ်`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`💰 လက်ကျန်ငွေ: **${user.balance.toLocaleString()} coins**`)
        .setTimestamp();

      return message.reply({ embeds: [cashEmbed] });
    }

   // ၂။ နေ့စဉ် အခမဲ့ငွေ ထုတ်ယူခြင်း (Kdaily) - Level & EXP အလိုက် တိုးမည် (Max: 10,000)
    if (command === 'daily') {
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;

      if (now - user.lastDaily < cooldown) {
        const remaining = cooldown - (now - user.lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`⏳ နေ့စဉ်ဆုကြေး ထုတ်ပြီးသား ဖြစ်ပါတယ်။ နောက်ထပ် **${hours} နာရီ ${minutes} မိနစ်** နေမှ ပြန်ထုတ်နိုင်ပါမယ်။`);
      }

      const MAX_DAILY = 10000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const baseReward = 500;
      const levelBonus = (currentLevel - 1) * 200; // Level 1 တက်တိုင်း +200 coins
      const expBonus = Math.floor(currentExp * 0.5); // လက်ရှိ EXP ၏ 50%
      const reward = Math.min(baseReward + levelBonus + expBonus, MAX_DAILY);

      user.balance += reward;
      user.lastDaily = now;
      await user.save();

      const maxNote = reward >= MAX_DAILY ? ' *(MAX)*' : '';
      return message.reply(
        `🎁 **Lv.${currentLevel}** (${currentExp} EXP) နေ့စဉ်ဆုကြေး **${reward.toLocaleString()} coins**${maxNote} ရရှိပါပြီ!\n` +
        `💰 လက်ကျန်ငွေ: **${user.balance.toLocaleString()} coins**`
      );
    }

    // ၃။ အလုပ်လုပ်ပြီး ပိုက်ဆံရှာခြင်း (Kwork) - Level & EXP အလိုက် တိုးမည် (Max: 3,000)
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

      const baseEarned = Math.floor(Math.random() * 151) + 50; // အခြေခံ 50 - 200 coins
      const levelBonus = (currentLevel - 1) * 60; // Level 1 တက်တိုင်း +60 coins
      const expBonus = Math.floor(currentExp * 0.15); // လက်ရှိ EXP ၏ 15%
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

    // ၄။ သူငယ်ချင်းဆီ ပိုက်ဆံလွှဲပေးခြင်း (!give @user 100)
    if (command === 'give') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!target || target.bot) {
        return message.reply('❌ ပိုက်ဆံလွှဲပေးမယ့် သူကို Mention ခေါ်ပါ။ (ဥပမာ - `!give @User 100`)');
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

    // ၅။ အချမ်းသာဆုံးစာရင်း (!top / !lb)
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
        .setFooter({ text: 'အလုပ်လုပ်ပြီး ပိုက်ဆံရှာရန် !work ကို ရိုက်ပါ' })
        .setTimestamp();

      return message.reply({ embeds: [topEmbed] });
    }

    // ၆။ အမဲလိုက်ခြင်း (!hunt / !h)
    if (command === 'hunt' || command === 'h') {
      const cost = 10;
      if (user.balance < cost) {
        return message.reply(`❌ အမဲလိုက်ဖို့ ကျည်ဆန်ဖိုး **${cost} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= cost;

      let totalLuck = 0;
      for (const itemId of user.items) {
        const itemInfo = SHOP_ITEMS.find((i) => i.id === itemId);
        if (itemInfo) totalLuck += itemInfo.luckBonus;
      }

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

      if (!user.zoo) user.zoo = {};
      user.zoo[caught.name] = (user.zoo[caught.name] || 0) + 1;
      user.markModified('zoo');
      await user.save();

      return message.reply(`🏹 သင်သည် တောထဲသို့ အမဲလိုက်ထွက်ရာ... ${caught.emoji} **${caught.name}** တစ်ကောင် ဖမ်းမိခဲ့ပါတယ်! (ကျန်ငွေ: **${user.balance.toLocaleString()} coins**)`);
    }

    // ၇။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (!zoo / !z)
    if (command === 'zoo' || command === 'z') {
      const entries = Object.entries(user.zoo || {});
      if (entries.length === 0) {
        return message.reply('🏞️ သင့်တိရစ္ဆာန်ရုံထဲမှာ ဘာမှ မရှိသေးပါဘူး။ `!hunt` ရိုက်ပြီး ဖမ်းကြည့်ပါ!');
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
        .setFooter({ text: 'အကုန်ပြန်ရောင်းရန် !sellall ကို ရိုက်ပါ' });

      return message.reply({ embeds: [zooEmbed] });
    }

    // ၈။ တိရစ္ဆာန်အားလုံး ပြန်ရောင်းခြင်း (!sellall)
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

    // ၉။ Coinflip ကစားခြင်း - Animation ပါဝင်သည် (!cf / !coinflip)
    if (command === 'cf' || command === 'coinflip') {
      const MAX_BET = 500000;
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);
      if (isNaN(bet) || bet <= 0) {
        return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - Kcf 100 သို့မဟုတ် Kcf 100 tails)');
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

    // ၁၀။ Slots ကစားခြင်း - Animation ပါဝင်သည် (!slots)
    if (command === 'slots') {
      const MAX_BET = 500000;
      const bet = args[0]?.toLowerCase() === 'all'
        ? Math.min(user.balance, MAX_BET)
        : Math.min(parseInt(args[0]), MAX_BET);
      if (isNaN(bet) || bet <= 0) return message.reply('❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (ဥပမာ - Kslots 100)');
      if (bet > user.balance) return message.reply(`❌ လက်ကျန်ငွေ မလုံလောက်ပါ! (လက်ကျန်: **${user.balance.toLocaleString()} coins**)`);

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

    // ၁၁။ ဆိုင်ခန်း ကြည့်ခြင်း (!shop)
    if (command === 'shop') {
      const shopList = SHOP_ITEMS.map((item) => {
        const owned = user.items.includes(item.id) ? '✅ *(ဝယ်ပြီး)*' : `💰 **${item.price.toLocaleString()} coins**`;
        return `🛒 **${item.name}** (ID: \`${item.id}\`)\n└ ${item.desc} — ${owned}`;
      }).join('\n\n');

      const shopEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏪 အမဲလိုက် ပစ္စည်းအရောင်းဆိုင် (Hunting Shop)')
        .setDescription(shopList)
        .setFooter({ text: 'ဝယ်ယူရန် !buy <ID> ကို ရိုက်ပါ (ဥပမာ - !buy bow)' });

      return message.reply({ embeds: [shopEmbed] });
    }

    // ၁၂။ ပစ္စည်း ဝယ်ယူခြင်း (!buy <id>)
    if (command === 'buy') {
      const itemId = args[0] ? args[0].toLowerCase() : null;
      const item = SHOP_ITEMS.find((i) => i.id === itemId);

      if (!item) {
        return message.reply('❌ ပစ္စည်း ID မှားယွင်းနေပါတယ်။ ဆိုင်ထဲက ပစ္စည်းများကို ကြည့်ရန် `!shop` ကို ရိုက်ပါ။');
      }
      if (user.items.includes(item.id)) {
        return message.reply(`✅ သင်သည် **${item.name}** ကို ဝယ်ယူပြီးသား ဖြစ်ပါတယ်!`);
      }
      if (user.balance < item.price) {
        return message.reply(`❌ ပိုက်ဆံ မလုံလောက်ပါ! **${item.name}** အတွက် **${item.price.toLocaleString()} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= item.price;
      user.items.push(item.id);
      await user.save();

      return message.reply(`🎉 **${item.name}** ကို **${item.price.toLocaleString()} coins** ဖြင့် အောင်မြင်စွာ ဝယ်ယူပြီးပါပြီ!`);
    }

    // ၁၃။ Command စာရင်းကြည့်ရန် (!help)
    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Bot အသုံးပြုနည်း Command လမ်းညွှန်')
        .addFields(
          { name: '💰 Economy (စီးပွားရေး)', value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kgive @user <amount>`, `Ktop`' },
          { name: '🏹 Hunting (အမဲလိုက်ခြင်း)', value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Ksellall`' },
          { name: '🎲 Gambling (ကံစမ်းမဲ)', value: '`Kcf <amount> [heads/tails]`, `Kslots <amount>`' },
          { name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)', value: '`Kbattle` (`Kb`)' },
          { name: '📈 Level & EXP', value: '`Kprofile`, `Klvl`, `Klevel`' }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    }

    // ၁၄။ တိရစ္ဆာန် တိုက်ခိုက်ရေး စနစ် - EXP ရရှိမည် (!battle / !b)
    if (command === 'battle' || command === 'b') {
      const entries = Object.entries(user.zoo || {});
      if (entries.length === 0) {
        return message.reply('❌ တိုက်ပွဲဝင်ဖို့ တိရစ္ဆာန် တစ်ကောင်မှ မရှိသေးပါဘူး! `Khunt` ရိုက်ပြီး အရင်ဖမ်းပါ။');
      }

      let myTeam = [];
      for (const [name, count] of entries) {
        const info = ANIMALS.find((a) => a.name === name);
        if (info) {
          for (let i = 0; i < count; i++) {
            myTeam.push(info);
          }
        }
      }
      myTeam.sort((a, b) => b.price - a.price);
      myTeam = myTeam.slice(0, 3);

      const enemyTeam = [
        ANIMALS[Math.floor(Math.random() * 20)],
        ANIMALS[Math.floor(Math.random() * 25)],
        ANIMALS[Math.floor(Math.random() * ANIMALS.length)],
      ];

      const levelBonus = user.level * 25;
      const myPower = myTeam.reduce((sum, a) => sum + a.price, 0) + levelBonus + Math.floor(Math.random() * 200);
      const enemyPower = enemyTeam.reduce((sum, a) => sum + a.price, 0) + Math.floor(Math.random() * 200);

      const myTeamText = myTeam.map((a) => `${a.emoji} ${a.name}`).join('\n');
      const enemyTeamText = enemyTeam.map((a) => `${a.emoji} ${a.name}`).join('\n');

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

      if (myPower >= enemyPower) {
        const gainedExp = Math.floor(Math.random() * 31) + 30;
        const isLevelUp = addExp(user, gainedExp);
        await user.save();

        let winText = `🎉 **အနိုင်ရရှိပါတယ်!** (Power: \`${myPower}\` vs \`${enemyPower}\`)\n✨ အတွေ့အကြုံ **+${gainedExp} EXP** ရရှိပါတယ်! (${user.exp}/${user.level * 100} EXP)`;
        if (isLevelUp) {
          winText += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }

        battleEmbed
          .setColor('#2ECC71')
          .setDescription(winText)
          .setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      } else {
        const loseExp = 5;
        const isLevelUp = addExp(user, loseExp);
        await user.save();

        let loseText = `💀 **ရှုံးနိမ့်သွားပါတယ်!** (Power: \`${myPower}\` vs \`${enemyPower}\`)\n📖 တိုက်ပွဲအတွေ့အကြုံ **+${loseExp} EXP** ရရှိပါတယ်။ (${user.exp}/${user.level * 100} EXP)`;
        if (isLevelUp) {
          loseText += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }

        battleEmbed
          .setColor('#E74C3C')
          .setDescription(loseText)
          .setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      }

      return msg.edit({ embeds: [battleEmbed] });
    }

    // ၁၅။ Level နှင့် EXP ကြည့်ရှုခြင်း (!profile / !lvl)
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
          { name: '📊 Level တက်ရန် တိုးတက်မှု', value: `${progressBar} (${Math.floor((user.exp / neededExp) * 100)}%)` }
        )
        .setFooter({ text: 'EXP ရရှိရန် !battle ကို ကစားပါ' });

      return message.reply({ embeds: [profileEmbed] });
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
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Keo Bot is running 24/7!');
}).listen(process.env.PORT || 8000);