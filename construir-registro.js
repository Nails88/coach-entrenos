#!/usr/bin/env node
/*
 * construir-registro.js — Panel de progreso de pesos (con GIF + gráfica por ejercicio).
 *
 * Lee pesos.json + catalogo.json y genera registro/panel.html: histórico de pesos
 * de Noel y Vicky por ejercicio, con el GIF del ejercicio (incrustado como data URI)
 * y una gráfica SVG de evolución (línea de cada uno = peso de la serie más pesada por
 * día). Content-only (style + body) y autocontenido para publicar como Artifact.
 *
 * Uso: node construir-registro.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAW = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pesos.json'), 'utf8'));
const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogo.json'), 'utf8'));
const byId = new Map(catalogo.map(e => [e.id, e]));
const personas = d.personas || { tu: 'Tú', ella: 'Ella' };

const C_TU = '#4aa3ff';    // color línea Noel
const C_ELLA = '#ff8fab';  // color línea Vicky

const META = {
  '0577': ['Press de pecho en máquina', 'Empuje'], '0314': ['Press inclinado con mancuernas', 'Empuje'],
  '0426': ['Press de hombro con mancuernas', 'Empuje'], '0334': ['Elevaciones laterales', 'Empuje'],
  '0194': ['Extensión de tríceps (sobre la cabeza)', 'Empuje'], '0596': ['Pec deck (contractor de pecho)', 'Empuje'],
  '0198': ['Jalón vertical (Vertical Traction)', 'Tirón'], '0861': ['Remo sentado en polea', 'Tirón'],
  '0602': ['Reverse fly (pájaros)', 'Tirón'], '0868': ['Curl en polea', 'Tirón'], '0313': ['Curl martillo con mancuernas', 'Tirón'],
  '0043': ['Back squat (barra libre)', 'Pierna'], '0085': ['Peso muerto rumano', 'Pierna'], '0739': ['Prensa 45°', 'Pierna'],
  '0585': ['Extensión de cuádriceps', 'Pierna'], '0586': ['Curl femoral', 'Pierna'], '0605': ['Gemelo de pie', 'Pierna']
};
const GRUPOS = ['Empuje', 'Tirón', 'Pierna', 'Otros'];
const ACENTO = { 'Empuje': '#ff5a3c', 'Tirón': '#3ca8ff', 'Pierna': '#35c46a', 'Otros': '#f5a623' };

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fechaCorta = f => { const [, m, dd] = String(f).split('-'); return `${dd}/${m}`; };
const nums = s => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
const maxOf = s => { const a = nums(s); return a.length ? Math.max(...a) : null; };

const gifCache = {};
function gifDataURI(id) {
  const ex = byId.get(id);
  if (!ex || !ex.gif) return null;
  if (gifCache[id]) return gifCache[id];
  try {
    const buf = execSync(`curl -sL --max-time 60 "${RAW}${ex.gif}"`, { maxBuffer: 64 * 1024 * 1024 });
    if (!buf.length) return null;
    return (gifCache[id] = `data:image/gif;base64,${buf.toString('base64')}`);
  } catch { return null; }
}

// Gráfica SVG de evolución (peso máximo por día) para Noel y Vicky.
function chartSVG(entradas) {
  const pts = entradas.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const tu = pts.map(e => maxOf(e.tu));
  const ella = pts.map(e => maxOf(e.ella));
  const all = [...tu, ...ella].filter(v => v != null);
  if (!all.length) return '';
  const W = 320, H = 148, padL = 30, padR = 8, padT = 12, padB = 22;
  const n = pts.length;
  const xOf = i => padL + (n <= 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
  let mn = Math.min(...all), mx = Math.max(...all);
  if (mn === mx) { mn -= 1; mx += 1; }
  const yOf = v => padT + (H - padT - padB) * (1 - (v - mn) / (mx - mn));

  const gridY = [mn, (mn + mx) / 2, mx];
  const grid = gridY.map(v => {
    const y = yOf(v).toFixed(1);
    const lbl = Number.isInteger(v) ? v : v.toFixed(1);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2a2e37" stroke-width="1"/>` +
           `<text x="${padL - 4}" y="${(+y + 3).toFixed(1)}" text-anchor="end" fill="#9aa0ab" font-size="8">${lbl}</text>`;
  }).join('');

  const xlabels = pts.map((e, i) => {
    if (n > 5 && i % Math.ceil(n / 5) !== 0 && i !== n - 1) return '';
    return `<text x="${xOf(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="#9aa0ab" font-size="8">${esc(fechaCorta(e.fecha))}</text>`;
  }).join('');

  function serie(vals, color) {
    const P = vals.map((v, i) => v == null ? null : [xOf(i), yOf(v)]).filter(Boolean);
    if (!P.length) return '';
    const line = P.length > 1 ? `<polyline points="${P.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>` : '';
    const dots = P.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.8" fill="${color}"/>`).join('');
    return line + dots;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evolución de peso" style="max-width:340px">
    ${grid}${xlabels}
    ${serie(ella, C_ELLA)}${serie(tu, C_TU)}
  </svg>`;
}

const porGrupo = {};
for (const [id, entradas] of Object.entries(d.registro || {})) {
  if (!entradas || !entradas.length) continue;
  const [nombre, grupo] = META[id] || [`Ejercicio ${id}`, 'Otros'];
  (porGrupo[grupo] = porGrupo[grupo] || []).push({ id, nombre, entradas });
}

function renderEjercicio(ej, acento) {
  const gif = gifDataURI(ej.id);
  if (gif) process.stderr.write(`  gif ${ej.id}\n`);
  const img = gif ? `<img src="${gif}" alt="${esc(ej.nombre)}">` : `<div class="noimg">sin gif</div>`;
  const ent = ej.entradas.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const ult = ent[ent.length - 1];
  const filas = ent.map((e, i) => `<tr class="${i === ent.length - 1 ? 'ult' : ''}">
      <td class="f">${esc(fechaCorta(e.fecha))}</td><td>${esc(e.tu || '—')}</td><td>${esc(e.ella || '—')}</td></tr>`).join('');
  return `<div class="ej" style="--ac:${acento}">
    <div class="ej-head">${img}<h3>${esc(ej.nombre)}</h3></div>
    <div class="chart">${chartSVG(ej.entradas)}</div>
    <table>
      <thead><tr><th class="f">Fecha</th><th>${esc(personas.tu)}</th><th>${esc(personas.ella)}</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
}

let secciones = '';
for (const g of GRUPOS) {
  const lista = porGrupo[g];
  if (!lista || !lista.length) continue;
  secciones += `<div class="grupo"><h2 style="color:${ACENTO[g]}">${esc(g)}</h2>\n${lista.map(ej => renderEjercicio(ej, ACENTO[g])).join('\n')}</div>\n`;
}
const nEj = Object.values(porGrupo).reduce((n, l) => n + l.length, 0);

const html = `<style>
  :root{--bg:#0f1115;--card:#1a1d24;--text:#f2f2f2;--muted:#9aa0ab;--border:#2a2e37}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);padding:24px 16px 60px}
  .wrap{max-width:760px;margin:0 auto}
  .eyebrow{color:#35c46a;font-weight:700;letter-spacing:.08em;font-size:.8rem;text-transform:uppercase}
  h1{margin:6px 0 4px;font-size:1.6rem}
  header p{color:var(--muted);margin:0 0 6px;line-height:1.5;font-size:.9rem}
  .legend{display:flex;gap:16px;align-items:center;margin-top:8px;font-size:.85rem}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
  .grupo{margin-top:28px}
  .grupo>h2{font-size:1.15rem;margin:0 0 12px;border-bottom:2px solid currentColor;display:inline-block;padding-bottom:3px}
  .ej{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--ac);border-radius:12px;padding:14px 16px;margin-bottom:16px}
  .ej-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .ej-head img{width:64px;height:64px;object-fit:cover;border-radius:8px;background:#000;flex:none}
  .ej-head .noimg{width:64px;height:64px;border-radius:8px;background:#000;color:var(--muted);font-size:.6rem;display:flex;align-items:center;justify-content:center;flex:none}
  .ej h3{margin:0;font-size:1.02rem}
  .chart{margin:2px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)}
  th{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.03em}
  td.f,th.f{color:var(--muted);white-space:nowrap;width:52px}
  tbody tr:last-child td{border-bottom:none}
  tr.ult td{color:var(--text);font-weight:700;background:color-mix(in srgb,var(--ac) 12%,transparent)}
  tr.ult td.f{color:var(--ac)}
  footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--border);color:var(--muted);font-size:.82rem;line-height:1.6}
</style>
<div class="wrap">
  <header>
    <div class="eyebrow">COACH · Registro de pesos</div>
    <h1>📊 Progreso — ${esc(personas.tu)} & ${esc(personas.ella)}</h1>
    <p>Evolución de cargas por ejercicio. La gráfica muestra el peso de la <b>serie más pesada</b> de cada día; la tabla, todas las series. Fila resaltada = última vez.</p>
    <div class="legend"><span><i class="dot" style="background:${C_TU}"></i>${esc(personas.tu)}</span><span><i class="dot" style="background:${C_ELLA}"></i>${esc(personas.ella)}</span></div>
  </header>
  ${secciones}
  <footer>${nEj} ejercicios con historial · fuente: pesos.json. Solo lectura; para registrar pesos nuevos, díselos a COACH tras entrenar y se actualiza este panel.</footer>
</div>`;

fs.mkdirSync(path.join(__dirname, 'registro'), { recursive: true });
const out = path.join(__dirname, 'registro', 'panel.html');
fs.writeFileSync(out, html);
console.log(`OK -> ${out} (${nEj} ejercicios, ${Math.round(html.length / 1024)} KB)`);
