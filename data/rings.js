// လက်ထပ်လက်စွပ် Rank ၅ ဆင့် (Kshop, Kbuy, Kinv, Kmarry, Kprofile)
const RINGS = [
  {
    id: 'ring1',
    rank: 1,
    name: 'Silver Ring',
    mmName: 'ငွေလက်စွပ်',
    emoji: '💍',
    price: 10000,
    color: '#C0C0C0',
  },
  {
    id: 'ring2',
    rank: 2,
    name: 'Gold Ring',
    mmName: 'ရွှေလက်စွပ်',
    emoji: '💛',
    price: 100000,
    color: '#FFD700',
  },
  {
    id: 'ring3',
    rank: 3,
    name: 'Diamond Ring',
    mmName: 'စိန်လက်စွပ်',
    emoji: '💎',
    price: 1000000,
    color: '#00E5FF',
  },
  {
    id: 'ring4',
    rank: 4,
    name: 'Promise Ring',
    mmName: 'ကတိသစ္စာ လက်စွပ်',
    emoji: '💜',
    price: 10000000,
    color: '#9B59B6',
  },
  {
    id: 'ring5',
    rank: 5,
    name: 'Eternal Ring',
    mmName: 'ထာဝရလက်စွပ်',
    emoji: '👑',
    price: 100000000,
    color: '#FF0055',
  },
];

function findRing(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  return RINGS.find(
    (r) =>
      r.id === q ||
      r.name.toLowerCase() === q ||
      r.mmName.toLowerCase() === q
  );
}

module.exports = { RINGS, findRing };