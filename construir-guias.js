#!/usr/bin/env node
/*
 * COACH — Construye las guías cortas (guia/<patron>-<entorno>.md) a partir de catalogo.json.
 *
 * Estas guías son un MENÚ RÁPIDO curado por patrón × entorno: al pedir un entreno, COACH lee
 * una guía diminuta y elige 5-7 ejercicios, en vez de sondear los 1.254 del catálogo. NO limitan
 * la variedad: para alternativas o algo fuera de la lista, COACH tira del catalogo.json completo.
 *
 * Se ejecuta una sola vez (o cuando se quiera regenerar): node construir-guias.js
 */

const fs = require('fs');
const path = require('path');
const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogo.json'), 'utf8'));

const EQUIPO = {
  gym: new Set(['barbell', 'dumbbell', 'cable', 'leverage machine', 'smith machine', 'ez barbell', 'olympic barbell', 'trap bar']),
  casa: new Set(['body weight', 'band', 'resistance band', 'dumbbell', 'stability ball']),
  box: new Set(['barbell', 'olympic barbell', 'kettlebell', 'medicine ball', 'rope', 'body weight', 'tire', 'sled machine'])
};

// Patrones: partes del cuerpo + palabras clave de compuestos y de aislamiento/accesorio.
const PATRONES = {
  empuje: {
    titulo: 'Empuje (Pecho / Hombro anterior / Tríceps)',
    parts: ['chest', 'shoulders', 'upper arms'],
    compuesto: ['bench press', 'chest press', 'chest dip', 'incline press', 'overhead press', 'shoulder press', 'military', 'push press', 'floor press', 'push-up', 'z press'],
    aislamiento: ['lateral raise', 'front raise', 'fly', 'pushdown', 'triceps extension', 'skull', 'kickback', 'reverse-grip press']
  },
  tiron: {
    titulo: 'Tirón (Espalda / Bíceps / Romboides)',
    parts: ['back', 'upper arms'],
    compuesto: ['pulldown', 'pull-up', 'pull up', 'chin-up', 'seated row', 'bent over row', 'one arm row', 'pullover', 'face pull', 't-bar', 'high row', 'low row'],
    aislamiento: ['curl', 'shrug', 'reverse fly', 'rear delt', 'rear lateral', 'straight arm']
  },
  pierna: {
    titulo: 'Pierna (Cuádriceps / Isquios / Glúteos / Gemelos)',
    parts: ['upper legs', 'lower legs'],
    compuesto: ['squat', 'deadlift', 'lunge', 'leg press', 'hip thrust', 'step-up', 'split squat', 'romanian', 'good morning', 'bulgarian', 'hack squat'],
    aislamiento: ['leg extension', 'leg curl', 'calf raise', 'hip abduction', 'hip adduction', 'glute', 'seated calf', 'standing calf']
  },
  core: {
    titulo: 'Core (finisher — combinable con cualquier día)',
    parts: ['waist'],
    compuesto: ['hanging', 'ab wheel', 'rollout', 'toes to bar'],
    aislamiento: ['plank', 'crunch', 'sit-up', 'russian twist', 'leg raise', 'woodchop', 'cable crunch', 'dead bug', 'bicycle', 'oblique']
  }
};

const nombre = s => s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1));

// Palabras que indican variantes menos canónicas: se penalizan para que el menú
// muestre primero los movimientos estándar y limpios.
const RUIDO = ['assisted', 'alternate', 'v. 2', 'v. 3', 'with arm blaster', 'kneeling',
  '(support', 'support head', 'guillotine', 'behind head', 'behind neck', 'behind the head',
  'reverse grip', 'reverse-grip', 'prone', 'guillotine', 'skier', 'bradford', 'landmine',
  'one arm', 'single arm', 'crossover', 'cross-over'];

function penalizacion(name) {
  let p = 0;
  for (const r of RUIDO) if (name.includes(r)) p += 1;
  return p;
}

function elegir(pat, equipoSet) {
  const base = catalogo.filter(e => pat.parts.includes(e.body_part) && equipoSet.has(e.equipment));
  const usados = new Set();
  const out = [];

  // Recorre las palabras clave en orden; por cada keyword coge los 2 candidatos más
  // "canónicos" (menor penalización, luego nombre más corto).
  function recolectar(keywords, rol) {
    for (const kw of keywords) {
      const cands = base
        .filter(e => !usados.has(e.id) && e.name.includes(kw))
        .sort((a, b) => penalizacion(a.name) - penalizacion(b.name) || a.name.length - b.name.length);
      for (const e of cands.slice(0, 2)) {
        usados.add(e.id);
        out.push({ id: e.id, name: e.name, rol, equipment: e.equipment });
      }
    }
  }
  recolectar(pat.compuesto, 'compuesto');
  recolectar(pat.aislamiento, 'aislamiento');
  return out;
}

const outDir = path.join(__dirname, 'guia');
fs.mkdirSync(outDir, { recursive: true });

const entornos = { gym: 'Gimnasio con máquinas', casa: 'Casa', box: 'Box de CrossFit' };
let total = 0;

for (const [pkey, pat] of Object.entries(PATRONES)) {
  for (const [ekey, elabel] of Object.entries(entornos)) {
    const lista = elegir(pat, EQUIPO[ekey]);
    if (!lista.length) continue;
    const comp = lista.filter(x => x.rol === 'compuesto');
    const ais = lista.filter(x => x.rol === 'aislamiento');
    let md = `# ${pat.titulo} — ${elabel}\n\n`;
    md += `> Menú curado. Elige 5-7 según tiempo/energía. Para alternativas fuera de esta lista, consulta \`catalogo.json\`.\n\n`;
    if (comp.length) {
      md += `## Compuestos (elige 2-3 como base)\n`;
      comp.forEach(x => { md += `- \`${x.id}\` — ${nombre(x.name)}  _(${x.equipment})_\n`; });
      md += `\n`;
    }
    if (ais.length) {
      md += `## Accesorios / aislamiento (elige 2-4)\n`;
      ais.forEach(x => { md += `- \`${x.id}\` — ${nombre(x.name)}  _(${x.equipment})_\n`; });
      md += `\n`;
    }
    const file = path.join(outDir, `${pkey}-${ekey}.md`);
    fs.writeFileSync(file, md);
    total++;
    console.log(`guia/${pkey}-${ekey}.md  (${lista.length} ejercicios)`);
  }
}
console.log(`\n${total} guías generadas.`);
