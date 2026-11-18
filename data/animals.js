// အမဲလိုက်လျှင် ရနိုင်သော တိရစ္ဆာန် ၁၀၀ မျိုး - Rank 10 ဆင့် (စုစုပေါင်း chance = 100%)
const ANIMALS = [
  // 🟢 Rank 1: Common (သာမန် - စုစုပေါင်း 40.09%)
  { name: 'ပုရွက်ဆိတ် (Common)', emoji: '🐜', price: 5, chance: 5.09 },
  { name: 'ပိုးတောင်မာ (Common)', emoji: '🪲', price: 7, chance: 4.5 },
  { name: 'ဖားကလေး (Common)', emoji: '🐸', price: 9, chance: 4.5 },
  { name: 'ကြွက်ဖြူလေး (Common)', emoji: '🐭', price: 10, chance: 4.0 },
  { name: 'ကြက်ကလေး (Common)', emoji: '🐤', price: 12, chance: 4.0 },
  { name: 'ဘဲကလေး (Common)', emoji: '🦆', price: 14, chance: 4.0 },
  { name: 'ပျားကလေး (Common)', emoji: '🐝', price: 15, chance: 3.5 },
  { name: 'လိပ်ပြာလေး (Common)', emoji: '🦋', price: 16, chance: 3.5 },
  { name: 'ခရုပက်ကျိ (Common)', emoji: '🐌', price: 17, chance: 3.5 },
  { name: 'တီကောင်လေး (Common)', emoji: '🪱', price: 18, chance: 3.5 },

  // 🔵 Rank 2: Uncommon (အတွေ့ရနည်း - စုစုပေါင်း 25%)
  { name: 'ယုန်ဖြူလေး (Uncommon)', emoji: '🐇', price: 22, chance: 2.5 },
  { name: 'ရှဉ့်ကလေး (Uncommon)', emoji: '🐿️', price: 25, chance: 2.5 },
  { name: 'ဖြူကောင် (Uncommon)', emoji: '🦔', price: 28, chance: 2.5 },
  { name: 'လိပ်ကလေး (Uncommon)', emoji: '🐢', price: 32, chance: 2.5 },
  { name: 'ခိုဖြူလေး (Uncommon)', emoji: '🕊️', price: 35, chance: 2.5 },
  { name: 'ကြောင်ကလေး (Uncommon)', emoji: '🐱', price: 38, chance: 2.5 },
  { name: 'ခွေးပေါက်လေး (Uncommon)', emoji: '🐶', price: 42, chance: 2.5 },
  { name: 'ဆိတ်ကလေး (Uncommon)', emoji: '🐐', price: 45, chance: 2.5 },
  { name: 'သိုးကလေး (Uncommon)', emoji: '🐑', price: 48, chance: 2.5 },
  { name: 'ဝက်ပေါက်လေး (Uncommon)', emoji: '🐷', price: 50, chance: 2.5 },

  // 🟣 Rank 3: Rare (ရှားပါး - စုစုပေါင်း 15%)
  { name: 'မြေခွေး (Rare)', emoji: '🦊', price: 65, chance: 1.5 },
  { name: 'ရက်ကွန်း (Rare)', emoji: '🦝', price: 75, chance: 1.5 },
  { name: 'ဇီးကွက် (Rare)', emoji: '🦉', price: 85, chance: 1.5 },
  { name: 'သမင် (Rare)', emoji: '🦌', price: 95, chance: 1.5 },
  { name: 'ဝံပုလွေ (Rare)', emoji: '🐺', price: 110, chance: 1.5 },
  { name: 'တောဝက် (Rare)', emoji: '🐗', price: 125, chance: 1.5 },
  { name: 'မျောက်ကလေး (Rare)', emoji: '🐒', price: 140, chance: 1.5 },
  { name: 'လင်းနို့ (Rare)', emoji: '🦇', price: 155, chance: 1.5 },
  { name: 'ငန်းဖြူ (Rare)', emoji: '🦢', price: 170, chance: 1.5 },
  { name: 'ပင်ဂွင်း (Rare)', emoji: '🐧', price: 180, chance: 1.5 },

  // 🩵 Rank 4: Super Rare (အထူးရှားပါး - စုစုပေါင်း 9%)
  { name: 'သားပိုက်ကောင် (Super Rare)', emoji: '🦘', price: 250, chance: 0.9 },
  { name: 'ကိုအာလာ (Super Rare)', emoji: '🐨', price: 300, chance: 0.9 },
  { name: 'ပူးကောင်လေး (Super Rare)', emoji: '🐹', price: 350, chance: 0.9 },
  { name: 'မြင်းကျား (Super Rare)', emoji: '🦓', price: 400, chance: 0.9 },
  { name: 'သစ်ကုလားအုတ် (Super Rare)', emoji: '🦒', price: 450, chance: 0.9 },
  { name: 'ကုလားအုတ် (Super Rare)', emoji: '🐪', price: 500, chance: 0.9 },
  { name: 'ရေမြင်း (Super Rare)', emoji: '🦛', price: 550, chance: 0.9 },
  { name: 'ဖျံကလေး (Super Rare)', emoji: '🦦', price: 600, chance: 0.9 },
  { name: 'ဗီဗာဖျံ (Super Rare)', emoji: '🦫', price: 650, chance: 0.9 },
  { name: 'ဒေါင်းမင်း (Super Rare)', emoji: '🦚', price: 700, chance: 0.9 },

  // 🟠 Rank 5: Epic (သူရဲကောင်း - စုစုပေါင်း 5%)
  { name: 'သိမ်းငှက် (Epic)', emoji: '🦅', price: 1000, chance: 0.5 },
  { name: 'မိကျောင်း (Epic)', emoji: '🐊', price: 1200, chance: 0.5 },
  { name: 'ဝက်ဝံညို (Epic)', emoji: '🐻', price: 1400, chance: 0.5 },
  { name: 'ပန်ဒါဝက်ဝံ (Epic)', emoji: '🐼', price: 1600, chance: 0.5 },
  { name: 'ကျားသစ် (Epic)', emoji: '🐆', price: 1800, chance: 0.5 },
  { name: 'ဂေါ်ရီလာ (Epic)', emoji: '🦍', price: 2000, chance: 0.5 },
  { name: 'ကျွဲရိုင်း (Epic)', emoji: '🐃', price: 2200, chance: 0.5 },
  { name: 'ပြောင်ကြီး (Epic)', emoji: '🦬', price: 2400, chance: 0.5 },
  { name: 'လင်းပိုင် (Epic)', emoji: '🐬', price: 2600, chance: 0.5 },
  { name: 'ဖျံကြီး (Epic)', emoji: '🦭', price: 2800, chance: 0.5 },

  // 🟡 Rank 6: Ultra Epic (မဟာသူရဲကောင်း - စုစုပေါင်း 3%)
  { name: 'ဝင်ရိုးစွန်းဝက်ဝံ (Ultra Epic)', emoji: '🐻‍❄️', price: 3500, chance: 0.3 },
  { name: 'ငါးမန်းဖြူ (Ultra Epic)', emoji: '🦈', price: 3800, chance: 0.3 },
  { name: 'ဝေလငါး (Ultra Epic)', emoji: '🐋', price: 4200, chance: 0.3 },
  { name: 'ရေဘဝဲကြီး (Ultra Epic)', emoji: '🐙', price: 4600, chance: 0.3 },
  { name: 'မြွေဟောက်မင်း (Ultra Epic)', emoji: '🐍', price: 5000, chance: 0.3 },
  { name: 'ကင်းမြီးကောက် (Ultra Epic)', emoji: '🦂', price: 5400, chance: 0.3 },
  { name: 'ပင့်ကူနက်ကြီး (Ultra Epic)', emoji: '🕷️', price: 5800, chance: 0.3 },
  { name: 'လင်းယုန်မင်း (Ultra Epic)', emoji: '🪶', price: 6200, chance: 0.3 },
  { name: 'သမင်ချိုကြီး (Ultra Epic)', emoji: '🫎', price: 6600, chance: 0.3 },
  { name: 'အော်ရန်အူတန် (Ultra Epic)', emoji: '🦧', price: 7000, chance: 0.3 },

  // 🔴 Rank 7: Legendary (ဒဏ္ဍာရီလာ - စုစုပေါင်း 1.8%)
  { name: 'ခြင်္သေ့မင်း (Legendary)', emoji: '🦁', price: 8500, chance: 0.18 },
  { name: 'ကျားရဲ (Legendary)', emoji: '🐅', price: 9200, chance: 0.18 },
  { name: 'ဆင်ပြောင်ကြီး (Legendary)', emoji: '🐘', price: 10000, chance: 0.18 },
  { name: 'ကြံ့သူတော် (Legendary)', emoji: '🦏', price: 10800, chance: 0.18 },
  { name: 'ကျားနက်ကြီး (Legendary)', emoji: '🐈‍⬛', price: 11500, chance: 0.18 },
  { name: 'ဝံပုလွေဖြူ (Legendary)', emoji: '🐺', price: 12200, chance: 0.18 },
  { name: 'ဝေလငါးပြာ (Legendary)', emoji: '🐳', price: 13000, chance: 0.18 },
  { name: 'မမ်မွတ်ဆင်ကြီး (Legendary)', emoji: '🦣', price: 13800, chance: 0.18 },
  { name: 'တီရက်စ်ဒိုင်နိုဆော (Legendary)', emoji: '🦖', price: 14500, chance: 0.18 },
  { name: 'ဘရွန်တိုဆောရပ် (Legendary)', emoji: '🦕', price: 15000, chance: 0.18 },

  // 🟣 Rank 8: Mythical (နတ်ဒေဝါ - စုစုပေါင်း 0.8%)
  { name: 'ယူနီကွန်း (Mythical)', emoji: '🦄', price: 18000, chance: 0.08 },
  { name: 'နဂါးမင်း (Mythical)', emoji: '🐉', price: 19500, chance: 0.08 },
  { name: 'မီးငှက်ဖီးနစ် (Mythical)', emoji: '🔥', price: 21000, chance: 0.08 },
  { name: 'တောင်ပံပါမြင်းပျံ (Mythical)', emoji: '🪽', price: 22000, chance: 0.08 },
  { name: 'ရေသူမဘုရင်မ (Mythical)', emoji: '🧜‍♀️', price: 23500, chance: 0.08 },
  { name: 'နတ်သမီးလေး (Mythical)', emoji: '🧚', price: 25000, chance: 0.08 },
  { name: 'ဝိညာဉ်မြေခွေး (Mythical)', emoji: '🦊', price: 26500, chance: 0.08 },
  { name: 'ရေခဲနဂါး (Mythical)', emoji: '🐲', price: 27500, chance: 0.08 },
  { name: 'ကျောက်စိမ်းလိပ်ကြီး (Mythical)', emoji: '🐢', price: 28800, chance: 0.08 },
  { name: 'ရွှေသိမ်းငှက် (Mythical)', emoji: '🦅', price: 30000, chance: 0.08 },

  // ✨ Rank 9: Divine (နတ်ဘုရားအဆင့် - စုစုပေါင်း 0.3%)
  { name: 'မိုးကြိုးခြင်္သေ့ (Divine)', emoji: '⚡', price: 35000, chance: 0.03 },
  { name: 'နေမင်းကျားရဲ (Divine)', emoji: '☀️', price: 38000, chance: 0.03 },
  { name: 'လမင်းဝံပုလွေ (Divine)', emoji: '🌙', price: 41000, chance: 0.03 },
  { name: 'ပင်လယ်စောင့်နဂါး (Divine)', emoji: '🌊', price: 44000, chance: 0.03 },
  { name: 'မီးတောင်နဂါး (Divine)', emoji: '🌋', price: 47000, chance: 0.03 },
  { name: 'လေမုန်တိုင်းငှက် (Divine)', emoji: '🌪️', price: 50000, chance: 0.03 },
  { name: 'ရွှေရောင်ယူနီကွန်း (Divine)', emoji: '🌟', price: 52500, chance: 0.03 },
  { name: 'နတ်ဘုရားဆင်ဖြူတော် (Divine)', emoji: '👑', price: 55000, chance: 0.03 },
  { name: 'သက်တံ့ဖီးနစ် (Divine)', emoji: '🌈', price: 57500, chance: 0.03 },
  { name: 'အမှောင်ထုနဂါး (Divine)', emoji: '🌑', price: 60000, chance: 0.03 },

  // 🌌 Rank 10: Celestial (စကြဝဠာအရှင် - စုစုပေါင်း 0.01% / ၁၀,၀၀၀ မှ ၁ ကောင်)
  { name: 'ကြယ်တာရာနဂါး (Celestial)', emoji: '🌠', price: 75000, chance: 0.001 },
  { name: 'ဂလက်ဆီဖီးနစ် (Celestial)', emoji: '🌌', price: 82000, chance: 0.001 },
  { name: 'အချိန်စောင့်နတ်မင်း (Celestial)', emoji: '⏳', price: 90000, chance: 0.001 },
  { name: 'စကြဝဠာခြင်္သေ့မင်း (Celestial)', emoji: '🪐', price: 98000, chance: 0.001 },
  { name: 'အနန္တနဂါးချုပ် (Celestial)', emoji: '♾️', price: 105000, chance: 0.001 },
  { name: 'ကောင်းကင်ဘုံအရှင် (Celestial)', emoji: '🏯', price: 115000, chance: 0.001 },
  { name: 'နေစကြဝဠာဝေလငါး (Celestial)', emoji: '☄️', price: 125000, chance: 0.001 },
  { name: 'နတ်ဘုရားဘုရင် (Celestial)', emoji: '🔱', price: 135000, chance: 0.001 },
  { name: 'ကမ္ဘာဦးနဂါးမင်း (Celestial)', emoji: '🐉', price: 142000, chance: 0.001 },
  { name: 'စကြဝဠာအရှင်သခင် (Celestial)', emoji: '👑', price: 150000, chance: 0.001 },
];

module.exports = ANIMALS;
