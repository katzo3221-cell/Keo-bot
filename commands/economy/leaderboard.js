const { EmbedBuilder } = require('discord.js');
const { User } = require('../../models/User');
const ANIMALS = require('../../data/animals');

const ANIMAL_PRICE_MAP = new Map(ANIMALS.map((a) => [a.name, a.price]));
const VALID_ANIMAL_IDS = new Set(ANIMALS.map((a) => a.id));
const ANIMAL_NAME_TO_ID = new Map(ANIMALS.map((a) => [a.name, a.id]));

module.exports = [
  // ထိပ်တန်းစာရင်း Top 10 (Ktop [cash / lvl / battle / zoo / col])
  {
    names: ['top', 'lb'],
    async execute(message, args) {
      const category = (args[0] || 'cash').toLowerCase();
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const activeFilter = { isBanned: { $ne: true } };

      let title = '';
      let color = '#FF4500';
      let lines = [];

      if (['lvl', 'level', 'profile', 'exp'].includes(category)) {
        const sorted = await User.find(activeFilter, 'username level exp')
          .sort({ level: -1, exp: -1 })
          .limit(10)
          .lean();
        title = '🏅 Profile Level အမြင့်ဆုံး ကစားသမားများ (Top 10)';
        color = '#3498DB';
        lines = sorted.map(
          (u, idx) => `${medals[idx]} **${u.username}** — 🏅 **Lv.${u.level || 1}** (${(u.exp || 0).toLocaleString()} EXP)`
        );
      } else if (['battle', 'b', 'blvl', 'pvp'].includes(category)) {
        const sorted = await User.find(activeFilter, 'username battleLevel battleExp')
          .sort({ battleLevel: -1, battleExp: -1 })
          .limit(10)
          .lean();
        title = '⚔️ Battle Level အမြင့်ဆုံး ကစားသမားများ (Top 10)';
        color = '#E67E22';
        lines = sorted.map(
          (u, idx) => `${medals[idx]} **${u.username}** — ⚔️ **Battle Lv.${u.battleLevel || 1}** (${(u.battleExp || 0).toLocaleString()} EXP)`
        );
      } else if (['zoo', 'z', 'animal', 'animals'].includes(category)) {
        // Index ဖြင့် အမြန်ဆွဲထုတ်ခြင်း
        const indexed = await User.find({ ...activeFilter, zooValue: { $gt: 0 } }, 'username zooValue zooCount')
          .sort({ zooValue: -1, zooCount: -1 })
          .limit(10)
          .lean();

        let scored = indexed.map((u) => ({
          username: u.username,
          totalValue: u.zooValue || 0,
          totalCount: u.zooCount || 0,
        }));

        // Database အဟောင်း User များအတွက် zooValue မတွက်ရသေးပါက Fallback စစ်ဆေးခြင်း
        if (scored.length === 0) {
          const allUsers = await User.find(activeFilter, 'username zoo').lean();
          scored = allUsers
            .map((u) => {
              let totalValue = 0;
              let totalCount = 0;
              for (const [name, rawCount] of Object.entries(u.zoo || {})) {
                const count = Number(rawCount) || 0;
                const price = ANIMAL_PRICE_MAP.get(name);
                if (count > 0 && price !== undefined) {
                  totalCount += count;
                  totalValue += price * count;
                }
              }
              return { username: u.username, totalValue, totalCount };
            })
            .filter((u) => u.totalCount > 0)
            .sort((a, b) => b.totalValue - a.totalValue || b.totalCount - a.totalCount)
            .slice(0, 10);
        }

        title = '🐾 တိရစ္ဆာန်ရုံ တန်ဖိုးအမြင့်ဆုံး ကစားသမားများ (Top 10)';
        color = '#2ECC71';
        lines = scored.map(
          (u, idx) => `${medals[idx]} **${u.username}** — 💵 **${u.totalValue.toLocaleString()} coins** (${u.totalCount.toLocaleString()} ကောင်)`
        );
      } else if (['col', 'collection', 'dex'].includes(category)) {
        // Index ဖြင့် အမြန်ဆွဲထုတ်ခြင်း
        const indexed = await User.find({ ...activeFilter, collectedCount: { $gt: 0 } }, 'username collectedCount')
          .sort({ collectedCount: -1 })
          .limit(10)
          .lean();

        let scored = indexed.map((u) => ({
          username: u.username,
          count: u.collectedCount || 0,
          percent: Math.floor(((u.collectedCount || 0) / ANIMALS.length) * 100),
        }));

        if (scored.length === 0) {
          const allUsers = await User.find(activeFilter, 'username zoo collectedAnimals').lean();
          scored = allUsers
            .map((u) => {
              const set = new Set();
              for (const id of u.collectedAnimals || []) {
                if (VALID_ANIMAL_IDS.has(id)) set.add(id);
              }
              for (const [name, rawCount] of Object.entries(u.zoo || {})) {
                if ((Number(rawCount) || 0) > 0 && ANIMAL_NAME_TO_ID.has(name)) {
                  set.add(ANIMAL_NAME_TO_ID.get(name));
                }
              }
              const count = set.size;
              return { username: u.username, count, percent: Math.floor((count / ANIMALS.length) * 100) };
            })
            .filter((u) => u.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }

        title = '📖 တိရစ္ဆာန် Collection အစုံဆုံး ကစားသမားများ (Top 10)';
        color = '#9B59B6';
        lines = scored.map(
          (u, idx) => `${medals[idx]} **${u.username}** — 📖 **${u.count} / ${ANIMALS.length}** (${u.percent}%)`
        );
      } else {
        const sorted = await User.find(activeFilter, 'username level balance')
          .sort({ balance: -1 })
          .limit(10)
          .lean();
        title = '🏆 အချမ်းသာဆုံး ကစားသမားများ (Top 10)';
        color = '#FF4500';
        lines = sorted.map(
          (u, idx) => `${medals[idx]} **${u.username}** (Lv.${u.level || 1}) — 💰 **${(u.balance || 0).toLocaleString()} coins**`
        );
      }

      if (lines.length === 0) {
        return message.reply('စာရင်း မရှိသေးပါ။');
      }

      const topEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'အခြားစာရင်းများ: Ktop cash | Ktop lvl | Ktop battle | Ktop zoo | Ktop col' })
        .setTimestamp();

      return message.reply({ embeds: [topEmbed] });
    },
  },
];