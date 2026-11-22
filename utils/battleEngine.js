const { getAnimalPower } = require('./battleHelper');
const { getAnimalMeta } = require('./huntingHelper');

// Fantasy RPG Class ၆ မျိုးနှင့် ကိုယ်ပိုင် Ultimate Skill များ
const RPG_CLASSES = [
  {
    id: 'warrior',
    icon: '⚔️',
    title: 'Warrior',
    hpMod: 1.05,
    atkMod: 1.05,
    defMod: 1.0,
    spdMod: 1.0,
    crit: 0.16,
    skillName: 'Dragon Slash',
    skillType: 'burst',
    skillMult: 1.85,
  },
  {
    id: 'guardian',
    icon: '🛡️',
    title: 'Guardian',
    hpMod: 1.32,
    atkMod: 0.85,
    defMod: 1.35,
    spdMod: 0.88,
    crit: 0.10,
    skillName: 'Aegis Sanctuary',
    skillType: 'guardHeal',
    skillMult: 1.25,
  },
  {
    id: 'assassin',
    icon: '🗡️',
    title: 'Assassin',
    hpMod: 0.84,
    atkMod: 1.22,
    defMod: 0.82,
    spdMod: 1.25,
    crit: 0.30,
    skillName: 'Phantom Execution',
    skillType: 'critBurst',
    skillMult: 2.05,
  },
  {
    id: 'mage',
    icon: '🔮',
    title: 'Mage',
    hpMod: 0.88,
    atkMod: 1.12,
    defMod: 0.88,
    spdMod: 1.08,
    crit: 0.18,
    skillName: 'Arcane Nova',
    skillType: 'aoe',
    skillMult: 0.92,
  },
  {
    id: 'mystic',
    icon: '💚',
    title: 'Mystic',
    hpMod: 1.05,
    atkMod: 0.90,
    defMod: 1.05,
    spdMod: 1.02,
    crit: 0.12,
    skillName: 'Celestial Blessing',
    skillType: 'teamHeal',
    skillMult: 1.05,
  },
  {
    id: 'berserker',
    icon: '🔥',
    title: 'Berserker',
    hpMod: 1.02,
    atkMod: 1.16,
    defMod: 0.90,
    spdMod: 1.06,
    crit: 0.22,
    skillName: 'Blood Fury',
    skillType: 'lifesteal',
    skillMult: 1.70,
  },
];

// Fantasy Arena နှင့် ရန်သူ့အဖွဲ့ နာမည်များ
const ARENAS = [
  '🌋 Volcano Caldera',
  '🌌 Astral Sanctum',
  '🌲 Enchanted Whisperwood',
  '❄️ Frozen Citadel',
  '⚡ Stormspire Peaks',
  '🏯 Ancient Dragon Ruins',
  '🌑 Abyssal Rift',
];

const ENEMY_SQUADS = [
  '🩸 Crimson Predators',
  '🌑 Shadow Legion',
  '🔥 Ember Fang Pack',
  '❄️ Frostbite Stalkers',
  '⚡ Thunderclaw Horde',
  '👁️ Void Watchers',
  '🐉 Abyssal Beasts',
];

// တိရစ္ဆာန် ID အလိုက် အမြဲတူညီသော Class တစ်ခု သတ်မှတ်ခြင်း
function getAnimalClass(animalId) {
  let hash = 0;
  for (let i = 0; i < animalId.length; i++) {
    hash = (hash * 31 + animalId.charCodeAt(i)) % 997;
  }
  return RPG_CLASSES[hash % RPG_CLASSES.length];
}

function pickArenaAndEnemy() {
  const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
  const enemySquad = ENEMY_SQUADS[Math.floor(Math.random() * ENEMY_SQUADS.length)];
  return { arena, enemySquad };
}

// တိရစ္ဆာန်အဖွဲ့ကို HP / MP / ATK / DEF / CRIT ပါဝင်သော RPG Unit များအဖြစ် ပြောင်းလဲခြင်း
function buildBattleUnits(animals, battleLevel = 1, powerScale = 1.0) {
  const levelMult = 1 + (Math.max(1, battleLevel) - 1) * 0.04;

  return animals.map((animal, idx) => {
    const meta = getAnimalMeta(animal);
    const cls = getAnimalClass(animal.id);
    const base = (getAnimalPower(animal) + 40) * levelMult * powerScale;

    const maxHp = Math.max(80, Math.round(base * 3.1 * cls.hpMod));
    const atk = Math.max(20, Math.round(base * 0.95 * cls.atkMod));
    const def = Math.max(10, Math.round(base * 0.28 * cls.defMod));
    const spd = Math.round((50 + idx * 3) * cls.spdMod);

    return {
      uid: `${animal.id}_${idx}`,
      id: animal.id,
      shortName: meta.shortName,
      emoji: animal.emoji,
      rankEmoji: meta.rankEmoji,
      cls,
      maxHp,
      hp: maxHp,
      mp: 35, // စတင်ချိန် Mana 35% (Turn 2-3 တွင် Ultimate ထုတ်သုံးနိုင်မည်)
      atk,
      def,
      spd,
      crit: cls.crit,
      alive: true,
    };
  });
}

// Progress Bar ပုံဖော်ခြင်း
function makeBar(current, max, filledChar, emptyChar, length = 5) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = current > 0 ? Math.max(1, Math.round(ratio * length)) : 0;
  return filledChar.repeat(filled) + emptyChar.repeat(length - filled);
}

// Embed ထဲတွင် အဖွဲ့တစ်ဖွဲ့ချင်းစီ၏ HP / MP / ATK / Class ပြသခြင်း
function renderTeamField(units) {
  return units
    .map((u) => {
      if (!u.alive || u.hp <= 0) {
        return (
          `💀 ~~${u.emoji} ${u.shortName}~~ *(KO)*\n` +
          `❤️\`${'⬛'.repeat(5)}\` \`0/${u.maxHp.toLocaleString()}\``
        );
      }

      const hpRatio = u.hp / u.maxHp;
      const hpChar = hpRatio > 0.5 ? '🟩' : hpRatio > 0.25 ? '🟨' : '🟥';
      const hpBar = makeBar(u.hp, u.maxHp, hpChar, '⬛', 5);
      const mpBar = makeBar(u.mp, 100, '🟦', '⬜', 5);

      return (
        `${u.rankEmoji}${u.emoji} **${u.shortName}** ${u.cls.icon}\n` +
        `❤️\`${hpBar}\` \`${u.hp.toLocaleString()}/${u.maxHp.toLocaleString()}\`\n` +
        `💧\`${mpBar}\` \`${u.mp}%\` • ⚔️\`${u.atk.toLocaleString()}\``
      );
    })
    .join('\n\n');
}

function cloneUnits(units) {
  return units.map((u) => ({ ...u }));
}

function calcDamage(attacker, defender, skillMult = 1, forceCrit = false) {
  const variance = 0.90 + Math.random() * 0.20;
  const isCrit = forceCrit || Math.random() < attacker.crit;
  const critMult = isCrit ? 1.48 : 1.0;

  // Rank အားလုံး (Common မှ Celestial အထိ) Turn ၂–၅ ကျော့အတွင်း ပွဲပြီးစေမည့် Ratio Defense Formula
  const mitigation = Math.max(0.45, 1 - defender.def / (defender.def + attacker.atk * 1.55));
  const dmg = Math.max(1, Math.round(attacker.atk * skillMult * variance * critMult * mitigation));
  return { dmg, isCrit };
}

function pickRandomAlive(units) {
  const alive = units.filter((u) => u.alive && u.hp > 0);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

// Turn-by-Turn RPG တိုက်ပွဲ တွက်ချက်ခြင်း
function simulateBattle(initialTeamA, initialTeamB) {
  const teamA = cloneUnits(initialTeamA);
  const teamB = cloneUnits(initialTeamB);
  const frames = [];
  const MAX_TURNS = 8;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const turnLogs = [];
    const actors = [
      ...teamA.filter((u) => u.alive).map((u) => ({ unit: u, side: 'A' })),
      ...teamB.filter((u) => u.alive).map((u) => ({ unit: u, side: 'B' })),
    ].sort((a, b) => (b.unit.spd + Math.random() * 12) - (a.unit.spd + Math.random() * 12));

    for (const actor of actors) {
      const attacker = actor.unit;
      if (!attacker.alive || attacker.hp <= 0) continue;

      const allies = actor.side === 'A' ? teamA : teamB;
      const enemies = actor.side === 'A' ? teamB : teamA;
      const sideTag = actor.side === 'A' ? '🔹' : '🔸';

      const target = pickRandomAlive(enemies);
      if (!target) break;

      const useUltimate = attacker.mp >= 100;

      if (useUltimate) {
        attacker.mp = 0;
        const { skillName, skillType, skillMult } = attacker.cls;

        if (skillType === 'aoe') {
          const livingEnemies = enemies.filter((e) => e.alive && e.hp > 0);
          let totalAoE = 0;
          let koCount = 0;

          for (const foe of livingEnemies) {
            const { dmg } = calcDamage(attacker, foe, skillMult, false);
            foe.hp = Math.max(0, foe.hp - dmg);
            foe.mp = Math.min(100, foe.mp + 20);
            totalAoE += dmg;
            if (foe.hp <= 0) {
              foe.alive = false;
              koCount += 1;
            }
          }

          const koText = koCount > 0 ? ` 💀 **${koCount} KO!**` : '';
          turnLogs.push(`${sideTag} ${attacker.emoji} **${attacker.shortName}** ✨ *${skillName}* ➔ ရန်သူအားလုံး **-${totalAoE.toLocaleString()}**!${koText}`);
        } else if (skillType === 'teamHeal') {
          const livingAllies = allies.filter((a) => a.alive && a.hp > 0);
          livingAllies.sort((x, y) => (x.hp / x.maxHp) - (y.hp / y.maxHp));
          const injured = livingAllies[0] || attacker;
          const healAmt = Math.round(injured.maxHp * 0.28);
          injured.hp = Math.min(injured.maxHp, injured.hp + healAmt);

          const { dmg } = calcDamage(attacker, target, skillMult, false);
          target.hp = Math.max(0, target.hp - dmg);
          target.mp = Math.min(100, target.mp + 20);
          let koText = '';
          if (target.hp <= 0) {
            target.alive = false;
            koText = ' 💀 **KO!**';
          }

          turnLogs.push(`${sideTag} ${attacker.emoji} **${attacker.shortName}** ✨ *${skillName}* ➔ 💚 +${healAmt.toLocaleString()} (${injured.emoji}) & ${target.emoji} **-${dmg.toLocaleString()}**${koText}`);
        } else if (skillType === 'guardHeal') {
          const healAmt = Math.round(attacker.maxHp * 0.24);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);

          const { dmg } = calcDamage(attacker, target, skillMult, false);
          target.hp = Math.max(0, target.hp - dmg);
          target.mp = Math.min(100, target.mp + 20);
          let koText = '';
          if (target.hp <= 0) {
            target.alive = false;
            koText = ' 💀 **KO!**';
          }

          turnLogs.push(`${sideTag} ${attacker.emoji} **${attacker.shortName}** ✨ *${skillName}* ➔ 🛡️ +${healAmt.toLocaleString()} HP & ${target.emoji} **-${dmg.toLocaleString()}**${koText}`);
        } else if (skillType === 'lifesteal') {
          const { dmg, isCrit } = calcDamage(attacker, target, skillMult, false);
          target.hp = Math.max(0, target.hp - dmg);
          target.mp = Math.min(100, target.mp + 20);
          const drain = Math.round(dmg * 0.35);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + drain);

          const critText = isCrit ? ' 💥**CRIT!**' : '';
          let koText = '';
          if (target.hp <= 0) {
            target.alive = false;
            koText = ' 💀 **KO!**';
          }

          turnLogs.push(`${sideTag} ${attacker.emoji} **${attacker.shortName}** ✨ *${skillName}* ➔ ${target.emoji} **-${dmg.toLocaleString()}**${critText} (🩸+${drain.toLocaleString()})${koText}`);
        } else {
          const forceCrit = skillType === 'critBurst';
          const { dmg, isCrit } = calcDamage(attacker, target, skillMult, forceCrit);
          target.hp = Math.max(0, target.hp - dmg);
          target.mp = Math.min(100, target.mp + 20);

          const critText = isCrit ? ' 💥**CRIT!**' : '';
          let koText = '';
          if (target.hp <= 0) {
            target.alive = false;
            koText = ' 💀 **KO!**';
          }

          turnLogs.push(`${sideTag} ${attacker.emoji} **${attacker.shortName}** ✨ *${skillName}* ➔ ${target.emoji} **-${dmg.toLocaleString()}**${critText}${koText}`);
        }
      } else {
        // ပုံမှန်တိုက်ခိုက်မှု + Mana +35%
        attacker.mp = Math.min(100, attacker.mp + 35);
        const { dmg, isCrit } = calcDamage(attacker, target, 1.0, false);
        target.hp = Math.max(0, target.hp - dmg);
        target.mp = Math.min(100, target.mp + 20);

        const critText = isCrit ? ' 💥**CRIT!**' : '';
        let koText = '';
        if (target.hp <= 0) {
          target.alive = false;
          koText = ' 💀 **KO!**';
        }

        turnLogs.push(`${sideTag} ${attacker.emoji} **${attacker.shortName}** ➔ ${target.emoji} **-${dmg.toLocaleString()}**${critText}${koText}`);
      }

      const aliveA = teamA.some((u) => u.alive);
      const aliveB = teamB.some((u) => u.alive);
      if (!aliveA || !aliveB) break;
    }

    frames.push({
      turn,
      teamA: cloneUnits(teamA),
      teamB: cloneUnits(teamB),
      logs: turnLogs.slice(0, 4), // Embed မရှုပ်စေရန် အရေးကြီးဆုံး Action ၄ ကြောင်းပြမည်
    });

    const aliveA = teamA.some((u) => u.alive);
    const aliveB = teamB.some((u) => u.alive);
    if (!aliveA || !aliveB) {
      return {
        frames,
        winner: aliveA ? 'A' : 'B',
        totalTurns: turn,
      };
    }
  }

  // ၈ ကျော့ပြည့်သည်အထိ နှစ်ဖက်လုံးကျန်နေပါက ကျန်ရှိသွေးရာခိုင်နှုန်း ပိုများသူ အနိုင်ရမည်
  const hpPctA = teamA.reduce((s, u) => s + u.hp, 0) / Math.max(1, teamA.reduce((s, u) => s + u.maxHp, 0));
  const hpPctB = teamB.reduce((s, u) => s + u.hp, 0) / Math.max(1, teamB.reduce((s, u) => s + u.maxHp, 0));

  return {
    frames,
    winner: hpPctA >= hpPctB ? 'A' : 'B',
    totalTurns: MAX_TURNS,
  };
}

// Discord Rate Limit မထိစေရန် အများဆုံး Animation Frame ၄ ခုအထိ ချိန်ညှိယူခြင်း
function selectAnimationFrames(frames) {
  if (frames.length <= 4) return frames;
  return [
    frames[0],
    frames[Math.floor(frames.length / 2)],
    frames[frames.length - 1],
  ];
}

module.exports = {
  buildBattleUnits,
  simulateBattle,
  selectAnimationFrames,
  renderTeamField,
  pickArenaAndEnemy,
};