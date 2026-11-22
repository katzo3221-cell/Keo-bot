const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ANIMALS = require('../data/animals');
const { getAnimalMeta } = require('./huntingHelper');

// Rank အလိုက် Portrait ဘောင်အရောင်များ
const RANK_COLORS = {
  Common: '#2ECC71',
  Uncommon: '#3498DB',
  Rare: '#9B59B6',
  'Super Rare': '#48DBFB',
  Epic: '#E67E22',
  'Ultra Epic': '#F1C40F',
  Legendary: '#E74C3C',
  Mythical: '#D980FA',
  Divine: '#F9CA24',
  Celestial: '#A29BFE',
};

// Class အလိုက် Badge အရောင်များ
const CLASS_COLORS = {
  warrior: '#E67E22',
  guardian: '#3498DB',
  assassin: '#E84393',
  mage: '#9B59B6',
  mystic: '#2ECC71',
  berserker: '#E74C3C',
};

const ANIMAL_RANK_MAP = new Map(
  ANIMALS.map((a) => [a.id, getAnimalMeta(a).rank])
);

// Twemoji ပုံများကို Memory ထဲ Cache သိမ်းထားခြင်း (နောက်တစ်ကြိမ်ဆို ချက်ချင်းထွက်စေရန်)
const emojiImageCache = new Map();

function getEmojiImageUrl(emojiStr) {
  if (!emojiStr) return null;

  // Discord Custom Emoji (<a:name:id> သို့ <:name:id>)
  const customMatch = emojiStr.match(/^<a?:[^:]+:(\d+)>$/);
  if (customMatch) {
    return `https://cdn.discordapp.com/emojis/${customMatch[1]}.png?size=96`;
  }

  // Standard Unicode Emoji -> Twemoji PNG
  const hasZwj = emojiStr.includes('\u200d');
  const codePoints = [];
  for (const ch of emojiStr) {
    const cp = ch.codePointAt(0);
    if (!hasZwj && cp === 0xfe0f) continue;
    codePoints.push(cp.toString(16));
  }

  if (codePoints.length === 0) return null;
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${codePoints.join('-')}.png`;
}

async function loadEmojiImage(emojiStr) {
  if (!emojiStr) return null;
  if (emojiImageCache.has(emojiStr)) {
    return emojiImageCache.get(emojiStr);
  }

  const url = getEmojiImageUrl(emojiStr);
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const img = await loadImage(Buffer.from(arrayBuf));

    if (emojiImageCache.size > 250) {
      const firstKey = emojiImageCache.keys().next().value;
      emojiImageCache.delete(firstKey);
    }
    emojiImageCache.set(emojiStr, img);
    return img;
  } catch {
    emojiImageCache.set(emojiStr, null);
    return null;
  }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function formatUnitLabel(id) {
  if (!id) return 'Unit';
  const clean = id.replace(/[_-]+/g, ' ');
  return clean.length > 14 ? `${clean.slice(0, 13)}…` : clean;
}

// တိရစ္ဆာန် တစ်ကောင်ချင်းစီ၏ RPG Card ဆွဲခြင်း
function drawUnitCard(ctx, unit, emojiImg, x, y, width, height, side) {
  const isLeft = side === 'left';
  const isDead = !unit.alive || unit.hp <= 0;
  const rankName = ANIMAL_RANK_MAP.get(unit.id) || 'Common';
  const rankColor = isDead ? '#4A5060' : (RANK_COLORS[rankName] || '#2ECC71');
  const classColor = isDead ? '#5A6070' : (CLASS_COLORS[unit.cls?.id] || '#E67E22');

  // Card နောက်ခံ
  drawRoundedRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = isDead ? '#1A1D26' : '#222736';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isDead ? '#2C3140' : '#323A50';
  ctx.stroke();

  // Portrait Box နေရာ (ဘယ်အဖွဲ့ = ဘယ်ဘက်၊ ညာအဖွဲ့ = ညာဘက်)
  const boxSize = 78;
  const pad = 12;
  const boxX = isLeft ? x + pad : x + width - pad - boxSize;
  const boxY = y + (height - boxSize) / 2;

  drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 8);
  ctx.fillStyle = isDead ? '#151820' : '#181C28';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = rankColor;
  ctx.stroke();

  // အကောင် Emoji ပုံဆွဲခြင်း
  ctx.save();
  if (isDead) ctx.globalAlpha = 0.30;
  if (emojiImg) {
    const imgSize = 54;
    ctx.drawImage(
      emojiImg,
      boxX + (boxSize - imgSize) / 2,
      boxY + (boxSize - imgSize) / 2,
      imgSize,
      imgSize
    );
  } else {
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((unit.id || '??').slice(0, 2).toUpperCase(), boxX + boxSize / 2, boxY + boxSize / 2);
  }
  ctx.restore();

  // KO တံဆိပ်တုံး
  if (isDead) {
    drawRoundedRect(ctx, boxX + 16, boxY + 26, boxSize - 32, 26, 5);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.90)';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KO', boxX + boxSize / 2, boxY + 39);
  }

  // Stats နှင့် HP/MP Bar ဧရိယာ
  const infoX = isLeft ? boxX + boxSize + 12 : x + pad;
  const infoW = width - boxSize - pad * 2 - 12;

  // ၁။ HP Bar (အပေါ်ဆုံး)
  const hpY = y + 12;
  const hpH = 18;
  const hpRatio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 0;
  const hpFillColor = isDead
    ? '#4A5060'
    : hpRatio > 0.5
      ? '#2ECC71'
      : hpRatio > 0.25
        ? '#F1C40F'
        : '#E74C3C';

  drawRoundedRect(ctx, infoX, hpY, infoW, hpH, 5);
  ctx.fillStyle = '#12151E';
  ctx.fill();

  if (hpRatio > 0) {
    const fillW = Math.max(8, Math.round(infoW * hpRatio));
    const fillX = isLeft ? infoX : infoX + (infoW - fillW);
    drawRoundedRect(ctx, fillX, hpY, fillW, hpH, 5);
    ctx.fillStyle = hpFillColor;
    ctx.fill();
  }

  ctx.fillStyle = isDead ? '#8A92A6' : '#FFFFFF';
  ctx.font = 'bold 11px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = isLeft ? 'left' : 'right';
  const hpLabel = `${Math.max(0, unit.hp).toLocaleString()} / ${unit.maxHp.toLocaleString()}`;
  ctx.fillText(hpLabel, isLeft ? infoX + 7 : infoX + infoW - 7, hpY + hpH / 2 + 0.5);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = isLeft ? 'right' : 'left';
  ctx.fillText('HP', isLeft ? infoX + infoW - 7 : infoX + 7, hpY + hpH / 2 + 0.5);

  // ၂။ Mana Bar (ဒုတိယ)
  const mpY = hpY + hpH + 6;
  const mpH = 14;
  const mpRatio = Math.max(0, Math.min(1, (unit.mp || 0) / 100));

  drawRoundedRect(ctx, infoX, mpY, infoW, mpH, 4);
  ctx.fillStyle = '#12151E';
  ctx.fill();

  if (mpRatio > 0 && !isDead) {
    const fillW = Math.max(6, Math.round(infoW * mpRatio));
    const fillX = isLeft ? infoX : infoX + (infoW - fillW);
    drawRoundedRect(ctx, fillX, mpY, fillW, mpH, 4);
    ctx.fillStyle = '#3498DB';
    ctx.fill();
  }

  ctx.fillStyle = isDead ? '#6E768A' : '#EBF5FB';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = isLeft ? 'left' : 'right';
  ctx.fillText(`${isDead ? 0 : (unit.mp || 0)} / 100`, isLeft ? infoX + 7 : infoX + infoW - 7, mpY + mpH / 2 + 0.5);

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.textAlign = isLeft ? 'right' : 'left';
  ctx.fillText('MP', isLeft ? infoX + infoW - 7 : infoX + 7, mpY + mpH / 2 + 0.5);

  // ၃။ အကောင် ID နှင့် Class Badge
  const nameY = mpY + mpH + 16;
  const unitName = formatUnitLabel(unit.id);
  const className = unit.cls?.title || 'Fighter';

  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = isDead ? '#71798E' : '#F1F5F9';
  ctx.textAlign = isLeft ? 'left' : 'right';
  ctx.fillText(unitName, isLeft ? infoX + 2 : infoX + infoW - 2, nameY);

  // Class Pill Badge
  ctx.font = 'bold 10px sans-serif';
  const badgeW = Math.max(58, ctx.measureText(className).width + 14);
  const badgeH = 17;
  const badgeX = isLeft ? infoX + infoW - badgeW : infoX;
  const badgeY = nameY - badgeH / 2;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 5);
  ctx.fillStyle = classColor;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(className, badgeX + badgeW / 2, nameY + 0.5);

  // ၄။ အောက်ဆုံး Stat တန်း (ATK • DEF • CRIT)
  const statY = y + height - 15;
  const critPct = Math.round((unit.crit || 0) * 100);
  const statText = `ATK ${unit.atk.toLocaleString()}   •   DEF ${unit.def.toLocaleString()}   •   CRIT ${critPct}%`;

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = isDead ? '#5A6275' : '#94A3B8';
  ctx.textAlign = isLeft ? 'left' : 'right';
  ctx.fillText(statText, isLeft ? infoX + 2 : infoX + infoW - 2, statY);
}

// နှစ်ဖက်အဖွဲ့လုံးပါဝင်သော Battle Card PNG Buffer ထုတ်ပေးခြင်း
async function renderBattleCard(teamA, teamB) {
  const rows = Math.max(1, teamA.length, teamB.length);
  const width = 800;
  const padX = 16;
  const padY = 16;
  const cardH = 104;
  const rowGap = 10;
  const centerGap = 36;
  const cardW = (width - padX * 2 - centerGap) / 2;
  const height = padY * 2 + rows * cardH + (rows - 1) * rowGap;

  // လိုအပ်သော Emoji PNG များကို တစ်ပြိုင်တည်း Load လုပ်ခြင်း
  const allEmojis = [...new Set([...teamA, ...teamB].map((u) => u.emoji))];
  await Promise.all(allEmojis.map((e) => loadEmojiImage(e)));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // နောက်ခံအရောင်နှင့် ဘေးဘောင်
  drawRoundedRect(ctx, 0, 0, width, height, 14);
  ctx.fillStyle = '#141720';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2A3042';
  ctx.stroke();

  // အလယ် Divider မျဉ်းနှင့် VS တံဆိပ်
  const midX = width / 2;
  ctx.strokeStyle = '#262C3D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(midX, 18);
  ctx.lineTo(midX, height - 18);
  ctx.stroke();

  drawRoundedRect(ctx, midX - 15, height / 2 - 14, 30, 28, 7);
  ctx.fillStyle = '#222838';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#F39C12';
  ctx.stroke();

  ctx.fillStyle = '#F39C12';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', midX, height / 2 + 0.5);

  // ဘယ်ဘက်အဖွဲ့ (Player) နှင့် ညာဘက်အဖွဲ့ (Enemy / Opponent) ဆွဲခြင်း
  for (let i = 0; i < rows; i++) {
    const y = padY + i * (cardH + rowGap);

    if (teamA[i]) {
      const img = emojiImageCache.get(teamA[i].emoji) || null;
      drawUnitCard(ctx, teamA[i], img, padX, y, cardW, cardH, 'left');
    }

    if (teamB[i]) {
      const img = emojiImageCache.get(teamB[i].emoji) || null;
      drawUnitCard(ctx, teamB[i], img, midX + centerGap / 2, y, cardW, cardH, 'right');
    }
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderBattleCard,
};