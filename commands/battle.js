const { EmbedBuilder } = require('discord.js');
const { getUser, addExp } = require('../models/User');
const ANIMALS = require('../data/animals');
const { SHOP_ITEMS, useCategoryItems } = require('../data/shopItems');

// တိရစ္ဆာန်အဖွဲ့ (Top 3) နှင့် ပစ္စည်း Power တွက်ချက်ပေးမည့် Helper Function
function getBattleStats(userObj) {
  const entries = Object.entries(userObj.zoo || {});
  let team = [];
  for (const [name, count] of entries) {
    const info = ANIMALS.find((a) => a.name === name);
    if (info) {
      for (let i = 0; i < count; i++) {
        team.push(info);
      }
    }
  }
  team.sort((a, b) => b.price - a.price);
  team = team.slice(0, 3);

  let itemPower = 0;
  for (const itemId of userObj.items || []) {
    const itemInfo = SHOP_ITEMS.find((i) => i.id === itemId);
    if (itemInfo && itemInfo.powerBonus) {
      itemPower += itemInfo.powerBonus;
    }
  }

  const basePower = team.reduce((sum, a) => sum + a.price, 0);
  const levelBonus = (userObj.level || 1) * 25;
  const totalPower = basePower + levelBonus + itemPower + Math.floor(Math.random() * 200);

  return { team, totalPower, itemPower };
}

module.exports = [
  {
    names: ['battle', 'b'],
    async execute(message, args, user) {
      const myStats = getBattleStats(user);
      if (myStats.team.length === 0) {
        return message.reply('❌ တိုက်ပွဲဝင်ဖို့ တိရစ္ဆာန် တစ်ကောင်မှ မရှိသေးပါဘူး! `Khunt` ရိုက်ပြီး အရင်ဖမ်းပါ။');
      }

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const myTeamText = myStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
      const opponentMention = message.mentions.users.first();

      // PvP Battle (သူငယ်ချင်းနှင့် တိုက်ခိုက်ခြင်း)
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
          return message.reply(`❌ **${opponentMention.username}** တွင် တိုက်ပွဲဝင်ရန် တိရစ္ဆာန် မရှိသေးပါ။`);
        }

        const oppTeamText = oppStats.team.map((a) => `${a.emoji} ${a.name}`).join('\n');
        const pvpEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`⚔️ PvP: ${message.author.username} (Lv.${user.level}) VS ${opponentMention.username} (Lv.${oppUser.level})`)
          .addFields(
            { name: `🛡️ ${message.author.username}`, value: myTeamText, inline: true },
            { name: `🔥 ${opponentMention.username}`, value: oppTeamText, inline: true }
          )
          .setFooter({ text: 'PvP တိုက်ပွဲ ပြင်းထန်စွာ တိုက်ခိုက်နေပါသည်...' });

        const msg = await message.reply({ embeds: [pvpEmbed] });
        await sleep(1500);

        const brokenItemText = useCategoryItems(user, 'battle');

        if (myStats.totalPower >= oppStats.totalPower) {
          const gainedExp = Math.floor(Math.random() * 31) + 45;
          const isLevelUp = addExp(user, gainedExp);
          addExp(oppUser, 10);

          let boxDropText = '';
          if (Math.random() < 0.20) {
            user.boxes = (user.boxes || 0) + 1;
            boxDropText = `\n🎁 PvP အောင်ပွဲဆု **Mystery Box +1** ရရှိပါတယ်!`;
          }

          await user.save();
          await oppUser.save();

          let resultText = `🏆 **${message.author.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${myStats.totalPower}\` vs \`${oppStats.totalPower}\`)\n✨ **+${gainedExp} EXP** ရရှိပါတယ်!${boxDropText}`;
          if (isLevelUp) {
            resultText += `\n🎊 **LEVEL UP!** **${message.author.username}** သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
          }
          resultText += brokenItemText;

          pvpEmbed.setColor('#2ECC71').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
        } else {
          const gainedExp = Math.floor(Math.random() * 31) + 45;
          const oppLevelUp = addExp(oppUser, gainedExp);
          addExp(user, 10);

          await user.save();
          await oppUser.save();

          let resultText = `🏆 **${opponentMention.username}** က အနိုင်ရရှိပါတယ်! (Power: \`${oppStats.totalPower}\` vs \`${myStats.totalPower}\`)\n✨ **${opponentMention.username}** က **+${gainedExp} EXP** ရရှိပြီး သင်သည် **+10 EXP** ရရှိပါတယ်။`;
          if (oppLevelUp) {
            resultText += `\n🎊 **LEVEL UP!** **${opponentMention.username}** သည် **Level ${oppUser.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
          }
          resultText += brokenItemText;

          pvpEmbed.setColor('#E74C3C').setDescription(resultText).setFooter({ text: 'PvP တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
        }

        return msg.edit({ embeds: [pvpEmbed] });
      }

      // Solo Wild Battle (တောရိုင်းအဖွဲ့နှင့် တိုက်ခိုက်ခြင်း)
      const enemyTeam = [
        ANIMALS[Math.floor(Math.random() * 65)],
        ANIMALS[Math.floor(Math.random() * 85)],
        ANIMALS[Math.floor(Math.random() * ANIMALS.length)],
      ];

      const enemyPower = enemyTeam.reduce((sum, a) => sum + a.price, 0) + Math.floor(Math.random() * 200);
      const enemyTeamText = enemyTeam.map((a) => `${a.emoji} ${a.name}`).join('\n');

      const battleEmbed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle(`⚔️ ${message.author.username} (Lv.${user.level}) ၏ တိရစ္ဆာန်တိုက်ပွဲ`)
        .addFields(
          { name: '🛡️ သင့်အဖွဲ့ (Your Team)', value: myTeamText, inline: true },
          { name: '👹 ရန်သူ့အဖွဲ့ (Wild Team)', value: enemyTeamText, inline: true }
        )
        .setFooter({ text: 'တိုက်ခိုက်နေပါသည်...' });

      const msg = await message.reply({ embeds: [battleEmbed] });
      await sleep(1500);

      const brokenItemText = useCategoryItems(user, 'battle');

      if (myStats.totalPower >= enemyPower) {
        const gainedExp = Math.floor(Math.random() * 31) + 30;
        const isLevelUp = addExp(user, gainedExp);

        let boxDropText = '';
        if (Math.random() < 0.15) {
          user.boxes = (user.boxes || 0) + 1;
          boxDropText = `\n🎁 ရန်သူ့စခန်းမှ **Mystery Box +1** သိမ်းပိုက်ရရှိပါတယ်!`;
        }

        await user.save();

        let winText = `🎉 **အနိုင်ရရှိပါတယ်!** (Power: \`${myStats.totalPower}\` vs \`${enemyPower}\`)\n✨ အတွေ့အကြုံ **+${gainedExp} EXP** ရရှိပါတယ်! (${user.exp}/${user.level * 100} EXP)${boxDropText}`;
        if (isLevelUp) {
          winText += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }
        winText += brokenItemText;

        battleEmbed.setColor('#2ECC71').setDescription(winText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      } else {
        const loseExp = 5;
        const isLevelUp = addExp(user, loseExp);
        await user.save();

        let loseText = `💀 **ရှုံးနိမ့်သွားပါတယ်!** (Power: \`${myStats.totalPower}\` vs \`${enemyPower}\`)\n📖 တိုက်ပွဲအတွေ့အကြုံ **+${loseExp} EXP** ရရှိပါတယ်။ (${user.exp}/${user.level * 100} EXP)`;
        if (isLevelUp) {
          loseText += `\n🎊 **LEVEL UP!** သင်သည် **Level ${user.level}** သို့ ရောက်ရှိသွားပါပြီ!`;
        }
        loseText += brokenItemText;

        battleEmbed.setColor('#E74C3C').setDescription(loseText).setFooter({ text: 'တိုက်ပွဲ ပြီးဆုံးပါပြီ' });
      }

      return msg.edit({ embeds: [battleEmbed] });
    },
  },
];