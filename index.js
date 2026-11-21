require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const { getUser } = require('./models/User');
const { isOwner } = require('./utils/helpers');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Anti-Spam Cooldown Map (Command တစ်ခုချင်းစီအလိုက်)
const cooldowns = new Map();

// Race Condition ကာကွယ်ရန် User တစ်ဦးလျှင် တစ်ချိန်တည်း Command တစ်ခုသာ လုပ်ဆောင်ခွင့် Lock
const processingUsers = new Set();

// ကြည့်ရုံသက်သက် Command များအတွက် ၃ စက္ကန့် Cooldown (ကျန် Command များ ၆ စက္ကန့်)
const FAST_COMMANDS = new Set([
  'cash', 'bal', 'zoo', 'z', 'zooid', 'inv', 'inventory', 'bag',
  'profile', 'p', 'lvl', 'level', 'cd', 'cooldown', 'cooldowns', 'limits',
  'quest', 'quests', 'q', 'col', 'collection', 'shop', 'top', 'lb',
  'help', 'avater', 'avatar', 'av', 'pfp', 'team', 'select', 'botstats', 'stats',
]);

// commands/ နှင့် Subfolder များထဲမှ .js ဖိုင်အားလုံးကို အလိုအလျောက် ဖတ်ယူခြင်း
const commandMap = new Map();
const commandsPath = path.join(__dirname, 'commands');

function loadCommandsFromDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      loadCommandsFromDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const fileCommands = require(fullPath);
      if (!Array.isArray(fileCommands)) continue;
      for (const cmd of fileCommands) {
        if (!cmd || !Array.isArray(cmd.names)) continue;
        for (const name of cmd.names) {
          commandMap.set(name.toLowerCase(), cmd);
        }
      }
    }
  }
}

loadCommandsFromDir(commandsPath);

// MongoDB Cloud Database ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Database ချိတ်ဆက်မှု အောင်မြင်ပါသည်!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

client.once('clientReady', () => {
  console.log(`${client.user.tag} အနေဖြင့် Keo Bot စနစ်အပြည့်အစုံ စတင်ပါပြီ! (Commands: ${commandMap.size})`);
});

client.on('messageCreate', async (message) => {
  // k နောက်တွင် Space မပါဘဲ အင်္ဂလိပ်စာလုံး တိုက်ရိုက်ပါမှ Command အဖြစ် ဖတ်မည်
  if (message.author.bot || !/^k[a-z]/i.test(message.content)) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const commandObj = commandMap.get(commandName);
  if (!commandObj) return;

  // တစ်ပြိုင်တည်း Command ၂ ခု ပြိုင်နှိပ်ခြင်းမှ ကာကွယ်ခြင်း
  if (processingUsers.has(message.author.id)) {
    return message.reply('⏳ အရင် Command ကို လုပ်ဆောင်နေဆဲဖြစ်လို့ ခဏစောင့်ပြီးမှ ပြန်ရိုက်ပါခင်ဗျာ။');
  }

  // Command အမျိုးအစားအလိုက် Cooldown စစ်ဆေးခြင်း
  const nowTime = Date.now();
  const baseName = commandObj.names[0].toLowerCase();
  const cooldownAmount =
    typeof commandObj.cooldown === 'number'
      ? commandObj.cooldown
      : FAST_COMMANDS.has(baseName) || FAST_COMMANDS.has(commandName)
        ? 3000
        : 6000;

  const cooldownKey = `${message.author.id}_${baseName}`;

  if (cooldowns.has(cooldownKey)) {
    const userData = cooldowns.get(cooldownKey);
    const expirationTime = userData.timestamp + cooldownAmount;

    if (nowTime < expirationTime) {
      userData.spamCount += 1;
      const timeLeft = ((expirationTime - nowTime) / 1000).toFixed(1);

      if (userData.spamCount === 1) {
        return message.reply(`⏳ ဖြည်းဖြည်းရိုက်ပါခင်ဗျာ! နောက်ထပ် **${timeLeft} စက္ကန့်** စောင့်ပြီးမှ ပြန်ရိုက်ပါ။`);
      } else if (userData.spamCount === 2) {
        return message.reply(`⏳ ခဏလေး စောင့်ပေးပါဦးနော် (**${timeLeft}s** ကျန်ပါသေးတယ်)။`);
      }
      // ၃ ကြိမ်နှင့်အထက် ဆက်တိုက် Spam ပါက Channel မရှုပ်အောင် တိတ်ဆိတ်စွာ လျစ်လျူရှုမည်
      return;
    }
    clearTimeout(userData.timeoutId);
  }

  const timeoutId = setTimeout(() => cooldowns.delete(cooldownKey), cooldownAmount);
  cooldowns.set(cooldownKey, { timestamp: nowTime, spamCount: 0, timeoutId });

  processingUsers.add(message.author.id);
  try {
    const user = await getUser(message.author.id, message.author.username);

    // Bot အသုံးပြုခွင့် ပိတ်ခံထားရသော User စစ်ဆေးခြင်း
    if (user.isBanned && !isOwner(message.author.id)) {
      return message.reply('🚫 သင်သည် Keo Bot အသုံးပြုခွင့် ပိတ်ပင်ခံထားရပါသည်။');
    }

    await commandObj.execute(message, args, user, commandName);
  } catch (err) {
    console.error(`Command Error (${commandName}):`, err);
    await message.reply('⚠️ Command လုပ်ဆောင်ရာတွင် ယာယီအမှားတစ်ခု ဖြစ်ပွားသွားပါတယ်။ ခဏနေမှ ထပ်စမ်းကြည့်ပါ။').catch(() => {});
  } finally {
    processingUsers.delete(message.author.id);
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