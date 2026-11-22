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
const {
  buildBattleUnits,
  simulateBattle,
  selectAnimationFrames,
  renderTeamField,
  pickArenaAndEnemy,
} = require('../../utils/battleEngine');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatPvpLevelUp(username, userObj, expRes) {
  if (!expRes.leveledUp) return '';
  const crateNote = expRes.rewardCrates > 0 ? ` နှင့် **Lucky Crate (\`lc\`) +${expRes.rewardCrates} လုံး**` : '';
  return `\n🔥 **BATTLE LEVEL UP!** **${username}** သည် **Battle Level ${userObj.battleLevel}** သို့ ရောက်ရှိသွားပါပြီ! (ဆု: **+${expRes.rewardCoins.toLocaleString()} coins**${crateNote})`;
}

// Turn-by-Turn Battle Embed တည်ဆောက်ခြင်း
function buildCombatEmbed({
  color,
  title,
  headerLine,
  logs,
  leftTitle,
  leftUnits,
  rightTitle,
  rightUnits,
  footerText,
}) {
  const logBlock = logs && logs.length > 0 ? `\n\n${logs.join('\n')}` : '';
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`${headerLine}${logBlock}`)
    .addFields(
      { name: leftTitle, value: renderTeamField(leftUnits), inline: true },
      { name: rightTitle, value: renderTeamField(rightUnits), inline: true }
    )
    .setFooter({ text: footerText });
}

module.exports = [
  // တိရစ္ဆာန် တိုက်ခိုက်ရေး စနစ် — Fantasy Turn-Based RPG (Solo & PvP)
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

      const opponentMention = message.mentions.users.first();

      // ================= PvP FANTASY BATTLE =================
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

        const previewMyUnits = buildBattleUnits(myStats.team, myStats.battleLevel, 1.0);
        const previewOppUnits = buildBattleUnits(oppStats.team, oppStats.battleLevel, 1.0);

        const challengeEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`⚔️ PvP Fantasy Arena: ${message.author.username} VS ${opponentMention.username}`)
          .setDescription(
            `**${message.author.username}** (Battle Lv.${myStats.battleLevel}) က **${opponentMention.username}** (Battle Lv.${oppStats.battleLevel}) ကို တိုက်ပွဲစိန်ခေါ်လိုက်ပါပြီ!\n` +
            `<@${opponentMention.id}> အနေဖြင့် **၃၀ စက္ကန့်အတွင်း** လက်ခံမလား၊ ငြင်းပယ်မလား ရွေးချယ်ပါ —`
          )
          .addFields(
            { name: `🛡️ ${message.author.username} (Lv.${myStats.battleLevel})`, value: renderTeamField(previewMyUnits), inline: true },
            { name: `🔥 ${opponentMention.username} (Lv.${oppStats.battleLevel})`, value: renderTeamField(previewOppUnits), inline: true }
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

              const { arena } = pickArenaAndEnemy();
              const myUnits = buildBattleUnits(freshMyStats.team, freshMyStats.battleLevel, 1.0);
              const oppUnits = buildBattleUnits(freshOppStats.team, freshOppStats.battleLevel, 1.0);
              const sim = simulateBattle(myUnits, oppUnits);
              const animFrames = selectAnimationFrames(sim.frames);

              const leftTitle = `🛡️ ${message.author.username} (Lv.${freshMyStats.battleLevel})`;
              const rightTitle = `🔥 ${opponentMention.username} (Lv.${freshOppStats.battleLevel})`;
              const title = `⚔️ PvP: ${message.author.username} VS ${opponentMention.username}`;

              const introEmbed = buildCombatEmbed({
                color: '#F39C12',
                title,
                headerLine: `**${arena}** • ⚔️ *တိုက်ပွဲ စတင်နေပါပြီ...*`,
                logs: [],
                leftTitle,
                leftUnits: myUnits,
                rightTitle,
                rightUnits: oppUnits,
                footerText: 'Turn 1 စတင်နေပါသည်...',
              });

              await i.update({ content: '', embeds: [introEmbed], components: [] });

              // Turn အလိုက် Live Animation ပြသခြင်း
              for (let idx = 0; idx < animFrames.length; idx++) {
                await sleep(1300);
                const frame = animFrames[idx];
                const isLast = idx === animFrames.length - 1;
                if (isLast) break;

                const turnEmbed = buildCombatEmbed({
                  color: '#F39C12',
                  title,
                  headerLine: `**${arena}** • 🔥 **Turn ${frame.turn}**`,
                  logs: frame.logs,
                  leftTitle,
                  leftUnits: frame.teamA,
                  rightTitle,
                  rightUnits: frame.teamB,
                  footerText: `Turn ${frame.turn} တိုက်ခိုက်နေပါသည်...`,
                });
                await challengeMsg.edit({ embeds: [turnEmbed] }).catch(() => {});
              }

              const finalFrame = sim.frames[sim.frames.length - 1];
              const p1Won = sim.winner === 'A';
              const gainedExp = Math.floor(Math.random() * 31) + 45;
              let resultText = '';

              if (p1Won) {
                const winExpRes = addBattleExpReward(freshUser, gainedExp);
                updateQuestProgress(freshUser, 'battleWin', 1);
                const loseExpRes = addBattleExpReward(freshOppUser, 10);

                const crateRes = tryDropBattleCrate(freshUser, 0.20);
                const crateDropText = crateRes.dropped
                  ? `\n🎁 PvP အောင်ပွဲဆု **Lucky Crate +1** ရရှိပါတယ်! *(ယနေ့ Limit: **${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT}**)*`
                  : '';

                await freshUser.save();
                await freshOppUser.save();

                resultText =
                  `**${arena}**\n` +
                  `🏆 **${message.author.username}** က **${sim.totalTurns} ကျော့မြောက်** တွင် အနိုင်ရရှိပါတယ်!\n` +
                  `⚔️ **+${gainedExp} Battle EXP** ရရှိပါတယ်!${crateDropText}` +
                  formatPvpLevelUp(message.author.username, freshUser, winExpRes) +
                  formatPvpLevelUp(opponentMention.username, freshOppUser, loseExpRes);
              } else {
                const winExpRes = addBattleExpReward(freshOppUser, gainedExp);
                updateQuestProgress(freshOppUser, 'battleWin', 1);
                const loseExpRes = addBattleExpReward(freshUser, 10);

                const crateRes = tryDropBattleCrate(freshOppUser, 0.20);
                const crateDropText = crateRes.dropped
                  ? `\n🎁 **${opponentMention.username}** သည် PvP အောင်ပွဲဆု **Lucky Crate +1** ရရှိပါတယ်! *(ယနေ့ Limit: **${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT}**)*`
                  : '';

                await freshUser.save();
                await freshOppUser.save();

                resultText =
                  `**${arena}**\n` +
                  `🏆 **${opponentMention.username}** က **${sim.totalTurns} ကျော့မြောက်** တွင် အနိုင်ရရှိပါတယ်!\n` +
                  `⚔️ **${opponentMention.username}** (+${gainedExp} EXP) | **${message.author.username}** (+10 EXP)${crateDropText}` +
                  formatPvpLevelUp(opponentMention.username, freshOppUser, winExpRes) +
                  formatPvpLevelUp(message.author.username, freshUser, loseExpRes);
              }

              const finalEmbed = buildCombatEmbed({
                color: p1Won ? '#2ECC71' : '#E74C3C',
                title,
                headerLine: resultText,
                logs: finalFrame.logs,
                leftTitle,
                leftUnits: finalFrame.teamA,
                rightTitle,
                rightUnits: finalFrame.teamB,
                footerText: `PvP တိုက်ပွဲ ${sim.totalTurns} ကျော့ဖြင့် ပြီးဆုံးပါပြီ`,
              });

              return challengeMsg.edit({ embeds: [finalEmbed] }).catch(() => {});
            }
          } catch (err) {
            console.error('Battle PvP Collect Error:', err);
          }
        });

        collector.on('end', async (_, reason) => {
          if (reason === 'time' && !handled) {
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription(`⏳ **${opponentMention.username}** မှ ၃၀ စက္ကန့်အတွင်း ပြန်လည်ဖြေကြားခြင်း မရှိသဖြင့် PvP စိန်ခေါ်မှု ပျက်ပြယ်သွားပါပြီ။`);
            await challengeMsg.edit({ content: '', embeds: [timeoutEmbed], components: [] }).catch(() => {});
          }
        });

        return;
      }

      // ================= DYNAMIC SOLO FANTASY BATTLE =================
      const wild = generateWildEnemy(myStats);
      const { arena, enemySquad } = pickArenaAndEnemy();

      const myUnits = buildBattleUnits(myStats.team, myStats.battleLevel, 1.0);
      const enemyUnits = buildBattleUnits(wild.team, wild.wildLevel, wild.difficulty.powerScale);
      const sim = simulateBattle(myUnits, enemyUnits);
      const animFrames = selectAnimationFrames(sim.frames);

      const leftTitle = `🛡️ ${message.author.username} (Lv.${myStats.battleLevel})`;
      const rightTitle = `${enemySquad} (Lv.${wild.wildLevel})`;
      const title = `⚔️ ${message.author.username} VS ${enemySquad}`;

      const startEmbed = buildCombatEmbed({
        color: wild.difficulty.color,
        title,
        headerLine: `**${arena}** • ${wild.difficulty.label}\n⚔️ *တိုက်ပွဲ စတင်နေပါပြီ...*`,
        logs: [],
        leftTitle,
        leftUnits: myUnits,
        rightTitle,
        rightUnits: enemyUnits,
        footerText: 'Turn 1 စတင်နေပါသည်...',
      });

      const msg = await message.reply({ embeds: [startEmbed] });

      // Turn အလိုက် Live Animation ပြသခြင်း
      for (let idx = 0; idx < animFrames.length; idx++) {
        await sleep(1300);
        const frame = animFrames[idx];
        const isLast = idx === animFrames.length - 1;
        if (isLast) break;

        const turnEmbed = buildCombatEmbed({
          color: '#F39C12',
          title,
          headerLine: `**${arena}** • ${wild.difficulty.label} • 🔥 **Turn ${frame.turn}**`,
          logs: frame.logs,
          leftTitle,
          leftUnits: frame.teamA,
          rightTitle,
          rightUnits: frame.teamB,
          footerText: `Turn ${frame.turn} တိုက်ခိုက်နေပါသည်...`,
        });
        await msg.edit({ embeds: [turnEmbed] }).catch(() => {});
      }

      const finalFrame = sim.frames[sim.frames.length - 1];
      const playerWon = sim.winner === 'A';

      if (playerWon) {
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
        const winHeader =
          `**${arena}** • ${wild.difficulty.label}\n` +
          `🏆 **${sim.totalTurns} ကျော့မြောက်တွင် အနိုင်ရရှိပါတယ်!**\n` +
          `⚔️ **+${gainedExp} Battle EXP** (${user.battleExp}/${bLevel * 100} EXP)${crateDropText}${expRes.levelUpText}`;

        const finalEmbed = buildCombatEmbed({
          color: '#2ECC71',
          title,
          headerLine: winHeader,
          logs: finalFrame.logs,
          leftTitle,
          leftUnits: finalFrame.teamA,
          rightTitle,
          rightUnits: finalFrame.teamB,
          footerText: `အနိုင်ရရှိပါပြီ • စုစုပေါင်း ${sim.totalTurns} ကျော့`,
        });

        return msg.edit({ embeds: [finalEmbed] }).catch(() => {});
      } else {
        const loseExp = 8 + Math.floor(wild.difficulty.bonusExp / 5);
        const expRes = addBattleExpReward(user, loseExp);
        await user.save();

        const bLevel = user.battleLevel || 1;
        const loseHeader =
          `**${arena}** • ${wild.difficulty.label}\n` +
          `💀 **${sim.totalTurns} ကျော့မြောက်တွင် ရှုံးနိမ့်သွားပါတယ်!**\n` +
          `📖 **+${loseExp} Battle EXP** (${user.battleExp}/${bLevel * 100} EXP)${expRes.levelUpText}`;

        const finalEmbed = buildCombatEmbed({
          color: '#E74C3C',
          title,
          headerLine: loseHeader,
          logs: finalFrame.logs,
          leftTitle,
          leftUnits: finalFrame.teamA,
          rightTitle,
          rightUnits: finalFrame.teamB,
          footerText: `ရှုံးနိမ့်သွားပါပြီ • စုစုပေါင်း ${sim.totalTurns} ကျော့`,
        });

        return msg.edit({ embeds: [finalEmbed] }).catch(() => {});
      }
    },
  },
];