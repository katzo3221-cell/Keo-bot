const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User, getUser, addProfileExp, updateQuestProgress } = require('../../models/User');

module.exports = [
  // ၁။ လက်ကျန်ငွေ စစ်ဆေးခြင်း (Kcash / Kbal)
  {
    names: ['cash', 'bal'],
    async execute(message, args, user) {
      const cashEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ name: `${message.author.username} ၏ ပိုက်ဆံအိတ်`, iconURL: message.author.displayAvatarURL() })
        .setDescription(
          `💰 လက်ကျန်ငွေ: **${(user.balance || 0).toLocaleString()} coins**\n` +
          `🎁 Lucky Crates (\`lc\`): **${user.boxes || 0} လုံး**`
        )
        .setTimestamp();

      return message.reply({ embeds: [cashEmbed] });
    },
  },

  // ၂။ နေ့စဉ် အခမဲ့ငွေ၊ Profile EXP နှင့် Lucky Crate (lc) ထုတ်ယူခြင်း (Kdaily)
  {
    names: ['daily'],
    async execute(message, args, user) {
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;

      if (now - user.lastDaily < cooldown) {
        const remaining = cooldown - (now - user.lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`⏳ နေ့စဉ်ဆုကြေး ထုတ်ပြီးသား ဖြစ်ပါတယ်။ နောက်ထပ် **${hours} နာရီ ${minutes} မိနစ်** နေမှ ပြန်ထုတ်နိုင်ပါမယ်။`);
      }

      if (user.lastDaily > 0 && now - user.lastDaily <= 48 * 60 * 60 * 1000) {
        user.dailyStreak = (user.dailyStreak || 0) + 1;
      } else {
        user.dailyStreak = 1;
      }

      const MAX_DAILY = 10000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const baseReward = 500;
      const levelBonus = (currentLevel - 1) * 200;
      const expBonus = Math.floor(currentExp * 0.5);
      const streakBonus = (user.dailyStreak - 1) * 100;
      const reward = Math.min(baseReward + levelBonus + expBonus + streakBonus, MAX_DAILY);

      let dailyCrates = 2;
      let streakBonusText = '';
      if (user.dailyStreak % 3 === 0) {
        dailyCrates += 1;
        streakBonusText = ` *(🔥 ${user.dailyStreak} ရက်ဆက် Streak Bonus +1 အပါအဝင်)*`;
      }

      user.boxes = (user.boxes || 0) + dailyCrates;
      user.balance += reward;
      user.lastDaily = now;

      const expRes = addProfileExp(user, 100);
      await user.save();

      const maxNote = reward >= MAX_DAILY ? ' *(MAX)*' : '';
      return message.reply(
        `🎁 **Profile Lv.${currentLevel}** | 🔥 Streak: **${user.dailyStreak} ရက်** — နေ့စဉ်ဆုကြေး **${reward.toLocaleString()} coins**${maxNote} နှင့် **+${expRes.addedExp} Profile EXP** ရရှိပါပြီ!\n` +
        `🎁 **Daily Lucky Crate (\`lc\`):** **+${dailyCrates} လုံး** ရရှိပါတယ်!${streakBonusText} *(\`Kopen lc\` ဖြင့် ဖွင့်ပါ)*${expRes.levelUpText}`
      );
    },
  },

  // ၃။ အလုပ်လုပ်ပြီး ပိုက်ဆံရှာခြင်း (Kwork)
  {
    names: ['work'],
    async execute(message, args, user) {
      const now = Date.now();
      const cooldown = 30 * 60 * 1000;

      if (now - user.lastWork < cooldown) {
        const remaining = cooldown - (now - user.lastWork);
        const minutes = Math.ceil(remaining / (1000 * 60));
        return message.reply(`😓 အလုပ်လုပ်ထားတာ မောနေပါပြီ။ နောက်ထပ် **${minutes} မိနစ်** နေမှ ပြန်လုပ်နိုင်ပါမယ်။`);
      }

      const MAX_WORK = 3000;
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;

      const jobs = ['ပီဇာပို့ခြင်း', 'ကားရေဆေးခြင်း', 'Coding ရေးပေးခြင်း', 'ကော်ဖီဖျော်ခြင်း', 'Delivery ပို့ခြင်း'];
      const job = jobs[Math.floor(Math.random() * jobs.length)];

      const baseEarned = Math.floor(Math.random() * 151) + 50;
      const levelBonus = (currentLevel - 1) * 60;
      const expBonus = Math.floor(currentExp * 0.15);
      const earned = Math.min(baseEarned + levelBonus + expBonus, MAX_WORK);

      user.balance += earned;
      user.lastWork = now;

      updateQuestProgress(user, 'work', 1);

      const expRes = addProfileExp(user, 35);
      await user.save();

      const maxNote = earned >= MAX_WORK ? ' *(MAX)*' : '';
      return message.reply(
        `💼 **Profile Lv.${currentLevel}** — သင်သည် **${job}** ဖြင့် လုပ်အားခ **${earned.toLocaleString()} coins**${maxNote} နှင့် **+${expRes.addedExp} Profile EXP** ရရှိခဲ့ပါတယ်!${expRes.levelUpText}`
      );
    },
  },

  // ၄။ သူငယ်ချင်းဆီ ပိုက်ဆံလွှဲပေးခြင်း (Kgive @user 100)
  {
    names: ['give'],
    async execute(message, args, user) {
      const target = message.mentions.users.first();
      const amountArg = args.find((a) => !a.startsWith('<@'));
      const amount = parseInt(String(amountArg || '').replace(/,/g, ''), 10);

      if (!target || target.bot) {
        return message.reply('❌ ပိုက်ဆံလွှဲပေးမယ့် သူကို Mention ခေါ်ပါ။ (ဥပမာ - `Kgive @User 100`)');
      }
      if (target.id === message.author.id) {
        return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်လွှဲလို့ မရပါဘူး။');
      }
      if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ လွှဲမယ့် ပမာဏ မှန်ကန်စွာ ထည့်ပါ။');
      }
      if (amount > user.balance) {
        return message.reply('❌ လက်ကျန်ငွေ မလုံလောက်ပါ!');
      }

      const confirmEmbed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('💸 ငွေလွှဲပြောင်းမှု အတည်ပြုချက် (Confirm Transfer)')
        .setDescription(
          `**${message.author.username}** သည် **${target.username}** ထံသို့ **${amount.toLocaleString()} coins** လွှဲပေးမှာ သေချာပါသလား?\n` +
          `*(၃၀ စက္ကန့်အတွင်း အောက်ပါခလုတ်ကို နှိပ်၍ ရွေးချယ်ပါ)*`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('give_confirm')
          .setLabel('✅ Confirm (အတည်ပြုမည်)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('give_reject')
          .setLabel('❌ Reject (ပယ်ဖျက်မည်)')
          .setStyle(ButtonStyle.Danger)
      );

      const promptMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });
      const collector = promptMsg.createMessageComponentCollector({ time: 30000 });
      let handled = false;

      collector.on('collect', async (i) => {
        try {
          if (i.user.id !== message.author.id) {
            return i.reply({ content: '❌ ဒါက သင့်ရဲ့ ငွေလွှဲမှု မဟုတ်ပါဘူး!', ephemeral: true });
          }
          if (handled) return;
          handled = true;

          if (i.customId === 'give_reject') {
            collector.stop('rejected');
            const rejectEmbed = new EmbedBuilder()
              .setColor('#E74C3C')
              .setDescription(`❌ **${message.author.username}** က **${target.username}** ထံ ငွေလွှဲခြင်းကို ပယ်ဖျက်လိုက်ပါပြီ။`);
            return i.update({ embeds: [rejectEmbed], components: [] });
          }

          if (i.customId === 'give_confirm') {
            collector.stop('confirmed');

            // လက်ခံမည့်သူ Account ရှိပြီးသားဖြစ်စေရန် ကြိုတင်စစ်ဆေးခြင်း
            await getUser(target.id, target.username);

            // Atomic Update ဖြင့် ငွေနုတ်ခြင်း (Race Condition ကာကွယ်ရန်)
            const deducted = await User.findOneAndUpdate(
              { userId: message.author.id, balance: { $gte: amount } },
              { $inc: { balance: -amount } },
              { new: true }
            );

            if (!deducted) {
              const errEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setDescription('❌ လက်ကျန်ငွေ မလုံလောက်တော့ပါ!');
              return i.update({ embeds: [errEmbed], components: [] });
            }

            try {
              await User.updateOne(
                { userId: target.id },
                { $inc: { balance: amount }, $set: { username: target.username } }
              );
            } catch (transferErr) {
              // တစ်ဖက်ထံ ထည့်မရပါက ပေးပို့သူထံ ငွေပြန်အမ်းခြင်း (Rollback)
              await User.updateOne(
                { userId: message.author.id },
                { $inc: { balance: amount } }
              ).catch(() => {});
              throw transferErr;
            }

            const successEmbed = new EmbedBuilder()
              .setColor('#2ECC71')
              .setDescription(`💸 **${message.author.username}** က **${target.username}** ထံသို့ **${amount.toLocaleString()} coins** လွှဲပေးလိုက်ပါပြီ!`);
            return i.update({ embeds: [successEmbed], components: [] });
          }
        } catch (err) {
          console.error('Give Collect Error:', err);
          await promptMsg.edit({ content: '⚠️ ငွေလွှဲရာတွင် အမှားဖြစ်ပွားသွားပါတယ်။ ခဏနေမှ ထပ်စမ်းပါ။', embeds: [], components: [] }).catch(() => {});
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time' && !handled) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#95A5A6')
            .setDescription('⏳ အချိန်စေ့သွားသဖြင့် ငွေလွှဲမှု အလိုအလျောက် ပျက်ပြယ်သွားပါပြီ။');
          await promptMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
      });
    },
  },
];