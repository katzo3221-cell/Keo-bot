// Item Rank ၇ ဆင့် (Rank 1-3 ဆိုင်တွင်ဝယ်နိုင်သည် | Rank 4-7 Khunt နှင့် Kopen lc မှသာရနိုင်သည်)
const ITEM_RANKS = {
  1: { name: 'Common', emoji: '🟢', dropWeight: 35 },
  2: { name: 'Uncommon', emoji: '🔵', dropWeight: 27 },
  3: { name: 'Rare', emoji: '🟣', dropWeight: 18 },
  4: { name: 'Epic', emoji: '🟠', dropWeight: 10 },
  5: { name: 'Legendary', emoji: '🔴', dropWeight: 6 },
  6: { name: 'Mythical', emoji: '🔮', dropWeight: 3 },
  7: { name: 'Celestial', emoji: '🌌', dropWeight: 1 },
};

const ITEM_TYPE_LABELS = {
  luck: '🍀 Lucky Item (ရှားပါးကောင် မိနိုင်ခြေတိုး)',
  extra: '🕸️ Extra Catch Item (အပိုအကောင်ရေတိုး)',
  multiplier: '⚡ Multiplier Item (အကောင်ရေ ၂ ဆတိုး)',
};

// အမျိုးအစား ၃ မျိုး × Rank ၇ ဆင့် = စုစုပေါင်း ၂၁ မျိုး
const SHOP_ITEMS = [
  // ================= ၁။ Lucky Items (luck1 - luck7) =================
  { id: 'luck1', type: 'luck', rank: 1, shopAvailable: true, name: 'သစ်သားအဆောင် (Wooden Charm)', price: 500, luckBonus: 4, extraCatch: 0, catchMultiplier: 1, maxUses: 15, desc: 'Hunt Luck +4% (၁၅ ကြိမ်သုံး)' },
  { id: 'luck2', type: 'luck', rank: 2, shopAvailable: true, name: 'ငွေရောင်လေးရွက်ပင် (Silver Clover)', price: 1800, luckBonus: 8, extraCatch: 0, catchMultiplier: 1, maxUses: 25, desc: 'Hunt Luck +8% (၂၅ ကြိမ်သုံး)' },
  { id: 'luck3', type: 'luck', rank: 3, shopAvailable: true, name: 'ကျောက်သလင်းအဆောင် (Crystal Relic)', price: 4500, luckBonus: 12, extraCatch: 0, catchMultiplier: 1, maxUses: 35, desc: 'Hunt Luck +12% (၃၅ ကြိမ်သုံး)' },
  { id: 'luck4', type: 'luck', rank: 4, shopAvailable: false, name: 'ရွှေသံလိုက်အိမ်မြှောင် (Golden Compass)', price: 0, luckBonus: 16, extraCatch: 0, catchMultiplier: 1, maxUses: 50, desc: 'Hunt Luck +16% (၅၀ ကြိမ်သုံး)' },
  { id: 'luck5', type: 'luck', rank: 5, shopAvailable: false, name: 'နဂါးမျက်ရည်ကျောက် (Dragon Tear)', price: 0, luckBonus: 20, extraCatch: 0, catchMultiplier: 1, maxUses: 75, desc: 'Hunt Luck +20% (၇၅ ကြိမ်သုံး)' },
  { id: 'luck6', type: 'luck', rank: 6, shopAvailable: false, name: 'နတ်ဒေဝါသရဖူ (Mythic Crown)', price: 0, luckBonus: 25, extraCatch: 0, catchMultiplier: 1, maxUses: 100, desc: 'Hunt Luck +25% (၁၀၀ ကြိမ်သုံး)' },
  { id: 'luck7', type: 'luck', rank: 7, shopAvailable: false, name: 'စကြဝဠာစက်ဝိုင်း (Celestial Halo)', price: 0, luckBonus: 30, extraCatch: 0, catchMultiplier: 1, maxUses: 150, desc: 'Hunt Luck +30% (၁၅၀ ကြိမ်သုံး)' },

  // ================= ၂။ Extra Catch Items (net1 - net7) =================
  { id: 'net1', type: 'extra', rank: 1, shopAvailable: true, name: 'ပိုက်ကွန်ငယ် (Small Net)', price: 600, luckBonus: 0, extraCatch: 1, catchMultiplier: 1, maxUses: 15, desc: '+1 ကောင် အပိုဖမ်းမိသည် (၁၅ ကြိမ်သုံး)' },
  { id: 'net2', type: 'extra', rank: 2, shopAvailable: true, name: 'မုဆိုးပိုက်ကွန် (Hunter Net)', price: 1800, luckBonus: 0, extraCatch: 1, catchMultiplier: 1, maxUses: 25, desc: '+1 ကောင် အပိုဖမ်းမိသည် (၂၅ ကြိမ်သုံး)' },
  { id: 'net3', type: 'extra', rank: 3, shopAvailable: true, name: 'သံမဏိပိုက်ကွန် (Steel Net)', price: 4800, luckBonus: 0, extraCatch: 2, catchMultiplier: 1, maxUses: 35, desc: '+2 ကောင် အပိုဖမ်းမိသည် (၃၅ ကြိမ်သုံး)' },
  { id: 'net4', type: 'extra', rank: 4, shopAvailable: false, name: 'ရွှေပိုက်ကွန် (Golden Net)', price: 0, luckBonus: 0, extraCatch: 2, catchMultiplier: 1, maxUses: 50, desc: '+2 ကောင် အပိုဖမ်းမိသည် (၅၀ ကြိမ်သုံး)' },
  { id: 'net5', type: 'extra', rank: 5, shopAvailable: false, name: 'နဂါးဖမ်းပိုက်ကွန် (Dragon Net)', price: 0, luckBonus: 0, extraCatch: 3, catchMultiplier: 1, maxUses: 75, desc: '+3 ကောင် အပိုဖမ်းမိသည် (၇၅ ကြိမ်သုံး)' },
  { id: 'net6', type: 'extra', rank: 6, shopAvailable: false, name: 'နတ်ဒေဝါလှောင်အိမ် (Mythic Trap)', price: 0, luckBonus: 0, extraCatch: 3, catchMultiplier: 1, maxUses: 100, desc: '+3 ကောင် အပိုဖမ်းမိသည် (၁၀၀ ကြိမ်သုံး)' },
  { id: 'net7', type: 'extra', rank: 7, shopAvailable: false, name: 'စကြဝဠာဖမ်းကွင်း (Celestial Snare)', price: 0, luckBonus: 0, extraCatch: 4, catchMultiplier: 1, maxUses: 150, desc: '+4 ကောင် အပိုဖမ်းမိသည် (၁၅၀ ကြိမ်သုံး)' },

  // ================= ၃။ Multiplier Items (x1 - x7 : 2x နှစ်ဆ + Rank အလိုက် အကြိမ်ရေသာ တိုးသည်) =================
  { id: 'x1', type: 'multiplier', rank: 1, shopAvailable: true, name: 'သစ်သားလှောင်အိမ် (Wooden Cage)', price: 1000, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 15, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၁၅ ကြိမ်သုံး)' },
  { id: 'x2', type: 'multiplier', rank: 2, shopAvailable: true, name: 'မုဆိုးလှောင်အိမ် (Hunter Cage)', price: 2800, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 25, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၂၅ ကြိမ်သုံး)' },
  { id: 'x3', type: 'multiplier', rank: 3, shopAvailable: true, name: 'သံမဏိလှောင်အိမ် (Steel Cage)', price: 6500, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 35, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၃၅ ကြိမ်သုံး)' },
  { id: 'x4', type: 'multiplier', rank: 4, shopAvailable: false, name: 'ရွှေလှောင်အိမ် (Golden Cage)', price: 0, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 50, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၅၀ ကြိမ်သုံး)' },
  { id: 'x5', type: 'multiplier', rank: 5, shopAvailable: false, name: 'နဂါးလှောင်အိမ် (Dragon Cage)', price: 0, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 75, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၇၅ ကြိမ်သုံး)' },
  { id: 'x6', type: 'multiplier', rank: 6, shopAvailable: false, name: 'နတ်ဒေဝါစက်လုံး (Mythic Orb)', price: 0, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 100, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၁၀၀ ကြိမ်သုံး)' },
  { id: 'x7', type: 'multiplier', rank: 7, shopAvailable: false, name: 'စကြဝဠာစက်လုံး (Celestial Orb)', price: 0, luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 150, desc: '2x နှစ်ဆ ဖမ်းမိသည် (၁၅၀ ကြိမ်သုံး)' },
];

// Database ထဲတွင် ကျန်ရှိနေနိုင်သော အဟောင်း Hunt Item ID များ
const LEGACY_ITEMS = {
  bow: { id: 'bow', type: 'luck', rank: 1, name: 'သစ်သားလေးမြား (Old Bow)', luckBonus: 4, extraCatch: 0, catchMultiplier: 1, maxUses: 15, desc: 'Hunt Luck +4%' },
  bow1: { id: 'bow1', type: 'luck', rank: 1, name: 'သစ်သားလေးမြား (Old Bow 1)', luckBonus: 4, extraCatch: 0, catchMultiplier: 1, maxUses: 15, desc: 'Hunt Luck +4%' },
  bow2: { id: 'bow2', type: 'luck', rank: 2, name: 'မုဆိုးလေးမြား (Old Bow 2)', luckBonus: 8, extraCatch: 0, catchMultiplier: 1, maxUses: 25, desc: 'Hunt Luck +8%' },
  rifle: { id: 'rifle', type: 'luck', rank: 3, name: 'အမဲလိုက်သေနတ် (Old Rifle)', luckBonus: 12, extraCatch: 0, catchMultiplier: 1, maxUses: 25, desc: 'Hunt Luck +12%' },
  rifle3: { id: 'rifle3', type: 'luck', rank: 3, name: 'အမဲလိုက်သေနတ် (Old Rifle 3)', luckBonus: 12, extraCatch: 0, catchMultiplier: 1, maxUses: 35, desc: 'Hunt Luck +12%' },
  charm: { id: 'charm', type: 'luck', rank: 5, name: 'နဂါးအဆောင် (Old Charm)', luckBonus: 20, extraCatch: 0, catchMultiplier: 1, maxUses: 40, desc: 'Hunt Luck +20%' },
  charm5: { id: 'charm5', type: 'luck', rank: 5, name: 'နဂါးအဆောင် (Old Charm 5)', luckBonus: 20, extraCatch: 0, catchMultiplier: 1, maxUses: 75, desc: 'Hunt Luck +20%' },
  net: { id: 'net', type: 'extra', rank: 1, name: 'အမဲလိုက်ပိုက်ကွန် (Old Net)', luckBonus: 0, extraCatch: 1, catchMultiplier: 1, maxUses: 20, desc: '+1 ကောင် အပိုဖမ်းမိသည်' },
  cage: { id: 'cage', type: 'multiplier', rank: 1, name: 'လှောင်အိမ်ကြီး (Old Cage)', luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 15, desc: '2x နှစ်ဆ ဖမ်းမိသည်' },
  cage6: { id: 'cage6', type: 'multiplier', rank: 6, name: 'နတ်ဒေဝါလှောင်အိမ် (Old Cage 6)', luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 100, desc: '2x နှစ်ဆ ဖမ်းမိသည်' },
  orb7: { id: 'orb7', type: 'multiplier', rank: 7, name: 'စကြဝဠာစက်လုံး (Old Orb 7)', luckBonus: 0, extraCatch: 0, catchMultiplier: 2, maxUses: 150, desc: '2x နှစ်ဆ ဖမ်းမိသည်' },
};

function findItemById(id) {
  if (!id) return null;
  const key = id.toLowerCase().trim();
  return SHOP_ITEMS.find((i) => i.id === key) || LEGACY_ITEMS[key] || null;
}

// သတ်မှတ်ထားသော အမျိုးအစား (luck / extra / multiplier) ထဲမှ လက်ရှိတပ်ဆင်သုံးနေသော Item ကို ရှာခြင်း
function getActiveItemByType(user, type) {
  for (const id of user.items || []) {
    const info = findItemById(id);
    if (info && info.type === type) {
      return info;
    }
  }
  return null;
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

// Drop မှ ရရှိသော Item ကို ထည့်ပေးခြင်း (အဲဒီအမျိုးအစား Slot လွတ်နေရင် တန်းတပ်ပေးမည်၊ သုံးနေဆဲရှိရင် အိတ်ထဲ သိမ်းထားပေးမည်)
function receiveDroppedItem(user, item) {
  if (!user.items) user.items = [];
  if (!user.itemUses) user.itemUses = {};
  if (!user.storedItems) user.storedItems = {};

  const activeSameType = getActiveItemByType(user, item.type);
  if (!activeSameType) {
    user.items.push(item.id);
    user.itemUses[item.id] = item.maxUses;
    user.markModified('itemUses');
    return { equipped: true, uses: item.maxUses };
  } else {
    user.storedItems[item.id] = (user.storedItems[item.id] || 0) + 1;
    user.markModified('storedItems');
    return { equipped: false, activeItem: activeSameType };
  }
}

// အမဲလိုက်ရာတွင် အမျိုးအစား ၃ မျိုးလုံးမှ တပ်ဆင်ထားသော Item တစ်ခုစီကိုသာ ရယူခြင်း
function getActiveHuntItems(user) {
  return {
    luck: getActiveItemByType(user, 'luck'),
    extra: getActiveItemByType(user, 'extra'),
    multiplier: getActiveItemByType(user, 'multiplier'),
  };
}

// အသုံးပြုလိုက်သော Active Item များ၏ အကြိမ်ရေကို ၁ ကြိမ်စီ လျှော့ချခြင်း
function consumeActiveHuntItems(user, activeMap) {
  if (!user.items || user.items.length === 0) return '';
  if (!user.itemUses) user.itemUses = {};

  const brokenMessages = [];
  const usedItems = [activeMap.luck, activeMap.extra, activeMap.multiplier].filter(Boolean);

  for (const itemInfo of usedItems) {
    if (!user.items.includes(itemInfo.id)) continue;
    const currentUses = user.itemUses[itemInfo.id] !== undefined ? user.itemUses[itemInfo.id] : itemInfo.maxUses;
    const remaining = currentUses - 1;

    if (remaining <= 0) {
      user.items = user.items.filter((id) => id !== itemInfo.id);
      delete user.itemUses[itemInfo.id];
      const rInfo = ITEM_RANKS[itemInfo.rank] || ITEM_RANKS[1];
      brokenMessages.push(`⚠️ သင်၏ ${rInfo.emoji} **${itemInfo.name}** (\`${itemInfo.id}\`) အကြိမ်ရေ ကုန်သွား၍ ပျက်စီးသွားပါပြီ!`);
    } else {
      user.itemUses[itemInfo.id] = remaining;
    }
  }

  user.markModified('itemUses');
  return brokenMessages.length > 0 ? `\n${brokenMessages.join('\n')}` : '';
}

module.exports = {
  ITEM_RANKS,
  ITEM_TYPE_LABELS,
  SHOP_ITEMS,
  findItemById,
  getActiveItemByType,
  rollRandomItem,
  receiveDroppedItem,
  getActiveHuntItems,
  consumeActiveHuntItems,
};