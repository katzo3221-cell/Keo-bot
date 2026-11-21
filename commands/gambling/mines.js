const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../models/User');
const { activeGambling, validateBet } = require('../../utils/gamblingState');

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

module.exports = [
  // ဗုံးရှောင်ဂိမ်း (Kmines = 4x4 Default 4 | Kmine = 3x3 Default 3)
  {
    names: ['mines', 'mine'],
    async execute(message, args, user, commandName) {
      if (activeGambling.has(message.author.id)) {
        return message.reply('💣 သင်သည် လောင်းကစားပွဲတစ်ခု ကစားနေဆဲ ဖြစ်ပါတယ်! အရင်ပွဲ ပြီးအောင် ဆော့ပါ။');
      }

      const isSmallGrid = commandName === 'mine';
      const gridSize = isSmallGrid ? 3 : 4;
      const totalCells = gridSize * gridSize;
      const defaultBombs = isSmallGrid ? 3 : 4;
      const maxBombs = isSmallGrid ? 6 : 11;
      const cmdLabel = isSmallGrid ? 'Kmine' : 'Kmines';

      const { bet, error } = validateBet(
        args[0],
        user.balance,
        `ဥပမာ - \`${cmdLabel} 1000\` သို့မဟုတ် \`${cmdLabel} 1000 ${defaultBombs}\``
      );
      if (error) return message.reply(error);

      let bombsCount = defaultBombs;
      if (args[1] !== undefined) {
        const parsedBombs = parseInt(args[1], 10);
        if (isNaN(parsedBombs) || parsedBombs < 1 || parsedBombs > maxBombs) {
          return message.reply(
            `❌ **${gridSize}×${gridSize}** အတွက် ဗုံးအရေအတွက်ကို **၁ လုံးမှ ${maxBombs} လုံး** အတွင်းသာ ထည့်ပေးပါ! (ဥပမာ - \`${cmdLabel} 1000 ${defaultBombs}\`)`
          );
        }
        bombsCount = parsedBombs;
      }

      activeGambling.add(message.author.id);

      try {
        user.balance -= bet;
        await user.save();

        const bombIndices = new Set();
        while (bombIndices.size < bombsCount) {
          bombIndices.add(Math.floor(Math.random() * totalCells));
        }

        const revealed = new Set();
        const safeTotal = totalCells - bombsCount;

        const buildBoardRows = (gameOver = false, explodedIdx = -1) => {
          const rows = [];
          for (let r = 0; r < gridSize; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < gridSize; c++) {
              const idx = r * gridSize + c;
              const isBomb = bombIndices.has(idx);
              const isOpen = revealed.has(idx);

              let emoji = '⬜';
              let style = ButtonStyle.Secondary;

              if (gameOver) {
                if (idx === explodedIdx) {
                  emoji = '💥';
                  style = ButtonStyle.Danger;
                } else if (isBomb) {
                  emoji = '💣';
                  style = ButtonStyle.Danger;
                } else if (isOpen) {
                  emoji = '💎';
                  style = ButtonStyle.Success;
                } else {
                  emoji = '🔹';
                  style = ButtonStyle.Secondary;
                }
              } else if (isOpen) {
                emoji = '💎';
                style = ButtonStyle.Success;
              }

              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`mine_${idx}`)
                  .setEmoji(emoji)
                  .setStyle(style)
                  .setDisabled(gameOver || isOpen)
              );
            }
            rows.push(row);
          }

          const mult = calcMinesMultiplier(revealed.size, bombsCount, totalCells);
          const cashoutAmount = Math.floor(bet * mult);

          const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('mine_cashout')
              .setLabel(
                revealed.size > 0
                  ? `💰 ငွေသိမ်းမည် (${cashoutAmount.toLocaleString()} coins • ${mult}x)`
                  : '💰 ငွေသိမ်းမည် (အနည်းဆုံး ၁ ကွက်ဖွင့်ပါ)'
              )
              .setStyle(ButtonStyle.Primary)
              .setDisabled(gameOver || revealed.size === 0)
          );
          rows.push(controlRow);
          return rows;
        };

        const buildEmbed = (statusText, color = '#3498DB') => {
          const mult = calcMinesMultiplier(revealed.size, bombsCount, totalCells);
          const nextMult = calcMinesMultiplier(revealed.size + 1, bombsCount, totalCells);
          const nextText = nextMult > 0 ? ` *(နောက် ၁ ကွက်: ${nextMult}x)*` : ' *(MAX)*';

          return new EmbedBuilder()
            .setColor(color)
            .setTitle(`💎 ${message.author.username} ၏ Mines ${gridSize}×${gridSize} (💣 ဗုံး ${bombsCount} လုံး)`)
            .setDescription(statusText)
            .addFields(
              { name: '💰 လောင်းကြေး', value: `**${bet.toLocaleString()} coins**`, inline: true },
              { name: '💎 ဖွင့်ပြီး', value: `**${revealed.size} / ${safeTotal}**`, inline: true },
              { name: '📈 လက်ရှိအဆ', value: `**${mult}x**${nextText}`, inline: true }
            );
        };

        const gameMsg = await message.reply({
          embeds: [buildEmbed('ဗုံး 💣 မထိအောင် စိန်တုံး 💎 များကို ဖွင့်ပါ! ကြိုက်တဲ့အချိန် **ငွေသိမ်းမည်** နှိပ်နိုင်ပါတယ်။')],
          components: buildBoardRows(false),
        });

        const collector = gameMsg.createMessageComponentCollector({ time: 60000 });
        let ended = false;

        collector.on('collect', async (i) => {
          try {
            if (i.user.id !== message.author.id) {
              return i.reply({ content: '❌ ဒါက သင့်ရဲ့ Mines ပွဲမဟုတ်ပါဘူး!', ephemeral: true });
            }
            if (ended) return;

            if (i.customId === 'mine_cashout') {
              ended = true;
              collector.stop('cashout');
              const mult = calcMinesMultiplier(revealed.size, bombsCount, totalCells);
              const payout = Math.floor(bet * mult);
              const profit = payout - bet;

              const freshUser = await getUser(message.author.id, message.author.username);
              freshUser.balance += payout;
              await freshUser.save();

              return i.update({
                embeds: [buildEmbed(
                  `🎉 **ငွေသိမ်းလိုက်ပါပြီ! (${mult}x)**\n💰 စုစုပေါင်း **${payout.toLocaleString()} coins** *(အမြတ်: +${profit.toLocaleString()} coins)* ရရှိပါတယ်!`,
                  '#2ECC71'
                )],
                components: buildBoardRows(true),
              });
            }

            const idx = parseInt(i.customId.replace('mine_', ''), 10);
            if (revealed.has(idx)) return i.deferUpdate();

            if (bombIndices.has(idx)) {
              ended = true;
              collector.stop('bomb');
              return i.update({
                embeds: [buildEmbed(
                  `💥 **BOOM! ဗုံးထိသွားပါပြီ!**\n💸 **-${bet.toLocaleString()} coins** ဆုံးရှုံးသွားပါတယ်။`,
                  '#E74C3C'
                )],
                components: buildBoardRows(true, idx),
              });
            }

            revealed.add(idx);

            if (revealed.size >= safeTotal) {
              ended = true;
              collector.stop('cleared');
              const mult = calcMinesMultiplier(revealed.size, bombsCount, totalCells);
              const payout = Math.floor(bet * mult);
              const profit = payout - bet;

              const freshUser = await getUser(message.author.id, message.author.username);
              freshUser.balance += payout;
              await freshUser.save();

              return i.update({
                embeds: [buildEmbed(
                  `🔥 **စိန်တုံးအားလုံး ရှင်းလင်းနိုင်ပါပြီ! (${mult}x MAX WIN)**\n💰 စုစုပေါင်း **${payout.toLocaleString()} coins** *(အမြတ်: +${profit.toLocaleString()} coins)* ရရှိပါတယ်!`,
                  '#FFD700'
                )],
                components: buildBoardRows(true),
              });
            }

            return i.update({
              embeds: [buildEmbed('✨ စိန်တုံး 💎 တွေ့ပါပြီ! ဆက်ဖွင့်မလား၊ ငွေသိမ်းမလား ရွေးချယ်ပါ။')],
              components: buildBoardRows(false),
            });
          } catch (err) {
            console.error('Mines Collect Error:', err);
          }
        });

        collector.on('end', async () => {
          try {
            if (ended) return;
            ended = true;

            const freshUser = await getUser(message.author.id, message.author.username);
            if (revealed.size > 0) {
              const mult = calcMinesMultiplier(revealed.size, bombsCount, totalCells);
              const payout = Math.floor(bet * mult);
              freshUser.balance += payout;
              await freshUser.save();

              await gameMsg.edit({
                embeds: [buildEmbed(
                  `⏳ အချိန်စေ့သွားသဖြင့် **${mult}x** ဖြင့် အလိုအလျောက် ငွေသိမ်းပေးလိုက်ပါပြီ! (**${payout.toLocaleString()} coins**)`,
                  '#2ECC71'
                )],
                components: buildBoardRows(true),
              }).catch(() => {});
            } else {
              freshUser.balance += bet;
              await freshUser.save();

              await gameMsg.edit({
                embeds: [buildEmbed(
                  `⏳ ဘာမှမဖွင့်ဘဲ အချိန်စေ့သွားသဖြင့် လောင်းကြေး **${bet.toLocaleString()} coins** ပြန်အမ်းပေးလိုက်ပါပြီ။`,
                  '#95A5A6'
                )],
                components: buildBoardRows(true),
              }).catch(() => {});
            }
          } catch (err) {
            console.error('Mines End Error:', err);
          } finally {
            activeGambling.delete(message.author.id);
          }
        });
      } catch (err) {
        activeGambling.delete(message.author.id);
        throw err;
      }
    },
  },
];