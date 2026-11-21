const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, addBattleExp, updateQuestProgress } = require('../models/User');
const { findAnimal } = require('../utils/helpers');
const ANIMALS = require('../data/animals');

// Rank ၁၀ ဆင့်အလိုက် သီးသန့် Battle Power (အရောင်းဈေးနှုန်းနှင့် ခွဲထုတ်ထားသည်)
const RANK_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Super Rare',
  'Epic',
  'Ultra Epic',
  'Legendary',
  'Mythical',
  'Divine',
  'Celestial',
];

const RANK_POWER = {
  Common: 50,
  Uncommon: 120,
  Rare: 250,
  'Super Rare': 500,
  Epic: 900,
  'Ultra Epic': 1600,
  Legendary: 2800,
  Mythical: 4500,
  Divine: 7500,
  Celestial: 12000,
};

// တိရစ္ဆာန်၏ Rank နှင့် Battle Power ခွဲထုတ်ခြင်း
function getAnimalRank(animal) {
  const match = animal.name.match(/\(([^)]+)\)$/);
  return match && RANK_POWER[match[1]] ? match[1] : 'Common';
}

function getAnimalRankIndex(animal) {
  const idx = RANK_ORDER.indexOf(getAnimalRank(animal));
  return idx >= 0 ? idx : 0;
}

function getAnimalPower(animal) {
  return RANK_POWER[getAnimalRank(animal)] || 50;
}

// Rank တစ်ခုချင်းစီအလိုက် တိရစ္ဆာန်အုပ်စုများ ကြိုတင်ခွဲထားခြင်း
const ANIMALS_BY_RANK = RANK_ORDER.map((rankName) =>
  ANIMALS.filter((a) => getAnimalRank(a) === rankName)
);

// တိရစ္ဆာန်ရုံထဲတွင် အကောင်ရှိမရှိ စစ်ဆေးခြင်း
function hasAnyAnimal(userObj) {
  return Object.values(userObj.zoo || {}).some((count) => count > 0);
}

// Battle Level နှင့် သုံးထားသော အကောင်များ၏ Rank ပေါ်မူတည်၍ Solo အခက်အခဲ သတ်မှတ်ခြင်း
function getSoloDifficulty(battleLevel, avgRankIdx) {
  const score = Math.min(100, Math.floor((battleLevel - 1) * 2.2 + avgRankIdx * 5));

  if (score < 20) {
    return {
      label: '🟢 Easy (အလွယ်)',
      color: '#2ECC71',
      levelOffset: -1,
      powerScale: 0.85,
      rankChances: { lower: 0.50, same: 0.45 }, // higher: 5%
      bonusExp: 0,
      crateChance: 0.15,
    };
  }
  if (score < 40) {
    return {
      label: '🔵 Normal (ပုံမှန်)',
      color: '#3498DB',
      levelOffset: 0,
      powerScale: 0.90,
      rankChances: { lower: 0.35, same: 0.55 }, // higher: 10%
      bonusExp: 10,
      crateChance: 0.15,
    };
  }
  if (score < 60) {
    return {
      label: '🟠 Hard (ခက်ခဲ)',
      color: '#E67E22',
      levelOffset: 0,
      powerScale: 0.95,
      rankChances: { lower: 0.25, same: 0.55 }, // higher: 20%
      bonusExp: 20,
      crateChance: 0.18,
    };
  }
  if (score < 80) {
    return {
      label: '🔴 Extreme (အလွန်ခက်)',
      color: '#E74C3C',
      levelOffset: 1,
      powerScale: 0.98,
      rankChances: { lower: 0.20, same: 0.55 }, // higher: 25%
      bonusExp: 35,
      crateChance: 0.20,
    };
  }
  return {
    label: '💀 Nightmare (ငရဲအဆင့်)',
    color: '#8E44AD',
    levelOffset: 2,
    powerScale: 1.00,
    rankChances: { lower: 0.15, same: 0.55 }, // higher: 30%
    bonusExp: 50,
    crateChance: 0.22,
  };
}

// ±8% Random Power Swing တွက်ချက်ခြင်း
function applyBattleSwing(staticPower) {
  const swing = 0.92 + Math.random() * 0.16;
  return Math.max(1, Math.round(staticPower * swing));
}

// ကစားသမား ကိုယ်တိုင်ရွေးထားသော Battle Team နှင့် Level Power တွက်ချက်ခြင်း
function getBattleStats(userObj) {
  const team = [];

  if (userObj.battleTeam && userObj.battleTeam.length > 0) {
    const usedCounts = {};
    for (const id of userObj.battleTeam) {
      const info = ANIMALS.find((a) => a.id === id);
      if (!info) continue;
      const owned = (userObj.zoo && userObj.zoo[info.name]) || 0;
      const used = usedCounts[info.name] || 0;
      if (owned > used) {
        team.push(info);
        usedCounts[info.name] = used + 1;
      }
    }
  }

  const bLevel = userObj.battleLevel || 1;
  const basePower = team.reduce((sum, a) => sum + getAnimalPower(a), 0);
  const avgRankIdx = team.length > 0
    ? team.reduce((sum, a) => sum + getAnimalRankIndex(a), 0) / team.length
    : 0;

  // Battle Level 1 ဆင့်တက်တိုင်း Base Power +3% နှင့် အခြေခံ +15 Power တိုးပေးမည်
  const levelPercent = (bLevel - 1) * 3;
  const levelBonus = Math.floor(basePower * (levelPercent / 100)) + (bLevel * 15);
  const staticPower = basePower + levelBonus;
  const totalPower = applyBattleSwing(staticPower);

  return {
    team,
    basePower,
    levelBonus,
    levelPercent,
    staticPower,
    totalPower,
    battleLevel: bLevel,
    avgRankIdx,
  };
}

// ကစားသမား၏ Level နှင့် အကောင် Rank များအပေါ်မူတည်၍ Wild Enemy အဖွဲ့ ဖန်တီးခြင်း
function generateWildEnemy(myStats) {
  const difficulty = getSoloDifficulty(myStats.battleLevel, myStats.avgRankIdx);
  const wildLevel = Math.max(1, myStats.battleLevel + difficulty.levelOffset);

  const enemyTeam = myStats.team.map((playerAnimal) => {
    const pRankIdx = getAnimalRankIndex(playerAnimal);
    const roll = Math.random();

    let eRankIdx = pRankIdx;
    if (roll < difficulty.rankChances.lower) {
      eRankIdx = Math.max(0, pRankIdx - 1);
    } else if (roll >= difficulty.rankChances.lower + difficulty.rankChances.same) {
      eRankIdx = Math.min(RANK_ORDER.length - 1, pRankIdx + 1);
    }

    const pool = ANIMALS_BY_RANK[eRankIdx]?.length ? ANIMALS_BY_RANK[eRankIdx] : ANIMALS;
    return pool[Math.floor(Math.random() * pool.length)];
  });

  const basePower = enemyTeam.reduce((sum, a) => sum + getAnimalPower(a), 0);
  const levelPercent = (wildLevel - 1) * 3;
  const levelBonus = Math.floor(basePower * (levelPercent / 100)) + (wildLevel * 15);
  const staticPower = Math.round((basePower + levelBonus) * difficulty.powerScale);
  const totalPower = applyBattleSwing(staticPower);

  return {
    team: enemyTeam,
    wildLevel,
    difficulty,
    basePower,
    staticPower,
    totalPower,
  };
}

// Kteam / Kb select လုပ်ဆောင်ချက်
async function handleTeamCommand(message, args, user) {
  const sub = args[0]?.toLowerCase();

  if (sub === 'clear' || sub === 'reset') {
    user.battleTeam = [];
    await user.save();
    return message.reply('✅ တိုက်ပွဲအဖွဲ့ (Battle Team) ကို ဖျက်သိမ်းလိုက်ပါပြီ! နောက်ထပ် `Kbattle` ဝင်လိုပါက `Kteam <id1> [id2] [id3]` ဖြင့် အကောင်အသစ် ပြန်ရွေးချယ်ပါ။');
  }

  const picks = sub === 'set' ? args.slice(1) : args;
  if (picks.length > 0) {
    if (picks.length > 3) {
      return message.reply('❌ တိုက်ပွဲအဖွဲ့တွင် အများဆုံး **၃ ကောင်** အထိသာ ရွေးချယ်နိုင်ပါတယ်!');
    }

    const chosenAnimals = [];
    const neededCounts = {};

    for (const rawId of picks) {
      const animal = findAnimal(rawId);
      if (!animal) {
        return message.reply(`❌ \`${rawId}\` ဆိုတဲ့ တိရစ္ဆာန် ID မတွေ့ပါဘူး! အမဲလိုက်ထားတဲ့ ID သို့မဟုတ် မြန်မာနာမည် မှန်ကန်စွာ ထည့်ပါ။`);
      }
      neededCounts[animal.name] = (neededCounts[animal.name] || 0) + 1;
      const owned = (user.zoo && user.zoo[animal.name]) || 0;
      if (owned < neededCounts[animal.name]) {
        return message.reply(`❌ သင့်တိရစ္ဆာန်ရုံထဲမှာ ${animal.emoji} **${animal.name}** (\`${animal.id}\`) လုံလောက်အောင် မရှိပါဘူး! (ပိုင်ဆိုင်မှု: **${owned} ကောင်**)`);
      }
      chosenAnimals.push(animal);
    }

    user.battleTeam = chosenAnimals.map((a) => a.id);
    await user.save();

    const teamList = chosenAnimals
      .map((a, idx) => `${idx + 1}. ${a.emoji} **${a.name}** (\`${a.id}\`) — Battle Power: \`${getAnimalPower(a).toLocaleString()}\``)
      .join('\n');

    return message.reply(
      `⚔️ **တိုက်ပွဲဝင်မည့် အဖွဲ့ (Battle Team) ကို ရွေးချယ်သတ်မှတ်ပြီးပါပြီ!**\n${teamList}\n*(တိုက်ခိုက်ရန် \`Kbattle\` ကို ရိုက်ပါ)*`
    );
  }

  const stats = getBattleStats(user);
  if (stats.team.length === 0) {
    if (!hasAnyAnimal(user)) {
      return message.reply('❌ တိုက်ပွဲဝင်ဖို့ တိရစ္ဆာန် တစ်ကောင်မှ မရှိသေးပါဘူး! `Khunt` ရိုက်ပြီး အရင်ဖမ်းပါ။');
    }
    return message.reply(
      '❌ တိုက်ပွဲဝင်မယ့် အဖွဲ့ (Battle Team) မရွေးချယ်ရသေးပါဘူး!\n' +
      '`Kteam <id1> [id2] [id3]` ရိုက်ပြီး အများဆုံး **၃ ကောင်** ကိုယ်တိုင်ရွေးချယ်ပါ။ (ဥပမာ - `Kteam lion tiger wolf`)'
    );
  }

  const soloDiff = getSoloDifficulty(stats.battleLevel, stats.avgRankIdx);
  const currentList = stats.team
    .map((a, idx) => `${idx + 1}. ${a.emoji} **${a.name}** (\`${a.id}\`) — Power: \`${getAnimalPower(a).toLocaleString()}\``)
    .join('\n');

  const teamEmbed = new EmbedBuilder()
    .setColor('#E67E22')
    .setAuthor({ name: `${message.author.username} ၏ Battle Team (Battle Lv.${stats.battleLevel})`, iconURL: message.author.displayAvatarURL() })
    .setDescription(`**ပုံစံ:** 🎯 ကိုယ်တိုင်ရွေးထားသော အဖွဲ့\n\n${currentList}`)
    .addFields(
      { name: '💥 Base Power', value: `**${stats.basePower.toLocaleString()}**`, inline: true },
      { name: `🔥 Level Bonus (+${stats.levelPercent}%)`, value: `**+${stats.levelBonus.toLocaleString()}**`, inline: true },
      { name: '⚔️ စုစုပေါင်း Power', value: `**~${stats.staticPower.toLocaleString()}** *(±8%)*`, inline: true },
      { name: '🔥 လက်ရှိ Solo အခက်အခဲ', value: `${soloDiff.label} *(Battle Lv.${stats.battleLevel} + အကောင် Rank)*`, inline: false }
    )
    .setFooter({ text: 'ပြောင်းရွေးရန်: Kteam <id1> [id2] [id3] | ပြန်ဖျက်ရန်: Kteam clear' });

  return message.reply({ embeds: [teamEmbed] });
}

module.exports = [
  // ၁။ တိုက်ပွဲဝင် အကောင်ရွေးချယ်ခြင်း (Kteam / Kselect)
  {
    names: ['team', 'select'],
    async execute(message, args, user) {
      return handleTeamCommand(message, args, user);
    },
  },

  // ၂။ တိရစ္ဆာန် တိုက်ခိုက်ရေး စနစ် - Dynamic Solo & PvP (Battle Level သီးသန့်တက်သည်)
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

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const myTeamText = myStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
      const opponentMention = message.mentions.users.first();

      // PvP Battle
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
          new ButtonBuilder()
            .setCustomId('pvp_accept')
            .setLabel('⚔️ Accept (လက်ခံမည်)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('pvp_reject')
            .setLabel('🏳️ Reject (ငြင်းပယ်မည်)')
            .setStyle(ButtonStyle.Danger)
        );

        const challengeMsg = await message.reply({
          content: `<@${opponentMention.id}>`,
          embeds: [challengeEmbed],
          components: [row],
        });

        const collector = challengeMsg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
          if (i.user.id !== opponentMention.id) {
            return i.reply({ content: '❌ ဒီစိန်ခေါ်မှုက သင့်ကို ခေါ်ထားတာ မဟုတ်ပါဘူး!', ephemeral: true });
          }

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
              const isBattleLevelUp = addBattleExp(freshUser, gainedExp);
              updateQuestProgress(freshUser, 'battleWin', 1);
              addBattleExp(freshOppUser, 10);

              let crateDropText = '';
              if (Math.random() < 0.20) {
                freshUser.boxes = (freshUser.boxes || 0) + 1;
                crateDropText = '\n🎁 PvP အောင်ပွဲဆု **Lucky Crate +1** ရရှိပါတယ်!';
              }

              await freshUser.save();
              await freshOppUser.save();

              let resultText = `🏆 **${message.author.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${freshMyStats.totalPower.toLocaleString()}\` vs \`${freshOppStats.totalPower.toLocaleString()}\`)\n⚔️ **+${gainedExp} Battle EXP** ရရှိပါတယ်!${crateDropText}`;
              if (isBattleLevelUp) {
                resultText += `\n🔥 **BATTLE LEVEL UP!** **${message.author.username}** သည် **Battle Level ${freshUser.battleLevel}** သို့ ရောက်ရှိသွားပါပြီ!`;
              }

              fightingEmbed.setColor('#2ECC71').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
            } else {
              const gainedExp = Math.floor(Math.random() * 31) + 45;
              const oppBattleLevelUp = addBattleExp(freshOppUser, gainedExp);
              updateQuestProgress(freshOppUser, 'battleWin', 1);
              addBattleExp(freshUser, 10);

              let crateDropText = '';
              if (Math.random() < 0.20) {
                freshOppUser.boxes = (freshOppUser.boxes || 0) + 1;
                crateDropText = `\n🎁 **${opponentMention.username}** သည် PvP အောင်ပွဲဆု **Lucky Crate +1** ရရှိပါတယ်!`;
              }

              await freshUser.save();
              await freshOppUser.save();

              let resultText = `🏆 **${opponentMention.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${freshOppStats.totalPower.toLocaleString()}\` vs \`${freshMyStats.totalPower.toLocaleString()}\`)\n⚔️ **${opponentMention.username}** က **+${gainedExp} Battle EXP** ရရှိပြီး **${message.author.username}** သည် **+10 Battle EXP** ရရှိပါတယ်။${crateDropText}`;
              if (oppBattleLevelUp) {
                resultText += `\n🔥 **BATTLE LEVEL UP!** **${opponentMention.username}** သည် **Battle Level ${freshOppUser.battleLevel}** သို့ ရောက်ရှိသွားပါပြီ!`;
              }

              fightingEmbed.setColor('#E74C3C').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
            }

            return challengeMsg.edit({ embeds: [fightingEmbed] });
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

      // Dynamic Solo Wild Battle (Level + Team Rank ပေါ်မူတည်၍ အခက်အခဲ ပြောင်းလဲသည်)
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
        const isBattleLevelUp = addBattleExp(user, gainedExp);
        updateQuestProgress(user, 'battleWin', 1);

        let crateDropText = '';
        if (Math.random() < wild.difficulty.crateChance) {
          user.boxes = (user.boxes || 0) + 1;
          crateDropText = '\n🎁 ရန်သူ့စခန်းမှ **Lucky Crate +1** သိမ်းပိုက်ရရှိပါတယ်!';
        }

        await user.save();

        const bLevel = user.battleLevel || 1;
        let winText =
          `**အခက်အခဲ:** ${wild.difficulty.label}\n\n` +
          `🎉 **အနိုင်ရရှိပါတယ်!** (Power: \`${myStats.totalPower.toLocaleString()}\` vs \`${wild.totalPower.toLocaleString()}\`)\n` +
          `⚔️ **+${gainedExp} Battle EXP** ရရှိပါတယ်! (${user.battleExp}/${bLevel * 100} EXP)${crateDropText}`;
        if (isBattleLevelUp) {
          winText += `\n🔥 **BATTLE LEVEL UP!** သင်သည် **Battle Level ${bLevel}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }

        battleEmbed.setColor('#2ECC71').setDescription(winText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      } else {
        const loseExp = 8 + Math.floor(wild.difficulty.bonusExp / 5);
        const isBattleLevelUp = addBattleExp(user, loseExp);
        await user.save();

        const bLevel = user.battleLevel || 1;
        let loseText =
          `**အခက်အခဲ:** ${wild.difficulty.label}\n\n` +
          `💀 **ရှုံးနိမ့်သွားပါတယ်!** (Power: \`${myStats.totalPower.toLocaleString()}\` vs \`${wild.totalPower.toLocaleString()}\`)\n` +
          `📖 **+${loseExp} Battle EXP** ရရှိပါတယ်။ (${user.battleExp}/${bLevel * 100} EXP)`;
        if (isBattleLevelUp) {
          loseText += `\n🔥 **BATTLE LEVEL UP!** သင်သည် **Battle Level ${bLevel}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }

        battleEmbed.setColor('#E74C3C').setDescription(loseText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      }

      return msg.edit({ embeds: [battleEmbed] });
    },
  },
];