const ANIMALS = require('../data/animals');

// မြန်မာစံတော်ချိန် (UTC+6:30) ယနေ့ရက်စွဲ
function getTodayMyanmarDate() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// English ID သို့မဟုတ် မြန်မာနာမည်ဖြင့် တိရစ္ဆာန် ရှာဖွေခြင်း
function findAnimal(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  return (
    ANIMALS.find((a) => a.id.toLowerCase() === q) ||
    ANIMALS.find((a) => a.name.toLowerCase() === q) ||
    ANIMALS.find((a) => a.name.split(' (')[0].toLowerCase() === q)
  );
}

// Bot Owner ID စစ်ဆေးခြင်း (.env ထဲမှ OWNER_ID)
function isOwner(userId) {
  const owners = (process.env.OWNER_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return owners.includes(userId);
}

module.exports = {
  getTodayMyanmarDate,
  findAnimal,
  isOwner,
};