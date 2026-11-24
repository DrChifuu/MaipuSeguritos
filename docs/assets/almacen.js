/* ============================================================================
   ALMACÉN DE MAIPO VIGÍA
   Una sola puerta para guardar y leer los datos. Hoy escribe en localStorage.
   Cuando datos/config.js tenga url y anonKey, la misma puerta habla con Supabase
   (funciones mv_estado_publico, mv_entrar, mv_guardar_estado, mv_registrar_lectura,
   mv_confirmar_tramo y mv_salir, definidas en supabase/esquema.sql).

   Contrato:
     MV_ALMACEN.modo                  'local' | 'supabase'
     MV_ALMACEN.cargar()              estado guardado o null
     MV_ALMACEN.guardar(e)            guarda local y, si hay sesión, empuja con retardo
     MV_ALMACEN.guardarLocal(e)       guarda solo en el navegador
     MV_ALMACEN.traer()               estado publicado en Supabase, o null
     MV_ALMACEN.entrar(c,p)           { ok, observador, token } o { ok:false, motivo }
     MV_ALMACEN.salir()               cierra la sesión del servidor y borra el token
     MV_ALMACEN.sincronizarAhora(e)   publica el estado y espera el resultado
     MV_ALMACEN.registrarLectura(d)   { ok, id } o { ok:false, motivo }
     MV_ALMACEN.confirmarTramo(d)     { ok } o { ok:false, motivo }
     MV_ALMACEN.respaldar(e)          descarga un JSON con todo el estado
     MV_ALMACEN.validarRespaldo(obj)  true si el JSON tiene forma de estado
     MV_ALMACEN.sanearParaPublicar(e) copia sin credenciales, lista para el servidor

   Seguridad: la clave anon viaja siempre en Authorization. El token de la
   tarjeta (UUID de mv_sesiones) NUNCA va en la cabecera: va en el cuerpo como
   p_token, y la función SQL lo valida.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.MV_CONFIG || {};
  var SB = CFG.supabase || {};
  var CLAVE = CFG.clave || 'maipo_vigia_estado_v2';
  var CLAVE_TOKEN = 'maipo_vigia_token';
  var configurado = !!(SB.url && SB.anonKey);

  var envioPendiente = null;
  var ultimoError = null;
  var sincronizando = false;
  var ultimoEnvioOk = null;

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* --------------------------------------------------------------------------
     ALMACENAMIENTO LOCAL (con sello de versión)
     -------------------------------------------------------------------------- */
  function leerLocal() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      var obj = JSON.parse(crudo);
      if (!obj || !Array.isArray(obj.stations) || !Array.isArray(obj.roads)) return null;
      /* Si el formato cambió de versión, se descarta: la semilla vuelve a mandar. */
      if (CFG.version && obj._version && obj._version !== CFG.version) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  function guardarLocal(estado) {
    try {
      var copia = clonar(estado);
      copia._version = CFG.version;
      localStorage.setItem(CLAVE, JSON.stringify(copia));
      return true;
    } catch (e) {
      return false;
    }
  }

  function token() {
    try { return sessionStorage.getItem(CLAVE_TOKEN) || ''; } catch (e) { return ''; }
  }

  function guardarToken(valor) {
    try { sessionStorage.setItem(CLAVE_TOKEN, valor); } catch (e) {}
  }

  function borrarToken() {
    try { sessionStorage.removeItem(CLAVE_TOKEN); } catch (e) {}
  }

  function baseUrl() {
    return String(SB.url || '').replace(/\/+$/, '');
  }

  /* --------------------------------------------------------------------------
     LLAMADA A UNA FUNCIÓN DE SUPABASE
     conToken = true agrega p_token al cuerpo; la cabecera siempre es la anon.
     -------------------------------------------------------------------------- */
  function rpc(nombre, cuerpo, conToken) {
    var datos = cuerpo ? clonar(cuerpo) : {};

    if (conToken) {
      var t = token();
      if (!t) return Promise.reject(new Error('Sin sesión'));
      datos.p_token = t;
    }

    return fetch(baseUrl() + '/rest/v1/rpc/' + nombre, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB.anonKey,
        'Authorization': 'Bearer ' + SB.anonKey
      },
      body: JSON.stringify(datos)
    }).then(function (r) {
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return r.json();
    });
  }

  /* --------------------------------------------------------------------------
     SANEO ANTES DE PUBLICAR
     El estado del navegador trae la sesión y las credenciales de las tarjetas.
     Nada de eso puede viajar al servidor ni quedar en el snapshot público.
     -------------------------------------------------------------------------- */
  function sanearParaPublicar(estado) {
    var limpio = clonar(estado || {});

    delete limpio.session;
    delete limpio.loginAttempts;
    delete limpio.lockoutUntil;
    delete limpio._version;

    if (Array.isArray(limpio.observers)) {
      limpio.observers = limpio.observers.map(function (o) {
        var observador = o || {};
        var copia = {};
        Object.keys(observador).forEach(function (k) {
          if (k !== 'card' && k !== 'pin') copia[k] = observador[k];
        });
        copia.cardLast2 = observador.cardLast2 ||
          (observador.card ? String(observador.card).slice(-2) : '••');
        return copia;
      });
    }

    return limpio;
  }

  function puedePublicar(estado) {
    return !!(configurado && token() && estado &&
      estado.session && estado.session.rol === 'directiva');
  }

  function publicar(estado) {
    sincronizando = true;
    return rpc('mv_guardar_estado', { p_estado: sanearParaPublicar(estado) }, true)
      .then(function () {
        ultimoError = null;
        ultimoEnvioOk = new Date().toISOString();
        sincronizando = false;
        return { ok: true };
      })
      .catch(function (e) {
        ultimoError = e.message;
        sincronizando = false;
        return { ok: false, error: e.message };
      });
  }

  function programarEnvio(estado) {
    if (envioPendiente) {
      clearTimeout(envioPendiente);
      envioPendiente = null;
    }
    if (!puedePublicar(estado)) return;

    envioPendiente = setTimeout(function () {
      envioPendiente = null;
      publicar(estado);
    }, 1500);
  }

  /* --------------------------------------------------------------------------
     PUERTA PÚBLICA
     -------------------------------------------------------------------------- */
  var almacen = {
    modo: configurado ? 'supabase' : 'local',
    configurado: configurado,

    cargar: function () { return leerLocal(); },

    /* Guarda solo en el navegador: se usa al bajar datos del servidor, para
       no devolverlos de inmediato. */
    guardarLocal: function (estado) { return guardarLocal(estado); },

    guardar: function (estado) {
      var ok = guardarLocal(estado);
      programarEnvio(estado);
      return ok;
    },

    traer: function () {
      if (!configurado) return Promise.resolve(null);
      return rpc('mv_estado_publico', {}, false).catch(function (e) {
        ultimoError = e.message;
        return null;
      });
    },

    entrar: function (codigo, pin) {
      if (!configurado || (CFG.auth && CFG.auth.modo !== 'supabase')) {
        return Promise.resolve({ ok: false, motivo: 'modo-local' });
      }
      return rpc('mv_entrar', { p_codigo: codigo, p_pin: pin }, false)
        .then(function (r) {
          if (r && r.ok && r.token) guardarToken(r.token);
          return r;
        })
        .catch(function (e) {
          ultimoError = e.message;
          return { ok: false, motivo: 'sin-conexion' };
        });
    },

    /* Cierra la sesión en el servidor (si se puede) y borra el token local.
       Best-effort: un fallo de red no deja la sesión abierta en el navegador. */
    salir: function () {
      var t = token();
      if (configurado && t) {
        return rpc('mv_salir', {}, true)
          .catch(function () {})
          .then(function () { borrarToken(); });
      }
      borrarToken();
      return Promise.resolve();
    },

    sincronizarAhora: function (estado) {
      if (envioPendiente) {
        clearTimeout(envioPendiente);
        envioPendiente = null;
      }
      if (!configurado) return Promise.resolve({ ok: false, error: 'modo-local' });
      if (!puedePublicar(estado)) {
        return Promise.resolve({ ok: false, error: 'sin-sesion' });
      }
      return publicar(estado);
    },

    registrarLectura: function (datos) {
      if (!configurado || !token()) {
        return Promise.resolve({ ok: false, motivo: 'modo-local' });
      }
      var d = datos || {};
      return rpc('mv_registrar_lectura', {
        p_punto: d.punto,
        p_mm: d.mm,
        p_medida_en: d.medidaEn,
        p_origen: d.origen,
        p_nota: d.nota || null,
        p_oficial: !!d.oficial
      }, true).catch(function (e) {
        ultimoError = e.message;
        return { ok: false, motivo: 'sin-conexion' };
      });
    },

    confirmarTramo: function (datos) {
      if (!configurado || !token()) {
        return Promise.resolve({ ok: false, motivo: 'modo-local' });
      }
      var d = datos || {};
      return rpc('mv_confirmar_tramo', {
        p_tramo: d.tramo,
        p_estado: d.estado,
        p_fuente: d.fuente,
        p_nota: d.nota || null
      }, true).catch(function (e) {
        ultimoError = e.message;
        return { ok: false, motivo: 'sin-conexion' };
      });
    },

    estado: function () {
      return {
        modo: this.modo,
        configurado: configurado,
        ultimoError: ultimoError,
        sincronizando: sincronizando,
        ultimoEnvioOk: ultimoEnvioOk
      };
    },

    sanearParaPublicar: sanearParaPublicar,

    texto: function (estado) {
      return JSON.stringify(estado, null, 2);
    },

    respaldar: function (estado) {
      var texto = this.texto(estado);
      var blob = new Blob([texto], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var hoy = new Date();
      var fecha = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
      a.href = url;
      a.download = 'maipo-vigia-respaldo-' + fecha + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      return texto.length;
    },

    /* Un respaldo sirve si trae puntos y caminos. Las listas que falten se
       completan vacías para que la aplicación no tenga que adivinar. */
    validarRespaldo: function (obj) {
      if (!obj || typeof obj !== 'object') return false;
      if (!Array.isArray(obj.stations) || obj.stations.length === 0) return false;
      if (!Array.isArray(obj.roads) || obj.roads.length === 0) return false;

      var listas = ['readings', 'observers', 'files', 'roadChanges', 'citizenReports'];
      for (var i = 0; i < listas.length; i++) {
        var clave = listas[i];
        if (obj[clave] === undefined || obj[clave] === null) {
          obj[clave] = [];
        } else if (!Array.isArray(obj[clave])) {
          return false;
        }
      }
      return true;
    }
  };

  window.MV_ALMACEN = almacen;
})();
