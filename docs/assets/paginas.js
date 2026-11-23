/* Maipo Vigía · piezas compartidas de las páginas del recorrido.
 * Lee datos/estaciones.js y datos/historicos.js, que llegan antes que este
 * archivo. No pide nada a la red y no escribe datos personales. */
(function () {
  'use strict';

  var svg = {
    rojo: '<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="1" y="1" width="16" height="16" fill="currentColor"/></svg>',
    ambar: '<svg viewBox="0 0 18 18" aria-hidden="true"><polygon points="9,1 17,16 1,16" fill="currentColor"/></svg>',
    verde: '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="currentColor"/></svg>',
    sin: '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="currentColor"/><text x="9" y="13" text-anchor="middle" font-size="12" font-weight="600" fill="#E2E6E5">?</text></svg>'
  };

  function estaciones() {
    return Array.isArray(window.ESTACIONES) ? window.ESTACIONES : [];
  }

  function porId(id) {
    var lista = estaciones();
    for (var i = 0; i < lista.length; i += 1) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  function parametro(nombre) {
    var p = new URLSearchParams(window.location.search);
    return p.get(nombre) || '';
  }

  function estadoVisual(est) {
    var e = est && est.estado_dato ? est.estado_dato : 'sin_datos';
    if (e === 'al_dia' || e === 'al-dia') return { clase: 'verde', icono: svg.verde, texto: 'Dato al día' };
    if (e === 'atrasado' || e === 'parcial') return { clase: 'ambar', icono: svg.ambar, texto: 'Dato atrasado' };
    if (e === 'error') return { clase: 'rojo', icono: svg.rojo, texto: 'No se pudo leer' };
    return { clase: 'sin-dato', icono: svg.sin, texto: 'Sin dato' };
  }

  function lugarTexto(est) {
    if (est.quebrada) return est.quebrada;
    return est.sector || '';
  }

  /* Todo texto que venga de los datos se escapa antes de entrar a innerHTML.
   * Los SVG de `svg` son literales de este archivo: no vienen de la base. */
  function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function marca(est) {
    var v = estadoVisual(est);
    return '<span class="marca-estado marca-estado--' + esc(v.clase) + '">' +
      v.icono + '<span>' + esc(v.texto) + '</span></span>';
  }

  function tarjeta(est) {
    var v = estadoVisual(est);
    var propuesto = est.procedencia && est.procedencia.propuesto;
    return '<article class="tarjeta-zona tarjeta-zona--' + v.clase + '">' +
      '<div class="tarjeta-zona__cabecera">' +
        '<h2 class="tarjeta-zona__nombre">' + esc(est.nombre) + '</h2>' +
      '</div>' +
      '<p class="tarjeta-zona__lugar">' + esc(lugarTexto(est)) + '</p>' +
      (propuesto ? '<p class="estacion__propuesto">Punto propuesto</p>' : '') +
      '<p class="tarjeta-zona__cifra tarjeta-zona__cifra--texto">Sin dato</p>' +
      marca(est) +
      '<a class="zona-enlace" href="zona.html?zona=' + esc(encodeURIComponent(est.id)) +
        '">Ver detalle de ' + esc(est.nombre) + '</a>' +
      '</article>';
  }

  function llenarRejillas() {
    var nodos = document.querySelectorAll('[data-estaciones]');
    var html = estaciones().map(tarjeta).join('');
    Array.prototype.forEach.call(nodos, function (n) { n.innerHTML = html; });
  }

  function llenarSelector() {
    var sel = document.getElementById('zona-selector');
    if (!sel) return;
    var actual = parametro('zona') || (estaciones()[0] && estaciones()[0].id) || '';
    sel.innerHTML = estaciones().map(function (est) {
      return '<option value="' + esc(est.id) + '"' + (est.id === actual ? ' selected' : '') +
        '>' + esc(est.nombre) + '</option>';
    }).join('');
  }

  function texto(id, valor) {
    var n = document.getElementById(id);
    if (n) n.textContent = valor;
  }

  function html(id, valor) {
    var n = document.getElementById(id);
    if (n) n.innerHTML = valor;
  }

  function fechaCorta(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return String(d.getUTCDate()).padStart(2, '0') + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + d.getUTCFullYear();
  }

  function llenarZona() {
    if (!document.getElementById('zona-nombre')) return;
    var lista = estaciones();
    if (!lista.length) return;
    var id = parametro('zona');
    var est = porId(id) || lista[0];
    var acceso = est.acceso || {};
    texto('zona-nombre', est.nombre);
    texto('zona-lugar', lugarTexto(est));
    texto('zona-lectura', 'Sin dato');
    texto('zona-acumulado', '—');
    texto('zona-acceso', 'Sin información');
    texto('zona-id', est.id);
    texto('zona-sector', est.sector || '—');
    texto('zona-quebrada', est.quebrada || '—');
    texto('zona-elevacion', est.elevacion_m === null || est.elevacion_m === undefined ? '—' : est.elevacion_m + ' m');
    texto('zona-lecturas', est.lecturas === null || est.lecturas === undefined ? '—' : String(est.lecturas));
    texto('zona-referencia', fechaCorta(est.referencia_dato));
    texto('zona-nota', acceso.nota || 'Sin información de acceso: no hay una constatación registrada.');
    html('zona-marca', marca(est));
    var enlace = document.getElementById('zona-enlace-registrar');
    if (enlace) enlace.href = 'registrar.html?zona=' + encodeURIComponent(est.id);
  }

  function llenarRuta() {
    var caja = document.getElementById('ruta-linea');
    if (!caja) return;
    var lista = estaciones();
    var ancho = 1200;
    var alto = 120 + lista.length * 76;
    var partes = ['<svg viewBox="0 0 ' + ancho + ' ' + alto + '" role="img" aria-label="Esquema lineal de la ruta G-25">'];
    partes.push('<line x1="140" y1="40" x2="140" y2="' + (alto - 40) + '" stroke="#0E6474" stroke-width="4"/>');
    lista.forEach(function (est, i) {
      var y = 76 + i * 76;
      partes.push('<circle cx="140" cy="' + y + '" r="12" fill="#F4F7F5" stroke="#0E6474" stroke-width="4"/>');
      partes.push('<text x="180" y="' + (y + 6) + '">' + esc(est.nombre) + '</text>');
      partes.push('<text x="640" y="' + (y + 6) + '">Acceso sin información</text>');
    });
    partes.push('</svg>');
    caja.innerHTML = partes.join('');
  }

  function llenarSelectoresZona() {
    var nodos = document.querySelectorAll('[data-selector-zonas]');
    Array.prototype.forEach.call(nodos, function (n) {
      n.innerHTML = estaciones().map(function (est) {
        return '<option value="' + esc(est.id) + '">' + esc(est.nombre) + '</option>';
      }).join('');
    });
  }

  function registro() {
    var pasos = document.querySelectorAll('[data-paso]');
    if (!pasos.length) return;
    var actual = 1;
    function mostrar(n) {
      actual = n;
      Array.prototype.forEach.call(pasos, function (p) {
        p.hidden = Number(p.getAttribute('data-paso')) !== n;
      });
      var resumen = document.getElementById('registro-resumen');
      if (resumen) {
        var sel = document.getElementById('registro-zona');
        var nombre = sel && sel.value ? (porId(sel.value) || {}).nombre : '—';
        var mm = document.getElementById('registro-mm');
        resumen.textContent = 'Zona: ' + (nombre || '—') + '. Lluvia declarada: ' +
          (mm && mm.value ? mm.value + ' mm' : '—') + '.';
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-accion-paso]'), function (b) {
      b.addEventListener('click', function () {
        var accion = b.getAttribute('data-accion-paso');
        if (accion === 'siguiente') mostrar(Math.min(3, actual + 1));
        if (accion === 'atras') mostrar(Math.max(1, actual - 1));
        if (accion === 'inicio') mostrar(1);
      });
    });
    mostrar(1);
  }

  function aviso() {
    var boton = document.getElementById('aviso-preparar');
    if (!boton) return;
    boton.addEventListener('click', function () {
      var lugar = document.getElementById('aviso-zona');
      var textoArea = document.getElementById('aviso-texto');
      var nombre = lugar && lugar.value ? (porId(lugar.value) || {}).nombre : '—';
      texto('aviso-vista', 'Lugar: ' + (nombre || '—') + '. Hecho: ' +
        ((textoArea && textoArea.value) || 'sin texto') + '. Esta copia no envía el aviso.');
    });
  }

  function archivoLocal() {
    var entrada = document.getElementById('archivo-local');
    if (!entrada) return;
    entrada.addEventListener('change', function () {
      texto('archivo-nombre', entrada.files && entrada.files[0] ? entrada.files[0].name : 'Ningún archivo elegido');
    });
  }

  function filtro() {
    var entrada = document.getElementById('filtro-lista');
    if (!entrada) return;
    entrada.addEventListener('input', function () {
      var q = entrada.value.toLowerCase();
      var filas = document.querySelectorAll('[data-filtrable]');
      Array.prototype.forEach.call(filas, function (f) {
        f.hidden = f.textContent.toLowerCase().indexOf(q) < 0;
      });
    });
  }

  llenarSelectoresZona();
  llenarRejillas();
  llenarSelector();
  llenarZona();
  llenarRuta();
  registro();
  aviso();
  archivoLocal();
  filtro();
}());
