/* ============================================================================
   ALMACÉN DE MAIPO VIGÍA
   Una sola puerta para guardar y leer los datos. Hoy escribe en localStorage.
   Cuando datos/config.js tenga url y anonKey, la misma puerta habla con Supabase
   (funciones mv_estado_publico, mv_entrar, mv_guardar_estado y mv_registrar_lectura,
   definidas en supabase/esquema.sql).

   Contrato:
     MV_ALMACEN.modo          'local' | 'supabase'
     MV_ALMACEN.cargar()      estado guardado o null
     MV_ALMACEN.guardar(e)    guarda local y, si hay Supabase, empuja con retardo
     MV_ALMACEN.traer()       estado publicado en Supabase, o null
     MV_ALMACEN.entrar(c,p)   { ok, observador, token } o { ok:false, motivo }
     MV_ALMACEN.respaldar(e)  descarga un JSON con todo el estado
     MV_ALMACEN.validarRespaldo(obj)  true si el JSON tiene forma de estado
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

  function leerLocal() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      var obj = JSON.parse(crudo);
      if (obj && Array.isArray(obj.stations) && Array.isArray(obj.roads)) return obj;
    } catch (e) { /* navegador sin cuota o JSON roto */ }
    return null;
  }

  function guardarLocal(estado) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      return false;
    }
  }

  function token() {
    try { return sessionStorage.getItem(CLAVE_TOKEN) || ''; } catch (e) { return ''; }
  }

  function baseUrl() {
    return String(SB.url || '').replace(/\/+$/, '');
  }

  function rpc(nombre, cuerpo, conToken) {
    var cabeceras = {
      'Content-Type': 'application/json',
      'apikey': SB.anonKey
    };
    cabeceras.Authorization = 'Bearer ' + (conToken && token() ? token() : SB.anonKey);
    return fetch(baseUrl() + '/rest/v1/rpc/' + nombre, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(cuerpo || {})
    }).then(function (r) {
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return r.json();
    });
  }

  function programarEnvio(estado) {
    if (!configurado) return;
    if (envioPendiente) clearTimeout(envioPendiente);
    envioPendiente = setTimeout(function () {
      rpc('mv_guardar_estado', { p_estado: estado }, true)
        .then(function () { ultimoError = null; })
        .catch(function (e) { ultimoError = e.message; });
    }, 1500);
  }

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
          if (r && r.ok && r.token) {
            try { sessionStorage.setItem(CLAVE_TOKEN, r.token); } catch (e) {}
          }
          return r;
        })
        .catch(function () { return { ok: false, motivo: 'sin-conexion' }; });
    },

    salir: function () {
      try { sessionStorage.removeItem(CLAVE_TOKEN); } catch (e) {}
    },

    estado: function () {
      return {
        modo: this.modo,
        configurado: configurado,
        ultimoError: ultimoError
      };
    },

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

    validarRespaldo: function (obj) {
      return !!(obj && Array.isArray(obj.stations) && obj.stations.length > 0 &&
                Array.isArray(obj.roads) && obj.roads.length > 0);
    }
  };

  window.MV_ALMACEN = almacen;
})();
