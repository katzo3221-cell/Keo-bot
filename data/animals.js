// အမဲလိုက်လျှင် ရနိုင်သော တိရစ္ဆာန် ၁၀၀ မျိုး - Rank 10 ဆင့် (Same Price Per Rank)
const ANIMALS = [
  // 🟢 Rank 1: Common (သာမန် - စုစုပေါင်း 46.479% | ဈေးနှုန်း: 5 coins)
  { id: 'ant', name: 'ပုရွက်ဆိတ် (Common)', emoji: '🐜', price: 5, chance: 5.479 },
  { id: 'beetle', name: 'ပိုးတောင်မာ (Common)', emoji: '🪲', price: 5, chance: 5.0 },
  { id: 'frog', name: 'ဖားကလေး (Common)', emoji: '🐸', price: 5, chance: 5.0 },
  { id: 'mouse', name: 'ကြွက်ဖြူလေး (Common)', emoji: '🐭', price: 5, chance: 5.0 },
  { id: 'chick', name: 'ကြက်ကလေး (Common)', emoji: '🐤', price: 5, chance: 4.5 },
  { id: 'duck', name: 'ဘဲကလေး (Common)', emoji: '🦆', price: 5, chance: 4.5 },
  { id: 'bee', name: 'ပျားကလေး (Common)', emoji: '🐝', price: 5, chance: 4.5 },
  { id: 'butterfly', name: 'လိပ်ပြာလေး (Common)', emoji: '🦋', price: 5, chance: 4.5 },
  { id: 'snail', name: 'ခရုပက်ကျိ (Common)', emoji: '🐌', price: 5, chance: 4.0 },
  { id: 'lizard', name: 'အိမ်မြှောင်လေး (Common)', emoji: '🦎', price: 5, chance: 4.0 },

  // 🔵 Rank 2: Uncommon (အတွေ့ရနည်း - စုစုပေါင်း 25% | ဈေးနှုန်း: 20 coins)
  { id: 'rabbit', name: 'ယုန်ဖြူလေး (Uncommon)', emoji: '🐇', price: 20, chance: 2.5 },
  { id: 'squirrel', name: 'ရှဉ့်ကလေး (Uncommon)', emoji: '🐿️', price: 20, chance: 2.5 },
  { id: 'hedgehog', name: 'ဖြူကောင် (Uncommon)', emoji: '🦔', price: 20, chance: 2.5 },
  { id: 'turtle', name: 'လိပ်ကလေး (Uncommon)', emoji: '🐢', price: 20, chance: 2.5 },
  { id: 'dove', name: 'ခိုဖြူလေး (Uncommon)', emoji: '🕊️', price: 20, chance: 2.5 },
  { id: 'cat', name: 'ကြောင်ကလေး (Uncommon)', emoji: '🐱', price: 20, chance: 2.5 },
  { id: 'dog', name: 'ခွေးပေါက်လေး (Uncommon)', emoji: '🐶', price: 20, chance: 2.5 },
  { id: 'goat', name: 'ဆိတ်ကလေး (Uncommon)', emoji: '🐐', price: 20, chance: 2.5 },
  { id: 'sheep', name: 'သိုးကလေး (Uncommon)', emoji: '🐑', price: 20, chance: 2.5 },
  { id: 'pig', name: 'ဝက်ပေါက်လေး (Uncommon)', emoji: '🐷', price: 20, chance: 2.5 },

  // 🟣 Rank 3: Rare (ရှားပါး - စုစုပေါင်း 14% | ဈေးနှုန်း: 50 coins)
  { id: 'fox', name: 'မြေခွေး (Rare)', emoji: '🦊', price: 50, chance: 1.4 },
  { id: 'raccoon', name: 'ရက်ကွန်း (Rare)', emoji: '🦝', price: 50, chance: 1.4 },
  { id: 'owl', name: 'ဇီးကွက် (Rare)', emoji: '🦉', price: 50, chance: 1.4 },
  { id: 'deer', name: 'သမင် (Rare)', emoji: '🦌', price: 50, chance: 1.4 },
  { id: 'wolf', name: 'ဝံပုလွေ (Rare)', emoji: '🐺', price: 50, chance: 1.4 },
  { id: 'boar', name: 'တောဝက် (Rare)', emoji: '🐗', price: 50, chance: 1.4 },
  { id: 'monkey', name: 'မျောက်ကလေး (Rare)', emoji: '🐒', price: 50, chance: 1.4 },
  { id: 'bat', name: 'လင်းနို့ (Rare)', emoji: '🦇', price: 50, chance: 1.4 },
  { id: 'swan', name: 'ငန်းဖြူ (Rare)', emoji: '🦢', price: 50, chance: 1.4 },
  { id: 'penguin', name: 'ပင်ဂွင်း (Rare)', emoji: '🐧', price: 50, chance: 1.4 },

  // 🩵 Rank 4: Super Rare (အထူးရှားပါး - စုစုပေါင်း 8% | ဈေးနှုန်း: 150 coins)
  { id: 'kangaroo', name: 'သားပိုက်ကောင် (Super Rare)', emoji: '🦘', price: 150, chance: 0.8 },
  { id: 'koala', name: 'ကိုအာလာ (Super Rare)', emoji: '🐨', price: 150, chance: 0.8 },
  { id: 'hamster', name: 'ပူးကောင်လေး (Super Rare)', emoji: '🐹', price: 150, chance: 0.8 },
  { id: 'zebra', name: 'မြင်းကျား (Super Rare)', emoji: '🦓', price: 150, chance: 0.8 },
  { id: 'giraffe', name: 'သစ်ကုလားအုတ် (Super Rare)', emoji: '🦒', price: 150, chance: 0.8 },
  { id: 'camel', name: 'ကုလားအုတ် (Super Rare)', emoji: '🐪', price: 150, chance: 0.8 },
  { id: 'hippo', name: 'ရေမြင်း (Super Rare)', emoji: '🦛', price: 150, chance: 0.8 },
  { id: 'otter', name: 'ဖျံကလေး (Super Rare)', emoji: '🦦', price: 150, chance: 0.8 },
  { id: 'beaver', name: 'ဗီဗာဖျံ (Super Rare)', emoji: '🦫', price: 150, chance: 0.8 },
  { id: 'peacock', name: 'ဒေါင်းမင်း (Super Rare)', emoji: '🦚', price: 150, chance: 0.8 },

  // 🟠 Rank 5: Epic (သူရဲကောင်း - စုစုပေါင်း 4% | ဈေးနှုန်း: 400 coins)
  { id: 'eagle', name: 'သိမ်းငှက် (Epic)', emoji: '🦅', price: 400, chance: 0.4 },
  { id: 'crocodile', name: 'မိကျောင်း (Epic)', emoji: '🐊', price: 400, chance: 0.4 },
  { id: 'bear', name: 'ဝက်ဝံညို (Epic)', emoji: '🐻', price: 400, chance: 0.4 },
  { id: 'panda', name: 'ပန်ဒါဝက်ဝံ (Epic)', emoji: '🐼', price: 400, chance: 0.4 },
  { id: 'leopard', name: 'ကျားသစ် (Epic)', emoji: '🐆', price: 400, chance: 0.4 },
  { id: 'gorilla', name: 'ဂေါ်ရီလာ (Epic)', emoji: '🦍', price: 400, chance: 0.4 },
  { id: 'buffalo', name: 'ကျွဲရိုင်း (Epic)', emoji: '🐃', price: 400, chance: 0.4 },
  { id: 'bison', name: 'ပြောင်ကြီး (Epic)', emoji: '🦬', price: 400, chance: 0.4 },
  { id: 'dolphin', name: 'လင်းပိုင် (Epic)', emoji: '🐬', price: 400, chance: 0.4 },
  { id: 'seal', name: 'ဖျံကြီး (Epic)', emoji: '🦭', price: 400, chance: 0.4 },

  // 🟡 Rank 6: Ultra Epic (မဟာသူရဲကောင်း - စုစုပေါင်း 2% | ဈေးနှုန်း: 1,000 coins)
  { id: 'polarbear', name: 'ဝင်ရိုးစွန်းဝက်ဝံ (Ultra Epic)', emoji: '🐻‍❄️', price: 1000, chance: 0.2 },
  { id: 'shark', name: 'ငါးမန်းဖြူ (Ultra Epic)', emoji: '🦈', price: 1000, chance: 0.2 },
  { id: 'whale', name: 'ဝေလငါး (Ultra Epic)', emoji: '🐋', price: 1000, chance: 0.2 },
  { id: 'octopus', name: 'ရေဘဝဲကြီး (Ultra Epic)', emoji: '🐙', price: 1000, chance: 0.2 },
  { id: 'cobra', name: 'မြွေဟောက်မင်း (Ultra Epic)', emoji: '🐍', price: 1000, chance: 0.2 },
  { id: 'scorpion', name: 'ကင်းမြီးကောက် (Ultra Epic)', emoji: '🦂', price: 1000, chance: 0.2 },
  { id: 'spider', name: 'ပင့်ကူနက်ကြီး (Ultra Epic)', emoji: '🕷️', price: 1000, chance: 0.2 },
  { id: 'falcon', name: 'လင်းယုန်မင်း (Ultra Epic)', emoji: '🪶', price: 1000, chance: 0.2 },
  { id: 'moose', name: 'သမင်ချိုကြီး (Ultra Epic)', emoji: '🫎', price: 1000, chance: 0.2 },
  { id: 'orangutan', name: 'အော်ရန်အူတန် (Ultra Epic)', emoji: '🦧', price: 1000, chance: 0.2 },

  // 🔴 Rank 7: Legendary (ဒဏ္ဍာရီလာ - စုစုပေါင်း 0.4% / ၂၅၀ မှ ၁ ကောင် | ဈေးနှုန်း: 3,000 coins)
  { id: 'lion', name: 'ခြင်္သေ့မင်း (Legendary)', emoji: '🦁', price: 3000, chance: 0.04 },
  { id: 'tiger', name: 'ကျားရဲ (Legendary)', emoji: '🐅', price: 3000, chance: 0.04 },
  { id: 'elephant', name: 'ဆင်ပြောင်ကြီး (Legendary)', emoji: '🐘', price: 3000, chance: 0.04 },
  { id: 'rhino', name: 'ကြံ့သူတော် (Legendary)', emoji: '🦏', price: 3000, chance: 0.04 },
  { id: 'panther', name: 'ကျားနက်ကြီး (Legendary)', emoji: '🐈‍⬛', price: 3000, chance: 0.04 },
  { id: 'whitewolf', name: 'ဝံပုလွေဖြူ (Legendary)', emoji: '🐺', price: 3000, chance: 0.04 },
  { id: 'bluewhale', name: 'ဝေလငါးပြာ (Legendary)', emoji: '🐳', price: 3000, chance: 0.04 },
  { id: 'mammoth', name: 'မမ်မွတ်ဆင်ကြီး (Legendary)', emoji: '🦣', price: 3000, chance: 0.04 },
  { id: 'trex', name: 'တီရက်စ်ဒိုင်နိုဆော (Legendary)', emoji: '🦖', price: 3000, chance: 0.04 },
  { id: 'bronto', name: 'ဘရွန်တိုဆောရပ် (Legendary)', emoji: '🦕', price: 3000, chance: 0.04 },

  // 🔮 Rank 8: Mythical (နတ်ဒေဝါ - စုစုပေါင်း 0.1% / ၁,၀၀၀ မှ ၁ ကောင် | ဈေးနှုန်း: 10,000 coins)
  { id: 'unicorn', name: 'ယူနီကွန်း (Mythical)', emoji: '🦄', price: 10000, chance: 0.01 },
  { id: 'dragon', name: 'နဂါးမင်း (Mythical)', emoji: '🐉', price: 10000, chance: 0.01 },
  { id: 'phoenix', name: 'မီးငှက်ဖီးနစ် (Mythical)', emoji: '🔥', price: 10000, chance: 0.01 },
  { id: 'pegasus', name: 'တောင်ပံပါမြင်းပျံ (Mythical)', emoji: '🪽', price: 10000, chance: 0.01 },
  { id: 'mermaid', name: 'ရေသူမဘုရင်မ (Mythical)', emoji: '🧜‍♀️', price: 10000, chance: 0.01 },
  { id: 'fairy', name: 'နတ်သမီးလေး (Mythical)', emoji: '🧚', price: 10000, chance: 0.01 },
  { id: 'spiritfox', name: 'ဝိညာဉ်မြေခွေး (Mythical)', emoji: '🦊', price: 10000, chance: 0.01 },
  { id: 'icedragon', name: 'ရေခဲနဂါး (Mythical)', emoji: '🐲', price: 10000, chance: 0.01 },
  { id: 'jadeturtle', name: 'ကျောက်စိမ်းလိပ်ကြီး (Mythical)', emoji: '🐢', price: 10000, chance: 0.01 },
  { id: 'goldeagle', name: 'ရွှေသိမ်းငှက် (Mythical)', emoji: '🦅', price: 10000, chance: 0.01 },

  // ✨ Rank 9: Divine (နတ်ဘုရားအဆင့် - စုစုပေါင်း 0.02% / ၅,၀၀၀ မှ ၁ ကောင် | ဈေးနှုန်း: 30,000 coins)
  { id: 'thunderlion', name: 'မိုးကြိုးခြင်္သေ့ (Divine)', emoji: '⚡', price: 30000, chance: 0.002 },
  { id: 'suntiger', name: 'နေမင်းကျားရဲ (Divine)', emoji: '☀️', price: 30000, chance: 0.002 },
  { id: 'moonwolf', name: 'လမင်းဝံပုလွေ (Divine)', emoji: '🌙', price: 30000, chance: 0.002 },
  { id: 'seadragon', name: 'ပင်လယ်စောင့်နဂါး (Divine)', emoji: '🌊', price: 30000, chance: 0.002 },
  { id: 'lavadragon', name: 'မီးတောင်နဂါး (Divine)', emoji: '🌋', price: 30000, chance: 0.002 },
  { id: 'stormbird', name: 'လေမုန်တိုင်းငှက် (Divine)', emoji: '🌪️', price: 30000, chance: 0.002 },
  { id: 'goldunicorn', name: 'ရွှေရောင်ယူနီကွန်း (Divine)', emoji: '🌟', price: 30000, chance: 0.002 },
  { id: 'divineelephant', name: 'နတ်ဘုရားဆင်ဖြူတော် (Divine)', emoji: '⚜️', price: 30000, chance: 0.002 },
  { id: 'rainbowphoenix', name: 'သက်တံ့ဖီးနစ် (Divine)', emoji: '🌈', price: 30000, chance: 0.002 },
  { id: 'darkdragon', name: 'အမှောင်ထုနဂါး (Divine)', emoji: '🌑', price: 30000, chance: 0.002 },

  // 🌌 Rank 10: Celestial (စကြဝဠာအရှင် - စုစုပေါင်း 0.001% / ၁၀၀,၀၀၀ မှ ၁ ကောင် | ဈေးနှုန်း: 150,000 coins)
  { id: 'stardragon', name: 'ကြယ်တာရာနဂါး (Celestial)', emoji: '🌠', price: 150000, chance: 0.0001 },
  { id: 'galaxyphoenix', name: 'ဂလက်ဆီဖီးနစ် (Celestial)', emoji: '🎆', price: 150000, chance: 0.0001 },
  { id: 'timegod', name: 'အချိန်စောင့်နတ်မင်း (Celestial)', emoji: '⏳', price: 150000, chance: 0.0001 },
  { id: 'cosmiclion', name: 'စကြဝဠာခြင်္သေ့မင်း (Celestial)', emoji: '🪐', price: 150000, chance: 0.0001 },
  { id: 'infinitedragon', name: 'အနန္တနဂါးချုပ် (Celestial)', emoji: '♾️', price: 150000, chance: 0.0001 },
  { id: 'heavenlord', name: 'ကောင်းကင်ဘုံအရှင် (Celestial)', emoji: '🏯', price: 150000, chance: 0.0001 },
  { id: 'solarwhale', name: 'နေစကြဝဠာဝေလငါး (Celestial)', emoji: '☄️', price: 150000, chance: 0.0001 },
  { id: 'godking', name: 'နတ်ဘုရားဘုရင် (Celestial)', emoji: '🔱', price: 150000, chance: 0.0001 },
  { id: 'primordialdragon', name: 'ကမ္ဘာဦးနဂါးမင်း (Celestial)', emoji: '💠', price: 150000, chance: 0.0001 },
  { id: 'celestiallord', name: 'စကြဝဠာအရှင်သခင် (Celestial)', emoji: '👑', price: 150000, chance: 0.0001 },
];

module.exports = ANIMALS;