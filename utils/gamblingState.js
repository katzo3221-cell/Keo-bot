const MAX_BET = 250000;
const LOCK_TTL_MS = 2 * 60 * 1000; // ၂ မိနစ်ကျော်ပြီး ကျန်နေသော Lock များကို အလိုအလျောက် ဖြုတ်ပေးမည်

// တစ်ချိန်တည်း လောင်းကစားပွဲ ထပ်မဆော့နိုင်ရန် ထိန်းချုပ်မည့် Auto-Expire Lock
const lockStore = new Map();
const activeGambling = {
  has(userId) {
    const expiresAt = lockStore.get(userId);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      lockStore.delete(userId);
      return false;
    }
    return true;
  },
  add(userId, ttlMs = LOCK_TTL_MS) {
    lockStore.set(userId, Date.now() + ttlMs);
    return this;
  },
  delete(userId) {
    return lockStore.delete(userId);
  },
  clear() {
    lockStore.clear();
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// လောင်းကြေး ဖတ်ယူခြင်း (all ရိုက်ပါက Max Bet 250,000 အထိသာ ယူမည်)
function parseBet(rawArg, balance) {
  if (!rawArg) return NaN;
  const cleaned = String(rawArg).replace(/,/g, '').trim().toLowerCase();
  if (cleaned === 'all') {
    return Math.min(Math.floor(balance), MAX_BET);
  }
  if (!/^\d+$/.test(cleaned)) return NaN;
  return parseInt(cleaned, 10);
}

// လောင်းကြေး စစ်ဆေးခြင်း (Max Bet 250,000 နှင့် လက်ကျန်ငွေ အပါအဝင်)
function validateBet(rawArg, balance, usageExample) {
  if (!rawArg) {
    return { bet: null, error: `❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (${usageExample})` };
  }

  const cleaned = String(rawArg).replace(/,/g, '').trim().toLowerCase();
  if (cleaned === 'all' && balance <= 0) {
    return { bet: null, error: '❌ လက်ကျန်ငွေ မလုံလောက်ပါ!' };
  }

  const bet = parseBet(rawArg, balance);
  if (isNaN(bet) || bet <= 0) {
    return { bet: null, error: `❌ လောင်းကြေးပမာဏ မှန်ကန်စွာ ထည့်ပါ။ (${usageExample})` };
  }
  if (bet > MAX_BET) {
    return {
      bet: null,
      error: `❌ တစ်ပွဲလျှင် အများဆုံး **${MAX_BET.toLocaleString()} coins** အထိသာ လောင်းနိုင်ပါတယ်!`,
    };
  }
  if (bet > balance) {
    return { bet: null, error: '❌ လက်ကျန်ငွေ မလုံလောက်ပါ!' };
  }

  return { bet, error: null };
}

// Mention ခေါ်ထားသော ပြိုင်ဘက်နှင့် လောင်းကြေး ခွဲထုတ်ခြင်း
function extractBetAndOpponent(message, args) {
  const opponent = message.mentions.users.first() || null;
  const betArg = args.find((a) => !a.startsWith('<@')) || null;
  return { opponent, betArg };
}

// ၅၂ ချပ် ဖဲထုပ် အသစ်မွှေခြင်း (Fisher-Yates Shuffle)
function createShuffledDeck() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ဖဲချပ်များကို စာသားပုံစံ ဖော်ပြခြင်း
function formatHand(hand, hideRest = false) {
  return hand
    .map((card, idx) => (hideRest && idx > 0 ? '`[ ❓ ]`' : `\`[ ${card.rank}${card.suit} ]\``))
    .join(' ');
}

module.exports = {
  MAX_BET,
  activeGambling,
  sleep,
  parseBet,
  validateBet,
  extractBetAndOpponent,
  createShuffledDeck,
  formatHand,
};