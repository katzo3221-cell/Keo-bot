const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../models/User');
const { activeGambling, validateBet } = require('../../utils/gamblingState');
const { isOwner } = require('../../utils/helpers');

// Mines Multiplier တွက်ချက်ခြင်း (3x3 = 9 ကွက် | 4x4 = 16 ကွက်)
function calcMinesMultiplier(revealedCount, bombsCount, totalCells = 16) {
  if (revealedCount <= 0) return 1;
  if (revealedCount > totalCells - bombsCount) return 0;
  let prob = 1;
  for (let i = 0; i < revealedCount; i++) {
    prob *= (totalCells - bombsCount - i) / (totalCells - i);
  }
  return Math.max(1.05, Math.round((0.96 / prob) * 100) / 100);
}

// ဗုံးနေရာများ ကျပန်းချထားခြင်း
function generateBombs(totalCells, bombsCount) {
  const indices = Array.from({ length: totalCells }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, bombsCount));
}

// Owner သီးသန့် ဗုံး (💣) နှင့် စိန် (💎) နေရာပြ ဇယားကွက် ဆွဲပေးခြင်း
function buildOwnerMineMap(gridSize, bombs, opened) {
  const rows = [];
  for (let r = 0; r < gridSize; r++) {
    const cols = [];
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      if (bombs.has(idx)) {
        cols.push('💣');
      } else if (opened.has(idx)) {
        cols.push('✅');
      } else {
        cols.push('💎');
      }
    }
    rows.push(cols.join(' '));
  }
  return rows.join('\n');
}

// ဂိမ်းခလုတ် Row များ တည်ဆောက်ခြင်း (3x3 -> 4 Rows, 4x4 -> 5 Rows)
function buildBoardRows({
  gridSize,
  bombs,
  opened,
  bet,
  currentPayout,
  revealAll = false,
  explodedIdx = -1,
}) {
  const rows = [];

  for (let r = 0; r < gridSize; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      const btn = new ButtonBuilder().setCustomId(`mine_${idx}`);

      if (revealAll) {
        btn.setDisabled(true);
        if (idx === explodedIdx) {
          btn.setEmoji('💥').setStyle(ButtonStyle.Danger);
        } else if (bombs.has(idx)) {
          btn.setEmoji('💣').setStyle(ButtonStyle.Secondary);
        } else if (opened.has(idx)) {
          btn.setEmoji('💎').setStyle(ButtonStyle.Success);
        } else {
          btn.setEmoji('▫️').setStyle(ButtonStyle.Secondary);
        }
      } else if (opened.has(idx)) {
        btn.setEmoji('💎').setStyle(ButtonStyle.Success).setDisabled(true);
      } else {
        btn.setLabel('❓').setStyle(ButtonStyle.Secondary);
      }

      row.addComponents(btn);
    }
    rows.push(row);
  }

  // အောက်ဆုံး Control Row: Cash Out + ℹ️ ကစားနည်း (Owner နှိပ်လျှင် ဗုံးနေရာပြမည်)
  const cashOutLabel =
    opened.size > 0
      ? `💰 Cash Out (${currentPayout.toLocaleString()} coins)`
      : `💰 Cash Out (${bet.toLocaleString()} coins)`;

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mine_cashout')
      .setLabel(cashOutLabel)
      .setStyle(ButtonStyle.Success)
      .setDisabled(revealAll || opened.size === 0),
    new ButtonBuilder()
      .setCustomId('mine_info')
      .setLabel('ℹ️ ကစားနည်း')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(revealAll)
  );

  rows.push(controlRow);
  return rows;
}

// 3x3 (Kmine) နှင့် 4x4 (Kmines) နှစ်မျိုးလုံးအတွက် ဘုံ Engine
async function runMinesGame(message, args, user, { gridSize, defaultBombs, cmdExample }) {
  if (activeGambling.has(message.author.id)) {
    return message.reply('🎲 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် စောင့်ပါ။');
  }

  const totalCells = gridSize * gridSize;
  const maxBombs = totalCells - 1;

  const { bet, error } = validateBet(args[0], user.balance, `ဥပမာ - \`${cmdExample}\``);
  if (error) return message.reply(error);

  let bombsCount = defaultBombs;
  if (args[1] !== undefined) {
    const parsed = parseInt(args[1], 10);
    if (isNaN(parsed) || parsed < 1 || parsed > maxBombs) {
      return message.reply(
        `❌ ${gridSize}x${gridSize} Mines တွင် ဗုံးအရေအတွက်ကို **1 မှ ${maxBombs}** အတွင်းသာ သတ်မှတ်နိုင်ပါသည်။ (ဥပမာ - \`${cmdExample}\`)`
      );
    }
    bombsCount = parsed;
  }

  const safeTotal = totalCells - bombsCount;
  const bombs = generateBombs(totalCells, bombsCount);
  const opened = new Set();

  activeGambling.add(message.author.id);

  // လောင်းကြေး ကြိုနုတ်သိမ်းခြင်း
  user.balance -= bet;
  await user.save();

  const buildEmbed = (statusColor, footerNote, customDesc = null) => {
    const mult = calcMinesMultiplier(opened.size, bombsCount, totalCells);
    const nextMult =
      opened.size < safeTotal
        ? calcMinesMultiplier(opened.size + 1, bombsCount, totalCells)
        : mult;
    const payout = Math.floor(bet * mult);

    const desc =
      customDesc ||
      `💰 လောင်းကြေး: **${bet.toLocaleString()} coins** • 💣 ဗုံး: **${bombsCount} လုံး**\n` +
      `💎 ဖွင့်ပြီး: **${opened.size}/${safeTotal}** • 📈 လက်ရှိဆ: **${mult.toFixed(2)}x** *(နောက်တစ်ကွက်: ${nextMult.toFixed(2)}x)*\n` +
      `💵 လက်ရှိထုတ်ယူနိုင်ငွေ: **${payout.toLocaleString()} coins**`;

    return new EmbedBuilder()
      .setColor(statusColor)
      .setTitle(`💣 Mines (${gridSize}x${gridSize}) — ${message.author.username}`)
      .setDescription(desc)
      .setFooter({ text: footerNote });
  };

  let gameMsg;
  try {
    gameMsg = await message.reply({
      embeds: [buildEmbed('#3498DB', 'ဗုံးမထိအောင် စိန်များကို ရွေးဖွင့်ပါ • ၆၀ စက္ကန့်အတွင်း မနှိပ်ပါက အလိုအလျောက်ပိတ်မည်')],
      components: buildBoardRows({
        gridSize,
        bombs,
        opened,
        bet,
        currentPayout: bet,
      }),
    });
  } catch (err) {
    const refundUser = await getUser(message.author.id, message.author.username);
    refundUser.balance += bet;
    await refundUser.save();
    activeGambling.delete(message.author.id);
    throw err;
  }

  const collector = gameMsg.createMessageComponentCollector({ idle: 60000 });
  let isProcessing = false;
  let gameEnded = false;

  collector.on('collect', async (i) => {
    try {
      // ℹ️ ကစားနည်း ခလုတ် — Owner နှိပ်လျှင် ဗုံးနေရာပြမည်၊ သာမန်ကစားသမားနှိပ်လျှင် ကစားနည်းပြမည်
      if (i.customId === 'mine_info') {
        if (isOwner(i.user.id)) {
          const mapText = buildOwnerMineMap(gridSize, bombs, opened);
          return i.reply({
            content:
              `👁️ **Mines Map (${gridSize}x${gridSize} • 💣 ${bombsCount})**\n` +
              `${mapText}\n\n` +
              `*(💣 ဗုံး • 💎 စိန် • ✅ ဖွင့်ပြီး)*`,
            ephemeral: true,
          });
        }

        return i.reply({
          content:
            `ℹ️ **Mines (${gridSize}x${gridSize}) ကစားနည်း**\n` +
            `• ဗုံး (💣) မထိအောင် ❓ အကွက်များကို ရွေးဖွင့်ပြီး စိန် (💎) ရှာပါ။\n` +
            `• စိန်များများဖွင့်နိုင်လေ ဆတိုး (Multiplier) ပိုမြင့်လေဖြစ်ပြီး စိန်အနည်းဆုံး ၁ ကွက်ဖွင့်ပြီးတာနဲ့ ကြိုက်တဲ့အချိန် **Cash Out** နှိပ်၍ ငွေထုတ်နိုင်ပါသည်။\n` +
            `• ဗုံးထိသွားပါက လောင်းကြေး ဆုံးရှုံးပါမည်။`,
          ephemeral: true,
        });
      }

      if (i.user.id !== message.author.id) {
        return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Mines ပွဲ မဟုတ်ပါဘူး!', ephemeral: true });
      }

      if (gameEnded || isProcessing) {
        return i.deferUpdate().catch(() => {});
      }

      isProcessing = true;

      // ၁။ Cash Out နှိပ်ခြင်း
      if (i.customId === 'mine_cashout') {
        if (opened.size === 0) {
          isProcessing = false;
          return i.reply({ content: '❌ Cash Out လုပ်ရန် အနည်းဆုံး စိန် ၁ ကွက် အရင်ဖွင့်ရပါမည်။', ephemeral: true });
        }

        gameEnded = true;
        collector.stop('cashout');
        await i.deferUpdate();

        const mult = calcMinesMultiplier(opened.size, bombsCount, totalCells);
        const payout = Math.floor(bet * mult);
        const profit = payout - bet;

        const freshUser = await getUser(message.author.id, message.author.username);
        freshUser.balance += payout;
        await freshUser.save();

        const winDesc =
          `🎉 **Cash Out အောင်မြင်ပါတယ်!**\n` +
          `💎 ဖွင့်နိုင်ခဲ့သော စိန်: **${opened.size}/${safeTotal}** (📈 **${mult.toFixed(2)}x**)\n` +
          `💰 ပြန်ရငွေ: **${payout.toLocaleString()} coins** *(အမြတ်: +${profit.toLocaleString()} coins)*\n` +
          `💳 လက်ကျန်ငွေ: **${freshUser.balance.toLocaleString()} coins**`;

        await i.editReply({
          embeds: [buildEmbed('#2ECC71', 'Cash Out ဖြင့် ပွဲပြီးဆုံးပါပြီ', winDesc)],
          components: buildBoardRows({
            gridSize,
            bombs,
            opened,
            bet,
            currentPayout: payout,
            revealAll: true,
          }),
        }).catch(() => {});

        activeGambling.delete(message.author.id);
        return;
      }

      // ၂။ အကွက်တစ်ကွက် ရွေးဖွင့်ခြင်း
      if (i.customId.startsWith('mine_')) {
        const idx = parseInt(i.customId.replace('mine_', ''), 10);
        if (isNaN(idx) || idx < 0 || idx >= totalCells || opened.has(idx)) {
          isProcessing = false;
          return i.deferUpdate().catch(() => {});
        }

        // ဗုံးထိသွားခြင်း
        if (bombs.has(idx)) {
          gameEnded = true;
          collector.stop('bomb');
          await i.deferUpdate();

          const freshUser = await getUser(message.author.id, message.author.username);
          const loseDesc =
            `💥 **ဘုန်း!! ဗုံးထိသွားပါပြီ!**\n` +
            `💸 ဆုံးရှုံးငွေ: **-${bet.toLocaleString()} coins** *(ဗုံး: ${bombsCount} လုံး)*\n` +
            `💳 လက်ကျန်ငွေ: **${freshUser.balance.toLocaleString()} coins**`;

          await i.editReply({
            embeds: [buildEmbed('#E74C3C', 'ဗုံးထိသွားသဖြင့် ရှုံးနိမ့်ပါပြီ', loseDesc)],
            components: buildBoardRows({
              gridSize,
              bombs,
              opened,
              bet,
              currentPayout: 0,
              revealAll: true,
              explodedIdx: idx,
            }),
          }).catch(() => {});

          activeGambling.delete(message.author.id);
          return;
        }

        // စိန်တွေ့ခြင်း
        opened.add(idx);
        const mult = calcMinesMultiplier(opened.size, bombsCount, totalCells);
        const payout = Math.floor(bet * mult);

        // စိန်အားလုံး ဖွင့်နိုင်သွားပါက Auto Cash Out
        if (opened.size >= safeTotal) {
          gameEnded = true;
          collector.stop('cleared');
          await i.deferUpdate();

          const profit = payout - bet;
          const freshUser = await getUser(message.author.id, message.author.username);
          freshUser.balance += payout;
          await freshUser.save();

          const clearDesc =
            `🏆 **JACKPOT!! စိန်အားလုံး ဖွင့်နိုင်သွားပါပြီ!**\n` +
            `💎 ဖွင့်နိုင်ခဲ့သော စိန်: **${opened.size}/${safeTotal}** (📈 **${mult.toFixed(2)}x**)\n` +
            `💰 စုစုပေါင်းရငွေ: **${payout.toLocaleString()} coins** *(အမြတ်: +${profit.toLocaleString()} coins)*\n` +
            `💳 လက်ကျန်ငွေ: **${freshUser.balance.toLocaleString()} coins**`;

          await i.editReply({
            embeds: [buildEmbed('#F1C40F', 'စိန်အားလုံး ရှာတွေ့ပြီး အနိုင်ရရှိပါပြီ!', clearDesc)],
            components: buildBoardRows({
              gridSize,
              bombs,
              opened,
              bet,
              currentPayout: payout,
              revealAll: true,
            }),
          }).catch(() => {});

          activeGambling.delete(message.author.id);
          return;
        }

        // ပွဲဆက်ကစားရန် Board ကို Update လုပ်ခြင်း
        await i.update({
          embeds: [buildEmbed('#3498DB', 'ဆက်ဖွင့်မလား၊ Cash Out လုပ်မလား ရွေးချယ်ပါ')],
          components: buildBoardRows({
            gridSize,
            bombs,
            opened,
            bet,
            currentPayout: payout,
          }),
        });
      }
    } catch (err) {
      console.error('Mines Collect Error:', err);
    } finally {
      isProcessing = false;
    }
  });

  collector.on('end', async () => {
    if (gameEnded) return;
    gameEnded = true;

    try {
      const freshUser = await getUser(message.author.id, message.author.username);

      if (opened.size > 0) {
        const mult = calcMinesMultiplier(opened.size, bombsCount, totalCells);
        const payout = Math.floor(bet * mult);
        freshUser.balance += payout;
        await freshUser.save();

        const timeoutDesc =
          `⏳ **အချိန်စေ့သွားသဖြင့် အလိုအလျောက် Cash Out လုပ်ပေးလိုက်ပါပြီ!**\n` +
          `💎 ဖွင့်ပြီးစိန်: **${opened.size}/${safeTotal}** (📈 **${mult.toFixed(2)}x**)\n` +
          `💰 ပြန်ရငွေ: **${payout.toLocaleString()} coins** (လက်ကျန်: **${freshUser.balance.toLocaleString()} coins**)`;

        await gameMsg.edit({
          embeds: [buildEmbed('#95A5A6', 'အချိန်စေ့ Auto Cash Out', timeoutDesc)],
          components: buildBoardRows({
            gridSize,
            bombs,
            opened,
            bet,
            currentPayout: payout,
            revealAll: true,
          }),
        }).catch(() => {});
      } else {
        freshUser.balance += bet;
        await freshUser.save();

        const refundDesc =
          `⏳ **အချိန်စေ့သွားသဖြင့် ပွဲပိတ်လိုက်ပါပြီ**\n` +
          `💰 တစ်ကွက်မှ မဖွင့်ရသေးသဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** ပြန်အမ်းပေးလိုက်ပါပြီ။`;

        await gameMsg.edit({
          embeds: [buildEmbed('#95A5A6', 'အချိန်စေ့၍ ပွဲပယ်ဖျက်ပြီး', refundDesc)],
          components: buildBoardRows({
            gridSize,
            bombs,
            opened,
            bet,
            currentPayout: 0,
            revealAll: true,
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Mines End Error:', err);
    } finally {
      activeGambling.delete(message.author.id);
    }
  });
}

module.exports = [
  // ၁။ 3x3 Mines (Kmine <amount> [bombs: 1-8])
  {
    names: ['mine'],
    async execute(message, args, user) {
      return runMinesGame(message, args, user, {
        gridSize: 3,
        defaultBombs: 2,
        cmdExample: 'Kmine 1000 2',
      });
    },
  },

  // ၂။ 4x4 Mines (Kmines <amount> [bombs: 1-15])
  {
    names: ['mines'],
    async execute(message, args, user) {
      return runMinesGame(message, args, user, {
        gridSize: 4,
        defaultBombs: 3,
        cmdExample: 'Kmines 1000 3',
      });
    },
  },
];