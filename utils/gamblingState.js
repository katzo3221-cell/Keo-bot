const activeGambling = new Set();
const MAX_BET = 250000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// လောင်းကြေးပမာဏ တွက်ထုတ်ခြင်း (all သို့မဟုတ် ဂဏန်း)
function parseBet(rawArg, balance) {
  if (!rawArg) return NaN;
  if (rawArg.toLowerCase() === 'all') {
    return Math.min(balance, MAX_BET);
  }
  const num = parseInt(rawArg, 10);
  if (isNaN(num)) return NaN;
  return Math.min(num, MAX_BET);
}

// Command တွင် Mention (@user) နှင့် လောင်းကြေး ရှေ့နောက် ဘယ်လိုရိုက်ရိုက် ဖတ်ပေးခြင်း
// ဥပမာ: Kbj @user 1000 သို့မဟုတ် Kbj 1000 @user
function extractBetAndOpponent(message, args) {
  const opponent = message.mentions.users.first() || null;
  const nonMentionArgs = args.filter((a) => !/^<@!?\d+>$/.test(a));
  return {
    opponent,
    betArg: nonMentionArgs[0],
    extraArgs: nonMentionArgs.slice(1),
  };
}

// ၅၂ ချပ် ဖဲထုပ်အသစ် မွှေပေးခြင်း
function createShuffledDeck() {
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
  return deck;
}

// ဖဲချပ်များကို စာသားပုံစံ ပြောင်းခြင်း
function formatHand(hand, hideSecond = false) {
  if (hideSecond) {
    return `\`[ ${hand[0].rank}${hand[0].suit} ]\` \`[ ❓ ]\``;
  }
  return hand.map((c) => `\`[ ${c.rank}${c.suit} ]\``).join(' ');
}

module.exports = {
  activeGambling,
  MAX_BET,
  sleep,
  parseBet,
  extractBetAndOpponent,
  createShuffledDeck,
  formatHand,
};