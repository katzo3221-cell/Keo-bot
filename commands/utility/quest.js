const { EmbedBuilder } = require('discord.js');
const {
  DAILY_QUESTS_LIST,
  ensureDailyQuests,
  addProfileExp,
} = require('../../models/User');

module.exports = [
  // နေ့စဉ် Mission စနစ် (Kquest / Kq / Kquest claim)
  {
    names: ['quest', 'quests', 'q'],
    async execute(message, args, user) {
      ensureDailyQuests(user);
      const sub = args[0]?.toLowerCase();

      if (sub === 'claim' || sub === 'c') {
        let totalCoins = 0;
        let totalCrates = 0;
        let totalExp = 0;
        const claimedNames = [];

        for (const q of DAILY_QUESTS_LIST) {
          const progress = user.dailyQuests[q.id] || 0;
          const alreadyClaimed = user.dailyQuests.claimed.includes(q.id);

          if (progress >= q.target && !alreadyClaimed) {
            user.dailyQuests.claimed.push(q.id);
            totalCoins += q.rewardCoins;
            totalCrates += q.rewardCrates;
            totalExp += q.rewardExp;
            claimedNames.push(q.title);
          }
        }

        if (claimedNames.length === 0) {
          await user.save();
          return message.reply('❌ ထုတ်ယူနိုင်သော ပြီးမြောက်ပြီးသား Quest မရှိသေးပါ! `Kquest` ဖြင့် စစ်ဆေးပါ။');
        }

        user.markModified('dailyQuests');
        user.balance += totalCoins;
        user.boxes = (user.boxes || 0) + totalCrates;
        const expRes = addProfileExp(user, totalExp);
        await user.save();

        const crateLine = totalCrates > 0 ? ` | 🎁 Lucky Crate: **+${totalCrates} လုံး**` : '';
        return message.reply(
          `🎉 **Daily Quest ဆုလက်ဆောင် ထုတ်ယူပြီးပါပြီ!** (${claimedNames.length} ခု)\n` +
          `💰 Coins: **+${totalCoins.toLocaleString()}**${crateLine} | ✨ Profile EXP: **+${expRes.addedExp}**${expRes.levelUpText}`
        );
      }

      await user.save();
      let hasClaimable = false;

      const lines = DAILY_QUESTS_LIST.map((q) => {
        const current = Math.min(user.dailyQuests[q.id] || 0, q.target);
        const isClaimed = user.dailyQuests.claimed.includes(q.id);
        const isDone = current >= q.target;

        let status = `⏳ (${current}/${q.target})`;
        if (isClaimed) {
          status = '✅ **ထုတ်ယူပြီး**';
        } else if (isDone) {
          status = '🎁 **ပြီးမြောက်ပြီ — `Kquest claim` ဖြင့် ထုတ်ပါ!**';
          hasClaimable = true;
        }

        const crateReward = q.rewardCrates > 0 ? ` + 🎁 ${q.rewardCrates} lc` : '';
        return `${q.title}\n└ တိုးတက်မှု: ${status} • ဆု: 💰 ${q.rewardCoins.toLocaleString()}${crateReward} + ✨ ${q.rewardExp} EXP`;
      });

      const questEmbed = new EmbedBuilder()
        .setColor(hasClaimable ? '#2ECC71' : '#F39C12')
        .setAuthor({ name: `${message.author.username} ၏ နေ့စဉ် Mission (Daily Quests)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'ပြီးမြောက်ပါက Kquest claim ရိုက်၍ ဆုထုတ်ယူပါ' })
        .setTimestamp();

      return message.reply({ embeds: [questEmbed] });
    },
  },
];