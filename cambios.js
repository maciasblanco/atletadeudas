/* ============================================================
   cambios.js — Sobrescribir CSS y HTML (Menú y Formulario)
   ============================================================ */

module.exports = {
  descripcion: 'Corregir menu responsive y poner formulario antes de la lista usando sobrescribir',
  operaciones: [
    // 1. Sobrescribir styles.css para arreglar las pestañas
    {
      tipo: 'sobrescribir',
      archivo: 'styles.css',
      contenido: `/* ============================================================
   styles.css — AtletaDeudas (Optimizado)
   ============================================================ */

:root {
  --bg: #0b1020;
  --bg-card: #111a2e;
  --border: #1e2a45;
  --text: #e6edf7;
  --muted: #9aa7c7;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --secondary: #1e2a45;
  --secondary-hover: #2a3a5c;
  --ok: #10b981;
  --warn: #f59e0b;
  --err: #ef4444;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
  background-color: var(--bg);
  color: var(--text);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
}

/* --- Contenedores y Tarjetas --- */
.view {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

#view-login .card {
  max-width: 450px;
  margin: 40px auto;
}

/* --- Tipografía --- */
h1, h2, h3, h4 {
  color: #fff;
  margin-bottom: 10px;
}

h1 { font-size: 24px; }
h2 { font-size: 20px; }
h3 { font-size: 18px; margin-top: 10px; }
h4 { font-size: 14px; text-transform: uppercase; color: var(--muted); margin-top: 20px; margin-bottom: 10px; }

p { margin-bottom: 10px; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.center { text-align: center; }

/* --- Formularios --- */
label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 6px;
  margin-top: 16px;
  text-transform: uppercase;
}

input, select, textarea {
  width: 100%;
  padding: 12px;
  background: #0a1220;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

input:focus, select:focus {
  border-color: var(--primary);
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* --- Botones --- */
button {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

button:active {
  transform: scale(0.98);
}

button.primary {
  background: var(--primary);
  color: #fff;
}
button.primary:hover { background: var(--primary-hover); }

button.secondary {
  background: var(--secondary);
  color: var(--text);
  border: 1px solid var(--border);
}
button.secondary:hover { background: var(--secondary-hover); }

button.small { padding: 8px 12px; font-size: 12px; }

button.ok { background: var(--ok); color: #fff; }
button.err { background: var(--err); color: #fff; }

/* --- Botones de ancho completo --- */
#login-atleta-form .primary, 
#login-admin-form .primary,
#btn-sync-login,
#btn-reportar-aporte,
#btn-guardar-config {
  width: 100%;
  margin-top: 20px;
}

/* --- Ojos de contraseña (pass-wrap) --- */
.pass-wrap {
  position: relative;
  width: 100%;
}

.pass-wrap input {
  padding-right: 45px;
}

.pass-wrap .btn-eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 20px;
  padding: 5px;
  width: auto;
  margin: 0;
  box-shadow: none;
}

.pass-wrap .btn-eye:hover {
  color: #fff;
  background: transparent;
}

/* --- Pestañas (Tabs) --- */
.tabs {
  display: flex;
  flex-wrap: wrap; /* Permite que los botones bajen de línea en el celular */
  gap: 8px;
  margin-bottom: 20px;
}

.tabs button {
  flex: 1 1 auto;
  min-width: 100px;
  background: #0a1220;
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 10px 14px;
}

.tabs button.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

/* --- Tablas --- */
.tabla-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 10px;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 600;
}

tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

/* --- Badges (Etiquetas de estado) --- */
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
}

.badge.ok { background: rgba(16, 185, 129, 0.2); color: var(--ok); }
.badge.warn { background: rgba(245, 158, 11, 0.2); color: var(--warn); }
.badge.err { background: rgba(239, 68, 68, 0.2); color: var(--err); }

/* --- Filas especiales --- */
.fila-no-practica {
  background: rgba(239, 68, 68, 0.1) !important;
}

/* --- Utilidades --- */
.hidden { display: none !important; }
.mt-1 { margin-top: 10px; }
.mt-2 { margin-top: 20px; }
.row { display: flex; align-items: center; }
.gap { gap: 10px; }
.space-between { justify-content: space-between; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

@media (max-width: 600px) {
  .grid-2 { grid-template-columns: 1fr; }
  .card { padding: 16px; }
}

/* --- Mensajes de alerta --- */
.msg {
  display: none;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 15px;
}

.msg.show { display: block; }
.msg.ok { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid var(--ok); }
.msg.err { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid var(--err); }
.msg.info { background: rgba(37, 99, 235, 0.15); color: #93c5fd; border: 1px solid var(--primary); }

/* --- Aviso de pendientes --- */
.aviso-pendiente {
  margin-top: 15px;
  padding: 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid var(--warn);
  border-radius: 8px;
  font-size: 13px;
  color: #fcd34d;
}

/* ============================================================
   Botón circular "Actualizar sistema" (⟳)
   ============================================================ */
.btn-sync-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--secondary);
  border: 1px solid var(--border);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0 auto;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
}

.btn-sync-circle:hover {
  background: var(--secondary-hover);
}

.btn-sync-circle:active {
  transform: scale(0.94);
}

.btn-sync-circle .sync-icon {
  font-size: 26px;
  line-height: 1;
  display: inline-block;
  transition: transform 0.3s;
}

/* Animación de giro mientras sincroniza */
.btn-sync-circle.syncing .sync-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}


/* ============================================================
   Ajuste visual del botón circular "Actualizar sistema"
   - Fondo verde claro
   - Ícono (flecha) azul oscuro
   ============================================================ */
.btn-sync-circle {
  background: #86efac !important;      /* verde claro */
  color: #0b1e4a !important;           /* azul oscuro */
  border: 1px solid #4ade80 !important;
}

.btn-sync-circle:hover {
  background: #4ade80 !important;      /* verde un poco más intenso al pasar el mouse */
}

.btn-sync-circle .sync-icon {
  color: #0b1e4a !important;           /* flecha azul oscuro */
}
`
    },
    // 2. Sobrescribir index.html para mantener el formulario arriba y la lista abajo
    {
      tipo: 'sobrescribir',
      archivo: 'index.html',
      contenido: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AtletaDeudas — Club Aves Voladoras</title>
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="styles.css">
  <meta name="theme-color" content="#0b1020">
</head>
<body>

  <!-- ================= VISTA: CARGANDO ================= -->
  <div id="view-loading" class="view">
    <div class="card center">
      <h1>AtletaDeudas</h1>
      <p class="muted">Cargando base de datos…</p>
    </div>
  </div>

  <!-- ================= VISTA: LOGIN ================= -->
  <div id="view-login" class="view hidden">
    <div class="card">
      <h1>AtletaDeudas</h1>
      <p class="muted">Club Aves Voladoras</p>

      <label>Cédula</label>
      <input id="login-cedula" type="text" placeholder="V-12345678" autocomplete="username">

      <label>Clave</label>
      <div class="pass-wrap">
        <input id="login-clave" type="password" placeholder="••••••" autocomplete="current-password">
        <button type="button" data-toggle-pass="login-clave" class="btn-eye" aria-label="Mostrar clave">👁</button>
      </div>

      <div class="row gap mt-2">
        <button id="btn-login-atleta" class="primary">Entrar como Atleta</button>
        <button id="btn-login-admin" class="secondary">Entrar como Admin</button>
      </div>

      <div id="login-msg" class="msg"></div>

      <div class="mt-2 center">
        <button id="btn-sync-login" class="btn-sync-circle" title="Actualizar sistema" aria-label="Actualizar sistema">
          <span class="sync-icon">⟳</span>
        </button>
        <div class="muted small mt-1">Actualizar sistema</div>
        <div id="sync-login-msg" class="msg"></div>
      </div>
    </div>
  </div>

  <!-- ================= VISTA: ATLETA ================= -->
  <div id="view-atleta" class="view hidden">
    <div class="card">
      <div class="row space-between">
        <h2 id="atleta-nombre">—</h2>
        <button id="btn-logout-atleta" class="secondary small">Salir</button>
      </div>
      <p class="muted">Cédula: <span id="atleta-cedula">—</span></p>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">Estado</div>
          <div id="atleta-estado" class="stat-val">—</div>
        </div>
        <div class="stat">
          <div class="stat-label">Deuda</div>
          <div id="atleta-deuda-bs" class="stat-val">—</div>
          <div id="atleta-deuda-usd" class="muted small">—</div>
        </div>
      </div>
      <div id="atleta-deuda-detalle" class="muted small"></div>

      <div id="ra-resumen" class="mt-2"></div>

      <div class="mt-2">
        <button id="btn-ver-pagos" class="secondary">Ver historial de pagos</button>
      </div>

      <div id="atleta-pagos-card" class="mt-2 hidden">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Monto</th><th>Ref.</th><th>Quincena</th><th>Estado</th></tr>
          </thead>
          <tbody id="atleta-pagos-tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="card mt-2">
      <h3>Reportar aporte</h3>
      <label>Monto (USD)</label>
      <input id="ra-monto" type="number" step="0.01" placeholder="5.00">
      <label>Método de pago</label>
      <select id="ra-metodo"></select>
      <label>Referencia</label>
      <input id="ra-referencia" type="text" placeholder="Nro. referencia">
      <label>Nota (opcional)</label>
      <input id="ra-nota" type="text" placeholder="Observación">
      <button id="btn-reportar-aporte" class="primary">Enviar aporte</button>
      <div id="ra-msg" class="msg"></div>
    </div>

    <div class="card mt-2 center">
      <button id="btn-sync-atleta" class="btn-sync-circle" title="Actualizar sistema" aria-label="Actualizar sistema">
        <span class="sync-icon">⟳</span>
      </button>
      <div class="muted small mt-1">Actualizar sistema</div>
      <div id="sync-atleta-msg" class="msg"></div>
    </div>
  </div>

  <!-- ================= VISTA: ADMIN ================= -->
  <div id="view-admin" class="view hidden">
    <div class="card">
      <div class="row space-between">
        <h2>Panel Administrador</h2>
        <button id="btn-logout-admin" class="secondary small">Salir</button>
      </div>
      <div id="diag" class="muted small"></div>
    </div>

    <div id="admin-tabs" class="tabs mt-2">
      <button class="active" data-tab="atletas">Atletas</button>
      <button data-tab="pagos">Pagos</button>
      <button data-tab="asistencia">Asistencia</button>
      <button data-tab="config">Configuración</button>
    </div>

    <!-- TAB: ATLETAS -->
    <div id="tab-atletas" class="tab-content">
      
      <!-- FORMULARIO PRIMERO -->
      <div class="card mt-2">
        <h3>Agregar / Editar Atleta</h3>
        <form id="form-atleta">
          <input type="hidden" id="atleta_id">
          <div class="grid-2">
            <div>
              <label>Cédula *</label>
              <input id="identificacion" type="text" required>
            </div>
            <div>
              <label>Fecha de Nacimiento</label>
              <input id="fn" type="date">
            </div>
            <div>
              <label>Primer Nombre *</label>
              <input id="p_nombre" type="text" required>
            </div>
            <div>
              <label>Segundo Nombre</label>
              <input id="s_nombre" type="text">
            </div>
            <div>
              <label>Primer Apellido *</label>
              <input id="p_apellido" type="text" required>
            </div>
            <div>
              <label>Segundo Apellido</label>
              <input id="s_apellido" type="text">
            </div>
            <div>
              <label>Categoría</label>
              <select id="categoria">
                <option value="">— Seleccione —</option>
                <option value="SEMILLAS">SEMILLAS</option>
                <option value="MINI">MINI</option>
                <option value="INFANTIL">INFANTIL</option>
                <option value="PRE-JUVENIL">PRE-JUVENIL</option>
                <option value="JUVENIL">JUVENIL</option>
                <option value="MAYOR">MAYOR</option>
              </select>
            </div>
            <div>
              <label>Escuela</label>
              <input id="escuela" type="text" value="Club Aves Voladoras">
            </div>
            <div>
              <label>Celular</label>
              <input id="cell" type="text">
            </div>
            <div>
              <label>Teléfono Emergencia</label>
              <input id="telf_emergencia1" type="text">
            </div>
            <div>
              <label>Clave Atleta</label>
              <div class="pass-wrap">
                <input id="clave_atleta" type="password">
                <button type="button" data-toggle-pass="clave_atleta" class="btn-eye" aria-label="Mostrar clave">👁</button>
              </div>
            </div>
          </div>

          <h4 class="mt-2">Representante</h4>
          <div class="grid-2">
            <div>
              <label>Cédula Rep. *</label>
              <input id="rep_identificacion" type="text" required>
            </div>
            <div>
              <label>Nombre Rep. *</label>
              <input id="rep_nombre" type="text" required>
            </div>
            <div>
              <label>Apellido Rep. *</label>
              <input id="rep_apellido" type="text" required>
            </div>
            <div>
              <label>Teléfono Rep.</label>
              <input id="rep_telefono" type="text">
            </div>
            <div>
              <label>Email Rep.</label>
              <input id="rep_email" type="email">
            </div>
            <div>
              <label>Parentesco</label>
              <select id="rep_parentesco">
                <option value="">— Seleccione —</option>
                <option value="Madre">Madre</option>
                <option value="Padre">Padre</option>
                <option value="Abuelo/a">Abuelo/a</option>
                <option value="Tío/a">Tío/a</option>
                <option value="Hermano/a">Hermano/a</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          <div class="mt-2 row gap">
            <button type="submit" class="primary">Guardar Atleta</button>
            <button type="button" id="btn-limpiar-atleta" class="secondary">Limpiar</button>
          </div>
          <div id="atleta-form-msg" class="msg"></div>
        </form>
      </div>

      <!-- LISTA DEBAJO -->
      <div class="card mt-2">
        <h3>Listado de Atletas</h3>
        <input id="buscar-atleta" type="text" placeholder="Buscar por cédula, nombre o representante…">
        <div class="tabla-scroll mt-2">
          <table>
            <thead>
              <tr>
                <th>Cédula</th><th>Nombre</th><th>Representante</th><th>Categoría</th><th>Deuda</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody id="atletas-tbody"></tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- TAB: PAGOS -->
    <div id="tab-pagos" class="tab-content hidden">
      <div class="card mt-2">
        <h3>Pagos Pendientes por Verificar</h3>
        <div id="lista-pagos-pendientes"></div>
      </div>

      <div class="card mt-2">
        <h3>Registrar Pago Manual</h3>
        <form id="form-pago">
          <label>Atleta</label>
          <select id="pago_atleta"><option value="">— Seleccione —</option></select>
          <div id="pago-resumen-atleta" class="card mt-1" style="display:none">
            <div id="pago-resumen-texto"></div>
          </div>

          <div class="grid-2 mt-2">
            <div>
              <label>Fecha Pago</label>
              <input id="fecha" type="date">
            </div>
            <div>
              <label>Fecha Quincena</label>
              <input id="fecha_quincena" type="date">
            </div>
            <div>
              <label>Número Quincena</label>
              <input id="numero_quincena" type="text" disabled>
            </div>
            <div>
              <label>Monto (USD)</label>
              <input id="monto" type="number" step="0.01">
            </div>
            <div>
              <label>Monto (Bs)</label>
              <input id="monto_bs" type="number" step="0.01">
            </div>
            <div>
              <label>Tasa</label>
              <input id="tasa" type="number" step="0.01">
            </div>
            <div>
              <label>Método de pago</label>
              <select id="metodo_pago_id"></select>
            </div>
            <div>
              <label>Referencia</label>
              <input id="referencia" type="text">
            </div>
            <div>
              <label>Banco Origen</label>
              <input id="banco_origen" type="text">
            </div>
            <div>
              <label>Teléfono Origen</label>
              <input id="telefono_origen" type="text">
            </div>
            <div>
              <label>Estado</label>
              <select id="estado">
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div>
              <label>Observación</label>
              <input id="observacion" type="text">
            </div>
          </div>
          <div id="pago-cobertura" class="mt-2" style="display:none"></div>

          <div class="mt-2 row gap">
            <button type="submit" class="primary">Registrar Pago</button>
            <button type="button" id="btn-limpiar-pago" class="secondary">Limpiar</button>
          </div>
          <div id="pago-msg" class="msg"></div>
        </form>
      </div>

      <div class="card mt-2">
        <h3>Últimos Pagos</h3>
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Atleta</th><th>Quincena</th><th>Método</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody id="pagos-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB: ASISTENCIA -->
    <div id="tab-asistencia" class="tab-content hidden">
      <div class="card mt-2">
        <h3>Control de Asistencia</h3>
        <p class="muted small">Selecciona la fecha y marca la asistencia de los atletas.</p>
        
        <div class="grid-2 mt-2">
          <div>
            <label>Fecha de la práctica</label>
            <input id="asistencia-fecha" type="date">
          </div>
          <div style="display:flex; align-items:flex-end;">
            <button id="btn-cargar-asistencia" class="secondary" style="width:100%">Cargar / Actualizar</button>
          </div>
        </div>

        <div class="mt-2">
          <input id="buscar-asistencia" type="text" placeholder="Buscar atleta por nombre o cédula…">
        </div>

        <div class="tabla-scroll mt-2" style="max-height: 500px; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Atleta</th>
                <th>Categoría</th>
                <th class="center">Asistencia</th>
              </tr>
            </thead>
            <tbody id="asistencia-tbody"></tbody>
          </table>
        </div>
        <div id="asistencia-msg" class="msg"></div>
      </div>
    </div>

    <!-- TAB: CONFIG -->
    <div id="tab-config" class="tab-content hidden">
      <div class="card mt-2">
        <h3>Configuración General</h3>
        <label>Monto por Quincena (USD)</label>
        <input id="c-monto-quincena" type="number" step="0.01">
        <label>Tasa Dólar</label>
        <input id="c-tasa-dolar" type="number" step="0.01">
        <button id="btn-tasa-bcv" class="secondary mt-2">Actualizar Tasa BCV</button>
        <div id="tasa-bcv-info" class="muted small mt-1"></div>

        <label class="mt-2">Clave Admin</label>
        <div class="pass-wrap">
          <input id="c-clave-admin" type="password">
          <button type="button" data-toggle-pass="c-clave-admin" class="btn-eye">👁</button>
        </div>

        <label>Cédula Admin (opcional)</label>
        <input id="c-cedula-admin" type="text" placeholder="Vacío = solo clave">

        <label>Fecha de Corte Quincena</label>
        <input id="c-fecha-corte" type="date">

        <div class="mt-2">
          <button id="btn-guardar-config" class="primary">Guardar Configuración</button>
        </div>
        <div id="config-msg" class="msg"></div>
      </div>

      <div class="card mt-2">
        <h3>Sincronización GitHub</h3>
        <label>Usuario</label>
        <input id="c-gh-user" type="text">
        <label>Repositorio</label>
        <input id="c-gh-repo" type="text">
        <label>Ruta (archivo JSON)</label>
        <input id="c-gh-ruta" type="text">
        <label>Rama</label>
        <input id="c-gh-rama" type="text">
        <label>Token</label>
        <div class="pass-wrap">
          <input id="c-gh-token" type="password">
          <button type="button" data-toggle-pass="c-gh-token" class="btn-eye">👁</button>
        </div>
        
        <div class="mt-2 row gap">
          <button id="btn-guardar-gh" class="secondary">Guardar GH</button>
          <button id="btn-subir-gh" class="primary">Subir a GitHub</button>
          <button id="btn-bajar-gh" class="secondary">Bajar de GitHub</button>
        </div>
        <div id="gh-msg" class="msg"></div>
      </div>

      <div class="card mt-2">
        <h3>Herramientas</h3>
        <button id="btn-recalcular-categorias" class="secondary">Recalcular Categorías por Edad</button>
        <div id="recalc-msg" class="msg"></div>

        <div class="mt-2 row gap">
          <button id="btn-respaldar" class="secondary">Respaldar BD (.sqlite)</button>
          <button id="btn-restaurar" class="secondary">Restaurar BD</button>
          <input type="file" id="file-restaurar" class="hidden" accept=".sqlite">
        </div>
        <div id="backup-msg" class="msg"></div>
      </div>
    </div>
  </div>

  <!-- Cargar la librería de SQLite como módulo -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.js"></script>

  <!-- Script de la aplicación -->
  <script type="module" src="./app.js"></script>
</body>
</html>
`
    }
  ]
};