const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../models/User');
const { RINGS } = require('../data/rings');
const {
  DAILY_PROFILE_EXP_LIMIT,
  DAILY_QUESTS_LIST,
  ensureDailyQuests,
  addProfileExp,
} = require('../models/User');
const { getTodayMyanmarDate } = require('../utils/helpers');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatDuration(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours} နာရီ ${minutes} မိနစ်`;
  if (minutes > 0) return `${minutes} မိနစ် ${seconds} စက္ကန့်`;
  return `${seconds} စက္ကန့်`;
}

module.exports = [
  // ၁။ Profile Level နှင့် Battle Level ခွဲပြခြင်း (Kprofile / Klvl / Klevel)
  {
    names: ['profile', 'p', 'lvl', 'level'],
    async execute(message, args, user) {
      const targetDiscordUser = message.mentions.users.first() || message.author;
      if (targetDiscordUser.bot) {
        return message.reply('❌ Bot များ၏ Profile ကို ကြည့်၍ မရပါ!');
      }

      const targetUser =
        targetDiscordUser.id === message.author.id
          ? user
          : await getUser(targetDiscordUser.id, targetDiscordUser.username);

      const pLevel = targetUser.level || 1;
      const pExp = targetUser.exp || 0;
      const pNeeded = pLevel * 150;
      const pProgress = Math.min(10, Math.floor((pExp / pNeeded) * 10));
      const pBar = '🟦'.repeat(pProgress) + '⬜'.repeat(10 - pProgress);

      const bLevel = targetUser.battleLevel || 1;
      const bExp = targetUser.battleExp || 0;
      const bNeeded = bLevel * 100;
      const bProgress = Math.min(10, Math.floor((bExp / bNeeded) * 10));
      const bBar = '🟥'.repeat(bProgress) + '⬜'.repeat(10 - bProgress);

      const todayStr = getTodayMyanmarDate();
      const todayExp = targetUser.dailyProfileExpDate === todayStr ? (targetUser.dailyProfileExpCount || 0) : 0;

      // လက်ရှိတပ်ဆင်ထားသော Item နှင့် အိတ်ထဲသိမ်းထားသော Item နှစ်ခုလုံး ရေတွက်ခြင်း
      const activeCount = (targetUser.items || []).length;
      const storedCount = Object.values(targetUser.storedItems || {}).reduce((sum, c) => sum + (c > 0 ? c : 0), 0);

      // တပ်ဆင်ထားသော လက်စွပ်နှင့် Profile Border Color ရှာဖွေခြင်း
      const equippedRing = targetUser.marriedRing
        ? RINGS.find((r) => r.id === targetUser.marriedRing)
        : null;
      const borderColor = equippedRing ? equippedRing.color : '#3498DB';

      let marriageText = '💔 တစ်ကိုယ်တည်း (Single)';
      if (targetUser.marriedTo && equippedRing) {
        const days = targetUser.marriedAt
          ? Math.floor((Date.now() - new Date(targetUser.marriedAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const daysText = days <= 0 ? 'ယနေ့ လက်ထပ်' : `${days} ရက်`;
        marriageText = `${equippedRing.emoji} **${equippedRing.name}** (${equippedRing.mmName})\n💞 <@${targetUser.marriedTo}> • *(${daysText})*`;
      }

      const profileEmbed = new EmbedBuilder()
        .setColor(borderColor)
        .setAuthor({
          name: `${targetDiscordUser.username} ၏ ကိုယ်ရေးအကျဉ်း (Profile)`,
          iconURL: targetDiscordUser.displayAvatarURL(),
        })
        .addFields(
          { name: '🏅 Profile Level', value: `**Lv.${pLevel}** (${pExp}/${pNeeded} EXP)`, inline: true },
          { name: '⚔️ Battle Level', value: `**Lv.${bLevel}** (${bExp}/${bNeeded} EXP)`, inline: true },
          { name: '🎁 Lucky Crates (`lc`)', value: `**${targetUser.boxes || 0} လုံး**`, inline: true },
          { name: '🔥 Daily Streak', value: `**${targetUser.dailyStreak || 0} ရက်**`, inline: true },
          { name: '🎒 ပိုင်ဆိုင်သော ပစ္စည်း', value: `Active: **${activeCount}** | အိတ်ထဲ: **${storedCount}**`, inline: true },
          { name: '📅 ယနေ့ Profile EXP Limit', value: `**${todayExp.toLocaleString()} / ${DAILY_PROFILE_EXP_LIMIT.toLocaleString()} EXP**`, inline: true },
          { name: '💍 အိမ်ထောင်ရေး (Marriage)', value: marriageText, inline: false },
          { name: '📊 Profile Level တိုးတက်မှု', value: `${pBar} (${Math.floor((pExp / pNeeded) * 100)}%)` },
          { name: '💥 Battle Level တိုးတက်မှု', value: `${bBar} (${Math.floor((bExp / bNeeded) * 100)}%)` }
        )
        .setFooter({ text: 'Profile Level တက်တိုင်း Coins နှင့် Lucky Crate (lc) ရရှိပါမည်' });

      return message.reply({ embeds: [profileEmbed] });
    },
  },

  // ၂။ Cooldown နှင့် နေ့စဉ် Limit များ စစ်ဆေးခြင်း (Kcd / Kcooldown)
  {
    names: ['cd', 'cooldown', 'cooldowns', 'limits'],
    async execute(message, args, user) {
      const now = Date.now();
      const todayStr = getTodayMyanmarDate();

      const dailyRemain = (24 * 60 * 60 * 1000) - (now - (user.lastDaily || 0));
      const dailyStatus = dailyRemain <= 0 ? '✅ **အဆင်သင့်ဖြစ်နေပါပြီ** (`Kdaily`)' : `⏳ ကျန်: **${formatDuration(dailyRemain)}**`;

      const workRemain = (30 * 60 * 1000) - (now - (user.lastWork || 0));
      const workStatus = workRemain <= 0 ? '✅ **အဆင်သင့်ဖြစ်နေပါပြီ** (`Kwork`)' : `⏳ ကျန်: **${formatDuration(workRemain)}**`;

      const huntDrops = user.dailyHuntItemDate === todayStr ? (user.dailyHuntItemCount || 0) : 0;
      const profileExpToday = user.dailyProfileExpDate === todayStr ? (user.dailyProfileExpCount || 0) : 0;
      const huntProgress = user.amvLocked ? '🔒 **AMV အတည်ပြုရန် လိုအပ်နေပါသည်** (`Kh`)' : `**${user.huntCount || 0} / 100 ကြိမ်**`;

      const cdEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setAuthor({ name: `${message.author.username} ၏ Cooldown & Daily Limits`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: '🎁 နေ့စဉ်ဆုကြေး (`Kdaily`)', value: dailyStatus, inline: false },
          { name: '💼 အလုပ်လုပ်ခြင်း (`Kwork`)', value: workStatus, inline: false },
          { name: '🎒 ယနေ့ Hunt Item Drop', value: `**${huntDrops} / 3 ခု**`, inline: true },
          { name: '✨ ယနေ့ Profile EXP', value: `**${profileExpToday.toLocaleString()} / ${DAILY_PROFILE_EXP_LIMIT.toLocaleString()}**`, inline: true },
          { name: '🛡️ AMV Hunt Counter', value: huntProgress, inline: true }
        )
        .setFooter({ text: 'နေ့စဉ် Limit များသည် မြန်မာစံတော်ချိန် ည ၁၂:၀၀ တွင် ပြန်လည်စတင်ပါသည်' })
        .setTimestamp();

      return message.reply({ embeds: [cdEmbed] });
    },
  },

  // ၃။ နေ့စဉ် Mission စနစ် (Kquest / Kq / Kquest claim)
  {
    names: ['quest', 'quests', 'q'],
    async execute(message, args, user) {
      ensureDailyQuests(user);
      const sub = args[0]?.toLowerCase();

      // ဆုလက်ဆောင် ထုတ်ယူခြင်း (Kquest claim)
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

      // Quest စာရင်း ကြည့်ရှုခြင်း
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

  // ၄။ Discord Profile ပုံ ကြည့်ရှုခြင်း (Kavater / Kavatar / Kav / Kpfp)
  {
    names: ['avater', 'avatar', 'av', 'pfp'],
    async execute(message) {
      const target = message.mentions.users.first() || message.author;
      const avatarUrl = target.displayAvatarURL({ size: 1024 });
      const pngUrl = target.displayAvatarURL({ extension: 'png', size: 1024 });
      const jpgUrl = target.displayAvatarURL({ extension: 'jpg', size: 1024 });
      const webpUrl = target.displayAvatarURL({ extension: 'webp', size: 1024 });

      const avatarEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🖼️ ${target.username} ၏ Profile ပုံ (Avatar)`)
        .setDescription(`[PNG](${pngUrl}) • [JPG](${jpgUrl}) • [WEBP](${webpUrl})`)
        .setImage(avatarUrl)
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      return message.reply({ embeds: [avatarEmbed] });
    },
  },

  // ၅။ စကားပြန်ပြောခိုင်းခြင်း (Krepeat / Krep / Ksay)
  {
    names: ['repeat', 'rep', 'say'],
    async execute(message, args) {
      if (args.length === 0) {
        return message.reply('❌ ပြောခိုင်းမယ့် စာသား ထည့်ပေးပါ!\nဥပမာ - `Krepeat 3 မင်္ဂလာပါ` သို့မဟုတ် `Krepeat မင်္ဂလာပါ`');
      }

      const MAX_REPEAT = 10;
      let count = 1;
      let text = '';

      if (/^\d+$/.test(args[0])) {
        count = Math.min(Math.max(parseInt(args[0], 10), 1), MAX_REPEAT);
        text = args.slice(1).join(' ');
      } else {
        text = args.join(' ');
      }

      if (!text.trim()) {
        return message.reply('❌ အကြိမ်ရေ နောက်မှာ ပြောခိုင်းမယ့် စာသားပါ ထည့်ပေးပါ! (ဥပမာ - `Krepeat 3 မင်္ဂလာပါ`)');
      }

      const cleanText = text.slice(0, 2000);
      await message.delete().catch(() => {});

      for (let i = 0; i < count; i++) {
        await message.channel.send({
          content: cleanText,
          allowedMentions: { parse: [] },
        });
        if (i < count - 1) {
          await sleep(600);
        }
      }
    },
  },

  // ၆။ Command စာရင်းကြည့်ရန် (Khelp)
  {
    names: ['help'],
    async execute(message) {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Keo Bot အသုံးပြုနည်း Command လမ်းညွှန်')
        .addFields(
          { name: '💰 Economy (စီးပွားရေး)', value: '`Kcash`, `Kdaily`, `Kwork`, `Kshop`, `Kbuy <id>`, `Kuse <id>`, `Kinv`, `Kgive @user <amount>`, `Ktop [cash/lvl/battle/zoo]`' },
          { name: '🏹 Hunting & Lucky Crate', value: '`Khunt` (`Kh`), `Kzoo` (`Kz`), `Kzoo id` (`Kzooid`), `Ksell <id> [အရေအတွက်/all]`, `Ksell <rank>`, `Ksell all`, `Kopen lc [အရေအတွက်/all]`' },
          { name: '🎲 Gambling (လောင်းကစား & PvP)', value: '`Kcf <amount/all> [h/t]`, `Ks <amount/all>`, `Kd <amount/all> <s/b/t>`, `Kbj [@user] <amount/all>`, `Kskm [@user] <amount/all>`, `Kgin <amount/all> [အကောင်]`, `Kmine <amount/all> [ဗုံး 1-6]` (3×3), `Kmines <amount/all> [ဗုံး 1-11]` (4×4), `Krps @user <amount/all>`' },
          { name: '⚔️ Battle (တိုက်ခိုက်ခြင်း)', value: '`Kbattle` (`Kb`), `Kbattle @user`, `Kteam <id1> [id2] [id3]`, `Kteam clear`' },
          { name: '🤗 Actions (လှုပ်ရှားမှု ၂၂ မျိုး)', value: '`Kcuddle`, `Khug`, `Kkiss`, `Kclick`, `Knom`, `Kpat`, `Kpoke`, `Kslap`, `Kstare`, `Khighfive`, `Kbite`, `Kgreet`, `Kpunch`, `Khandholding`, `Ktickle`, `Kkill`, `Khold`, `Kpats`, `Kwave`, `Kboop`, `Ksnuggle`, `Kbully` (`@user`)' },
          { name: '💍 Marriage (လက်ထပ်စနစ်)', value: '`Kbuy <ring1-5>`, `Kmarry @user <ring1-5>`, `Kdivorce`, `Kprofile [@user]`' },
          { name: '🛠️ Utility, Quest & Profile', value: '`Kprofile [@user]` (`Klvl`), `Kcd`, `Kquest` (`Kquest claim`), `Kavater` (`Kavatar` `[@user]`), `Krepeat [အကြိမ်ရေ] <စာသား>`, `Khelp`' }
        )
        .setFooter({ text: 'ပျော်ရွှင်စွာ ကစားနိုင်ပါစေ!' });

      return message.reply({ embeds: [helpEmbed] });
    },
  },
];