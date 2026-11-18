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

module.exports = { SHOP_ITEMS, useCategoryItems };