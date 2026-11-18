require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const { getUser } = require('./models/User');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,x
  ],
});

// Anti-Spam Cooldown Map
const cooldowns = new Map();

// commands/ ဖိုဒါထဲမှ Command ဖိုင်အားလုံးကို အလိုအလျောက် ဖတ်ယူခြင်း
const commandMap = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const fileCommands = require(path.join(commandsPath, file));
  for (const cmd of fileCommands) {
    for (const name of cmd.names) {
      commandMap.set(name.toLowerCase(), cmd);
    }
  }
}

// MongoDB Cloud Database ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Database ချိတ်ဆက်မှု အောင်မြင်ပါသည်!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

client.once('clientReady', () => {
  console.log(`${client.user.tag} အနေဖြင့် Keo Bot စနစ်အပြည့်အစုံ စတင်ပါပြီ! (Commands: ${commandMap.size})`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.toLowerCase().startsWith('k')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const commandObj = commandMap.get(commandName);
  if (!commandObj) return;

  // Anti-Spam Cooldown စစ်ဆေးခြင်း (၈ စက္ကန့်)
  const nowTime = Date.now();
  const cooldownAmount = 8000;

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
    await commandObj.execute(message, args, user, commandName);
  } catch (err) {
    console.error(`Command Error (${commandName}):`, err);
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