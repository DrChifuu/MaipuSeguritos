#!/usr/bin/env node
/* ============================================================================
   MAIPO VIGÍA · SUITE DE VERIFICACIÓN
   Node estándar + WebSocket nativo contra Obscura CDP (ws://127.0.0.1:9222).
   Levanta un servidor HTTP efímero sobre docs/, ejecuta las pruebas y lo cierra.
   Uso: node tests/verificar.mjs
   ========================================================================== */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const DOCS = path.join(RAIZ, 'docs');
const CDP_URL = process.env.OBSCURA_CDP || 'ws://127.0.0.1:9222/devtools/browser';

/* ----------------------------------------------------------------------------
   Utilidades generales
   -------------------------------------------------------------------------- */
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (texto) => JSON.stringify(String(texto));

function igual(real, esperado, mensaje) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${mensaje}: se esperaba ${b}, llegó ${a}`);
}
function verdad(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

const resultados = [];
let fallos = 0;

async function prueba(nombre, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    resultados.push({ nombre, ok: true, ms });
    console.log(`  ok   ${nombre} (${ms} ms)`);
  } catch (e) {
    fallos += 1;
    resultados.push({ nombre, ok: false, ms: Date.now() - t0, error: e.message });
    console.error(`  FALLA ${nombre}`);
    console.error(`        ${e.message}`);
  }
}

function titulo(texto) {
  console.log(`\n${texto}`);
}

/* ----------------------------------------------------------------------------
   1. SERVIDOR EFÍMERO SOBRE docs/
   -------------------------------------------------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function crearServidor() {
  const servidor = http.createServer((req, res) => {
    let ruta = '/index.html';
    try {
      ruta = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    } catch (e) { /* ruta rara */ }
    if (ruta === '/') ruta = '/index.html';
    const archivo = path.join(DOCS, ruta);
    if (!archivo.startsWith(DOCS)) {
      res.writeHead(403);
      res.end('fuera del sitio');
      return;
    }
    fs.readFile(archivo, (err, datos) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(archivo)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(datos);
    });
  });
  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(0, '127.0.0.1', () => resolver(servidor));
  });
}

/* ----------------------------------------------------------------------------
   2. CLIENTE CDP
   -------------------------------------------------------------------------- */
class CDP {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.id = 0;
    this.pendientes = new Map();
    this.excepciones = [];
    this.erroresConsola = [];
    this.dialogos = [];
    this.targetId = null;
    this.sessionId = null;
  }

  async conectar() {
    await new Promise((resolver, rechazar) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener('open', resolver, { once: true });
      this.ws.addEventListener('error', () => rechazar(new Error('No se pudo conectar a Obscura CDP')), { once: true });
    });
    this.ws.addEventListener('message', (evento) => {
      let mensaje = null;
      try { mensaje = JSON.parse(evento.data); } catch (e) { return; }
      if (mensaje.id && this.pendientes.has(mensaje.id)) {
        const p = this.pendientes.get(mensaje.id);
        this.pendientes.delete(mensaje.id);
        if (mensaje.error) p.rechazar(new Error(JSON.stringify(mensaje.error)));
        else p.resolver(mensaje.result);
        return;
      }
      if (mensaje.method === 'Runtime.exceptionThrown') {
        const d = mensaje.params && mensaje.params.exceptionDetails;
        const texto = d && (d.exception && d.exception.description || d.text) || 'excepción sin detalle';
        this.excepciones.push(String(texto).split('\n')[0]);
      }
      if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') {
        this.erroresConsola.push(mensaje.params.args.map((a) => a.value || a.description || '').join(' '));
      }
      if (mensaje.method === 'Page.javascriptDialogOpening') {
        this.dialogos.push(mensaje.params.message);
        this.enviar('Page.handleJavaScriptDialog', { accept: false }, mensaje.sessionId || this.sessionId).catch(() => {});
      }
    });
  }

  async abrirPagina() {
    const t = await this.enviar('Target.createTarget', { url: 'about:blank' });
    this.targetId = t.targetId;
    const a = await this.enviar('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    this.sessionId = a.sessionId;
    await this.enviar('Runtime.enable', {}, this.sessionId);
    await this.enviar('Page.enable', {}, this.sessionId);
    await this.enviar('Page.bringToFront', {}, this.sessionId).catch(() => {});
    await this.enviar('Emulation.setFocusEmulationEnabled', { enabled: true }, this.sessionId).catch(() => {});
    await this.enviar('Page.setWebLifecycleState', { state: 'active' }, this.sessionId).catch(() => {});
    return this;
  }

  enviar(method, params = {}, sessionId = this.sessionId) {
    return new Promise((resolver, rechazar) => {
      const id = ++this.id;
      this.pendientes.set(id, { resolver, rechazar });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        if (this.pendientes.has(id)) {
          this.pendientes.delete(id);
          rechazar(new Error(`tiempo agotado en ${method}`));
        }
      }, 15000);
    });
  }

  async evaluar(expr, { awaitPromise = true } = {}) {
    const r = await this.enviar('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise,
      userGesture: true
    }, this.sessionId);
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      const texto = d.exception && d.exception.description || d.text || 'error de evaluación';
      throw new Error(String(texto).split('\n')[0]);
    }
    return r.result ? r.result.value : undefined;
  }

  async ir(url) {
    await this.enviar('Page.navigate', { url }, this.sessionId);
    await this.esperar(`document.readyState === 'complete' && !!document.getElementById('appShell')`, 12000);
    await pausa(120);
  }

  async esperar(expr, limite = 8000) {
    const inicio = Date.now();
    let ultimo = '';
    while (Date.now() - inicio < limite) {
      try {
        if (await this.evaluar(expr)) return true;
      } catch (e) {
        ultimo = e.message;
      }
      await pausa(120);
    }
    throw new Error(`no se cumplió: ${expr}${ultimo ? ' (' + ultimo + ')' : ''}`);
  }

  async metricas(width, height) {
    await this.enviar('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false
    }, this.sessionId);
  }

  async cerrar() {
    try {
      if (this.targetId) await this.enviar('Target.closeTarget', { targetId: this.targetId });
    } catch (e) { /* ya cerrado */ }
    try { this.ws.close(); } catch (e) { /* nada */ }
  }
}

/* ----------------------------------------------------------------------------
   3. PRUEBAS UNITARIAS DE MV_ALMACEN
   -------------------------------------------------------------------------- */
function memoria() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear()
  };
}

function sandboxAlmacen({ supabase, fetchFalso }) {
  const llamadas = [];
  const fetchUsado = fetchFalso || (async (url, opciones) => {
    llamadas.push({ url, opciones });
    return { ok: true, json: async () => ({ ok: true }) };
  });
  const sandbox = {
    console, Promise, JSON, Object, Array, String, Number, Date, Error, Math,
    setTimeout, clearTimeout,
    localStorage: memoria(),
    sessionStorage: memoria(),
    Blob: class Blob { constructor(partes) { this.partes = partes; } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    document: { createElement: () => ({}), body: { appendChild() {}, removeChild() {} } },
    fetch: fetchUsado
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(DOCS, 'datos/config.js'), 'utf8'), sandbox);
  sandbox.MV_CONFIG.supabase = supabase;
  vm.runInContext(fs.readFileSync(path.join(DOCS, 'assets/almacen.js'), 'utf8'), sandbox);
  return { almacen: sandbox.MV_ALMACEN, sandbox, llamadas };
}

async function pruebasUnitarias() {
  titulo('Unidades · MV_ALMACEN');

  await prueba('sanearParaPublicar quita credenciales y no muta el original', () => {
    const { almacen } = sandboxAlmacen({ supabase: { url: '', anonKey: '' } });
    const estado = {
      session: { rol: 'directiva', alias: 'Directiva' },
      loginAttempts: 2,
      lockoutUntil: 123,
      _version: '2.2.0',
      stations: [{ id: 'san-alfonso' }],
      roads: [{ id: 'san-alfonso' }],
      observers: [{ id: 'OBS-01', alias: 'Uno', card: '10042042', pin: '1234', cardLast2: '42' }]
    };
    const limpio = almacen.sanearParaPublicar(estado);
    verdad(limpio.session === undefined && limpio.loginAttempts === undefined && limpio.lockoutUntil === undefined && limpio._version === undefined, 'quedaron llaves internas');
    verdad(limpio.observers[0].card === undefined && limpio.observers[0].pin === undefined, 'quedaron credenciales');
    igual(limpio.observers[0].cardLast2, '42', 'cardLast2');
    verdad(estado.session && estado.observers[0].card === '10042042', 'mutó el estado original');
  });

  await prueba('descarta el estado guardado de otra versión', () => {
    const { almacen, sandbox } = sandboxAlmacen({ supabase: { url: '', anonKey: '' } });
    almacen.guardar({ stations: [{ id: 'a' }], roads: [{ id: 'a' }] });
    const guardado = JSON.parse(sandbox.localStorage.getItem('maipo_vigia_estado_v2'));
    igual(guardado._version, sandbox.MV_CONFIG.version, 'sello de versión al guardar');
    guardado._version = '0.0.1';
    sandbox.localStorage.setItem('maipo_vigia_estado_v2', JSON.stringify(guardado));
    verdad(almacen.cargar() === null, 'no descartó una versión distinta');
  });

  await prueba('mv_guardar_estado usa Bearer anonKey y p_token en el cuerpo', async () => {
    const { almacen, sandbox, llamadas } = sandboxAlmacen({
      supabase: { url: 'https://demo.supabase.co', anonKey: 'ANON' }
    });
    sandbox.sessionStorage.setItem('maipo_vigia_token', 'uuid-123');
    const estado = {
      session: { rol: 'directiva', alias: 'Directiva' },
      loginAttempts: 1,
      lockoutUntil: 9,
      stations: [{ id: 'san-alfonso' }],
      roads: [{ id: 'san-alfonso' }],
      observers: [{ id: 'OBS-01', card: '10042042', pin: '1234' }]
    };
    const r = await almacen.sincronizarAhora(estado);
    verdad(r.ok === true, 'no sincronizó');
    igual(llamadas.length, 1, 'llamadas a fetch');
    const { url, opciones } = llamadas[0];
    verdad(url.endsWith('/rest/v1/rpc/mv_guardar_estado'), 'URL de la función');
    igual(opciones.headers.Authorization, 'Bearer ANON', 'cabecera Authorization');
    const cuerpo = JSON.parse(opciones.body);
    igual(cuerpo.p_token, 'uuid-123', 'token en el cuerpo');
    verdad(cuerpo.p_estado.session === undefined, 'viajó la sesión');
    verdad(cuerpo.p_estado.observers[0].card === undefined && cuerpo.p_estado.observers[0].pin === undefined, 'viajaron credenciales');
  });

  await prueba('sin sesión no publica y no llama a fetch', async () => {
    const { almacen, llamadas } = sandboxAlmacen({ supabase: { url: 'https://demo.supabase.co', anonKey: 'ANON' } });
    const r = await almacen.sincronizarAhora({ stations: [], roads: [] });
    igual(r.ok, false, 'debía rechazar');
    igual(r.error, 'sin-sesion', 'motivo');
    igual(llamadas.length, 0, 'no debía llamar');
  });
}

/* ----------------------------------------------------------------------------
   4. E2E
   -------------------------------------------------------------------------- */
const A11Y = `(() => {
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight &&
      c.visibility !== 'hidden' && c.display !== 'none' && c.opacity !== '0';
  };
  const hojas = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() && vis(e));
  const fuentes = hojas.map(e => parseFloat(getComputedStyle(e).fontSize));
  const controles = [...document.querySelectorAll('button, input, select, textarea, a[href]')].filter(vis);
  const alturas = controles.map(e => e.getBoundingClientRect().height);
  return {
    textos: hojas.length,
    menores16: fuentes.filter(f => f < 16).length,
    minFont: fuentes.length ? Math.min(...fuentes) : null,
    controles: controles.length,
    bajos: alturas.filter(h => h < 56).length,
    minControl: alturas.length ? Math.min(...alturas) : null
  };
})()`;

const MEDIDAS = `(() => {
  const mp = document.getElementById('mainPanel');
  return {
    vw: innerWidth, vh: innerHeight,
    docW: document.documentElement.scrollWidth,
    docH: document.documentElement.scrollHeight,
    diff: mp ? mp.scrollHeight - mp.clientHeight : null,
    fontLarge: document.documentElement.classList.contains('font-large')
  };
})()`;

function crearE2E(cdp, base) {
  const estado = () => cdp.evaluar(`JSON.parse(localStorage.getItem('maipo_vigia_estado_v2'))`);
  const clic = async (selector) => {
    await cdp.esperar(`!!document.querySelector(${q(selector)})`);
    await cdp.evaluar(`document.querySelector(${q(selector)}).click()`);
    await pausa(90);
  };
  const escribir = async (selector, valor) => {
    await cdp.esperar(`!!document.querySelector(${q(selector)})`);
    await cdp.evaluar(`(() => {
      const el = document.querySelector(${q(selector)});
      el.focus();
      el.value = ${q(valor)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await pausa(60);
  };
  const texto = (selector) => cdp.evaluar(`(document.querySelector(${q(selector)}) || {}).textContent || ''`);
  const irARuta = async (hash) => {
    await cdp.evaluar(`(() => {
      history.replaceState(null, '', ${q(hash)});
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return location.hash;
    })()`);
    await pausa(180);
  };
  const reiniciar = async () => {
    await cdp.evaluar(`(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} return true; })()`).catch(() => {});
    await cdp.ir(base + '/index.html');
    await cdp.esperar(`document.querySelectorAll('.rain-card').length > 0`, 10000);
    await pausa(150);
  };
  const login = async (tarjeta, pin) => {
    await clic('#btnOpenLogin');
    await cdp.esperar(`!document.getElementById('sheetBackdrop').classList.contains('hidden')`);
    await escribir('#loginCardInput', tarjeta);
    await clic('#loginPinBtn');
    for (const d of String(pin)) await clic(`[data-loginkey="${d}"]`);
    await clic('#btnDoLogin');
    await pausa(250);
  };
  const abrirTab = (tab) => clic(`.tab-btn[data-tab="${tab}"]`);
  const abrirSub = (sub) => clic(`.subtab-btn[data-subtab="${sub}"]`);
  const a11y = async (vista) => {
    const m = await cdp.evaluar(A11Y);
    if (m.menores16 > 0) throw new Error(`${vista}: ${m.menores16} textos bajo 16px (mínimo ${m.minFont})`);
    if (m.bajos > 0) throw new Error(`${vista}: ${m.bajos} controles bajo 56px (mínimo ${m.minControl})`);
    return m;
  };
  return { estado, clic, escribir, texto, irARuta, reiniciar, login, abrirTab, abrirSub, a11y };
}

async function pruebasE2E(cdp, base) {
  const e = crearE2E(cdp, base);

  titulo('Diseño · 1280×800');
  await cdp.metricas(1280, 800);
  await e.reiniciar();

  await prueba('Ahora › Lluvia mide 1280×800 exacto y sin scroll interno', async () => {
    const m = await cdp.evaluar(MEDIDAS);
    igual(m.docW, 1280, 'ancho del documento');
    igual(m.docH, 800, 'alto del documento');
    igual(m.diff, 0, 'scroll interno del panel');
    igual(m.fontLarge, false, 'modo letra grande');
  });

  await prueba('Barrido público de vistas sin textos ni controles chicos', async () => {
    const vistas = [
      ['Ahora · Lluvia', async () => { await e.abrirTab('ahora'); await e.abrirSub('lluvia'); }],
      ['Ahora · Última hora', async () => { await e.abrirSub('ultima-hora'); }],
      ['Zona · Lluvia 24 h', async () => { await e.abrirTab('ahora'); await e.clic('[data-open-zone="san-alfonso"]'); }],
      ['Zona · Quién midió', async () => { await e.abrirSub('quien'); }],
      ['Zona · Camino', async () => { await e.abrirSub('camino'); }],
      ['Zona · Qué hacer', async () => { await e.abrirSub('hacer'); }],
      ['Camino · Estado', async () => { await e.abrirTab('camino'); await e.abrirSub('estado'); }],
      ['Camino · Informar', async () => { await e.abrirSub('informar'); }],
      ['Camino · Cambios', async () => { await e.abrirSub('cambios'); }],
      ['Archivo · Archivos', async () => { await e.abrirTab('archivo'); await e.abrirSub('archivos'); }],
      ['Archivo · Tablero', async () => { await e.abrirSub('tablero'); }],
      ['Archivo · Tabla con filtros', async () => {
        await e.abrirSub('tabla');
        await cdp.evaluar(`(() => {
          const sel = document.getElementById('tablaPunto');
          sel.value = 'San Alfonso';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          const inp = document.getElementById('tablaTexto');
          inp.value = '20/11';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`);
        await pausa(350);
      }],
      ['Ayuda · Estados', async () => { await e.abrirTab('ayuda'); await e.abrirSub('estados'); }],
      ['Ayuda · Milímetros', async () => { await e.abrirSub('milimetros'); }],
      ['Ayuda · Alertas', async () => { await e.abrirSub('alertas'); }],
      ['Ayuda · Sin internet', async () => { await e.abrirSub('sin-internet'); }]
    ];
    for (const [nombre, paso] of vistas) {
      await paso();
      await e.a11y(nombre);
    }
  });

  await prueba('Cooldown de avisos y cancelación del aviso propio', async () => {
    await e.reiniciar();
    await e.clic('#btnAvisarFromAhora');
    await cdp.esperar(`!document.getElementById('sheetBackdrop').classList.contains('hidden')`);

    await e.clic('#btnSendAvisar');
    await pausa(300);
    const trasEnviar = await e.estado();
    const propio = trasEnviar.citizenReports.find(a => a.esMio === true);
    verdad(propio, 'el aviso no quedó marcado como propio');
    verdad(trasEnviar.myReportIds.includes(propio.id), 'el aviso no entró en myReportIds');
    verdad(trasEnviar.avisarCooldownUntil > Date.now(), 'no se activó el cooldown');
    verdad(await cdp.evaluar(`!!document.querySelector('#avisarCooldownCountdown[data-live-cooldown]')`), 'falta la cuenta regresiva');
    verdad(await cdp.evaluar(`!!document.querySelector('[data-cancel-report]')`), 'falta el botón para cancelar');

    await e.clic('#btnCloseAvisarDone');
    await e.clic('#btnAvisarFromAhora');
    await cdp.esperar(`!!document.getElementById('btnSendAvisar')`);
    verdad(await cdp.evaluar(`document.getElementById('btnSendAvisar').disabled`), 'el botón no quedó deshabilitado');

    const c1 = (await e.texto('#avisarCooldownCountdown')).trim();
    await pausa(2300);
    const c2 = (await e.texto('#avisarCooldownCountdown')).trim();
    verdad(c2 !== c1, 'la cuenta regresiva no avanzó: ' + c1 + ' → ' + c2);

    await e.clic('[data-cancel-report]');
    await pausa(300);
    const trasCancelar = await e.estado();
    const cancelado = trasCancelar.citizenReports.find(a => a.id === propio.id);
    igual(cancelado.estado, 'Cancelado', 'estado del aviso cancelado');
    const tramo = trasCancelar.roads.find(r => r.id === propio.road_id);
    igual(tramo.pendingReports, 0, 'pendientes del tramo tras cancelar');
    verdad(trasCancelar.avisarCooldownUntil > Date.now(), 'el cooldown no debe liberarse al cancelar');
    verdad(await cdp.evaluar(`!document.querySelector('[data-cancel-report]')`), 'el aviso cancelado sigue en la hoja');

    /* Al vencer el cooldown, el botón se habilita solo. */
    await cdp.evaluar(`(() => {
      window.__realNow = Date.now;
      const base = Date.now();
      Date.now = () => base + 121000;
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await pausa(500);
    verdad(await cdp.evaluar(`!document.querySelector('#avisarCooldownCountdown')`), 'la franja de cooldown no desapareció');
    verdad(await cdp.evaluar(`document.getElementById('btnSendAvisar') && !document.getElementById('btnSendAvisar').disabled`), 'el botón no se habilitó al vencer');
    verdad((await e.estado()).avisarCooldownUntil === null, 'el cooldown no se limpió');
    await cdp.evaluar(`(() => { if (window.__realNow) { Date.now = window.__realNow; delete window.__realNow; } return true; })()`);
    await e.clic('#btnCloseSheet').catch(() => {});

    /* El mismo control existe en Camino › Informar. */
    await e.reiniciar();
    await e.abrirTab('camino');
    await e.abrirSub('informar');
    await e.clic('#btnSendInform');
    await pausa(300);
    await e.clic('#btnInformReset');
    await cdp.esperar(`!!document.getElementById('btnSendInform')`);
    verdad(await cdp.evaluar(`!!document.querySelector('#avisarCooldownCountdown[data-live-cooldown]')`), 'falta el cooldown en Camino › Informar');
    verdad(await cdp.evaluar(`document.getElementById('btnSendInform').disabled`), 'el botón de camino no quedó deshabilitado');
    verdad(await cdp.evaluar(`!!document.querySelector('[data-cancel-report]')`), 'falta el aviso propio en Camino › Informar');
    await e.clic('[data-cancel-report]');
    await pausa(250);
    igual((await e.estado()).citizenReports.find(a => a.esMio === true).estado, 'Cancelado', 'cancelación desde Camino');
  });

  await prueba('Kiosco: reloj, paginación, flechas y cierre con Escape', async () => {
    await e.clic('#btnFooterKiosco');
    await cdp.esperar(`!document.getElementById('kioscoOverlay').classList.contains('hidden')`);
    const reloj = (await e.texto('#kioscoClock')).trim();
    const pie = (await e.texto('#kioscoFootMode')).trim();
    const fondoKiosco = await cdp.evaluar(`getComputedStyle(document.getElementById('kioscoOverlay')).backgroundColor`);
    igual(fondoKiosco, 'rgb(11, 17, 23)', 'fondo pizarra del kiosco');
    const insignias = await cdp.evaluar(`[...document.querySelectorAll('.k-badge')].map(b => b.className)`);
    igual(insignias.length, 3, 'insignias de estado del kiosco');
    verdad(insignias.every(c => /k-badge-(rojo|ambar|verde|sindato)/.test(c)), 'insignia sin clase de estado: ' + insignias.join(', '));
    const estiloBadge = await cdp.evaluar(`(() => {
      const b = document.querySelector('.k-badge');
      const c = getComputedStyle(b);
      return { fondo: c.backgroundColor, tamano: c.fontSize };
    })()`);
    igual(estiloBadge.fondo, 'rgb(203, 213, 225)', 'fondo de insignia sin dato');
    igual(estiloBadge.tamano, '24px', 'tamaño de insignia');
    const bordeTarjeta = await cdp.evaluar(`getComputedStyle(document.querySelector('.kiosco-card')).borderTopWidth`);
    igual(bordeTarjeta, '10px', 'borde superior de tarjeta de kiosco');
    const ajusteKiosco = await cdp.evaluar(`(() => {
      const g = document.getElementById('kioscoGrid');
      return { scroll: g.scrollHeight, client: g.clientHeight };
    })()`);
    verdad(ajusteKiosco.scroll <= ajusteKiosco.client + 2, 'el kiosco desborda: ' + JSON.stringify(ajusteKiosco));
    verdad(reloj.length > 8, 'reloj vacío o muy corto');
    verdad(/\d.?–?\d*.?de \d+/.test(pie) || /puntos? · al día/.test(pie), 'indicador de página inesperado: ' + pie);
    await cdp.evaluar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
    await pausa(150);
    const pie2 = (await e.texto('#kioscoFootMode')).trim();
    verdad(pie2 !== pie || /puntos? · al día/.test(pie), 'la paginación no cambió con ArrowRight');
    await cdp.evaluar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await cdp.esperar(`document.getElementById('kioscoOverlay').classList.contains('hidden')`);
  });

  await prueba('Modo A+ mantiene piso de 16px y controles de 56px', async () => {
    await e.abrirTab('ahora');
    await e.abrirSub('lluvia');
    await e.clic('#btnFontToggle');
    verdad(await cdp.evaluar(`document.documentElement.classList.contains('font-large')`), 'no se activó A+');
    await e.a11y('Ahora · A+');
    await e.clic('#btnFontToggle');
  });

  titulo('Diseño · 390×844');
  await cdp.metricas(390, 844);
  await cdp.ir(base + '/index.html');
  await cdp.esperar(`document.querySelectorAll('.rain-card').length > 0`, 10000);

  await prueba('Ahora › Lluvia mide 390×844 sin desborde horizontal', async () => {
    const m = await cdp.evaluar(MEDIDAS);
    igual(m.docW, 390, 'ancho del documento');
    igual(m.docH, 844, 'alto del documento');
    const sinDesborde = await cdp.evaluar(`document.documentElement.scrollWidth <= innerWidth`);
    verdad(sinDesborde, 'hay desborde horizontal');
    await e.a11y('Ahora · móvil');
  });

  /* Volver al escritorio para los flujos */
  await cdp.metricas(1280, 800);
  await cdp.ir(base + '/index.html');
  await cdp.esperar(`document.querySelectorAll('.rain-card').length > 0`, 10000);

  titulo('Flujos · sesión y permisos');

  await prueba('Ruta protegida pide tarjeta y vuelve a Ahora', async () => {
    await e.reiniciar();
    await e.irARuta('#/directiva/validar');
    await cdp.esperar(`!document.getElementById('sheetBackdrop').classList.contains('hidden')`);
    igual(await cdp.evaluar(`document.getElementById('appShell').getAttribute('aria-hidden')`), 'true', 'aria-hidden de la app');
    igual(await cdp.evaluar(`location.hash`), '#/ahora/lluvia', 'ruta tras el intento');
    await e.clic('#btnCloseSheet');
  });

  await prueba('Tres fallos de tarjeta bloquean la hoja', async () => {
    await e.reiniciar();
    for (let intento = 1; intento <= 3; intento++) {
      await e.login('00000000', '0000');
    }
    const cuerpo = await e.texto('#sheetBody');
    verdad(/Espera|minutos/.test(cuerpo), 'no apareció el bloqueo: ' + cuerpo.slice(0, 120));
    verdad((await cdp.evaluar(`!!document.getElementById('loginCardInput')`)) === false, 'el formulario sigue activo durante el bloqueo');
  });

  await prueba('Cuenta regresiva del bloqueo y desbloqueo automático', async () => {
    const t1 = (await e.texto('#lockoutCountdown')).trim();
    verdad(/^\d{2}:\d{2}$/.test(t1), 'formato de cuenta regresiva inesperado: ' + t1);
    /* Dos segundos completos: con Math.ceil el primer tick puede caer dentro
       del mismo segundo y todavía mostrar 05:00. */
    await pausa(2300);
    const t2 = (await e.texto('#lockoutCountdown')).trim();
    verdad(t2 !== t1, 'la cuenta regresiva no avanzó: ' + t1 + ' → ' + t2);

    await cdp.evaluar(`(() => {
      window.__realNow = Date.now;
      const base = Date.now();
      Date.now = () => base + 5 * 60000 + 2000;
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await pausa(500);
    const desbloqueado = await cdp.evaluar(`!!document.getElementById('loginCardInput')`);
    verdad(desbloqueado, 'no se desbloqueó al vencer el plazo');
    await cdp.evaluar(`(() => { if (window.__realNow) { Date.now = window.__realNow; delete window.__realNow; } return true; })()`);
    await e.clic('#btnCloseSheet');
  });

  await prueba('Los tiempos avanzan sin perder el foco ni lo escrito', async () => {
    await e.reiniciar();
    await e.clic('#btnOpenLogin');
    await e.escribir('#loginCardInput', '88');
    const antes = (await e.texto('#topbarUpdated')).trim();
    const focoAntes = await cdp.evaluar(`document.activeElement.id`);

    await cdp.evaluar(`(() => {
      window.__realNow = Date.now;
      const base = Date.now();
      Date.now = () => base + 2 * 60000;
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await pausa(500);
    const despues = (await e.texto('#topbarUpdated')).trim();
    const valor = await cdp.evaluar(`(document.getElementById('loginCardInput') || {}).value || ''`);
    const focoDespues = await cdp.evaluar(`document.activeElement.id`);
    verdad(despues !== antes, 'el texto de actualización no cambió: ' + antes);
    verdad(/hace 2 min/.test(despues), 'texto inesperado: ' + despues);
    igual(valor, '88', 'texto escrito en el campo');
    igual(focoDespues, focoAntes, 'foco tras actualizar tiempos');

    await cdp.evaluar(`(() => { if (window.__realNow) { Date.now = window.__realNow; delete window.__realNow; } return true; })()`);
    await e.clic('#btnCloseSheet');
    await e.reiniciar();
  });

  await prueba('Topbar con tiempo largo no desborda a 1280', async () => {
    await e.reiniciar();
    await cdp.evaluar(`(() => {
      window.__realNow = Date.now;
      const base = Date.now();
      Date.now = () => base + 3 * 3600000;
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await pausa(500);
    const m = await cdp.evaluar(MEDIDAS);
    verdad(m.docW <= 1280, 'desborde horizontal: ' + m.docW);
    igual(m.diff, 0, 'scroll interno con texto largo');
    const texto = (await e.texto('#topbarUpdated')).trim();
    verdad(/hace 3 h/.test(texto), 'texto largo inesperado: ' + texto);
    await cdp.evaluar(`(() => { if (window.__realNow) { Date.now = window.__realNow; delete window.__realNow; } return true; })()`);
    await e.reiniciar();
  });

  await prueba('Una estación pasa de Normal a Sin dato al vencer su frescura', async () => {
    await e.reiniciar();
    await e.login('90000001', '9999');
    await e.abrirTab('directiva');
    await e.abrirSub('oficial');
    await cdp.evaluar(`(() => {
      const sel = document.getElementById('ofPunto');
      sel.value = 'el-manzano';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await e.escribir('#ofMm', '1,0');
    await e.clic('#btnGuardarOficial');
    await pausa(250);

    await e.abrirTab('ahora');
    await e.abrirSub('lluvia');
    const estadoCard = async () => cdp.evaluar(`(() => {
      const card = [...document.querySelectorAll('.rain-card')]
        .find(c => (c.querySelector('.rain-point-name') || {}).textContent === 'El Manzano');
      return card ? card.querySelector('.state-pill').textContent.trim() : '';
    })()`);
    const antes = await estadoCard();
    verdad(/Normal/.test(antes), 'El Manzano no quedó en Normal tras el ingreso: ' + antes);

    await cdp.evaluar(`(() => {
      window.__realNow = Date.now;
      const base = Date.now();
      Date.now = () => base + 70 * 60000;
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await pausa(700);
    const despues = await estadoCard();
    verdad(/Sin dato/.test(despues), 'no pasó a Sin dato: ' + despues);

    await cdp.evaluar(`(() => { if (window.__realNow) { Date.now = window.__realNow; delete window.__realNow; } return true; })()`);
    await e.reiniciar();
  });

  await prueba('Observador entra, registra 5,5 mm y respeta el límite 0–300', async () => {
    await e.reiniciar();
    await e.login('10042042', '1234');
    await cdp.esperar(`location.hash === '#/registrar/identidad'`);
    await e.clic('#btnRegNext1');
    for (const tecla of ['5', ',', '5']) await e.clic(`#regNumpad [data-numkey="${tecla}"]`);
    await e.clic('#btnRegNext2');
    await cdp.esperar(`!!document.getElementById('btnRegSubmit')`);
    await e.clic('#btnRegSubmit');
    await pausa(250);
    const est = await e.estado();
    igual(est.readings[0].rainfall_mm, 5.5, 'lectura enviada');
    igual(est.readings[0].estado_validacion, 'En revisión', 'estado de la lectura');

    /* Límite superior: 300 se acepta, 301 no. */
    await e.abrirTab('registrar');
    await e.abrirSub('lectura');
    await e.clic('#btnRegNoRead');
    for (const tecla of ['3', '0', '0']) await e.clic(`#regNumpad [data-numkey="${tecla}"]`);
    await e.clic('#regNumpad [data-numkey="0"]');
    const valor = (await e.texto('.readout-value')).trim();
    verdad(valor.startsWith('300'), 'el valor superó el tope: ' + valor);
    const aviso = await e.texto('#toastBox');
    verdad(/300/.test(aviso), 'no avisó del tope de 300 mm');
  });

  await prueba('Directiva valida y corrige sin falsear hasSensor', async () => {
    await e.reiniciar();

    /* Dos lecturas manuales del observador de San Alfonso. */
    await e.login('10042042', '1234');
    const registrar = async (mm) => {
      await e.abrirTab('registrar');
      await e.abrirSub('lectura');
      await e.clic('#btnRegNoRead');
      for (const tecla of String(mm).split('')) {
        await e.clic(`#regNumpad [data-numkey="${tecla === '.' ? ',' : tecla}"]`);
      }
      await e.clic('#btnRegNext2');
      await cdp.esperar(`!!document.getElementById('btnRegSubmit')`);
      await e.clic('#btnRegSubmit');
      await pausa(220);
    };
    await registrar('4.5');
    await e.clic('#btnRegAnother');
    await registrar('2.5');
    await e.clic('#btnLogoutTop');
    await pausa(150);

    await e.login('90000001', '9999');
    await cdp.esperar(`location.hash === '#/directiva/validar'`);
    await e.clic('[data-val-filter="lluvia"]');
    const antes = await e.estado();
    const pendiente = antes.readings.find((r) => r.estado_validacion === 'En revisión');
    verdad(pendiente, 'no hay lectura pendiente tras el registro');
    const estacionAntes = antes.stations.find((s) => s.id === pendiente.station_id);

    await e.clic('#btnValApprove');
    await pausa(250);
    const tras = await e.estado();
    const validada = tras.readings.find((r) => r.id === pendiente.id);
    igual(validada.estado_validacion, 'Validada', 'estado tras validar');
    const estacionDespues = tras.stations.find((s) => s.id === pendiente.station_id);
    igual(estacionDespues.rainfall_mm, pendiente.rainfall_mm, 'cifra del tablero');
    igual(estacionDespues.hasSensor, estacionAntes.hasSensor, 'hasSensor no debe cambiar');

    await e.clic('[data-val-filter="lluvia"]');
    await e.clic('#btnValCorrect');
    await e.escribir('#valCorrectInput', '2,5');
    await e.clic('#btnConfirmCorrect');
    await pausa(300);
    const corregida = (await e.estado()).readings.find((r) => r.estado_validacion === 'Corregida' && r.rainfall_mm === 2.5);
    verdad(corregida, 'no quedó la lectura corregida a 2,5 mm');
  });

  await prueba('Ingreso oficial guarda y actualiza el tablero', async () => {
    await e.abrirTab('directiva');
    await e.abrirSub('oficial');
    await e.escribir('#ofMm', '3,3');
    await e.clic('#btnGuardarOficial');
    await pausa(300);
    const est = await e.estado();
    verdad(est.readings[0].oficial === true, 'la lectura no quedó marcada como oficial');
    igual(est.readings[0].rainfall_mm, 3.3, 'cifra oficial');
    const estacion = est.stations.find((s) => s.id === est.readings[0].station_id);
    igual(estacion.rainfall_mm, 3.3, 'tablero tras ingreso oficial');
  });

  await prueba('Ventana de 1 hora y cierre diario en CSV', async () => {
    await e.reiniciar();
    await e.login('90000001', '9999');

    await e.abrirTab('directiva');
    await e.abrirSub('oficial');
    await cdp.evaluar(`(() => {
      const sel = document.getElementById('ofPunto');
      sel.value = 'el-manzano';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await e.escribir('#ofMm', '1,0');
    await e.clic('#btnGuardarOficial');
    await pausa(250);

    await e.abrirTab('archivo');
    await e.abrirSub('archivos');
    const textoArchivo = await e.texto('#mainContent');
    verdad(/Formato predeterminado: CSV/.test(textoArchivo), 'no se anuncia CSV como predeterminado');
    const antesCierre = await e.estado();
    igual(antesCierre.files[0].id, 'f-2', 'el CSV de ejemplo debe ir primero');
    verdad(antesCierre.files[0].isDefaultFormat === true, 'f-2 debe estar marcado como predeterminado');
    verdad(await cdp.evaluar(`!!document.getElementById('btnGenerateDailyCsv')`), 'falta el botón de cierre diario');

    await e.clic('#btnGenerateDailyCsv');
    await pausa(350);
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
    const conCierre = await e.estado();
    const diario = conCierre.files.find(f => f.autoDaily && f.dailyDate === hoy);
    verdad(diario, 'no se generó el dataset diario');
    igual(diario.format, 'CSV', 'formato del cierre');
    igual(diario.name, 'lluvia_diaria_' + hoy + '.csv', 'nombre del cierre');
    verdad(diario.rows.length >= 1, 'el cierre quedó sin filas');

    /* Una lectura de hace 61 minutos no debe mover el tablero. */
    await e.abrirTab('directiva');
    await e.abrirSub('oficial');
    const antes = (await e.estado()).stations.find(s => s.id === 'el-manzano').rainfall_mm;
    const horaVieja = await cdp.evaluar(`new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(Date.now() - 61 * 60000))`);
    await cdp.evaluar(`(() => {
      const sel = document.getElementById('ofPunto');
      sel.value = 'el-manzano';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await e.escribir('#ofHora', horaVieja);
    await e.escribir('#ofMm', '9,9');
    await e.clic('#btnGuardarOficial');
    await pausa(300);
    const despues = (await e.estado()).stations.find(s => s.id === 'el-manzano').rainfall_mm;
    igual(despues, antes, 'el tablero no debe cambiar con una lectura vieja');
    const aviso = await e.texto('#toastBox');
    verdad(/una hora/.test(aviso), 'el aviso no menciona la hora: ' + aviso);
  });

  await prueba('Crear, editar y quitar un punto con hoja de confirmación', async () => {
    await e.abrirSub('datos');
    await e.clic('#btnNuevoPunto');
    await e.escribir('#ptNombre', 'Punto Suite');
    await e.clic('#btnSavePunto');
    await pausa(250);
    verdad((await e.estado()).stations.some((s) => s.name === 'Punto Suite'), 'no se creó el punto');

    await e.clic('[data-edit-point="punto-suite"]');
    await e.escribir('#ptNombre', 'Punto Suite Dos');
    await e.clic('#btnSavePunto');
    await pausa(250);
    verdad((await e.estado()).stations.some((s) => s.name === 'Punto Suite Dos'), 'no se editó el punto');

    await e.clic('[data-del-point="punto-suite"]');
    const tituloHoja = await e.texto('#sheetTitle');
    verdad(/Quitar/.test(tituloHoja), 'no abrió la hoja de confirmación: ' + tituloHoja);
    await e.clic('#btnDoConfirm');
    await pausa(250);
    verdad(!(await e.estado()).stations.some((s) => s.id === 'punto-suite'), 'el punto sigue en el estado');
    igual(cdp.dialogos.length, 0, 'aparecieron diálogos nativos');
  });

  await prueba('Subir CSV: publicar y deshacer dentro de 24 h', async () => {
    await e.abrirTab('directiva');
    await e.abrirSub('subir');
    await e.clic('#btnUseDemoCsv');
    await e.clic('#btnUpToStep3');
    const resumen = await e.texto('.info-banner strong');
    verdad(/5 filas listas/.test(resumen), 'revisión inesperada: ' + resumen);
    await e.clic('#btnUpToStep4');
    await e.clic('#btnUpPublish');
    await pausa(350);
    const publicado = (await e.estado()).files[0];
    igual(publicado.rows.length, 5, 'filas publicadas');
    verdad(publicado.summary.acumulado > 30, 'acumulado no recalculado');

    await e.abrirTab('archivo');
    await e.abrirSub('archivos');
    await e.clic('[data-undo-publish]');
    await pausa(300);
    verdad(!(await e.estado()).files.some((f) => f.id === publicado.id), 'no se deshizo la publicación');
  });

  await prueba('Borrador: guardar, retomar y descartar', async () => {
    await e.abrirTab('directiva');
    await e.abrirSub('subir');
    await e.clic('#btnUseDemoCsv');
    await e.clic('#btnUpToStep3');
    await e.clic('#btnUpToStep4');
    await e.clic('#btnUpDraft');
    await pausa(250);
    igual((await e.estado()).uploadDrafts.length, 1, 'borrador guardado');

    await e.clic('[data-draft-resume]');
    await pausa(150);
    igual((await e.texto('.step-pill.active')).trim(), '4 · Publicar', 'retomar no volvió al paso 4');

    await e.clic('#btnUpBack3');
    await e.clic('#btnUpBack2');
    await e.clic('#btnUpBack1');
    await e.clic('[data-draft-delete]');
    await pausa(250);
    igual((await e.estado()).uploadDrafts.length, 0, 'borrador descartado');
  });

  await prueba('Barrido Directiva y Registrar (5 + 3 solapas)', async () => {
    const vistas = [
      ['Directiva · Por validar', async () => { await e.abrirTab('directiva'); await e.abrirSub('validar'); }],
      ['Directiva · Oficial', async () => e.abrirSub('oficial')],
      ['Directiva · Observadores', async () => e.abrirSub('observadores')],
      ['Directiva · Datos', async () => e.abrirSub('datos')],
      ['Directiva · Subir', async () => e.abrirSub('subir')],
      ['Registrar · Identidad', async () => { await e.abrirTab('registrar'); await e.abrirSub('identidad'); }],
      ['Registrar · Lectura', async () => e.abrirSub('lectura')],
      ['Registrar · Revisar', async () => {
        for (const tecla of ['2', ',', '5']) await e.clic(`#regNumpad [data-numkey="${tecla}"]`);
        await e.clic('#btnRegNext2');
        await cdp.esperar(`document.querySelector('.step-pill.active') && document.querySelector('.step-pill.active').textContent.includes('3')`);
      }]
    ];
    for (const [nombre, paso] of vistas) {
      await paso();
      await e.a11y(nombre);
    }
  });

  await prueba('Sin excepciones JS ni diálogos nativos en todo el recorrido', () => {
    if (cdp.excepciones.length) throw new Error('excepciones: ' + cdp.excepciones.slice(0, 3).join(' | '));
    if (cdp.dialogos.length) throw new Error('diálogos nativos: ' + cdp.dialogos.join(' | '));
  });
}

/* ----------------------------------------------------------------------------
   5. ORQUESTACIÓN
   -------------------------------------------------------------------------- */
async function principal() {
  console.log('Maipo Vigía · verificación integral');
  await pruebasUnitarias();

  const servidor = await crearServidor();
  const puerto = servidor.address().port;
  const base = `http://127.0.0.1:${puerto}`;

  const cdp = new CDP(CDP_URL);
  await cdp.conectar();
  await cdp.abrirPagina();

  try {
    await pruebasE2E(cdp, base);
  } finally {
    await cdp.cerrar();
    await new Promise((r) => servidor.close(r));
  }

  const total = resultados.length;
  const pasadas = resultados.filter((r) => r.ok).length;
  console.log(`\n${pasadas}/${total} pruebas pasaron.`);
  if (fallos) {
    console.error(`${fallos} fallaron.`);
    process.exitCode = 1;
  } else {
    console.log('Verificación completa: exit 0.');
  }
}

principal().catch((e) => {
  console.error('No se pudo completar la verificación:', e.message);
  process.exitCode = 1;
});
