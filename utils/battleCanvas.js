const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ANIMALS = require('../data/animals');
const { getAnimalMeta } = require('./huntingHelper');

// 2x HD Resolution (Discord ပေါ်တွင် စာလုံးမဝါးဘဲ ပြတ်သားစေရန်)
const SCALE = 2;

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
  warrior: '#D35400',
  guardian: '#2980B9',
  assassin: '#C0392B',
  mage: '#8E44AD',
  mystic: '#27AE60',
  berserker: '#E74C3C',
};

const ANIMAL_RANK_MAP = new Map(
  ANIMALS.map((a) => [a.id, getAnimalMeta(a).rank])
);

const emojiImageCache = new Map();

function getEmojiImageUrl(emojiStr) {
  if (!emojiStr) return null;

  const customMatch = emojiStr.match(/^<a?:[^:]+:(\d+)>$/);
  if (customMatch) {
    return `https://cdn.discordapp.com/emojis/${customMatch[1]}.png?size=128`;
  }

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

// Bar ပေါ်တွင် စာလုံးအရမ်းရှင်းလင်းစေရန် အနားသတ်အမည်း (Outline) ဖြင့် ရေးခြင်း
function drawCrispText(ctx, text, x, y, maxWidth, startSize, minSize, fillColor = '#FFFFFF') {
  let fontSize = startSize;
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > minSize) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }

  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(8, 10, 16, 0.92)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

// တိရစ္ဆာန် တစ်ကောင်ချင်းစီ၏ RPG Card (နာမည်မပါ၊ HP/MP အကြီးစား)
function drawUnitCard(ctx, unit, emojiImg, x, y, width, height, side) {
  const isLeft = side === 'left';
  const isDead = !unit.alive || unit.hp <= 0;
  const rankName = ANIMAL_RANK_MAP.get(unit.id) || 'Common';
  const rankColor = isDead ? '#4A5060' : (RANK_COLORS[rankName] || '#2ECC71');
  const classColor = isDead ? '#4E5568' : (CLASS_COLORS[unit.cls?.id] || '#D35400');

  // Card နောက်ခံ
  drawRoundedRect(ctx, x, y, width, height, 11);
  ctx.fillStyle = isDead ? '#191C24' : '#212636';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isDead ? '#2B303E' : '#343D56';
  ctx.stroke();

  // Portrait Box (အကောင်ပုံ + အောက်ခြေ Class Badge)
  const boxSize = 94;
  const pad = 12;
  const boxX = isLeft ? x + pad : x + width - pad - boxSize;
  const boxY = y + (height - boxSize) / 2;

  drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 9);
  ctx.fillStyle = isDead ? '#13161E' : '#161A26';
  ctx.fill();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = rankColor;
  ctx.stroke();

  // အကောင် Emoji ပုံဆွဲခြင်း
  ctx.save();
  if (isDead) ctx.globalAlpha = 0.28;
  if (emojiImg) {
    const imgSize = 58;
    ctx.drawImage(
      emojiImg,
      boxX + (boxSize - imgSize) / 2,
      boxY + 6,
      imgSize,
      imgSize
    );
  }
  ctx.restore();

  // Portrait အောက်ခြေရှိ Class Pill Badge
  const className = unit.cls?.title || 'Fighter';
  const badgeW = boxSize - 12;
  const badgeH = 20;
  const badgeX = boxX + 6;
  const badgeY = boxY + boxSize - badgeH - 5;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 5);
  ctx.fillStyle = classColor;
  ctx.fill();

  ctx.fillStyle = isDead ? '#CBD5E1' : '#FFFFFF';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(className, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);

  // KO တံဆိပ်တုံး
  if (isDead) {
    drawRoundedRect(ctx, boxX + 18, boxY + 20, boxSize - 36, 28, 6);
    ctx.fillStyle = 'rgba(220, 53, 69, 0.94)';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KO', boxX + boxSize / 2, boxY + 34.5);
  }

  // Stats နှင့် HP/MP Bar ဧရိယာ
  const infoX = isLeft ? boxX + boxSize + 12 : x + pad;
  const infoW = width - boxSize - pad * 2 - 12;
  const infoCenterX = infoX + infoW / 2;

  // ၁။ HP Bar (အကြီးစား 34px + Outline ပါ 18px Bold စာလုံး)
  const hpY = y + 14;
  const hpH = 34;
  const hpRatio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 0;
  const hpFillColor = isDead
    ? '#3D4352'
    : hpRatio > 0.5
      ? '#1FA855'
      : hpRatio > 0.25
        ? '#D4940A'
        : '#D63031';

  drawRoundedRect(ctx, infoX, hpY, infoW, hpH, 7);
  ctx.fillStyle = '#0F121A';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#2B3245';
  ctx.stroke();

  if (hpRatio > 0 && !isDead) {
    const fillW = Math.max(12, Math.round(infoW * hpRatio));
    const fillX = isLeft ? infoX : infoX + (infoW - fillW);
    drawRoundedRect(ctx, fillX, hpY, fillW, hpH, 7);
    ctx.fillStyle = hpFillColor;
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hpText = `${Math.max(0, unit.hp).toLocaleString()} / ${unit.maxHp.toLocaleString()}`;
  drawCrispText(
    ctx,
    hpText,
    infoCenterX,
    hpY + hpH / 2 + 1,
    infoW - 14,
    18,
    13,
    isDead ? '#94A3B8' : '#FFFFFF'
  );

  // ၂။ Mana Bar (24px + Outline ပါ 14px Bold စာလုံး)
  const mpY = hpY + hpH + 8;
  const mpH = 24;
  const mpVal = isDead ? 0 : (unit.mp || 0);
  const mpRatio = Math.max(0, Math.min(1, mpVal / 100));

  drawRoundedRect(ctx, infoX, mpY, infoW, mpH, 6);
  ctx.fillStyle = '#0F121A';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#2B3245';
  ctx.stroke();

  if (mpRatio > 0) {
    const fillW = Math.max(10, Math.round(infoW * mpRatio));
    const fillX = isLeft ? infoX : infoX + (infoW - fillW);
    drawRoundedRect(ctx, fillX, mpY, fillW, mpH, 6);
    ctx.fillStyle = '#2574C4';
    ctx.fill();
  }

  drawCrispText(
    ctx,
    `MP  ${mpVal}%`,
    infoCenterX,
    mpY + mpH / 2 + 0.5,
    infoW - 14,
    14,
    11,
    isDead ? '#64748B' : '#F0F9FF'
  );

  // ၃။ အောက်ဆုံး Stat တန်း (ATK • DEF • CRIT)
  const statY = mpY + mpH + 17;
  const critPct = Math.round((unit.crit || 0) * 100);
  const statText = `ATK ${unit.atk.toLocaleString()}  •  DEF ${unit.def.toLocaleString()}  •  ${critPct}%`;

  let statFont = 13;
  ctx.font = `bold ${statFont}px sans-serif`;
  while (ctx.measureText(statText).width > infoW - 4 && statFont > 10) {
    statFont -= 1;
    ctx.font = `bold ${statFont}px sans-serif`;
  }

  ctx.fillStyle = isDead ? '#64748B' : '#E2E8F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statText, infoCenterX, statY);
}

// နှစ်ဖက်အဖွဲ့လုံးပါဝင်သော 2x HD Battle Card PNG Buffer ထုတ်ပေးခြင်း
async function renderBattleCard(teamA, teamB) {
  const rows = Math.max(1, teamA.length, teamB.length);
  const width = 720;
  const padX = 14;
  const padY = 14;
  const cardH = 118;
  const rowGap = 11;
  const centerGap = 34;
  const cardW = (width - padX * 2 - centerGap) / 2;
  const height = padY * 2 + rows * cardH + (rows - 1) * rowGap;

  const allEmojis = [...new Set([...teamA, ...teamB].map((u) => u.emoji))];
  await Promise.all(allEmojis.map((e) => loadEmojiImage(e)));

  const canvas = createCanvas(width * SCALE, height * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // နောက်ခံအရောင်နှင့် ဘေးဘောင်
  drawRoundedRect(ctx, 0, 0, width, height, 14);
  ctx.fillStyle = '#12151E';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2A3144';
  ctx.stroke();

  // အလယ် Divider မျဉ်းနှင့် VS တံဆိပ်
  const midX = width / 2;
  ctx.strokeStyle = '#262D40';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(midX, 18);
  ctx.lineTo(midX, height - 18);
  ctx.stroke();

  drawRoundedRect(ctx, midX - 16, height / 2 - 15, 32, 30, 8);
  ctx.fillStyle = '#1F2536';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#F39C12';
  ctx.stroke();

  ctx.fillStyle = '#F39C12';
  ctx.font = 'bold 13px sans-serif';
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