/* ============================================================
   aplicar.js — Motor de aplicación de cambios
   Uso: node aplicar.js
   Lee cambios.js, aplica las operaciones y hace backup.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const RECETA = path.join(RAIZ, 'cambios.js');

if (!fs.existsSync(RECETA)) {
  console.error('❌ No existe cambios.js en la raíz del proyecto.');
  process.exit(1);
}

const cambios = require(RECETA);

if (!cambios || !Array.isArray(cambios.operaciones)) {
  console.error('❌ cambios.js no exporta un objeto con "operaciones".');
  process.exit(1);
}

const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP = path.join(RAIZ, `backup_${TS}`);
fs.mkdirSync(BACKUP, { recursive: true });

console.log(`📦 Respaldo en: ${BACKUP}`);
console.log(`📝 ${cambios.descripcion || '(sin descripción)'}\n`);

// 1. Respaldar archivos afectados
const afectados = new Set(cambios.operaciones.map(o => o.archivo));
for (const archivo of afectados) {
  const src = path.join(RAIZ, archivo);
  if (fs.existsSync(src)) {
    const dst = path.join(BACKUP, archivo.replace(/[\/\\]/g, '__'));
    fs.copyFileSync(src, dst);
    console.log(`  💾 respaldado: ${archivo}`);
  }
}
console.log('');

// 2. Aplicar operaciones
let ok = 0, fallos = 0;
for (const op of cambios.operaciones) {
  const archivo = path.join(RAIZ, op.archivo);
  let contenido = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : '';

  try {
    switch (op.tipo) {
      case 'reemplazar': {
        if (!contenido.includes(op.buscar)) {
          console.warn(`  ⚠️  ${op.archivo}: no se encontró el texto a reemplazar`);
          fallos++;
          continue;
        }
        contenido = contenido.split(op.buscar).join(op.reemplazo);
        break;
      }
      case 'agregarAlFinal': {
        contenido += '\n' + op.contenido;
        break;
      }
      case 'agregarDespuesDe': {
        if (!contenido.includes(op.ancla)) {
          console.warn(`  ⚠️  ${op.archivo}: no se encontró el ancla`);
          fallos++;
          continue;
        }
        contenido = contenido.replace(op.ancla, op.ancla + '\n' + op.contenido);
        break;
      }
      case 'sobrescribir': {
        contenido = op.contenido;
        break;
      }
      case 'borrar': {
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
        console.log(`  🗑️  borrado: ${op.archivo}`);
        ok++;
        continue;
      }
      default:
        console.warn(`  ⚠️  tipo desconocido: ${op.tipo}`);
        fallos++;
        continue;
    }
    fs.writeFileSync(archivo, contenido, 'utf8');
    console.log(`  ✅ ${op.tipo} → ${op.archivo}`);
    ok++;
  } catch (e) {
    console.error(`  ❌ ${op.archivo}: ${e.message}`);
    fallos++;
  }
}

console.log(`\n🎉 Resultado: ${ok} operación(es) aplicada(s), ${fallos} fallo(s).`);
console.log(`   Backup en: ${BACKUP}`);
if (fallos > 0) {
  console.log('\n⚠️  Hubo fallos. Revisa el texto "buscar" en cambios.js (debe coincidir EXACTO con el archivo).');
}