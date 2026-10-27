#!/usr/bin/env node
/*
 * construir-composicion.js — Panel de composición corporal (InBody).
 *
 * Lee composicion.json y genera registro/composicion.html: evolución de las
 * métricas de composición corporal de Noel y Vicky (peso, % y kg de grasa,
 * músculo, MLG, visceral, etc.) con una gráfica SVG por métrica (sin librerías)
 * y una tabla. Content-only (style + body), autocontenido para publicar como
 * Artifact. Sin GIFs ni recursos externos.
 *
 * Uso: node construir-composicion.js
 */
const fs = require('fs');
const path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'composicion.json'), 'utf8'));
const personas = d.personas || { tu: 'Tú', ella: 'Ella' };
const objetivo = d.objetivo || { tu: {}, ella: {} };
const reg = d.registro || { tu: [], ella: [] };

const C_TU = '#4aa3ff';    // Noel
const C_ELLA = '#ff8fab';  // Vicky
const C_GOAL = '#35c46a';  // meta final
const C_HITO = '#f5a623';  // hito intermedio

// Métricas a mostrar. lower:true = baja es mejor · higher:true = sube es mejor.
const METRICS = [
  { k: 'peso',           label: 'Peso',                        unit: 'kg',   dec: 1, group: 'clave', lower: true },
  { k: 'grasa_pct',      label: '% Masa grasa',                unit: '%',    dec: 1, group: 'clave', lower: true },
  { k: 'grasa_kg',       label: 'Masa grasa',                  unit: 'kg',   dec: 1, group: 'clave', lower: true },
  { k: 'musculo',        label: 'Masa muscular esquelética',   unit: 'kg',   dec: 1, group: 'clave', higher: true },
  { k: 'mlg',            label: 'Masa libre de grasa',         unit: 'kg',   dec: 1, group: 'clave', higher: true },
  { k: 'visceral',       label: 'Grasa visceral (índice)',     unit: '',     dec: 0, group: 'clave', lower: true },
  { k: 'imc',            label: 'IMC',                         unit: '',     dec: 1, group: 'otros', lower: true },
  { k: 'tmb',            label: 'Tasa metabólica basal',       unit: 'kcal', dec: 0, group: 'otros' },
  { k: 'inbody',         label: 'InBody score',                unit: 'pts',  dec: 0, group: 'otros', higher: true },
  { k: 'agua',           label: 'Agua corporal total',         unit: 'kg',   dec: 1, group: 'otros' },
  { k: 'proteinas',      label: 'Proteínas',                   unit: 'kg',   dec: 1, group: 'otros' },
  { k: 'minerales',      label: 'Minerales',                   unit: 'kg',   dec: 1, group: 'otros' },
  { k: 'grado_obesidad', label: 'Grado de obesidad',           unit: '%',    dec: 0, group: 'otros', lower: true }
];

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fechaCorta = f => { const [, m, dd] = String(f).split('-'); return `${dd}/${m}`; };
const fmt = (v, dec) => v == null ? '—' : Number(v).toFixed(dec).replace('.', ',');

function sorted(arr) { return (arr || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))); }
const tuE = sorted(reg.tu);
const ellaE = sorted(reg.ella);
const lastVal = (entries, k) => { for (let i = entries.length - 1; i >= 0; i--) if (entries[i][k] != null) return entries[i][k]; return null; };
const prevVal = (entries, k) => { let seen = 0; for (let i = entries.length - 1; i >= 0; i--) if (entries[i][k] != null) { seen++; if (seen === 2) return entries[i][k]; } return null; };

// Gráfica SVG de evolución de UNA métrica, con línea de Noel y de Vicky (+ meta e hito opcionales).
function chartSVG(k, goalTu, hitoTu) {
  const seriesTu = tuE.map(e => ({ f: e.fecha, v: e[k] == null ? null : +e[k] }));
  const seriesElla = ellaE.map(e => ({ f: e.fecha, v: e[k] == null ? null : +e[k] }));
  const fechas = Array.from(new Set([...seriesTu, ...seriesElla].map(p => p.f))).sort();
  const vals = [...seriesTu, ...seriesElla].map(p => p.v).filter(v => v != null);
  if (goalTu != null) vals.push(goalTu);
  if (hitoTu != null) vals.push(hitoTu);
  if (!vals.length) return '<div class="noimg">sin datos aún</div>';

  const W = 320, H = 150, padL = 34, padR = 10, padT = 12, padB = 22;
  const n = fechas.length;
  const xOf = i => padL + (n <= 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mn === mx) { mn -= 1; mx += 1; }
  const pad = (mx - mn) * 0.08; mn -= pad; mx += pad;
  const yOf = v => padT + (H - padT - padB) * (1 - (v - mn) / (mx - mn));

  const gridY = [mn, (mn + mx) / 2, mx];
  const grid = gridY.map(v => {
    const y = yOf(v).toFixed(1);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2a2e37" stroke-width="1"/>` +
      `<text x="${padL - 5}" y="${(+y + 3).toFixed(1)}" text-anchor="end" fill="#9aa0ab" font-size="8">${esc(fmt(v, mx - mn < 4 ? 1 : 0))}</text>`;
  }).join('');

  const xlabels = fechas.map((f, i) => {
    if (n > 5 && i % Math.ceil(n / 5) !== 0 && i !== n - 1) return '';
    return `<text x="${xOf(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="#9aa0ab" font-size="8">${esc(fechaCorta(f))}</text>`;
  }).join('');

  const refLine = (val, color, label) => val == null ? '' :
    `<line x1="${padL}" y1="${yOf(val).toFixed(1)}" x2="${W - padR}" y2="${yOf(val).toFixed(1)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${W - padR}" y="${(yOf(val) - 3).toFixed(1)}" text-anchor="end" fill="${color}" font-size="8">${label} ${esc(fmt(val, 1))}</text>`;
  const goal = refLine(hitoTu, C_HITO, 'hito') + refLine(goalTu, C_GOAL, 'meta');

  function serie(series, color) {
    const P = series.filter(p => p.v != null).map(p => [xOf(fechas.indexOf(p.f)), yOf(p.v)]);
    if (!P.length) return '';
    const line = P.length > 1 ? `<polyline points="${P.map(p => p.map(z => z.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>` : '';
    const dots = P.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.8" fill="${color}"/>`).join('');
    return line + dots;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evolución de ${esc(k)}" style="max-width:340px">
    ${grid}${goal}${xlabels}
    ${serie(seriesElla, C_ELLA)}${serie(seriesTu, C_TU)}
  </svg>`;
}

// Indicador de cambio respecto a la toma anterior (color según si el cambio es bueno).
function deltaBadge(m, entries) {
  const last = lastVal(entries, m.k), prev = prevVal(entries, m.k);
  if (last == null || prev == null) return '';
  const diff = last - prev;
  if (Math.abs(diff) < 1e-9) return `<span class="delta flat">→ igual</span>`;
  let cls = 'flat';
  if (m.lower) cls = diff < 0 ? 'good' : 'bad';
  else if (m.higher) cls = diff > 0 ? 'good' : 'bad';
  const sign = diff > 0 ? '+' : '−';
  return `<span class="delta ${cls}">${sign}${esc(fmt(Math.abs(diff), m.dec))} ${esc(m.unit)}</span>`;
}

function metricCard(m) {
  const goalTu = (objetivo.tu || {})[m.k];
  const hitoTu = ((objetivo.tu || {}).hito || {})[m.k];
  const lt = lastVal(tuE, m.k), le = lastVal(ellaE, m.k);
  const valLine = who => {
    const entries = who === 'tu' ? tuE : ellaE;
    const v = lastVal(entries, m.k);
    const color = who === 'tu' ? C_TU : C_ELLA;
    const name = who === 'tu' ? personas.tu : personas.ella;
    if (v == null) return `<div class="mrow"><span class="mwho" style="color:${color}">${esc(name)}</span><span class="mval muted">sin datos</span></div>`;
    return `<div class="mrow"><span class="mwho" style="color:${color}">${esc(name)}</span>` +
      `<span class="mval">${esc(fmt(v, m.dec))}<small>${esc(m.unit)}</small> ${deltaBadge(m, entries)}</span></div>`;
  };
  // Notas de hito y meta (solo Noel, solo métricas con objetivo).
  const noteLine = (val, icon, word) => {
    if (val == null || lt == null) return '';
    const falta = lt - val;
    if (Math.abs(falta) < 0.05) return `<div class="meta-note">${icon} ${esc(word)} alcanzado (${esc(fmt(val, 1))} ${esc(m.unit)})</div>`;
    return `<div class="meta-note">${icon} ${esc(word)}: ${esc(fmt(val, 1))} ${esc(m.unit)} — ${falta > 0 ? 'faltan' : 'te has pasado'} ${esc(fmt(Math.abs(falta), 1))} ${esc(m.unit)}</div>`;
  };
  const metaNote = noteLine(hitoTu, '🟠', 'Hito') + noteLine(goalTu, '🎯', 'Meta');
  return `<div class="mcard">
    <div class="mhead"><h3>${esc(m.label)}</h3></div>
    <div class="chart">${chartSVG(m.k, goalTu, hitoTu)}</div>
    ${valLine('tu')}${valLine('ella')}
    ${metaNote}
  </div>`;
}

const clave = METRICS.filter(m => m.group === 'clave');
const otros = METRICS.filter(m => m.group === 'otros');
const sec = (titulo, list, color) => `<div class="grupo"><h2 style="color:${color}">${esc(titulo)}</h2>\n<div class="grid">${list.map(metricCard).join('\n')}</div></div>`;

// Resumen de cabecera para Noel (si hay datos).
let resumen = '';
if (tuE.length) {
  const peso = lastVal(tuE, 'peso'), grasa = lastVal(tuE, 'grasa_pct'), musc = lastVal(tuE, 'musculo');
  const obj = objetivo.tu || {}, hito = obj.hito || {};
  const goal = obj.peso;
  const falta = (peso != null && goal != null) ? peso - goal : null;
  const nTomas = tuE.length;
  let hitoLine = '';
  if (hito.peso != null || hito.grasa_pct != null) {
    const parts = [];
    if (hito.peso != null) parts.push(`<b>${esc(fmt(hito.peso, 1))} kg</b>`);
    if (hito.grasa_pct != null) parts.push(`<b>${esc(fmt(hito.grasa_pct, 0))}%</b> de grasa`);
    hitoLine = `<p class="hito-line">🟠 Próximo hito (${esc(hito.plazo || 'medio plazo')}): ${parts.join(' / ')}. Objetivo alcanzable antes de mirar la meta final.</p>`;
  }
  resumen = `<div class="resumen">
    <p><b>${esc(personas.tu)}</b> · última toma ${esc(fechaCorta(tuE[tuE.length - 1].fecha))}: <b>${esc(fmt(peso, 1))} kg</b>, <b>${esc(fmt(grasa, 1))}%</b> grasa, <b>${esc(fmt(musc, 1))} kg</b> de músculo.${(goal != null || obj.grasa_pct != null) ? ` 🎯 Meta final: ${goal != null ? `<b>${esc(fmt(goal, 1))} kg</b>` : ''}${(goal != null && obj.grasa_pct != null) ? ' / ' : ''}${obj.grasa_pct != null ? `<b>${esc(fmt(obj.grasa_pct, 0))}%</b> de grasa` : ''}${falta != null ? ` (a ${esc(fmt(Math.abs(falta), 1))} kg), perdiendo grasa y manteniendo el músculo.` : '.'}` : ''}</p>
    ${hitoLine}
    ${nTomas < 2 ? `<p class="hint">Primera toma registrada: aún no hay tendencia. En cuanto haya una segunda medición (≈1 mes) verás las líneas y si la grasa baja mientras el músculo aguanta — que es la señal de que el plan funciona.</p>` : ''}
  </div>`;
}

const html = `<style>
  :root{--bg:#0f1115;--card:#1a1d24;--text:#f2f2f2;--muted:#9aa0ab;--border:#2a2e37}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);padding:24px 16px 60px}
  .wrap{max-width:820px;margin:0 auto}
  .eyebrow{color:${C_GOAL};font-weight:700;letter-spacing:.08em;font-size:.8rem;text-transform:uppercase}
  h1{margin:6px 0 4px;font-size:1.6rem}
  header p{color:var(--muted);margin:0 0 6px;line-height:1.5;font-size:.9rem}
  .legend{display:flex;gap:16px;align-items:center;margin-top:8px;font-size:.85rem;flex-wrap:wrap}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
  .dash{width:16px;height:0;border-top:2px dashed ${C_GOAL};display:inline-block}
  .resumen{background:var(--card);border:1px solid var(--border);border-left:4px solid ${C_TU};border-radius:12px;padding:12px 16px;margin-top:16px}
  .resumen p{margin:0 0 6px;line-height:1.5;font-size:.92rem}
  .resumen .hito-line{color:${C_HITO};font-size:.88rem;margin:0 0 6px;line-height:1.5}
  .resumen .hint{color:var(--muted);font-size:.85rem;margin:0}
  .grupo{margin-top:26px}
  .grupo>h2{font-size:1.15rem;margin:0 0 12px;border-bottom:2px solid currentColor;display:inline-block;padding-bottom:3px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .mcard{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
  .mhead h3{margin:0 0 6px;font-size:1rem}
  .chart{margin:2px 0 8px}
  .noimg{height:120px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem;background:#0f1115;border-radius:8px}
  .mrow{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:3px 0;font-variant-numeric:tabular-nums}
  .mwho{font-weight:700;font-size:.85rem}
  .mval{font-size:1.02rem;font-weight:700}
  .mval small{color:var(--muted);font-weight:400;font-size:.7rem;margin-left:2px}
  .mval.muted,.muted{color:var(--muted);font-weight:400;font-size:.85rem}
  .delta{font-size:.72rem;font-weight:700;margin-left:6px;padding:1px 6px;border-radius:6px}
  .delta.good{color:#8ff0b0;background:rgba(53,196,106,.15)}
  .delta.bad{color:#ff9e8f;background:rgba(255,90,60,.15)}
  .delta.flat{color:var(--muted);background:rgba(154,160,171,.12)}
  .meta-note{margin-top:6px;font-size:.8rem;color:${C_GOAL}}
  footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--border);color:var(--muted);font-size:.82rem;line-height:1.6}
</style>
<div class="wrap">
  <header>
    <div class="eyebrow">COACH · Composición corporal</div>
    <h1>🧬 Composición — ${esc(personas.tu)} & ${esc(personas.ella)}</h1>
    <p>Evolución de las mediciones del InBody, toma a toma (≈1/mes). Lo que importa es la <b>tendencia</b>: grasa bajando mientras el músculo aguanta. Cada punto es una medición; una toma suelta fluctúa con hidratación y hora, así que miramos la línea, no el decimal de un día.</p>
    <div class="legend"><span><i class="dot" style="background:${C_TU}"></i>${esc(personas.tu)}</span><span><i class="dot" style="background:${C_ELLA}"></i>${esc(personas.ella)}</span><span><i class="dash" style="border-top-color:${C_HITO}"></i>hito</span><span><i class="dash"></i>meta</span></div>
  </header>
  ${resumen}
  ${sec('Lo que miramos', clave, C_GOAL)}
  ${sec('Otros / avanzados', otros, '#f5a623')}
  <footer>Fuente: composicion.json · básculas de bioimpedancia (InBody): fiables en tendencia, no al gramo. Para registrar una toma nueva, pásale los datos a COACH tras pesarte y se actualiza este panel.</footer>
</div>`;

fs.mkdirSync(path.join(__dirname, 'registro'), { recursive: true });
const out = path.join(__dirname, 'registro', 'composicion.html');
fs.writeFileSync(out, html);
console.log(`OK -> ${out} (${METRICS.length} métricas, ${Math.round(html.length / 1024)} KB)`);
