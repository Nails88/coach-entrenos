#!/usr/bin/env node
/*
 * construir-artifact.js — versión autocontenida de una sesión para publicar como Artifact.
 *
 * Los Artifacts de claude.ai se sirven bajo un CSP que BLOQUEA recursos externos
 * (imágenes remotas incluidas). Los GIFs de las sesiones son remotos
 * (raw.githubusercontent.com), así que aquí los descargamos y los incrustamos como
 * data: URI dentro del propio HTML. El resultado no depende de internet y se ve
 * completo en el visor de Artifacts.
 *
 * Además, el fichero de salida NO lleva <!doctype>/<html>/<head>/<body>: la
 * publicación del Artifact envuelve el contenido en su propio esqueleto, así que
 * solo emitimos el <style> + el contenido del <body>.
 *
 * Uso:
 *   node construir-artifact.js sessions/<fecha>/index.html
 *   node construir-artifact.js sessions/<fecha>            (busca index.html dentro)
 *
 * Escribe sessions/<fecha>/artifact.html (mismo directorio que el index.html).
 * Después: publica ese artifact.html con la herramienta Artifact y entrega la URL
 * al usuario dentro de un bloque de código (para que la app muestre botón de copiar).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function resolveInput(arg) {
  if (!arg) throw new Error('Falta la ruta: node construir-artifact.js sessions/<fecha>/index.html');
  const stat = fs.existsSync(arg) ? fs.statSync(arg) : null;
  if (stat && stat.isDirectory()) return path.join(arg, 'index.html');
  return arg;
}

const input = resolveInput(process.argv[2]);
if (!fs.existsSync(input)) throw new Error('No existe: ' + input);

let html = fs.readFileSync(input, 'utf8');

const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
if (!styleMatch || !bodyMatch) {
  throw new Error('El HTML no tiene el <style>/<body> esperado (¿lo generó generar-sesion.js?).');
}

let out = styleMatch[0] + '\n' + bodyMatch[1];

// Descargar cada GIF remoto y sustituirlo por su data: URI.
const urls = [...new Set(html.match(/https:\/\/raw\.githubusercontent\.com[^"']+/g) || [])];
for (const url of urls) {
  const buf = execSync(`curl -sL --max-time 60 "${url}"`, { maxBuffer: 64 * 1024 * 1024 });
  if (!buf.length) throw new Error('GIF vacío o inaccesible: ' + url);
  const dataURI = `data:image/gif;base64,${buf.toString('base64')}`;
  out = out.split(url).join(dataURI);
  process.stderr.write(`  incrustado ${path.basename(url)} (${Math.round(buf.length / 1024)} KB)\n`);
}

const leftover = (out.match(/https?:\/\/[^"')\s]+/g) || []).filter(u => !u.startsWith('data:'));
if (leftover.length) {
  process.stderr.write('  AVISO: quedan referencias externas (se verían rotas en el Artifact):\n');
  leftover.forEach(u => process.stderr.write('   - ' + u + '\n'));
}

const outPath = path.join(path.dirname(input), 'artifact.html');
fs.writeFileSync(outPath, out);
console.log(`OK -> ${outPath} (${Math.round(out.length / 1024)} KB, ${urls.length} GIFs incrustados)`);
