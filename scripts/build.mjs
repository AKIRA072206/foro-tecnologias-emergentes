import fs from "node:fs";
import path from "node:path";
import { transform, build } from "esbuild";
import ejs from "ejs";

const root = process.cwd();
const errores = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

// 1) Sintaxis de todo el backend y la función
const servidor = [
  ...walk(path.join(root, "src")),
  ...walk(path.join(root, "functions")),
  ...walk(path.join(root, "scripts")),
].filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));

let validadas = 0;
for (const file of servidor) {
  try {
    await transform(fs.readFileSync(file, "utf8"), { loader: "js", format: "esm" });
    validadas += 1;
  } catch (error) {
    errores.push(`${path.relative(root, file)}: ${error.message}`);
  }
}
console.log(`[build] sintaxis OK en ${validadas}/${servidor.length} archivos JS`);

// 2) Compilación de todas las vistas EJS
const vistas = walk(path.join(root, "views")).filter((file) => file.endsWith(".ejs"));
let compiladas = 0;
for (const file of vistas) {
  try {
    ejs.compile(fs.readFileSync(file, "utf8"), { filename: file });
    compiladas += 1;
  } catch (error) {
    errores.push(`${path.relative(root, file)}: ${error.message}`);
  }
}
console.log(`[build] vistas EJS compiladas: ${compiladas}/${vistas.length}`);

// 3) Bundle del cliente de Neon Realtime (el navegador no resuelve node_modules)
try {
  const salida = path.join(root, "public", "js", "logistica-live.js");
  await build({
    entryPoints: [path.join(root, "src", "client", "logistica-live.js")],
    outfile: salida,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  const kb = (fs.statSync(salida).size / 1024).toFixed(1);
  console.log(`[build] bundle realtime → public/js/logistica-live.js (${kb} KB)`);
} catch (error) {
  errores.push(`bundle realtime: ${error.message}`);
}

// 4) Activos que las vistas esperan
const requeridos = [
  "public/css/style.css",
  "public/css/certificado.css",
  "public/js/app.js",
  "public/js/certificado.js",
  "public/js/logistica-live.js",
  "public/img/logo-foro-cert.png",
  "public/img/plantilla-certificado.png",
];
for (const activo of requeridos) {
  if (!fs.existsSync(path.join(root, activo))) errores.push(`falta activo: ${activo}`);
}
console.log(`[build] activos verificados: ${requeridos.length}`);

if (errores.length) {
  console.error("\n[build] FALLÓ:");
  for (const error of errores) console.error(" -", error);
  process.exit(1);
}

console.log("[build] OK");
