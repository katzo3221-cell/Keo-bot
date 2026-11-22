const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
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
  pickArenaAndEnemy,
} = require('../../utils/battleEngine');
const { renderBattleCard } = require('../../utils/battleCanvas');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatPvpLevelUp(username, userObj, expRes) {
  if (!expRes.leveledUp) return '';
  const crateNote = expRes.rewardCrates > 0 ? ` နှင့် **Lucky Crate (\`lc\`) +${expRes.rewardCrates} လုံး**` : '';
  return `\n🔥 **BATTLE LEVEL UP!** **${username}** ➔ **Battle Lv.${userObj.battleLevel}** (+${expRes.rewardCoins.toLocaleString()} coins${crateNote})`;
}

// OwO စတိုင် အကောင်နာမည်မပါဘဲ Emoji + Class အကျဉ်းသာ ပြသခြင်း
function formatCompactRoster(units, level) {
  return units
    .map((u) => `\`Lv.${level}\` ${u.rankEmoji}${u.emoji} — ${u.cls.icon} *${u.cls.title}*`)
    .join('\n');
}

// Canvas Battle Card ပါဝင်သော Embed တည်ဆောက်ခြင်း
function buildCardEmbed({
  color,
  authorName,
  authorIcon,
  description,
  leftTitle,
  leftRoster,
  rightTitle,
  rightRoster,
  imageFileName,
  footerText,
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: authorName, iconURL: authorIcon })
    .addFields(
      { name: leftTitle, value: leftRoster, inline: true },
      { name: rightTitle, value: rightRoster, inline: true }
    )
    .setImage(`attachment://${imageFileName}`)
    .setFooter({ text: footerText });

  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

module.exports = [
  // တိရစ္ဆာန် တိုက်ခိုက်ရေး စနစ် — OwO Style HD Canvas RPG Card (Solo & PvP)
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

      // ================= PvP CANVAS BATTLE =================
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
          .setTitle(`⚔️ PvP Arena: ${message.author.username} VS ${opponentMention.username}`)
          .setDescription(
            `**${message.author.username}** က **${opponentMention.username}** ကို တိုက်ပွဲစိန်ခေါ်လိုက်ပါပြီ!\n` +
            `<@${opponentMention.id}> အနေဖြင့် **၃၀ စက္ကန့်အတွင်း** ရွေးချယ်ပါ —`
          )
          .addFields(
            { name: `🛡️ ${message.author.username} (Lv.${myStats.battleLevel})`, value: formatCompactRoster(previewMyUnits, myStats.battleLevel), inline: true },
            { name: `🔥 ${opponentMention.username} (Lv.${oppStats.battleLevel})`, value: formatCompactRoster(previewOppUnits, oppStats.battleLevel), inline: true }
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
                  .setDescription('❌ ကစားသမားတစ်ဦးတွင် Battle Team မရှိတော့သဖြင့် တိုက်ပွဲပျက်ပြယ်သွားပါပြီ။');
                return i.update({ content: '', embeds: [errEmbed], components: [] });
              }

              const { arena } = pickArenaAndEnemy();
              const myUnits = buildBattleUnits(freshMyStats.team, freshMyStats.battleLevel, 1.0);
              const oppUnits = buildBattleUnits(freshOppStats.team, freshOppStats.battleLevel, 1.0);
              const sim = simulateBattle(myUnits, oppUnits);
              const finalFrame = sim.frames[sim.frames.length - 1];
              const p1Won = sim.winner === 'A';
              const gainedExp = Math.floor(Math.random() * 31) + 45;

              let bonusText = '';
              let footerResult = '';

              if (p1Won) {
                const winExpRes = addBattleExpReward(freshUser, gainedExp);
                updateQuestProgress(freshUser, 'battleWin', 1);
                const loseExpRes = addBattleExpReward(freshOppUser, 10);
                const crateRes = tryDropBattleCrate(freshUser, 0.20);

                await freshUser.save();
                await freshOppUser.save();

                if (crateRes.dropped) {
                  bonusText += `\n🎁 **${message.author.username}** သည် Lucky Crate +1 ရရှိပါတယ်! (${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT})`;
                }
                bonusText += formatPvpLevelUp(message.author.username, freshUser, winExpRes);
                bonusText += formatPvpLevelUp(opponentMention.username, freshOppUser, loseExpRes);
                footerResult = `🏆 ${message.author.username} အနိုင်ရရှိပါပြီ (${sim.totalTurns} ကျော့) | +${gainedExp} Battle EXP`;
              } else {
                const winExpRes = addBattleExpReward(freshOppUser, gainedExp);
                updateQuestProgress(freshOppUser, 'battleWin', 1);
                const loseExpRes = addBattleExpReward(freshUser, 10);
                const crateRes = tryDropBattleCrate(freshOppUser, 0.20);

                await freshUser.save();
                await freshOppUser.save();

                if (crateRes.dropped) {
                  bonusText += `\n🎁 **${opponentMention.username}** သည် Lucky Crate +1 ရရှိပါတယ်! (${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT})`;
                }
                bonusText += formatPvpLevelUp(opponentMention.username, freshOppUser, winExpRes);
                bonusText += formatPvpLevelUp(message.author.username, freshUser, loseExpRes);
                footerResult = `🏆 ${opponentMention.username} အနိုင်ရရှိပါပြီ (${sim.totalTurns} ကျော့) | +${gainedExp} Battle EXP`;
              }

              const leftTitle = `🛡️ ${message.author.username}'s Team`;
              const rightTitle = `🔥 ${opponentMention.username}'s Team`;
              const leftRoster = formatCompactRoster(myUnits, freshMyStats.battleLevel);
              const rightRoster = formatCompactRoster(oppUnits, freshOppStats.battleLevel);

              const [startBuf, finalBuf] = await Promise.all([
                renderBattleCard(myUnits, oppUnits),
                renderBattleCard(finalFrame.teamA, finalFrame.teamB),
              ]);

              const startFile = new AttachmentBuilder(startBuf, { name: 'pvp-start.png' });
              const startEmbed = buildCardEmbed({
                color: '#F39C12',
                authorName: `${message.author.username} VS ${opponentMention.username}`,
                authorIcon: message.author.displayAvatarURL(),
                description: `**${arena}**`,
                leftTitle,
                leftRoster,
                rightTitle,
                rightRoster,
                imageFileName: 'pvp-start.png',
                footerText: '⚔️ PvP တိုက်ပွဲ တိုက်ခိုက်နေပါသည်...',
              });

              await i.update({ content: '', embeds: [startEmbed], components: [], files: [startFile] });

              await sleep(1300);

              const finalFile = new AttachmentBuilder(finalBuf, { name: 'pvp-final.png' });
              const finalEmbed = buildCardEmbed({
                color: p1Won ? '#2ECC71' : '#E74C3C',
                authorName: `${message.author.username} VS ${opponentMention.username}`,
                authorIcon: message.author.displayAvatarURL(),
                description: `**${arena}**${bonusText}`,
                leftTitle,
                leftRoster,
                rightTitle,
                rightRoster,
                imageFileName: 'pvp-final.png',
                footerText: footerResult,
              });

              return challengeMsg.edit({ embeds: [finalEmbed], files: [finalFile], attachments: [] }).catch(() => {});
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

      // ================= SOLO CANVAS BATTLE =================
      const wild = generateWildEnemy(myStats);
      const { arena, enemySquad } = pickArenaAndEnemy();

      const myUnits = buildBattleUnits(myStats.team, myStats.battleLevel, 1.0);
      const enemyUnits = buildBattleUnits(wild.team, wild.wildLevel, wild.difficulty.powerScale);
      const sim = simulateBattle(myUnits, enemyUnits);
      const finalFrame = sim.frames[sim.frames.length - 1];
      const playerWon = sim.winner === 'A';

      // Database ထဲ ချက်ချင်း Save လုပ်ခြင်း (အခြား Command များ ဆက်တိုက်ရိုက်နိုင်ရန်)
      let bonusText = '';
      let finalColor = '#E74C3C';
      let finalFooter = '';

      if (playerWon) {
        const baseExp = Math.floor(Math.random() * 26) + 30;
        const gainedExp = baseExp + wild.difficulty.bonusExp;
        const expRes = addBattleExpReward(user, gainedExp);
        updateQuestProgress(user, 'battleWin', 1);

        const crateRes = tryDropBattleCrate(user, wild.difficulty.crateChance);
        await user.save();

        const bLevel = user.battleLevel || 1;
        finalColor = '#2ECC71';
        finalFooter = `🏆 ${sim.totalTurns} ကျော့မြောက်တွင် အနိုင်ရရှိပါပြီ! | +${gainedExp} Battle EXP (${user.battleExp}/${bLevel * 100})`;

        if (crateRes.dropped) {
          bonusText += `\n🎁 **Lucky Crate +1** သိမ်းပိုက်ရရှိပါတယ်! *(ယနေ့ Limit: ${crateRes.dailyCount}/${DAILY_BATTLE_CRATE_LIMIT})*`;
        }
        if (expRes.levelUpText) {
          bonusText += expRes.levelUpText;
        }
      } else {
        const loseExp = 8 + Math.floor(wild.difficulty.bonusExp / 5);
        const expRes = addBattleExpReward(user, loseExp);
        await user.save();

        const bLevel = user.battleLevel || 1;
        finalFooter = `💀 ${sim.totalTurns} ကျော့မြောက်တွင် ရှုံးနိမ့်သွားပါပြီ | +${loseExp} Battle EXP (${user.battleExp}/${bLevel * 100})`;
        if (expRes.levelUpText) {
          bonusText += expRes.levelUpText;
        }
      }

      const leftTitle = `🛡️ ${message.author.username}'s Team`;
      const rightTitle = `${enemySquad}`;
      const leftRoster = formatCompactRoster(myUnits, myStats.battleLevel);
      const rightRoster = formatCompactRoster(enemyUnits, wild.wildLevel);

      const [startBuf, finalBuf] = await Promise.all([
        renderBattleCard(myUnits, enemyUnits),
        renderBattleCard(finalFrame.teamA, finalFrame.teamB),
      ]);

      const startFile = new AttachmentBuilder(startBuf, { name: 'battle-start.png' });
      const startEmbed = buildCardEmbed({
        color: wild.difficulty.color,
        authorName: `${message.author.username} goes into battle!`,
        authorIcon: message.author.displayAvatarURL(),
        description: `**${arena}** • ${wild.difficulty.label}`,
        leftTitle,
        leftRoster,
        rightTitle,
        rightRoster,
        imageFileName: 'battle-start.png',
        footerText: '⚔️ တိုက်ပွဲ တိုက်ခိုက်နေပါသည်...',
      });

      const msg = await message.reply({ embeds: [startEmbed], files: [startFile] });

      (async () => {
        await sleep(1300);

        const finalFile = new AttachmentBuilder(finalBuf, { name: 'battle-final.png' });
        const finalEmbed = buildCardEmbed({
          color: finalColor,
          authorName: `${message.author.username} goes into battle!`,
          authorIcon: message.author.displayAvatarURL(),
          description: `**${arena}** • ${wild.difficulty.label}${bonusText}`,
          leftTitle,
          leftRoster,
          rightTitle,
          rightRoster,
          imageFileName: 'battle-final.png',
          footerText: finalFooter,
        });

        await msg.edit({ embeds: [finalEmbed], files: [finalFile], attachments: [] }).catch(() => {});
      })().catch((err) => console.error('Battle Canvas Edit Error:', err));
    },
  },
];