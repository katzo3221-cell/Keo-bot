const { EmbedBuilder } = require('discord.js');
const {
  getUser,
  DAILY_PROFILE_EXP_LIMIT,
  DAILY_BATTLE_CRATE_LIMIT,
} = require('../../models/User');
const { RINGS } = require('../../data/rings');
const { getTodayMyanmarDate } = require('../../utils/helpers');

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

      const activeCount = (targetUser.items || []).length;
      const storedCount = Object.values(targetUser.storedItems || {}).reduce((sum, c) => sum + (c > 0 ? c : 0), 0);

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
          { name: '💍 Marriage', value: marriageText, inline: false },
          { name: '📊 Profile Level တိုးတက်မှု', value: `${pBar} (${Math.floor((pExp / pNeeded) * 100)}%)` },
          { name: '💥 Battle Level တိုးတက်မှု', value: `${bBar} (${Math.floor((bExp / bNeeded) * 100)}%)` }
        )
        .setFooter({ text: 'Profile Level နှင့် Battle Level တက်တိုင်း Coins နှင့် Lucky Crate (lc) ရရှိပါမည်' });

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
      const battleCrates = user.dailyBattleCrateDate === todayStr ? (user.dailyBattleCrateCount || 0) : 0;
      const profileExpToday = user.dailyProfileExpDate === todayStr ? (user.dailyProfileExpCount || 0) : 0;
      const huntProgress = user.amvLocked ? '🔒 **AMV အတည်ပြုရန် လိုအပ်နေပါသည်** (`Kh`)' : `**${user.huntCount || 0} / 100 ကြိမ်**`;

      const cdEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setAuthor({ name: `${message.author.username} ၏ Cooldown & Daily Limits`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: '🎁 နေ့စဉ်ဆုကြေး (`Kdaily`)', value: dailyStatus, inline: false },
          { name: '💼 အလုပ်လုပ်ခြင်း (`Kwork`)', value: workStatus, inline: false },
          { name: '🎒 ယနေ့ Hunt Item Drop', value: `**${huntDrops} / 3 ခု**`, inline: true },
          { name: '🎁 ယနေ့ Battle Crate Drop', value: `**${battleCrates} / ${DAILY_BATTLE_CRATE_LIMIT} လုံး**`, inline: true },
          { name: '✨ ယနေ့ Profile EXP', value: `**${profileExpToday.toLocaleString()} / ${DAILY_PROFILE_EXP_LIMIT.toLocaleString()}**`, inline: true },
          { name: '🛡️ AMV Hunt Counter', value: huntProgress, inline: false }
        )
        .setFooter({ text: 'နေ့စဉ် Limit များသည် မြန်မာစံတော်ချိန် ည ၁၂:၀၀ တွင် ပြန်လည်စတင်ပါသည်' })
        .setTimestamp();

      return message.reply({ embeds: [cdEmbed] });
    },
  },

  // ၃။ Discord Profile ပုံ ကြည့်ရှုခြင်း (Kavater / Kavatar / Kav / Kpfp)
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
];