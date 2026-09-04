#!/usr/bin/env node
/*
 * construir-registro.js — Panel de progreso de pesos.
 *
 * Lee pesos.json y genera registro/panel.html: una página con el histórico de
 * pesos de Noel y Vicky por ejercicio y fecha. Content-only (style + body, sin
 * <html>/<head>/<body>) para publicar como Artifact autocontenido. Sin recursos
 * externos.
 *
 * Uso: node construir-registro.js   (luego publicar registro/panel.html como Artifact)
 */
const fs = require('fs');
const path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pesos.json'), 'utf8'));
const personas = d.personas || { tu: 'Tú', ella: 'Ella' };

// Nombres amables + grupo por ejercicio (fallback: id crudo).
const META = {
  '0577': ['Press de pecho en máquina', 'Empuje'],
  '0314': ['Press inclinado con mancuernas', 'Empuje'],
  '0426': ['Press de hombro con mancuernas', 'Empuje'],
  '0334': ['Elevaciones laterales', 'Empuje'],
  '0194': ['Extensión de tríceps (sobre la cabeza)', 'Empuje'],
  '0596': ['Pec deck (contractor de pecho)', 'Empuje'],
  '0198': ['Jalón vertical (Vertical Traction)', 'Tirón'],
  '0861': ['Remo sentado en polea', 'Tirón'],
  '0602': ['Reverse fly (pájaros)', 'Tirón'],
  '0868': ['Curl en polea', 'Tirón'],
  '0313': ['Curl martillo con mancuernas', 'Tirón'],
  '0043': ['Back squat (barra libre)', 'Pierna'],
  '0085': ['Peso muerto rumano', 'Pierna'],
  '0739': ['Prensa 45°', 'Pierna'],
  '0585': ['Extensión de cuádriceps', 'Pierna'],
  '0586': ['Curl femoral', 'Pierna'],
  '0605': ['Gemelo de pie', 'Pierna']
};
const GRUPOS = ['Empuje', 'Tirón', 'Pierna', 'Otros'];
const ACENTO = { 'Empuje': '#ff5a3c', 'Tirón': '#3ca8ff', 'Pierna': '#35c46a', 'Otros': '#f5a623' };

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fechaCorta(f) { const [y, m, dd] = String(f).split('-'); return `${dd}/${m}`; }

// Agrupa ejercicios del registro por grupo muscular.
const porGrupo = {};
for (const [id, entradas] of Object.entries(d.registro || {})) {
  if (!entradas || !entradas.length) continue;
  const [nombre, grupo] = META[id] || [`Ejercicio ${id}`, 'Otros'];
  (porGrupo[grupo] = porGrupo[grupo] || []).push({ id, nombre, entradas });
}

function renderEjercicio(ej, acento) {
  // entradas ordenadas por fecha ascendente; la última destacada
  const filas = ej.entradas
    .slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .map((e, i, arr) => {
      const ultima = i === arr.length - 1;
      return `<tr class="${ultima ? 'ult' : ''}">
        <td class="f">${esc(fechaCorta(e.fecha))}</td>
        <td>${esc(e.tu || '—')}</td>
        <td>${esc(e.ella || '—')}</td>
      </tr>`;
    }).join('');
  return `<div class="ej" style="--ac:${acento}">
    <h3>${esc(ej.nombre)}</h3>
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
  const cards = lista.map(ej => renderEjercicio(ej, ACENTO[g])).join('\n');
  secciones += `<div class="grupo"><h2 style="color:${ACENTO[g]}">${esc(g)}</h2>\n${cards}</div>\n`;
}

const nEj = Object.values(porGrupo).reduce((n, l) => n + l.length, 0);

const html = `<style>
  :root{--bg:#0f1115;--card:#1a1d24;--text:#f2f2f2;--muted:#9aa0ab;--border:#2a2e37}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);padding:24px 16px 60px}
  .wrap{max-width:760px;margin:0 auto}
  header{margin-bottom:20px}
  .eyebrow{color:#35c46a;font-weight:700;letter-spacing:.08em;font-size:.8rem;text-transform:uppercase}
  h1{margin:6px 0 4px;font-size:1.6rem}
  header p{color:var(--muted);margin:0;line-height:1.5;font-size:.9rem}
  .grupo{margin-top:28px}
  .grupo>h2{font-size:1.15rem;margin:0 0 12px;border-bottom:2px solid currentColor;display:inline-block;padding-bottom:3px}
  .ej{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--ac);border-radius:12px;padding:14px 16px;margin-bottom:14px}
  .ej h3{margin:0 0 10px;font-size:1.02rem}
  table{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)}
  th{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.03em}
  td.f,th.f{color:var(--muted);white-space:nowrap;width:56px}
  tbody tr:last-child td{border-bottom:none}
  tr.ult td{color:var(--text);font-weight:700;background:color-mix(in srgb,var(--ac) 12%,transparent)}
  tr.ult td.f{color:var(--ac)}
  footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--border);color:var(--muted);font-size:.82rem;line-height:1.6}
</style>
<div class="wrap">
  <header>
    <div class="eyebrow">COACH · Registro de pesos</div>
    <h1>📊 Progreso — ${esc(personas.tu)} & ${esc(personas.ella)}</h1>
    <p>Histórico de cargas por ejercicio y fecha. La fila resaltada es la última vez. Los pesos de cada serie van separados por "/". Se actualiza cada vez que reportáis los pesos tras entrenar.</p>
  </header>
  ${secciones}
  <footer>${nEj} ejercicios con historial · fuente: pesos.json del repo. Este panel es solo de lectura; para registrar nuevos pesos, díselos a COACH tras entrenar.</footer>
</div>`;

fs.mkdirSync(path.join(__dirname, 'registro'), { recursive: true });
const out = path.join(__dirname, 'registro', 'panel.html');
fs.writeFileSync(out, html);
console.log(`OK -> ${out} (${nEj} ejercicios, ${Math.round(html.length / 1024)} KB)`);
