const { EmbedBuilder } = require('discord.js');
const {
  ITEM_RANKS,
  ITEM_TYPE_LABELS,
  SHOP_ITEMS,
  findItemById,
  getActiveItemByType,
} = require('../../data/shopItems');
const { RINGS, findRing } = require('../../data/rings');

module.exports = [
  // ၁။ ဆိုင်ခန်း ကြည့်ခြင်း (Kshop)
  {
    names: ['shop'],
    async execute(message, args, user) {
      const shopOnlyItems = SHOP_ITEMS.filter((item) => item.shopAvailable);
      const types = ['luck', 'extra', 'multiplier'];

      const sections = types.map((t) => {
        const header = `**${ITEM_TYPE_LABELS[t]}**`;
        const rows = shopOnlyItems
          .filter((item) => item.type === t)
          .map((item) => {
            const rInfo = ITEM_RANKS[item.rank];
            let status = `💰 **${item.price.toLocaleString()} coins**`;
            if ((user.items || []).includes(item.id)) {
              const left = (user.itemUses && user.itemUses[item.id] !== undefined)
                ? user.itemUses[item.id]
                : item.maxUses;
              status = `✅ *(သုံးနေဆဲ — ကျန်: **${left}/${item.maxUses}** ကြိမ်)*`;
            }
            return `${rInfo.emoji} **[R${item.rank}] ${item.name}** (\`${item.id}\`) — ${item.desc} • ${status}`;
          })
          .join('\n');
        return `${header}\n${rows}`;
      });

      const ringRows = RINGS.map((r) => {
        const owned = Number((user.rings && user.rings[r.id]) || 0);
        const ownedNote = owned > 0 ? ` *(ပိုင်ဆိုင်: ×${owned})*` : '';
        return `${r.emoji} **[R${r.rank}] ${r.name}** (${r.mmName}) (\`${r.id}\`) — 💰 **${r.price.toLocaleString()} coins**${ownedNote}`;
      }).join('\n');

      sections.push(`**💍 Marriage Rings (လက်ထပ်လက်စွပ်များ — \`Kbuy <ringId>\` ➔ \`Kmarry @user <ringId>\`)**\n${ringRows}`);

      const shopEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏪 Keo အရောင်းဆိုင် (Hunt Items & Marriage Rings)')
        .setDescription(sections.join('\n\n'))
        .setFooter({ text: 'ဝယ်ရန်: Kbuy <id> [အရေအတွက်] | လက်ထပ်ရန်: Kmarry @user <ringId>' });
      return message.reply({ embeds: [shopEmbed] });
    },
  },

  // ၂။ ပစ္စည်း ဝယ်ယူခြင်း (Kbuy <id>)
  {
    names: ['buy'],
    async execute(message, args, user) {
      const itemId = args[0] ? args[0].toLowerCase().trim() : null;

      // Marriage Ring ဝယ်ယူခြင်း (Kbuy ring1 [အရေအတွက်])
      const targetRing = findRing(itemId);
      if (targetRing) {
        let qty = 1;
        if (args[1] !== undefined) {
          qty = parseInt(args[1], 10);
          if (isNaN(qty) || qty < 1 || qty > 50) {
            return message.reply('❌ ဝယ်ယူမည့် အရေအတွက်ကို **၁ မှ ၅၀** အတွင်း မှန်ကန်စွာ ထည့်ပါ!');
          }
        }

        const totalCost = targetRing.price * qty;
        if (user.balance < totalCost) {
          return message.reply(
            `❌ လက်ကျန်ငွေ မလုံလောက်ပါ! ${targetRing.emoji} **${targetRing.name}** ×${qty} အတွက် **${totalCost.toLocaleString()} coins** လိုအပ်ပါတယ်။`
          );
        }

        user.balance -= totalCost;
        user.rings = user.rings || {};
        user.rings[targetRing.id] = (Number(user.rings[targetRing.id]) || 0) + qty;
        user.markModified('rings');
        await user.save();

        return message.reply(
          `🛍️ ${targetRing.emoji} **${targetRing.name}** (${targetRing.mmName}) **×${qty}** ကို **${totalCost.toLocaleString()} coins** ဖြင့် ဝယ်ယူပြီးပါပြီ!\n` +
          `*(လက်ထပ်ခွင့်တောင်းရန်: \`Kmarry @user ${targetRing.id}\`)*`
        );
      }

      const item = SHOP_ITEMS.find((i) => i.id === itemId);
      if (!item) {
        return message.reply('❌ ပစ္စည်း ID မှားယွင်းနေပါတယ်။ ဆိုင်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kshop` ကို ရိုက်ပါ။');
      }

      if (!item.shopAvailable) {
        const rInfo = ITEM_RANKS[item.rank];
        return message.reply(
          `🚫 ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** ကို ဆိုင်မှာ ဝယ်ယူ၍ မရပါ!\n` +
          `Rank 4 (🟠) မှ Rank 7 (🌌) အထိ အဆင့်မြင့်ပစ္စည်းများကို \`Khunt\` နှင့် \`Kopen lc\` မှသာ ရရှိနိုင်ပါမယ်။`
        );
      }

      const activeSameType = getActiveItemByType(user, item.type);
      if (activeSameType) {
        const activeRank = ITEM_RANKS[activeSameType.rank] || ITEM_RANKS[1];
        const usesLeft = (user.itemUses && user.itemUses[activeSameType.id] !== undefined)
          ? user.itemUses[activeSameType.id]
          : activeSameType.maxUses;
        return message.reply(
          `❌ **${ITEM_TYPE_LABELS[item.type]}** ထဲမှ တစ်မျိုးကို တစ်ခုသာ တပ်ဆင်အသုံးပြုခွင့် ရှိပါတယ်!\n` +
          `လက်ရှိတွင် ${activeRank.emoji} **${activeSameType.name}** (\`${activeSameType.id}\`) *(ကျန်: **${usesLeft}/${activeSameType.maxUses}** ကြိမ်)* ရှိနေပါသေးတယ်။ အကြိမ်ရေ ကုန်သွားမှ နောက်တစ်ခု ထပ်ဝယ်/ထပ်သုံးနိုင်ပါမယ်။`
        );
      }

      if (user.balance < item.price) {
        return message.reply(`❌ ပိုက်ဆံ မလုံလောက်ပါ! **${item.name}** အတွက် **${item.price.toLocaleString()} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= item.price;
      if (!user.items) user.items = [];
      if (!user.itemUses) user.itemUses = {};
      user.items.push(item.id);
      user.itemUses[item.id] = item.maxUses;
      user.markModified('itemUses');
      await user.save();

      const rInfo = ITEM_RANKS[item.rank];
      return message.reply(
        `🎉 ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** (\`${item.id}\`) ကို **${item.price.toLocaleString()} coins** ဖြင့် ဝယ်ယူတပ်ဆင်ပြီးပါပြီ! (အသုံးပြုခွင့်: **${item.maxUses} ကြိမ်**)`
      );
    },
  },

  // ၃။ အိတ်ထဲ သိမ်းထားသော အပို Item ကို ပြောင်းတပ်ဆင်ခြင်း (Kuse <id> / Kequip <id>)
  {
    names: ['use', 'equip'],
    async execute(message, args, user) {
      const itemId = args[0] ? args[0].toLowerCase().trim() : null;
      if (!itemId) {
        return message.reply('❌ တပ်ဆင်အသုံးပြုမယ့် Item ID ထည့်ပေးပါ! (ဥပမာ - `Kuse luck5` — အိတ်ထဲက ပစ္စည်းများကို ကြည့်ရန် `Kinv` ရိုက်ပါ)');
      }

      const storedCount = (user.storedItems && user.storedItems[itemId]) || 0;
      if (storedCount <= 0) {
        return message.reply(`❌ သင့်အိတ် (Storage) ထဲမှာ \`${itemId}\` ပစ္စည်း မရှိပါဘူး! \`Kinv\` တွင် စစ်ဆေးပါ။`);
      }

      const item = findItemById(itemId);
      if (!item) {
        return message.reply(`❌ \`${itemId}\` ပစ္စည်း အချက်အလက် မတွေ့ပါဘူး။`);
      }

      const activeSameType = getActiveItemByType(user, item.type);
      if (activeSameType) {
        const activeRank = ITEM_RANKS[activeSameType.rank] || ITEM_RANKS[1];
        const usesLeft = (user.itemUses && user.itemUses[activeSameType.id] !== undefined)
          ? user.itemUses[activeSameType.id]
          : activeSameType.maxUses;
        return message.reply(
          `❌ **${ITEM_TYPE_LABELS[item.type]}** ထဲမှ ${activeRank.emoji} **${activeSameType.name}** (\`${activeSameType.id}\`) ကို လက်ရှိသုံးနေဆဲ ဖြစ်ပါတယ်! *(ကျန်: **${usesLeft}/${activeSameType.maxUses}** ကြိမ်)*\n` +
          `အဲဒီပစ္စည်း အကြိမ်ရေ ကုန်သွားမှ \`Kuse ${item.id}\` ဖြင့် ပြောင်းလဲအသုံးပြုနိုင်ပါမယ်။`
        );
      }

      if (storedCount - 1 <= 0) {
        delete user.storedItems[itemId];
      } else {
        user.storedItems[itemId] = storedCount - 1;
      }
      user.markModified('storedItems');

      if (!user.items) user.items = [];
      if (!user.itemUses) user.itemUses = {};
      user.items.push(item.id);
      user.itemUses[item.id] = item.maxUses;
      user.markModified('itemUses');

      await user.save();

      const rInfo = ITEM_RANKS[item.rank] || ITEM_RANKS[1];
      return message.reply(
        `✅ ${rInfo.emoji} **[Rank ${item.rank}] ${item.name}** (\`${item.id}\`) ကို တပ်ဆင်အသုံးပြုလိုက်ပါပြီ! (အသုံးပြုခွင့်: **${item.maxUses} ကြိမ်**)`
      );
    },
  },

  // ၄။ ပိုင်ဆိုင်သော ပစ္စည်းများ စစ်ဆေးခြင်း (Kinv / Kinventory / Kbag)
  {
    names: ['inv', 'inventory', 'bag'],
    async execute(message, args, user) {
      const crateCount = user.boxes || 0;
      const sections = [];

      if (crateCount > 0) {
        sections.push(`🎁 **Lucky Crate (\`lc\`)** — **${crateCount} လုံး** *(\`Kopen lc [အရေအတွက်/all]\` ဖြင့် ဖွင့်ပါ)*`);
      }

      const activeLines = [];
      for (const t of ['luck', 'extra', 'multiplier']) {
        const activeItem = getActiveItemByType(user, t);
        if (activeItem) {
          const rInfo = ITEM_RANKS[activeItem.rank] || ITEM_RANKS[1];
          const left = (user.itemUses && user.itemUses[activeItem.id] !== undefined)
            ? user.itemUses[activeItem.id]
            : activeItem.maxUses;
          activeLines.push(
            `${rInfo.emoji} **[R${activeItem.rank}] ${activeItem.name}** (\`${activeItem.id}\`) — ကျန်: **${left}/${activeItem.maxUses} ကြိမ်**\n` +
            `└ ${activeItem.desc}`
          );
        }
      }

      if (activeLines.length > 0) {
        sections.push(`⚔️ **လက်ရှိ အသုံးပြုနေသော ပစ္စည်းများ (Active — 1 Per Type):**\n${activeLines.join('\n')}`);
      }

      const storedEntries = Object.entries(user.storedItems || {}).filter(([, count]) => count > 0);
      if (storedEntries.length > 0) {
        const storedLines = storedEntries
          .map(([id, count]) => {
            const info = findItemById(id);
            if (!info) return `• \`${id}\` × ${count}`;
            const rInfo = ITEM_RANKS[info.rank] || ITEM_RANKS[1];
            return `${rInfo.emoji} **[R${info.rank}] ${info.name}** (\`${info.id}\`) × **${count} ခု** — *(${info.desc})*`;
          })
          .join('\n');

        sections.push(`🎒 **အိတ်ထဲ သိမ်းထားသော အပိုပစ္စည်းများ (\`Kuse <id>\` ဖြင့် သုံးရန်):**\n${storedLines}`);
      }

      const ownedRingLines = RINGS
        .filter((r) => (Number(user.rings?.[r.id]) || 0) > 0)
        .map((r) => `${r.emoji} **[R${r.rank}] ${r.name}** (${r.mmName}) (\`${r.id}\`) × **${Number(user.rings[r.id])} ကွင်း**`);

      if (ownedRingLines.length > 0) {
        sections.push(`💍 **လက်ထပ်လက်စွပ်များ (\`Kmarry @user <ringId>\` ဖြင့် စွပ်ပေးရန်):**\n${ownedRingLines.join('\n')}`);
      }

      if (sections.length === 0) {
        return message.reply('🎒 သင့်ကျောပိုးအိတ် (Inventory) ထဲမှာ ဘာပစ္စည်းမှ မရှိသေးပါဘူး! `Kshop`၊ `Kdaily` သို့မဟုတ် `Khunt` မှ ရယူနိုင်ပါတယ်။');
      }

      const invEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setAuthor({ name: `${message.author.username} ၏ ကျောပိုးအိတ် (Inventory)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(sections.join('\n\n'))
        .setFooter({ text: 'တစ်မျိုးလျှင် တစ်ခုသာ သုံးခွင့်ရှိပြီး အကြိမ်ရေကုန်မှ နောက်တစ်ခု ထပ်သုံးနိုင်ပါသည်' })
        .setTimestamp();

      return message.reply({ embeds: [invEmbed] });
    },
  },
];