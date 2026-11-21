const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ANIMALS = require('../../data/animals');
const { findAnimal } = require('../../utils/helpers');
const {
  RANKS,
  SHORT_RANK_LABELS,
  getAnimalMeta,
  syncCollection,
  syncZooStats,
  syncBattleTeam,
} = require('../../utils/huntingHelper');

module.exports = [
  // ၁။ တိရစ္ဆာန်ရုံ ကြည့်ခြင်း (Kzoo / Kz / Kzoo id / Kzooid)
  {
    names: ['zoo', 'z', 'zooid'],
    async execute(message, args, user, commandName) {
      const zooData = user.zoo || {};
      const hasAnimals = ANIMALS.some((a) => (Number(zooData[a.name]) || 0) > 0);

      if (!hasAnimals) {
        return message.reply('🏞️ သင့်တိရစ္ဆာန်ရုံထဲမှာ ဘာမှ မရှိသေးပါဘူး။ `Khunt` ရိုက်ပြီး ဖမ်းကြည့်ပါ!');
      }

      let showIds = commandName === 'zooid' || ['id', 'ids', 'list'].includes(args[0]?.toLowerCase());
      let page = 0;

      const buildZooView = () => {
        let totalValue = 0;
        let totalAnimals = 0;
        const rankLines = [];

        const ranksOrder = showIds ? [...RANKS].reverse() : RANKS;

        for (const rankInfo of ranksOrder) {
          const rankTag = `(${rankInfo.name})`;
          const ownedInRank = ANIMALS.filter(
            (a) => a.name.endsWith(rankTag) && (Number(zooData[a.name]) || 0) > 0
          );

          if (ownedInRank.length > 0) {
            const listText = ownedInRank
              .map((a) => {
                const count = Number(zooData[a.name]) || 0;
                totalValue += a.price * count;
                totalAnimals += count;
                return showIds
                  ? `${a.emoji}\`${a.id}\`×${count}`
                  : `${a.emoji}×${count}`;
              })
              .join(' ');

            const label = SHORT_RANK_LABELS[rankInfo.name] || rankInfo.name;
            rankLines.push(`${rankInfo.emoji}**${label}** ➔ ${listText}`);
          }
        }

        const pages = [];
        let currentLines = [];
        let currentLen = 0;

        for (const line of rankLines) {
          if (currentLen + line.length + 1 > 3800 && currentLines.length > 0) {
            pages.push(currentLines.join('\n'));
            currentLines = [line];
            currentLen = line.length;
          } else {
            currentLines.push(line);
            currentLen += line.length + 1;
          }
        }
        if (currentLines.length > 0) {
          pages.push(currentLines.join('\n'));
        }

        const totalPages = Math.max(1, pages.length);
        if (page >= totalPages) page = totalPages - 1;
        if (page < 0) page = 0;

        const pageNote = totalPages > 1 ? ` • စာမျက်နှာ ${page + 1}/${totalPages}` : '';

        const embed = new EmbedBuilder()
          .setColor(showIds ? '#3498DB' : '#2ECC71')
          .setAuthor({
            name: `${message.author.username} ၏ တိရစ္ဆာန်ရုံ (${showIds ? 'ID စာရင်း' : 'Zoo'}${pageNote})`,
            iconURL: message.author.displayAvatarURL(),
          })
          .setDescription(pages[page])
          .addFields(
            { name: '🐾 စုစုပေါင်း အကောင်ရေ', value: `**${totalAnimals.toLocaleString()} ကောင်**`, inline: true },
            { name: '💵 စုစုပေါင်း တန်ဖိုး', value: `**${totalValue.toLocaleString()} coins**`, inline: true }
          )
          .setFooter({
            text: showIds
              ? 'အဖွဲ့ရွေးရန်: Kteam <id1> [id2] [id3] | ရောင်းရန်: Ksell <id> [အရေအတွက်]'
              : 'ID ကြည့်ရန်: Kzoo id | အဖွဲ့ရွေးရန်: Kteam <id1> [id2] [id3] | ရောင်းရန်: Ksell all',
          });

        const buttons = [
          new ButtonBuilder()
            .setCustomId('zoo_toggle_id')
            .setLabel(showIds ? '🐾 အကျဉ်းကြည့်ရန်' : '🆔 ID များကြည့်ရန်')
            .setStyle(showIds ? ButtonStyle.Secondary : ButtonStyle.Primary),
        ];

        if (totalPages > 1) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId('zoo_prev')
              .setLabel('◀️ ရှေ့')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('zoo_next')
              .setLabel('နောက် ▶️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1)
          );
        }

        const row = new ActionRowBuilder().addComponents(buttons);
        return { embed, row };
      };

      const initial = buildZooView();
      const zooMsg = await message.reply({
        embeds: [initial.embed],
        components: [initial.row],
      });

      const collector = zooMsg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        try {
          if (i.user.id !== message.author.id) {
            return i.reply({ content: '❌ ဒါက သင့်ရဲ့ တိရစ္ဆာန်ရုံ မဟုတ်ပါဘူး!', ephemeral: true });
          }

          if (i.customId === 'zoo_toggle_id') {
            showIds = !showIds;
            page = 0;
          } else if (i.customId === 'zoo_prev') {
            page -= 1;
          } else if (i.customId === 'zoo_next') {
            page += 1;
          }

          const updated = buildZooView();
          await i.update({
            embeds: [updated.embed],
            components: [updated.row],
          });
        } catch (err) {
          console.error('Zoo Collect Error:', err);
        }
      });

      collector.on('end', async () => {
        await zooMsg.edit({ components: [] }).catch(() => {});
      });
    },
  },

  // ၂။ တိရစ္ဆာန် ရောင်းချခြင်း (Ksell all / Ksell <id> [count/all] / Ksell <rank>)
  {
    names: ['sell', 'sellall'],
    async execute(message, args, user, commandName) {
      const entries = Object.entries(user.zoo || {}).filter(([, count]) => count > 0);
      if (entries.length === 0) {
        return message.reply('❌ ရောင်းစရာ တိရစ္ဆာန် တစ်ကောင်မှ မရှိပါဘူး။');
      }

      // မရောင်းခင် Pokédex Collection ထဲ အရင်သိမ်းထားခြင်း
      syncCollection(user);

      const firstArg = args[0]?.toLowerCase();

      if (commandName === 'sellall' || firstArg === 'all') {
        const protectedCounts = {};
        for (const id of user.battleTeam || []) {
          const info = ANIMALS.find((a) => a.id === id);
          if (!info) continue;
          const owned = (user.zoo && user.zoo[info.name]) || 0;
          const alreadyProtected = protectedCounts[info.name] || 0;
          if (owned > alreadyProtected) {
            protectedCounts[info.name] = alreadyProtected + 1;
          }
        }

        let totalEarned = 0;
        let soldTotal = 0;
        let keptTotal = 0;
        const newZoo = {};

        for (const [name, count] of entries) {
          const info = ANIMALS.find((a) => a.name === name);
          const keepCount = Math.min(count, protectedCounts[name] || 0);
          const sellCount = count - keepCount;

          if (keepCount > 0) {
            newZoo[name] = keepCount;
            keptTotal += keepCount;
          }

          if (sellCount > 0 && info) {
            totalEarned += info.price * sellCount;
            soldTotal += sellCount;
          }
        }

        if (soldTotal === 0) {
          return message.reply(
            '🛡️ ရောင်းစရာ တိရစ္ဆာန် မရှိပါဘူး! လက်ကျန်အကောင်အားလုံးက **Battle Team** ထဲမှာ တပ်ဆင်ထားတဲ့ အကောင်တွေ ဖြစ်နေပါတယ်။\n' +
            '*(အဲဒီအကောင်တွေကိုပါ ရောင်းချင်ရင် `Kteam clear` အရင်ရိုက်ပါ)*'
          );
        }

        user.zoo = newZoo;
        syncBattleTeam(user);
        syncZooStats(user);
        user.balance += totalEarned;
        user.markModified('zoo');
        await user.save();

        const keepNote = keptTotal > 0
          ? `\n🛡️ *(Battle Team ထဲမှ အကောင် **${keptTotal} ကောင်** ကို မရောင်းဘဲ ချန်ထားပေးထားပါသည်)*`
          : '';

        return message.reply(
          `💵 တိရစ္ဆာန် စုစုပေါင်း **${soldTotal.toLocaleString()} ကောင်** ကို ရောင်းချလိုက်ရာ **+${totalEarned.toLocaleString()} coins** ရရှိပါပြီ!${keepNote}`
        );
      }

      if (!firstArg) {
        return message.reply(
          '❌ ရောင်းမယ့် အကောင် ID သို့မဟုတ် `all` ထည့်ပေးပါ!\n' +
          'ဥပမာ - `Ksell ant` | `Ksell rabbit 3` | `Ksell rabbit all` | `Ksell all`'
        );
      }

      const rankMap = {
        common: '(Common)',
        uncommon: '(Uncommon)',
        rare: '(Rare)',
        superrare: '(Super Rare)',
        epic: '(Epic)',
        ultraepic: '(Ultra Epic)',
        legendary: '(Legendary)',
        mythical: '(Mythical)',
        divine: '(Divine)',
        celestial: '(Celestial)',
      };

      if (rankMap[firstArg]) {
        const rankTag = rankMap[firstArg];

        const protectedCounts = {};
        for (const id of user.battleTeam || []) {
          const info = ANIMALS.find((a) => a.id === id);
          if (!info) continue;
          const owned = (user.zoo && user.zoo[info.name]) || 0;
          const alreadyProtected = protectedCounts[info.name] || 0;
          if (owned > alreadyProtected) {
            protectedCounts[info.name] = alreadyProtected + 1;
          }
        }

        let rankEarned = 0;
        let soldTotal = 0;
        let keptTotal = 0;

        for (const [name, count] of entries) {
          if (name.includes(rankTag)) {
            const info = ANIMALS.find((a) => a.name === name);
            if (!info) continue;

            const keepCount = Math.min(count, protectedCounts[name] || 0);
            const sellCount = count - keepCount;

            if (keepCount > 0) {
              user.zoo[name] = keepCount;
              keptTotal += keepCount;
            } else {
              delete user.zoo[name];
            }

            if (sellCount > 0) {
              rankEarned += info.price * sellCount;
              soldTotal += sellCount;
            }
          }
        }

        if (soldTotal === 0) {
          if (keptTotal > 0) {
            return message.reply(
              `🛡️ ရောင်းစရာ **${rankTag}** အကောင် မရှိပါဘူး! လက်ကျန် **${keptTotal} ကောင်** လုံးက **Battle Team** ထဲမှာ တပ်ဆင်ထားပါတယ်။\n` +
              '*(အဲဒီအကောင်တွေကိုပါ ရောင်းချင်ရင် `Kteam clear` အရင်ရိုက်ပါ)*'
            );
          }
          return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ **${rankTag}** အကောင် မရှိပါဘူး။`);
        }

        syncBattleTeam(user);
        syncZooStats(user);
        user.balance += rankEarned;
        user.markModified('zoo');
        await user.save();

        const keepNote = keptTotal > 0
          ? `\n🛡️ *(Battle Team ထဲမှ **${rankTag}** အကောင် **${keptTotal} ကောင်** ကို မရောင်းဘဲ ချန်ထားပေးထားပါသည်)*`
          : '';

        return message.reply(
          `💵 **${rankTag}** တိရစ္ဆာန် စုစုပေါင်း **${soldTotal.toLocaleString()} ကောင်** ကို ရောင်းချလိုက်ရာ **+${rankEarned.toLocaleString()} coins** ရရှိပါပြီ!${keepNote}`
        );
      }

      const targetAnimal = findAnimal(firstArg);
      if (!targetAnimal) {
        return message.reply(`❌ \`${args[0]}\` ဆိုတဲ့ တိရစ္ဆာန် ID မတွေ့ပါဘူး!`);
      }

      const ownedCount = (user.zoo && user.zoo[targetAnimal.name]) || 0;
      if (ownedCount <= 0) {
        const meta = getAnimalMeta(targetAnimal);
        return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ ${meta.rankEmoji} ${targetAnimal.emoji} **${meta.shortName}** (\`${targetAnimal.id}\`) မရှိပါဘူး။`);
      }

      const qtyArg = args[1]?.toLowerCase();
      let sellCount = 1;

      if (qtyArg === 'all') {
        sellCount = ownedCount;
      } else if (qtyArg !== undefined) {
        sellCount = parseInt(qtyArg, 10);
        if (isNaN(sellCount) || sellCount <= 0) {
          return message.reply('❌ ရောင်းမယ့် အရေအတွက် မှန်ကန်စွာ ထည့်ပါ! (ဥပမာ - `Ksell rabbit 2` သို့မဟုတ် `Ksell rabbit all`)');
        }
        if (sellCount > ownedCount) {
          const meta = getAnimalMeta(targetAnimal);
          return message.reply(`❌ သင့်မှာ ${meta.rankEmoji} ${targetAnimal.emoji} **${meta.shortName}** စုစုပေါင်း **${ownedCount} ကောင်** ပဲ ရှိပါတယ်။`);
        }
      }

      const earned = targetAnimal.price * sellCount;
      if (ownedCount - sellCount <= 0) {
        delete user.zoo[targetAnimal.name];
      } else {
        user.zoo[targetAnimal.name] = ownedCount - sellCount;
      }

      syncBattleTeam(user);
      syncZooStats(user);
      user.balance += earned;
      user.markModified('zoo');
      await user.save();

      const meta = getAnimalMeta(targetAnimal);
      return message.reply(
        `💵 ${meta.rankEmoji} ${targetAnimal.emoji} **${meta.shortName}** (\`${targetAnimal.id}\`) × \`${sellCount}\` ကောင်ကို ရောင်းချလိုက်ရာ **+${earned.toLocaleString()} coins** ရရှိပါပြီ!`
      );
    },
  },
];