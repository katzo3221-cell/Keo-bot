// Item Rank ၇ ဆင့် အချက်အလက် (Rank 1-3 ဆိုင်တွင်ဝယ်နိုင်သည် | Rank 4-7 Kdaily & Khunt မှသာရနိုင်သည်)
const ITEM_RANKS = {
  1: { name: 'Rank 1 (Common)', emoji: '🟢', dropWeight: 35 },
  2: { name: 'Rank 2 (Uncommon)', emoji: '🔵', dropWeight: 27 },
  3: { name: 'Rank 3 (Rare)', emoji: '🟣', dropWeight: 18 },
  4: { name: 'Rank 4 (Epic)', emoji: '🟠', dropWeight: 10 },
  5: { name: 'Rank 5 (Legendary)', emoji: '🔴', dropWeight: 6 },
  6: { name: 'Rank 6 (Mythical)', emoji: '🔮', dropWeight: 3 },
  7: { name: 'Rank 7 (Celestial)', emoji: '🌌', dropWeight: 1 },
};

const SHOP_ITEMS = [
  // 🟢 Rank 1 (ဆိုင်တွင် ဝယ်ယူနိုင်သည် - 15 ကြိမ်သုံး)
  { id: 'bow1', rank: 1, shopAvailable: true, name: 'သစ်သားလေးမြား (Wooden Bow)', price: 500, luckBonus: 4, extraCatch: 0, catchMultiplier: 1, maxUses: 15, category: 'hunt', desc: 'Hunt Luck +4% (၁၅ ကြိမ်သုံး)' },

  // 🔵 Rank 2 (ဆိုင်တွင် ဝယ်ယူနိုင်သည် - 25 ကြိမ်သုံး)
  { id: 'bow2', rank: 2, shopAvailable: true, name: 'မုဆိုးလေးမြား (Hunter Bow)', price: 1800, luckBonus: 8, extraCatch: 0, catchMultiplier: 1, maxUses: 25, category: 'hunt', desc: 'Hunt Luck +8% (၂၅ ကြိမ်သုံး)' },

  // 🟣 Rank 3 (ဆိုင်တွင် ဝယ်ယူနိုင်သည် - 35 ကြိမ်သုံး)
  { id: 'rifle3', rank: 3, shopAvailable: true, name: 'အမဲလိုက်သေနတ် (Hunting Rifle)', price: 4500, luckBonus: 12, extraCatch: 0, catchMultiplier: 1, maxUses: 35, category: 'hunt', desc: 'Hunt Luck +12% (၃၅ ကြိမ်သုံး)' },

  // 🟠 Rank 4 (Kdaily နှင့် Khunt မှသာ ရနိုင်သည် - 50 ကြိမ်သုံး)
  { id: 'net4', rank: 4, shopAvailable: false, name: 'ရွှေပိုက်ကွန် (Golden Net)', price: 0, luckBonus: 16, extraCatch: 1, catchMultiplier: 1, maxUses: 50, category: 'hunt', desc: 'Hunt Luck +16% & +1 ကောင် အပိုဖမ်းမိသည် (၅၀ ကြိမ်သုံး)' },

  // 🔴 Rank 5 (Kdaily နှင့် Khunt မှသာ ရနိုင်သည် - 75 ကြိမ်သုံး)
  { id: 'charm5', rank: 5, shopAvailable: false, name: 'နဂါးအဆောင် (Dragon Charm)', price: 0, luckBonus: 20, extraCatch: 1, catchMultiplier: 1, maxUses: 75, category: 'hunt', desc: 'Hunt Luck +20% & +1 ကောင် အပိုဖမ်းမိသည် (၇၅ ကြိမ်သုံး)' },

  // 🔮 Rank 6 (Kdaily နှင့် Khunt မှသာ ရနိုင်သည် - 100 ကြိမ်သုံး)
  { id: 'cage6', rank: 6, shopAvailable: false, name: 'နတ်ဒေဝါလှောင်အိမ် (Mythic Cage)', price: 0, luckBonus: 25, extraCatch: 0, catchMultiplier: 2, maxUses: 100, category: 'hunt', desc: 'Hunt Luck +25% & 2x နှစ်ဆ ဖမ်းမိသည် (၁၀၀ ကြိမ်သုံး)' },

  // 🌌 Rank 7 (Kdaily နှင့် Khunt မှသာ ရနိုင်သည် - 150 ကြိမ်သုံး / ရာကျော်)
  { id: 'orb7', rank: 7, shopAvailable: false, name: 'စကြဝဠာအမဲလိုက်စက်လုံး (Celestial Orb)', price: 0, luckBonus: 30, extraCatch: 0, catchMultiplier: 2, maxUses: 150, category: 'hunt', desc: 'Hunt Luck +30% & 2x နှစ်ဆ ဖမ်းမိသည် (၁၅၀ ကြိမ်သုံး)' },
];

// အဟောင်း Hunt Item ID များ Database ထဲတွင် ကျန်ရှိနေပါက ဆက်သုံးနိုင်ရန် ချိတ်ဆက်ပေးခြင်း
const LEGACY_ITEMS = {
  bow: { id: 'bow', rank: 1, name: 'လေးနှင့်မြား (Old Bow)', luckBonus: 4, extraCatch: 0, catchMultiplier: 1, maxUses: 15, category: 'hunt', desc: 'Hunt Luck +4%' },
  rifle: { id: 'rifle', rank: 3, name: 'အမဲလိုက်သေနတ် (Old Rifle)', luckBonus: 12, extraCatch: 0, catchMultiplier: 1, maxUses: 25, category: 'hunt', desc: 'Hunt Luck +12%' },
  charm: { id: 'charm', rank: 5, name: 'နဂါးအဆောင် (Old Charm)', luckBonus: 20, extraCatch: 1, catchMultiplier: 1, maxUses: 40, category: 'hunt', desc: 'Hunt Luck +20%' },
  net: { id: 'net', rank: 4, name: 'အမဲလိုက်ပိုက်ကွန် (Old Net)', luckBonus: 12, extraCatch: 1, catchMultiplier: 1, maxUses: 20, category: 'hunt', desc: '+1 ကောင် အပိုဖမ်းမိသည်' },
  cage: { id: 'cage', rank: 6, name: 'လှောင်အိမ်ကြီး (Old Cage)', luckBonus: 20, extraCatch: 0, catchMultiplier: 2, maxUses: 15, category: 'hunt', desc: '2x နှစ်ဆ ဖမ်းမိသည်' },
};

function findItemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || LEGACY_ITEMS[id] || null;
}

// Rank 1 မှ 7 အတွင်း Random Hunt Item တစ်ခု ကျပန်းရွေးချယ်ပေးမည့် Function
function rollRandomItem() {
  const weighted = SHOP_ITEMS.map((item) => {
    const rankWeight = ITEM_RANKS[item.rank]?.dropWeight || 10;
    return { item, weight: rankWeight };
  });
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  let acc = 0;

  for (const entry of weighted) {
    acc += entry.weight;
    if (roll <= acc) return entry.item;
  }
  return weighted[0].item;
}

// ကစားသမားထံ Item ထည့်ပေးခြင်း (ရှိပြီးသားဆိုလျှင် အသုံးပြုခွင့် အကြိမ်ရေ ထပ်ပေါင်းပေးမည်)
function grantItemToUser(user, item) {
  if (!user.items) user.items = [];
  if (!user.itemUses) user.itemUses = {};

  if (user.items.includes(item.id)) {
    const currentUses = user.itemUses[item.id] !== undefined ? user.itemUses[item.id] : item.maxUses;
    user.itemUses[item.id] = currentUses + item.maxUses;
  } else {
    user.items.push(item.id);
    user.itemUses[item.id] = item.maxUses;
  }
  user.markModified('itemUses');
  return user.itemUses[item.id];
}

// အမဲလိုက်ရာတွင် အမြင့်ဆုံး Hunt Item တစ်မျိုးတည်းကိုသာ ရွေးချယ်အသုံးပြုခြင်း
function getActiveHuntItem(user) {
  let bestItem = null;
  for (const id of user.items || []) {
    const info = findItemById(id);
    if (info && info.category === 'hunt') {
      if (!bestItem || info.rank > bestItem.rank || info.luckBonus > bestItem.luckBonus) {
        bestItem = info;
      }
    }
  }
  return bestItem;
}

// သတ်မှတ်ထားသော Item တစ်ခု၏ အကြိမ်ရေကို ၁ ကြိမ် လျှော့ချခြင်း
function consumeSingleItem(user, itemId) {
  if (!itemId || !user.items || !user.items.includes(itemId)) return '';
  const itemInfo = findItemById(itemId);
  if (!itemInfo || !itemInfo.maxUses) return '';

  if (!user.itemUses) user.itemUses = {};
  const currentUses = user.itemUses[itemId] !== undefined ? user.itemUses[itemId] : itemInfo.maxUses;
  const remaining = currentUses - 1;

  user.markModified('itemUses');
  if (remaining <= 0) {
    user.items = user.items.filter((id) => id !== itemId);
    delete user.itemUses[itemId];
    return `\n⚠️ သင်၏ **${itemInfo.name}** အသုံးပြုခွင့် ပြည့်သွား၍ ပျက်စီးသွားပါပြီ!`;
  } else {
    user.itemUses[itemId] = remaining;
    return '';
  }
}

module.exports = {
  ITEM_RANKS,
  SHOP_ITEMS,
  findItemById,
  rollRandomItem,
  grantItemToUser,
  getActiveHuntItem,
  consumeSingleItem,
};