const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../models/User');
const ANIMALS = require('../../data/animals');
const { RANKS, SHORT_RANK_LABELS, syncCollection } = require('../../utils/huntingHelper');

module.exports = [
  // တိရစ္ဆာန် Collection စာရင်း ကြည့်ရှုခြင်း (Kcol / Kcollection [@user] [rank])
  {
    names: ['col', 'collection'],
    async execute(message, args, user) {
      const targetDiscordUser = message.mentions.users.first() || message.author;
      if (targetDiscordUser.bot) {
        return message.reply('❌ Bot များ၏ Collection ကို ကြည့်၍ မရပါ!');
      }

      const targetUser =
        targetDiscordUser.id === message.author.id
          ? user
          : await getUser(targetDiscordUser.id, targetDiscordUser.username);

      if (syncCollection(targetUser)) {
        await targetUser.save();
      }

      const collectedSet = new Set(targetUser.collectedAnimals || []);
      const collectedCount = collectedSet.size;
      const totalCount = ANIMALS.length;
      const percent = Math.floor((collectedCount / totalCount) * 100);
      const barFilled = Math.min(10, Math.floor((collectedCount / totalCount) * 10));
      const progressBar = '🟩'.repeat(barFilled) + '⬜'.repeat(10 - barFilled);

      const rankQuery = args.find((a) => !a.startsWith('<@'))?.toLowerCase();
      if (rankQuery) {
        const matchedRank = RANKS.find(
          (r) =>
            r.name.toLowerCase() === rankQuery ||
            r.name.toLowerCase().replace(/\s+/g, '') === rankQuery
        );

        if (!matchedRank) {
          const validRanks = RANKS.map((r) => `\`${r.name.toLowerCase().replace(/\s+/g, '')}\``).join(', ');
          return message.reply(`❌ Rank နာမည် မမှန်ပါ! ကြည့်နိုင်သော Rank များ: ${validRanks}`);
        }

        const rankTag = `(${matchedRank.name})`;
        const rankAnimals = ANIMALS.filter((a) => a.name.endsWith(rankTag));
        const rankUnlocked = rankAnimals.filter((a) => collectedSet.has(a.id)).length;

        const detailLines = rankAnimals.map((a) => {
          const cleanName = a.name.replace(/\s*\([^)]+\)\s*$/, '');
          return collectedSet.has(a.id)
            ? `✅ ${a.emoji} **${cleanName}**`
            : `⬛ ❓ *${cleanName} (မမိသေး)*`;
        });

        const detailEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setAuthor({
            name: `${targetDiscordUser.username} ၏ Collection — ${matchedRank.name}`,
            iconURL: targetDiscordUser.displayAvatarURL(),
          })
          .setDescription(
            `${matchedRank.emoji} **${matchedRank.name}** — **${rankUnlocked} / ${rankAnimals.length}**\n\n` +
            detailLines.join('\n')
          )
          .setFooter({ text: 'အားလုံးပြန်ကြည့်ရန်: Kcol' });

        return message.reply({ embeds: [detailEmbed] });
      }

      const lines = RANKS.map((rankInfo) => {
        const rankTag = `(${rankInfo.name})`;
        const rankAnimals = ANIMALS.filter((a) => a.name.endsWith(rankTag));
        const unlocked = rankAnimals.filter((a) => collectedSet.has(a.id)).length;
        const icons = rankAnimals
          .map((a) => (collectedSet.has(a.id) ? a.emoji : '⬛'))
          .join(' ');
        const label = SHORT_RANK_LABELS[rankInfo.name] || rankInfo.name;
        return `${rankInfo.emoji} **${label}** \`${unlocked}/${rankAnimals.length}\` ➔ ${icons}`;
      });

      const colEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setAuthor({
          name: `${targetDiscordUser.username} ၏ Animal Collection (Pokédex)`,
          iconURL: targetDiscordUser.displayAvatarURL(),
        })
        .setDescription(
          `📖 **Collection: ${collectedCount} / ${totalCount} (${percent}%)**\n` +
          `${progressBar}\n\n` +
          lines.join('\n')
        )
        .setFooter({ text: 'အသေးစိတ်ကြည့်ရန်: Kcol <rank> (ဥပမာ - Kcol celestial) | အခြားသူကြည့်ရန်: Kcol @user' });

      return message.reply({ embeds: [colEmbed] });
    },
  },
];