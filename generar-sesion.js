#!/usr/bin/env node
/*
 * COACH — Generador de página de sesión.
 *
 * Uso:  node generar-sesion.js sessions/<fecha>/sesion.json
 *
 * Lee un fichero de especificación (sesion.json) + el catalogo.json, y escribe
 * sessions/<fecha>/index.html con una tarjeta por ejercicio (GIF remoto, músculos,
 * series/reps/descanso, instrucción). El modelo (COACH) solo decide el contenido de
 * sesion.json; toda la mecánica (buscar datos, montar HTML, URLs de GIF) la hace este script.
 *
 * Esquema de sesion.json:
 * {
 *   "fecha": "2026-07-23",
 *   "patron": "Tirón — Espalda / Bíceps / Romboides",
 *   "entorno": "Gimnasio con máquinas",
 *   "tiempo": "60 min",
 *   "energia": "Alta",
 *   "objetivo": "Definición / pérdida de grasa",
 *   "acento": "#3ca8ff",              // opcional (color de acento)
 *   "intro": "Texto de justificación del split del día...",
 *   "calentamiento": "Texto del calentamiento...",
 *   "bloques": [
 *     { "titulo": "💪 Bloque principal", "ejercicios": [
 *         { "id": "2330", "series": "4", "reps": "10-12", "descanso": "75s",
 *           "nota": "Nota técnica clave...", "instruccion": "override opcional" }
 *     ]},
 *     { "titulo": "⚡ Finisher", "ejercicios": [ ... ] }
 *   ],
 *   "vuelta_calma": "Texto de vuelta a la calma...",
 *   "cierre": "Nota de cierre motivadora..."
 * }
 */

const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

// --- Traducción de músculos EN -> ES (para las etiquetas de cada tarjeta) ---
const MUS_ES = {
  'abdominals': 'Abdominales', 'lower abs': 'Abdomen bajo', 'ankle stabilizers': 'Estabilizadores de tobillo',
  'ankles': 'Tobillos', 'back': 'Espalda', 'biceps': 'Bíceps', 'brachialis': 'Braquial',
  'calves': 'Gemelos', 'chest': 'Pecho', 'upper chest': 'Pecho superior', 'core': 'Core',
  'deltoids': 'Deltoides', 'rear deltoids': 'Deltoides posterior', 'feet': 'Pies',
  'forearms': 'Antebrazos', 'glutes': 'Glúteos', 'grip muscles': 'Agarre', 'groin': 'Aductores',
  'hamstrings': 'Isquiotibiales', 'hands': 'Manos', 'hip flexors': 'Flexores de cadera',
  'inner thighs': 'Aductores', 'latissimus dorsi': 'Dorsales', 'lats': 'Dorsales',
  'lower back': 'Lumbar', 'obliques': 'Oblicuos', 'quadriceps': 'Cuádriceps',
  'rhomboids': 'Romboides', 'rotator cuff': 'Manguito rotador', 'shins': 'Tibial',
  'shoulders': 'Hombros', 'soleus': 'Sóleo', 'sternocleidomastoid': 'Cuello',
  'trapezius': 'Trapecios', 'traps': 'Trapecios', 'triceps': 'Tríceps',
  'upper back': 'Espalda alta', 'wrist extensors': 'Extensores de muñeca',
  'wrist flexors': 'Flexores de muñeca', 'wrists': 'Muñecas'
};

function musEs(m) {
  if (!m) return null;
  return MUS_ES[m.toLowerCase()] || (m.charAt(0).toUpperCase() + m.slice(1));
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function titleCase(s) {
  return String(s || '').replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1));
}

// --- Argumentos ---
const specPath = process.argv[2];
if (!specPath) {
  console.error('Uso: node generar-sesion.js sessions/<fecha>/sesion.json');
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const root = __dirname;
const catalogo = JSON.parse(fs.readFileSync(path.join(root, 'catalogo.json'), 'utf8'));
const byId = new Map(catalogo.map(e => [e.id, e]));

const fecha = spec.fecha;
if (!fecha) { console.error('Falta "fecha" en la especificación.'); process.exit(1); }
const acento = spec.acento || '#3ca8ff';

// --- Render de una tarjeta de ejercicio ---
function renderCard(ej) {
  const ex = byId.get(ej.id);
  if (!ex) {
    console.error('AVISO: id no encontrado en catalogo.json:', ej.id);
    return `<div class="card"><div class="card-body"><h3>[id ${esc(ej.id)} no encontrado]</h3></div></div>`;
  }
  // Etiquetas de músculo: si la spec trae "musculos", se usan tal cual (override).
  // Si no, se derivan del catálogo (principal + secundarios) traducidas al español.
  const musculos = [];
  const push = m => { const t = musEs(m); if (t && !musculos.includes(t)) musculos.push(t); };
  if (Array.isArray(ej.musculos) && ej.musculos.length) {
    ej.musculos.forEach(m => { if (!musculos.includes(m)) musculos.push(m); });
  } else {
    push(ex.muscle);
    (ex.secondary || []).forEach(push);
  }
  const tags = musculos.slice(0, 4).map(m => `<span>${esc(m)}</span>`).join('');

  const gif = RAW_BASE + ex.gif;
  const instruccion = ej.instruccion || (ex.pasos_es || []).join(' ');

  // Prescripción: soporta reps o tiempo
  const medida = ej.reps ? { v: ej.reps, l: 'Reps' } : (ej.tiempo ? { v: ej.tiempo, l: 'Tiempo' } : { v: '—', l: 'Reps' });
  const presc = `
        <div class="prescription">
          <div><b>${esc(ej.series || '—')}</b><span>Series</span></div>
          <div><b>${esc(medida.v)}</b><span>${esc(medida.l)}</span></div>
          <div><b>${esc(ej.descanso || '—')}</b><span>Descanso</span></div>
        </div>`;

  const nota = ej.nota ? `<p class="note">Nota técnica: ${esc(ej.nota)}</p>` : '';

  // Nombre: si la spec trae "nombre", se usa tal cual (override, p. ej. cardio con GIF prestado).
  const nombre = ej.nombre ? ej.nombre : titleCase(ex.name);

  return `
  <div class="card">
    <img src="${esc(gif)}" alt="${esc(nombre)}" loading="lazy">
    <div class="card-body">
      <h3>${esc(nombre)}</h3>
      <div class="muscles">${tags}</div>${presc}
      <p class="instructions">${esc(instruccion)}</p>
      ${nota}
    </div>
  </div>`;
}

function renderBloque(b) {
  const cards = (b.ejercicios || []).map(renderCard).join('\n');
  return `  <div class="block-title">${esc(b.titulo || 'Bloque')}</div>\n${cards}`;
}

const bloquesHtml = (spec.bloques || []).map(renderBloque).join('\n\n');

const calentamiento = spec.calentamiento
  ? `  <div class="block-title">🔥 Calentamiento</div>
  <p class="prose">${esc(spec.calentamiento)}</p>\n`
  : '';

const vuelta = spec.vuelta_calma
  ? `  <div class="block-title">🧘 Vuelta a la calma</div>
  <p class="prose">${esc(spec.vuelta_calma)}</p>\n`
  : '';

const cierre = spec.cierre
  ? `  <footer><b>Nota de coach:</b> ${esc(spec.cierre)}</footer>\n`
  : '';

const metaPills = [
  spec.entorno ? `<div class="pill">Entorno: <b>${esc(spec.entorno)}</b></div>` : '',
  spec.tiempo ? `<div class="pill">Tiempo: <b>${esc(spec.tiempo)}</b></div>` : '',
  spec.energia ? `<div class="pill">Energía: <b>${esc(spec.energia)}</b></div>` : '',
  spec.objetivo ? `<div class="pill">Objetivo: <b>${esc(spec.objetivo)}</b></div>` : ''
].filter(Boolean).join('\n      ');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>COACH — ${esc(spec.patron || 'Sesión')} · ${esc(fecha)}</title>
<style>
  :root {
    --bg: #0f1115;
    --card-bg: #1a1d24;
    --accent: ${esc(acento)};
    --text: #f2f2f2;
    --muted: #9aa0ab;
    --border: #2a2e37;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px 16px 60px;
  }
  .wrap { max-width: 880px; margin: 0 auto; }
  header { margin-bottom: 28px; }
  header .eyebrow {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    text-transform: uppercase;
  }
  header h1 { margin: 6px 0 8px; font-size: 1.8rem; }
  header p { color: var(--muted); margin: 0; line-height: 1.5; }
  .meta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  .pill {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .pill b { color: var(--text); }
  .prose { color: var(--muted); line-height: 1.6; margin-top: -6px; }
  .block-title {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 32px 0 14px;
    color: var(--accent);
  }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 18px;
  }
  .card img {
    width: 160px;
    height: 160px;
    object-fit: cover;
    border-radius: 10px;
    background: #000;
  }
  .card-body h3 { margin: 0 0 4px; font-size: 1.1rem; }
  .muscles { font-size: 0.8rem; color: var(--muted); margin-bottom: 10px; }
  .muscles span {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    padding: 2px 8px;
    border-radius: 6px;
    margin-right: 6px;
    display: inline-block;
  }
  .prescription { display: flex; gap: 18px; margin-bottom: 10px; font-size: 0.9rem; }
  .prescription div b { display: block; font-size: 1.05rem; }
  .prescription div span { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; }
  .instructions { font-size: 0.85rem; color: var(--muted); line-height: 1.5; margin: 0; }
  .note { font-size: 0.8rem; color: var(--accent); margin-top: 6px; }
  footer {
    margin-top: 36px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.6;
  }
  @media (max-width: 560px) {
    .card { grid-template-columns: 1fr; }
    .card img { width: 100%; height: auto; max-height: 260px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">COACH · Sesión de hoy</div>
    <h1>${esc(spec.patron || 'Sesión')}</h1>
    ${spec.intro ? `<p>${esc(spec.intro)}</p>` : ''}
    <div class="meta-row">
      ${metaPills}
    </div>
  </header>

${calentamiento}
${bloquesHtml}

${vuelta}
${cierre}</div>
</body>
</html>
`;

const outDir = path.join(root, 'sessions', fecha);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'index.html');
fs.writeFileSync(outPath, html);

const nEj = (spec.bloques || []).reduce((n, b) => n + (b.ejercicios || []).length, 0);
console.log(`OK -> sessions/${fecha}/index.html (${nEj} ejercicios, GIFs remotos)`);
