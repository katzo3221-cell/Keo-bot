const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  getUser,
  addBattleExpReward,
  tryDropBattleCrate,
  updateQuestProgress,
  DAILY_BATTLE_CRATE_LIMIT,
} = require('../../models/User');
const {
  hasAnyAnimal,
  getBattleStats,
  generateWildEnemy,
  handleTeamCommand,
} = require('../../utils/battleHelper');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatPvpLevelUp(username, userObj, expRes) {
  if (!expRes.leveledUp) return '';
  const crateNote = expRes.rewardCrates > 0 ? ` နှင့် **Lucky Crate (\`lc\`) +${expRes.rewardCrates} လုံး**` : '';
  return `\n🔥 **BATTLE LEVEL UP!** **${username}** သည် **Battle Level ${userObj.battleLevel}** သို့ ရောက်ရှိသွားပါပြီ! (ဆု: **+${expRes.rewardCoins.toLocaleString()} coins**${crateNote})`;
}

module.exports = [
  // တိရစ္ဆာန် တိုက်ခိုက်ရေး စနစ် — Dynamic Solo & PvP
  {
    names: ['battle', 'b'],
    async execute(message, args, user) {
      if (args[0] && ['select', 'team'].includes(args[0].toLowerCase())) {
        return handleTeamCommand(message, args.slice(1), user);
      }

      const myStats = getBattleStats(user);
      if (myStats.team.length === 0) {
        if (!hasAnyAnimal(user)) {
          return message.reply('❌ တိုက်ပွဲဝင်ဖို့ တိရစ္ဆာန် တစ်ကောင်မှ မရှိသေးပါဘူး! `Khunt` ရိုက်ပြီး အရင်ဖမ်းပါ။');
        }
        return message.reply(
          '❌ တိုက်ပွဲဝင်ဖို့ **Battle Team** မရွေးချယ်ရသေးပါဘူး!\n' +
          'အရင်ဆုံး `Kteam <id1> [id2] [id3]` ရိုက်ပြီး တိုက်ပွဲဝင်မယ့် အကောင်တွေကို ကိုယ်တိုင်ရွေးချယ်ပါ။'
        );
      }

      const myTeamText = myStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
      const opponentMention = message.mentions.users.first();

      // ================= PvP BATTLE =================
      if (opponentMention) {
        if (opponentMention.bot) {
          return message.reply('❌ Bot များကို စိန်ခေါ်၍ မရပါ။');
        }
        if (opponentMention.id === message.author.id) {
          return message.reply('❌ ကိုယ့်ကိုယ်ကိုယ် ပြန်စိန်ခေါ်၍ မရပါ။');
        }

        const oppUser = await getUser(opponentMention.id, opponentMention.username);
        const oppStats = getBattleStats(oppUser);
        if (oppStats.team.length === 0) {
          return message.reply(`❌ **${opponentMention.username}** သည် Battle Team မရွေးချယ်ရသေးပါ။ (\`Kteam <id1> [id2] [id3]\` ဖြင့် အရင်ရွေးချယ်ရပါမည်)`);
        }

        const oppTeamText = oppStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
        const challengeEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`⚔️ PvP စိန်ခေါ်မှု: ${message.author.username} VS ${opponentMention.username}`)
          .setDescription(
            `**${message.author.username}** (Battle Lv.${myStats.battleLevel}) က **${opponentMention.username}** (Battle Lv.${oppStats.battleLevel}) ကို တိရစ္ဆာန်တိုက်ပွဲ စိန်ခေါ်လိုက်ပါပြီ!\n` +
            `<@${opponentMention.id}> အနေဖြင့် **၃၀ စက္ကန့်အတွင်း** လက်ခံမလား၊ ငြင်းပယ်မလား ရွေးချယ်ပါ —`
          )
          .addFields(
            { name: `🛡️ ${message.author.username}`, value: myTeamText, inline: true },
            { name: `🔥 ${opponentMention.username}`, value: oppTeamText, inline: true }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pvp_accept').setLabel('⚔️ Accept (လက်ခံမည်)').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('pvp_reject').setLabel('🏳️ Reject (ငြင်းပယ်မည်)').setStyle(ButtonStyle.Danger)
        );

        const challengeMsg = await message.reply({
          content: `<@${opponentMention.id}>`,
          embeds: [challengeEmbed],
          components: [row],
        });

        const collector = challengeMsg.createMessageComponentCollector({ time: 30000 });
        let handled = false;

        collector.on('collect', async (i) => {
          try {
            if (i.user.id !== opponentMention.id) {
              return i.reply({ content: '❌ ဒီစိန်ခေါ်မှုက သင့်ကို ခေါ်ထားတာ မဟုတ်ပါဘူး!', ephemeral: true });
            }
            if (handled) return;
            handled = true;

            if (i.customId === 'pvp_reject') {
              collector.stop('rejected');
              const rejectEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('🏳️ စိန်ခေါ်မှုကို ငြင်းပယ်လိုက်ပါပြီ')
                .setDescription(`**${opponentMention.username}** က **${message.author.username}** ၏ PvP တိုက်ပွဲစိန်ခေါ်မှုကို ငြင်းပယ်လိုက်ပါပြီ။`);
              return i.update({ content: '', embeds: [rejectEmbed], components: [] });
            }

            if (i.customId === 'pvp_accept') {
              collector.stop('accepted');

              const freshUser = await getUser(message.author.id, message.author.username);
              const freshOppUser = await getUser(opponentMention.id, opponentMention.username);
              const freshMyStats = getBattleStats(freshUser);
              const freshOppStats = getBattleStats(freshOppUser);

              if (freshMyStats.team.length === 0 || freshOppStats.team.length === 0) {
                const errEmbed = new EmbedBuilder()
                  .setColor('#E74C3C')
                  .setDescription('❌ ကစားသမားတစ်ဦးတွင် ရွေးချယ်ထားသော Battle Team မရှိတော့သဖြင့် တိုက်ပွဲပျက်ပြယ်သွားပါပြီ။');
                return i.update({ content: '', embeds: [errEmbed], components: [] });
              }

              const fightingEmbed = new EmbedBuilder()
                .setColor('#F39C12')
                .setTitle(`⚔️ PvP: ${message.author.username} (Battle Lv.${freshMyStats.battleLevel}) VS ${opponentMention.username} (Battle Lv.${freshOppStats.battleLevel})`)
                .addFields(
                  { name: `🛡️ ${message.author.username}`, value: freshMyStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n'), inline: true },
                  { name: `🔥 ${opponentMention.username}`, value: freshOppStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n'), inline: true }
                )
                .setFooter({ text: 'PvP တိုက်ပွဲ ပြင်းထန်စွာ တိုက်ခိုက်နေပါသည်...' });

              await i.update({ content: '', embeds: [fightingEmbed], components: [] });
              await sleep(1500);

              if (freshMyStats.totalPower >= freshOppStats.totalPower) {
                const gainedExp = Math.floor(Math.random() * 31) + 45;
                const winExpRes = addBattleExpReward(freshUser, gainedExp);
                updateQuestProgress(freshUser, 'battleWin', 1);
                const loseExpRes = addBattleExpReward(freshOppUser, 10);

                const crateRes = tryDropBattleCrate(freshUser, 0.20);
                const crateDropText = crateRes.dropped
                  ? `\n🎁 PvP အောင်ပွဲဆု **Lucky Crate +1** ရရှိပါတယ်! *(ယနေ့ Limit: **${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT}**)*`
                  : '';

                await freshUser.save();
                await freshOppUser.save();

                let resultText =
                  `🏆 **${message.author.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${freshMyStats.totalPower.toLocaleString()}\` vs \`${freshOppStats.totalPower.toLocaleString()}\`)\n` +
                  `⚔️ **+${gainedExp} Battle EXP** ရရှိပါတယ်!${crateDropText}` +
                  formatPvpLevelUp(message.author.username, freshUser, winExpRes) +
                  formatPvpLevelUp(opponentMention.username, freshOppUser, loseExpRes);

                fightingEmbed.setColor('#2ECC71').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
              } else {
                const gainedExp = Math.floor(Math.random() * 31) + 45;
                const winExpRes = addBattleExpReward(freshOppUser, gainedExp);
                updateQuestProgress(freshOppUser, 'battleWin', 1);
                const loseExpRes = addBattleExpReward(freshUser, 10);

                const crateRes = tryDropBattleCrate(freshOppUser, 0.20);
                const crateDropText = crateRes.dropped
                  ? `\n🎁 **${opponentMention.username}** သည် PvP အောင်ပွဲဆု **Lucky Crate +1** ရရှိပါတယ်! *(ယနေ့ Limit: **${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT}**)*`
                  : '';

                await freshUser.save();
                await freshOppUser.save();

                let resultText =
                  `🏆 **${opponentMention.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${freshOppStats.totalPower.toLocaleString()}\` vs \`${freshMyStats.totalPower.toLocaleString()}\`)\n` +
                  `⚔️ **${opponentMention.username}** က **+${gainedExp} Battle EXP** ရရှိပြီး **${message.author.username}** သည် **+10 Battle EXP** ရရှိပါတယ်။${crateDropText}` +
                  formatPvpLevelUp(opponentMention.username, freshOppUser, winExpRes) +
                  formatPvpLevelUp(message.author.username, freshUser, loseExpRes);

                fightingEmbed.setColor('#E74C3C').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
              }

              return challengeMsg.edit({ embeds: [fightingEmbed] }).catch(() => {});
            }
          } catch (err) {
            console.error('Battle PvP Collect Error:', err);
          }
        });

        collector.on('end', async (_, reason) => {
          if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription(`⏳ **${opponentMention.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်လည်ဖြေကြားခြင်း မရှိသဖြင့် PvP စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
            await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
          }
        });

        return;
      }

      // ================= DYNAMIC SOLO WILD BATTLE =================
      const wild = generateWildEnemy(myStats);
      const enemyTeamText = wild.team.map((a) => `${a.emoji} ${a.name}`).join('\n');

      const battleEmbed = new EmbedBuilder()
        .setColor(wild.difficulty.color)
        .setTitle(`⚔️ ${message.author.username} (Battle Lv.${myStats.battleLevel}) VS Wild Team (Lv.${wild.wildLevel})`)
        .setDescription(`**အခက်အခဲ:** ${wild.difficulty.label}`)
        .addFields(
          { name: '🛡️ သင့်အဖွဲ့ (Your Team)', value: myTeamText, inline: true },
          { name: `👹 ရန်သူ့အဖွဲ့ (Wild Lv.${wild.wildLevel})`, value: enemyTeamText, inline: true }
        )
        .setFooter({ text: 'တိုက်ခိုက်နေပါသည်...' });

      const msg = await message.reply({ embeds: [battleEmbed] });
      await sleep(1500);

      if (myStats.totalPower >= wild.totalPower) {
        const baseExp = Math.floor(Math.random() * 26) + 30;
        const gainedExp = baseExp + wild.difficulty.bonusExp;
        const expRes = addBattleExpReward(user, gainedExp);
        updateQuestProgress(user, 'battleWin', 1);

        const crateRes = tryDropBattleCrate(user, wild.difficulty.crateChance);
        const crateDropText = crateRes.dropped
          ? `\n🎁 ရန်သူ့စခန်းမှ **Lucky Crate +1** သိမ်းပိုက်ရရှိပါတယ်! *(ယနေ့ Limit: **${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT}**)*`
          : '';

        await user.save();

        const bLevel = user.battleLevel || 1;
        const winText =
          `**အခက်အခဲ:** ${wild.difficulty.label}\n\n` +
          `🎉 **အနိုင်ရရှိပါတယ်!** (Power: \`${myStats.totalPower.toLocaleString()}\` vs \`${wild.totalPower.toLocaleString()}\`)\n` +
          `⚔️ **+${gainedExp} Battle EXP** ရရှိပါတယ်! (${user.battleExp}/${bLevel * 100} EXP)${crateDropText}${expRes.levelUpText}`;

        battleEmbed.setColor('#2ECC71').setDescription(winText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      } else {
        const loseExp = 8 + Math.floor(wild.difficulty.bonusExp / 5);
        const expRes = addBattleExpReward(user, loseExp);
        await user.save();

        const bLevel = user.battleLevel || 1;
        const loseText =
          `**အခက်အခဲ:** ${wild.difficulty.label}\n\n` +
          `💀 **ရှုံးနိမ့်သွားပါတယ်!** (Power: \`${myStats.totalPower.toLocaleString()}\` vs \`${wild.totalPower.toLocaleString()}\`)\n` +
          `📖 **+${loseExp} Battle EXP** ရရှိပါတယ်။ (${user.battleExp}/${bLevel * 100} EXP)${expRes.levelUpText}`;

        battleEmbed.setColor('#E74C3C').setDescription(loseText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      }

      return msg.edit({ embeds: [battleEmbed] });
    },
  },
];