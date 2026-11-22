const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, addProfileExp, updateQuestProgress } = require('../../models/User');
const ANIMALS = require('../../data/animals');
const {
  ITEM_RANKS,
  rollRandomItem,
  receiveDroppedItem,
  getActiveHuntItems,
  consumeActiveHuntItems,
} = require('../../data/shopItems');
const { getTodayMyanmarDate } = require('../../utils/helpers');
const {
  DIVINE_SHINE,
  CELESTIAL_SHINE,
  getAnimalMeta,
  syncCollection,
  syncZooStats,
} = require('../../utils/huntingHelper');

// Anti-Macro Verification (AMV) ခလုတ်စစ်ဆေးမှု ပေးပို့ခြင်း
async function sendAmvChallenge(message) {
  const pool = ['🐶', '🐱', '🦊', '🐻', '🐼', '🦁', '🐸', '🐵', '🐧', '🦄', '🐉', '🐢'];
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  const targetEmoji = shuffled[Math.floor(Math.random() * shuffled.length)];

  const amvEmbed = new EmbedBuilder()
    .setColor('#E67E22')
    .setTitle('🛡️ Anti-Macro Verification (AMV)')
    .setDescription(
      `**${message.author.username}** သည် အမဲလိုက်မှု **အကြိမ် ၁၀၀** ပြည့်သွားပါပြီ!\n` +
      `Auto-Typer / Macro မဟုတ်ကြောင်း အတည်ပြုရန် အောက်ပါခလုတ်များထဲမှ **【 ${targetEmoji} 】** ကို နှိပ်ပါ —\n` +
      `*(၆၀ စက္ကန့်အတွင်း နှိပ်ပေးပါ)*`
    );

  const row = new ActionRowBuilder().addComponents(
    shuffled.map((emoji, idx) =>
      new ButtonBuilder()
        .setCustomId(`amv_${idx}_${emoji === targetEmoji ? 'ok' : 'no'}`)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const promptMsg = await message.reply({ embeds: [amvEmbed], components: [row] });
  const collector = promptMsg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async (i) => {
    try {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Verification စစ်ဆေးမှု မဟုတ်ပါဘူး!', ephemeral: true });
      }

      if (i.customId.endsWith('_ok')) {
        const freshUser = await getUser(message.author.id, message.author.username);
        freshUser.amvLocked = false;
        freshUser.huntCount = 0;
        await freshUser.save();

        collector.stop('verified');
        const passEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ အတည်ပြုမှု အောင်မြင်ပါသည်!')
          .setDescription(`ကျေးဇူးတင်ပါတယ် **${message.author.username}**! ဆက်လက်၍ \`Kh\` ရိုက်ပြီး အမဲလိုက်နိုင်ပါပြီ။`);
        return i.update({ embeds: [passEmbed], components: [] });
      }

      collector.stop('wrong');
      const failEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ ခလုတ်ရွေးချယ်မှု မှားယွင်းနေပါသည်!')
        .setDescription(`**【 ${targetEmoji} 】** ကို နှိပ်ရမည်ဖြစ်ပါသည်။ \`Kh\` ပြန်ရိုက်ပြီး ထပ်မံအတည်ပြုပါ။`);
      return i.update({ embeds: [failEmbed], components: [] });
    } catch (err) {
      console.error('AMV Collect Error:', err);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle('⏳ Verification အချိန်စေ့သွားပါပြီ')
        .setDescription('ဆက်လက်အမဲလိုက်လိုပါက `Kh` ပြန်ရိုက်ပြီး ခလုတ်နှိပ် အတည်ပြုပါ။');
      await promptMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  });
}

module.exports = [
  // အမဲလိုက်ခြင်း (Khunt / Kh)
  {
    names: ['hunt', 'h'],
    async execute(message, args, user) {
      if (user.amvLocked) {
        return sendAmvChallenge(message);
      }

      const cost = 10;
      if (user.balance < cost) {
        return message.reply(`❌ အမဲလိုက်ဖို့ ကျည်ဆန်ဖိုး **${cost} coins** လိုအပ်ပါတယ်။`);
      }

      user.balance -= cost;

      // တပ်ဆင်ထားသော Item ၃ မျိုး (luck, extra, multiplier) မှ စွမ်းရည်များ တွက်ချက်ခြင်း
      const activeItems = getActiveHuntItems(user);
      const totalLuck = activeItems.luck ? activeItems.luck.luckBonus : 0;
      const extraCatch = activeItems.extra ? activeItems.extra.extraCatch : 0;
      const catchMultiplier = activeItems.multiplier ? activeItems.multiplier.catchMultiplier : 1;
      const catchCount = Math.min((1 + extraCatch) * catchMultiplier, 10);

      if (!user.zoo) user.zoo = {};
      const caughtSummary = {};

      const weightedAnimals = ANIMALS.map((animal) => {
        const { rank } = getAnimalMeta(animal);
        let multiplier = 1;
        if (['Mythical', 'Divine', 'Celestial'].includes(rank)) {
          multiplier = 1 + totalLuck * 0.015;
        } else if (rank === 'Legendary') {
          multiplier = 1 + totalLuck * 0.025;
        } else if (['Epic', 'Ultra Epic'].includes(rank)) {
          multiplier = 1 + totalLuck * 0.03;
        } else if (['Rare', 'Super Rare'].includes(rank)) {
          multiplier = 1 + totalLuck * 0.02;
        }
        return { animal, weight: animal.chance * multiplier };
      });

      const totalWeight = weightedAnimals.reduce((sum, item) => sum + item.weight, 0);

      for (let i = 0; i < catchCount; i++) {
        let roll = Math.random() * totalWeight;
        let cumulative = 0;
        let caught = weightedAnimals[0].animal;

        for (const item of weightedAnimals) {
          cumulative += item.weight;
          if (roll <= cumulative) {
            caught = item.animal;
            break;
          }
        }

        user.zoo[caught.name] = (user.zoo[caught.name] || 0) + 1;
        if (!caughtSummary[caught.name]) {
          const meta = getAnimalMeta(caught);
          caughtSummary[caught.name] = {
            emoji: caught.emoji,
            id: caught.id,
            rank: meta.rank,
            rankEmoji: meta.rankEmoji,
            count: 0,
          };
        }
        caughtSummary[caught.name].count += 1;
      }

      user.markModified('zoo');
      syncCollection(user);
      syncZooStats(user);
      updateQuestProgress(user, 'hunt', 1);

      let hasDivine = false;
      let hasCelestial = false;

      // Emoji သီးသန့် ပြသခြင်း (Divine နှင့် Celestial ကို Animated Sparkle ဖြင့် ထင်ရှားအောင် ဘောင်ခတ်မည်)
      const caughtListText = Object.values(caughtSummary)
        .map((data) => {
          const qty = data.count > 1 ? `×${data.count}` : '';
          if (data.rank === 'Celestial') {
            hasCelestial = true;
            return `${CELESTIAL_SHINE}『 ${data.emoji} 』${CELESTIAL_SHINE}${qty}`;
          }
          if (data.rank === 'Divine') {
            hasDivine = true;
            return `${DIVINE_SHINE}【 ${data.emoji} 】${DIVINE_SHINE}${qty}`;
          }
          return `${data.rankEmoji}${data.emoji}${qty}`;
        })
        .join(' ');

      let rareBannerText = '';
      if (hasCelestial) {
        rareBannerText += `\n${CELESTIAL_SHINE} **CELESTIAL ဖမ်းမိပါပြီ!!** ${CELESTIAL_SHINE}`;
      }
      if (hasDivine) {
        rareBannerText += `\n${DIVINE_SHINE} **DIVINE ဖမ်းမိပါပြီ!** ${DIVINE_SHINE}`;
      }

      // တောထဲမှ Item ရှာတွေ့ခြင်း (တစ်ရက်လျှင် အများဆုံး ၃ ခု Limit)
      const todayStr = getTodayMyanmarDate();
      if (user.dailyHuntItemDate !== todayStr) {
        user.dailyHuntItemDate = todayStr;
        user.dailyHuntItemCount = 0;
      }

      let foundItemText = '';
      if (user.dailyHuntItemCount < 3 && Math.random() < 0.15) {
        const foundItem = rollRandomItem();
        const dropResult = receiveDroppedItem(user, foundItem);
        user.dailyHuntItemCount += 1;
        const rInfo = ITEM_RANKS[foundItem.rank];
        const statusNote = dropResult.equipped
          ? `*(အလိုအလျောက် တပ်ဆင်ပြီး — **${dropResult.uses} ကြိမ်**)*`
          : `*(အိတ်ထဲ သိမ်းဆည်းပြီး — လက်ရှိ \`${dropResult.activeItem.id}\` ကုန်မှ \`Kuse ${foundItem.id}\` ဖြင့် သုံးပါ)*`;
        foundItemText =
          `\n🎒 တောထဲမှ ${rInfo.emoji} **[Rank ${foundItem.rank}] ${foundItem.name}** (\`${foundItem.id}\`) ရှာတွေ့ပါတယ်! ` +
          `${statusNote} *(ယနေ့ Limit: **${user.dailyHuntItemCount}/3**)*`;
      }

      const brokenItemText = consumeActiveHuntItems(user, activeItems);
      const expRes = addProfileExp(user, 10);

      user.huntCount = (user.huntCount || 0) + 1;
      let triggeredAmv = false;
      if (user.huntCount >= 100) {
        user.amvLocked = true;
        user.huntCount = 0;
        triggeredAmv = true;
      }

      await user.save();

      await message.reply(
        `🏹 သင်သည် တောထဲသို့ အမဲလိုက်ထွက်ရာ... ${caughtListText} ဖမ်းမိခဲ့ပါတယ်!${rareBannerText}${foundItemText}${brokenItemText}${expRes.levelUpText}`
      );

      if (triggeredAmv) {
        await sendAmvChallenge(message);
      }
    },
  },
];