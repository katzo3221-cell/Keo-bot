const { User, getUser } = require('../models/User');

// @mention သို့မဟုတ် Discord User ID မှ ကစားသမား Data ရှာယူခြင်း
async function resolveAdminTarget(message, rawArg) {
  if (!rawArg) return null;

  const trimmed = rawArg.trim();
  const mentionMatch = trimmed.match(/^<@!?(\d{17,20})>$/);
  const idMatch = trimmed.match(/^(\d{17,20})$/);
  const userId = mentionMatch ? mentionMatch[1] : idMatch ? idMatch[1] : null;

  if (!userId) return null;

  let discordUser = message.mentions.users.get(userId) || null;
  if (!discordUser) {
    discordUser = await message.client.users.fetch(userId).catch(() => null);
  }

  if (discordUser) {
    const dbUser = await getUser(discordUser.id, discordUser.username);
    return { id: discordUser.id, username: discordUser.username, dbUser };
  }

  const existing = await User.findOne({ userId });
  if (existing) {
    return { id: existing.userId, username: existing.username || userId, dbUser: existing };
  }

  return null;
}

// ကော်မာ (,) ပါသော ဂဏန်းများကိုပါ လက်ခံတွက်ချက်ခြင်း
function parseAmount(raw, allowZero = false) {
  if (raw === undefined || raw === null) return NaN;
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!/^\d+$/.test(cleaned)) return NaN;
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return NaN;
  if (allowZero ? num < 0 : num <= 0) return NaN;
  return num;
}

module.exports = {
  resolveAdminTarget,
  parseAmount,
};