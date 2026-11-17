/* Maipo Vigía · comportamiento del panel
   Sin dependencias y sin red: todo lo que necesita está en datos/*.js.

   Los nombres y los tipos de cada registro son los del firmware
   (panel-web/enlace-datos.md §3.1). Acá no se renombra ninguna clave: `source`
   vale `automatico` o `manual`, y el acumulado se calcula sobre `automatico`.
   Ninguna cifra de esta página es una medición real: el archivo de datos se
   declara simulado y el rótulo no se toca desde acá. */

(function () {
  'use strict';

  var TZ = 'America/Santiago';
  var HORA_MS = 3600000;
  var VENTANA_24H_MS = 24 * HORA_MS;
  /* Desde cuándo una publicación deja de ser «de ahora». No corrige nada:
     solo decide si la antigüedad se marca como dato antiguo. */
  var UMBRAL_ANTIGUO_MS = 6 * HORA_MS;

  /* ------------------------------------------------------------- formato */

  var fmtDia = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ
  });
  var fmtHora = new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ
  });
  var fmtDiaMes = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', timeZone: TZ
  });
  var fmtYMD = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ
  });
  var fmtNum1 = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 1, maximumFractionDigits: 1
  });
  var fmtNum0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

  function uno(n) { return fmtNum1.format(n); }
  function entero(n) { return fmtNum0.format(n); }
  function hora(iso) { return fmtHora.format(new Date(iso)); }
  function dia(iso) { return fmtDia.format(new Date(iso)); }
  function cuando(iso) { return dia(iso) + ', ' + hora(iso); }
  function ymd(iso) { return fmtYMD.format(new Date(iso)); }
  function msDe(iso) { return new Date(iso).getTime(); }
  function redondear(n) { return Math.round(n * 10) / 10; }
  function plural(n, singular, varios) { return n === 1 ? singular : varios; }

  /* "14-11 18:00": la fecha corta alcanza dentro de un evento de dos días. */
  function corto(iso) {
    var partes = fmtDiaMes.formatToParts(new Date(iso));
    var dd = '', mm = '';
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].type === 'day') dd = partes[i].value;
      if (partes[i].type === 'month') mm = partes[i].value;
    }
    return dd + '-' + mm + ' ' + hora(iso);
  }

  /* La hora de medir y la hora de publicar son distintas y se muestran las dos.
     Una publicación de otro día lleva su fecha; la misma noche, solo la hora. */
  function publicado(medidoIso, publicadoIso) {
    if (!publicadoIso) return null;
    return ymd(medidoIso) === ymd(publicadoIso) ? hora(publicadoIso) : corto(publicadoIso);
  }

  function duracion(horas) {
    if (!isFinite(horas) || horas <= 0) return 'sin duración';
    var minutos = Math.round(horas * 60);
    var h = Math.floor(minutos / 60);
    var m = minutos % 60;
    if (!h) return m + ' min';
    if (!m) return h + ' h';
    return h + ' h ' + m + ' min';
  }

  function hace(iso) {
    var delta = Date.now() - msDe(iso);
    if (!isFinite(delta)) return '';
    var horas = Math.round(Math.abs(delta) / HORA_MS);
    if (delta < 0) return 'con fecha posterior a hoy';
    if (delta < HORA_MS) return 'hace menos de una hora';
    if (horas < 24) return 'hace ' + horas + (horas === 1 ? ' hora' : ' horas');
    var dias = Math.floor(horas / 24);
    return 'hace ' + dias + (dias === 1 ? ' día' : ' días');
  }

  /* -------------------------------------------------- contrato de datos */

  /* Los siete campos del dispositivo, en el orden del firmware y con sus
     nombres exactos (enlace-datos.md §3.1). */
  var CLAVES = ['id', 'station_id', 'timestamp', 'rainfall_mm', 'temperature_c', 'source', 'verified'];

  /* Dominio cerrado de `source`: el dispositivo emite `automatico`; el
     simulador agrega `manual`. Lo que no esté acá se rechaza (§3.4-6). */
  var CANALES = { automatico: 'Sensor automático', manual: 'Lector manual' };

  /* Condición declarada por la copia publicada en `estado`. No decide el
     canal: son dos campos distintos (§7 D15). */
  var CONDICIONES = {
    simulado: 'datos simulados',
    real: 'dato real',
    historico: 'dato histórico'
  };

  var DESFASE = /(Z|[+-]\d{2}:?\d{2})$/;
  var TEMP_MIN = -100;
  var TEMP_MAX = 100;

  function esNumero(v) { return typeof v === 'number' && isFinite(v); }
  function esTexto(v) { return typeof v === 'string' && v.trim() !== ''; }

  /* Devuelve null si el registro sirve, o el motivo por el que no.
     Las reglas son las de enlace-datos.md §3.4: no se completa, no se
     convierte un tipo y no se adivina un campo que falta. */
  function revisar(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return 'no es un objeto';
    for (var i = 0; i < CLAVES.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(m, CLAVES[i])) {
        return 'le falta la clave ' + CLAVES[i];
      }
    }
    if (!esTexto(m.id)) return 'id no es texto';
    if (!esTexto(m.station_id)) return 'station_id no es texto';
    if (!esTexto(m.timestamp) || !DESFASE.test(m.timestamp) || !isFinite(msDe(m.timestamp))) {
      return 'timestamp sin desfase horario o sin fecha válida';
    }
    if (!esNumero(m.rainfall_mm) || m.rainfall_mm < 0) return 'rainfall_mm no es un número mayor o igual que 0';
    if (m.temperature_c !== null && !esNumero(m.temperature_c)) return 'temperature_c no es número ni nulo';
    if (typeof m.source !== 'string' || !CANALES[m.source.toLowerCase()]) return 'source fuera del dominio';
    if (typeof m.verified !== 'boolean') return 'verified no es booleano';
    return null;
  }

  /* Una temperatura fuera de (-100, 100) no se publica como número: se
     declara ausente. El firmware descarta la lectura en ese caso (§3.4-7). */
  function temperatura(m) {
    if (!esNumero(m.temperature_c)) return null;
    if (m.temperature_c <= TEMP_MIN || m.temperature_c >= TEMP_MAX) return null;
    return m.temperature_c;
  }

  function leerDatos() {
    var bruto = window.REGISTROS;
    if (!bruto) {
      return {
        error: 'No existe window.REGISTROS. El archivo datos/registros.js no llegó o no se pudo leer.'
      };
    }
    /* Una sola forma: un objeto con label, generated_at, published_at, station y el
       arreglo de registros en measurements (panel-web/datos/formato_panel.py). */
    if (typeof bruto !== 'object' || Array.isArray(bruto)) {
      return {
        error: 'window.REGISTROS no es el objeto que espera el panel: debe traer label, ' +
          'generated_at, published_at, station y measurements. La forma la define ' +
          'panel-web/datos/formato_panel.py.'
      };
    }
    var crudos = bruto.measurements;
    if (!Array.isArray(crudos)) {
      return {
        error: 'window.REGISTROS.measurements no es un arreglo de registros: el archivo no ' +
          'tiene la forma que define panel-web/datos/formato_panel.py.'
      };
    }
    var validos = [];
    var rechazos = [];
    for (var i = 0; i < crudos.length; i++) {
      var motivo = revisar(crudos[i]);
      if (motivo) {
        rechazos.push({
          id: (crudos[i] && crudos[i].id) ? String(crudos[i].id) : 'sin id',
          motivo: motivo
        });
        continue;
      }
      crudos[i].source = crudos[i].source.toLowerCase();
      validos.push(crudos[i]);
    }
    validos.sort(function (a, b) { return msDe(a.timestamp) - msDe(b.timestamp); });
    return { registros: validos, rechazos: rechazos, meta: bruto };
  }

  /* ------------------------------------------------------------ helpers */

  function porId(id) { return document.getElementById(id); }
  function texto(id, valor) {
    var n = porId(id);
    if (n) n.textContent = valor;
  }
  function mostrar(id) {
    var n = porId(id);
    if (n) n.hidden = false;
  }
  function ocultar(id) {
    var n = porId(id);
    if (n) n.hidden = true;
  }
  function limpiar(n) {
    if (!n) return;
    while (n.firstChild) n.removeChild(n.firstChild);
  }
  function nodo(etiqueta, clase, contenido) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (contenido !== undefined && contenido !== null) n.textContent = String(contenido);
    return n;
  }
  /* La marca en línea del sistema visual. Hereda pigmento y nivel de agua del
     contenedor cuando este trae [data-estado]; si no, se le da el modificador. */
  function marcaDato(txt, modificador) {
    return nodo('span', 'marca-dato' + (modificador ? ' ' + modificador : ''), txt);
  }
  /* Texto para lectores de pantalla, sin ocupar lugar en la pantalla. */
  function paraLector(txt) { return nodo('span', 'visualmente-oculta', txt); }
  /* Valor que no existe: guion largo, nunca un cero (§8.4 del sistema). */
  function ausente(nota) {
    var frag = document.createDocumentFragment();
    frag.appendChild(nodo('span', 'valor-ausente', '—'));
    if (nota) frag.appendChild(paraLector(' ' + nota));
    return frag;
  }
  /* Deja el guion largo en un contenedor que puede no existir. */
  function ponerAusente(id, nota) {
    var n = porId(id);
    if (!n) return;
    limpiar(n);
    n.appendChild(ausente(nota));
  }

  /* --------------------------------------------------------------- datos */

  var datos = leerDatos();

  if (datos.error) {
    /* Sin archivo de datos, el resto de la página sigue funcionando: la serie
       histórica, el índice de secciones y el pie no dependen de él. */
    fallar(datos.error);
    pintarHistoricos();
    regla();
    modo();
    window.__maipoIniciado = true;
    return;
  }

  var meta = datos.meta || {};
  var estacion = meta.station || {};
  var registros = datos.registros;
  var rechazos = datos.rechazos;

  var auto = [];
  var manuales = [];
  for (var r = 0; r < registros.length; r++) {
    if (registros[r].source === 'manual') manuales.push(registros[r]);
    else auto.push(registros[r]);
  }

  /* Todos los registros tienen que ser del mismo punto: sumar puntos distintos en un
     solo acumulado sería inventar un dato que no existe. */
  var puntos = [];
  for (var p = 0; p < registros.length; p++) {
    if (puntos.indexOf(registros[p].station_id) < 0) puntos.push(registros[p].station_id);
  }
  var puntoUnico = puntos.length === 1;

  /* Acumulado del tramo: suma del sensor desde el inicio de la serie y se
     reinicia en cada vaciado del tubo (`tube_empty`), no en cada fila. */
  var acumulados = [];
  (function () {
    var corrida = 0;
    for (var i = 0; i < auto.length; i++) {
      if (auto[i].tube_empty === true) corrida = auto[i].rainfall_mm;
      else corrida += auto[i].rainfall_mm;
      acumulados.push({
        fila: auto[i],
        acumulado: redondear(corrida),
        corte: auto[i].tube_empty === true
      });
    }
  })();

  /* Las filas de la tabla en el orden cronológico del archivo, con el
     acumulado del sensor cuando la fila es del sensor. */
  var filasTabla = (function () {
    var salida = [];
    var j = 0;
    for (var i = 0; i < registros.length; i++) {
      var m = registros[i];
      var acumulado = null;
      var corte = false;
      if (m.source === 'automatico' && j < acumulados.length) {
        acumulado = acumulados[j].acumulado;
        corte = acumulados[j].corte;
        j++;
      }
      salida.push({ fila: m, acumulado: acumulado, corte: corte });
    }
    return salida;
  })();

  function suma(lista) {
    var total = 0;
    for (var i = 0; i < lista.length; i++) total += lista[i].rainfall_mm;
    return redondear(total);
  }

  var primeroAutoMs = auto.length ? msDe(auto[0].timestamp) : 0;
  var ultimoAutoMs = auto.length ? msDe(auto[auto.length - 1].timestamp) : 0;
  var horasSensor = auto.length ? (ultimoAutoMs - primeroAutoMs) / HORA_MS : 0;

  /* Ventana declarada: las 24 horas que terminan en la última lectura del
     sensor. La lluvia se suma entera: vaciar el tubo no le resta lluvia a la
     ventana, porque el acumulado de 24 h no es el nivel del tubo. */
  var inicioVentanaMs = ultimoAutoMs - VENTANA_24H_MS;
  var ventanaCompleta = auto.length > 0 && primeroAutoMs <= inicioVentanaMs;
  var enVentana = auto.filter(function (m) { return msDe(m.timestamp) >= inicioVentanaMs; });
  var acumulado24 = suma(enVentana);

  var totalArchivo = suma(auto);

  var cortes = acumulados.filter(function (f) { return f.corte; });
  var ultimoCorte = cortes.length ? cortes[cortes.length - 1] : null;
  var desdeCorte = null;
  if (ultimoCorte) {
    desdeCorte = suma(auto.filter(function (m) {
      return msDe(m.timestamp) >= msDe(ultimoCorte.fila.timestamp);
    }));
  }

  var ultimaManual = manuales.length ? manuales[manuales.length - 1] : null;
  var sensorAlManual = null;
  if (ultimaManual) {
    sensorAlManual = suma(auto.filter(function (m) {
      return msDe(m.timestamp) <= msDe(ultimaManual.timestamp);
    }));
  }

  /* Condición declarada en la copia publicada (campo `estado`). */
  function condiciones() {
    var vistas = [];
    for (var i = 0; i < registros.length; i++) {
      var c = (typeof registros[i].estado === 'string' && registros[i].estado.trim())
        ? registros[i].estado.trim().toLowerCase()
        : 'sin-condicion';
      if (vistas.indexOf(c) < 0) vistas.push(c);
    }
    if (!vistas.length) vistas.push('sin-condicion');
    return vistas;
  }

  function esSimulado() {
    var cs = condiciones();
    return cs.length === 1 && cs[0] === 'simulado';
  }

  function rotuloCondicion() {
    if (esSimulado()) {
      return 'Datos simulados para prueba. No corresponden a una medición real.';
    }
    var cs = condiciones();
    if (cs.length === 1 && cs[0] === 'sin-condicion') {
      return 'La condición del dato no está declarada en el archivo. No se afirma que sean mediciones reales.';
    }
    return 'Condiciones declaradas en el archivo: ' + cs.join(', ') + '.';
  }

  /* ---------------------------------------------------------------- fallo */

  function fallar(motivo) {
    ocultar('estado-carga');
    ocultar('panel-datos');
    ocultar('estado-vacio');
    ocultar('estado-sin-sensor');
    ocultar('estado-rechazos');
    ocultar('estado-puntos');
    ocultar('estado-periodo');
    /* La cabecera no se esconde: si no hay datos, el título dice el asunto y
       no se inventa el nombre de una estación que no se pudo leer. */
    texto('estacion-nombre', 'El registro del evento');
    texto('estacion-detalle', 'El archivo de datos no llegó, así que no hay punto, período ni cifras que mostrar.');
    texto('ultima-publicacion', '');
    limpiar(porId('ultima-publicacion'));
    ponerAusente('ultima-publicacion', 'sin fecha de publicación');
    limpiar(porId('ultima-publicacion-edad'));
    texto('estado-error-motivo', motivo);
    mostrar('estado-error');
  }

  /* ---------------------------------------------------------------- ficha */

  function pintarFicha() {
    texto('estacion-nombre', esTexto(estacion.name) ? estacion.name : 'Punto sin nombre declarado');

    var detalle = [];
    if (esTexto(estacion.sector)) detalle.push(estacion.sector);
    if (esTexto(estacion.region)) detalle.push(estacion.region);
    /* La altitud es opcional: si no viene o viene nula, se omite. Nunca «null m». */
    if (esNumero(estacion.elevation_m)) detalle.push(entero(estacion.elevation_m) + ' m');
    texto('estacion-detalle', detalle.length
      ? detalle.join(' · ')
      : 'El archivo no declara sector, región ni altitud.');

    texto('ultima-publicacion', '');
    limpiar(porId('ultima-publicacion'));
    limpiar(porId('ultima-publicacion-edad'));

    /* La última publicación es la mayor entre el metadato del archivo y la fecha de
       publicación de cada fila: el metadato no puede quedar por detrás de lo que
       contiene. Si la fila es posterior, se marca en la ficha. */
    var publicadoMetaMs = esTexto(meta.published_at) && isFinite(msDe(meta.published_at))
      ? msDe(meta.published_at)
      : null;
    var publicadoFilasMs = null;
    for (var i = 0; i < registros.length; i++) {
      var marcaFila = registros[i].published_at;
      if (esTexto(marcaFila) && isFinite(msDe(marcaFila))) {
        var t = msDe(marcaFila);
        if (publicadoFilasMs === null || t > publicadoFilasMs) publicadoFilasMs = t;
      }
    }
    var publicadoMs = Math.max(publicadoMetaMs === null ? 0 : publicadoMetaMs,
      publicadoFilasMs === null ? 0 : publicadoFilasMs);
    var publicadoIso = publicadoMs ? new Date(publicadoMs).toISOString() : null;

    if (publicadoIso) {
      texto('ultima-publicacion', cuando(publicadoIso));
      var edad = Date.now() - publicadoMs;
      porId('ultima-publicacion-edad').appendChild(
        marcaDato(hace(publicadoIso), edad > UMBRAL_ANTIGUO_MS ? 'marca-dato--antiguo' : null)
      );
    } else {
      ponerAusente('ultima-publicacion', 'sin fecha de publicación en el archivo');
    }

    texto('f-punto', (esTexto(estacion.id) ? estacion.id : 'sin identificador') + ' · ' +
      (esTexto(estacion.commune) ? estacion.commune : 'comuna no declarada') +
      ', sector aproximado');

    var intervalo = esNumero(estacion.interval_min) ? entero(estacion.interval_min) + ' min' : null;
    texto('f-unidad', 'Milímetros de lluvia (mm) por registro.' +
      (intervalo
        ? ' Intervalo declarado en el archivo: ' + intervalo + '.'
        : ' El archivo no declara el intervalo entre registros.'));

    if (registros.length === 1) {
      texto('f-periodo', corto(registros[0].timestamp) + ' (un solo registro, sin tramo)');
    } else if (registros.length) {
      var horasArchivo = (msDe(registros[registros.length - 1].timestamp) - msDe(registros[0].timestamp)) / HORA_MS;
      texto('f-periodo', corto(registros[0].timestamp) + ' → ' +
        corto(registros[registros.length - 1].timestamp) +
        ' (' + duracion(horasArchivo) + ', ' + registros.length + ' ' +
        plural(registros.length, 'registro', 'registros') + ')');
    } else {
      ponerAusente('f-periodo', 'sin registros');
    }

    /* La fuente no se escribe fija: sale de los datos. Si mañana el archivo
       no trae lecturas manuales, el rótulo deja de nombrarlas. */
    var canales = [];
    if (auto.length) canales.push('sensor automático');
    if (manuales.length) canales.push('lector manual');
    /* El centinela del archivo no se imprime crudo: se dice con palabras. */
    var cond = condiciones().map(function (c) {
      if (c === 'sin-condicion') return 'condición no declarada';
      return CONDICIONES[c] || ('condición «' + c + '»');
    }).join(', ');
    texto('f-fuente', (canales.length ? canales.join(' y ') : 'sin canal declarado') + ' · ' + cond);

    var celdaPublicacion = porId('f-publicacion');
    if (!celdaPublicacion) return;
    limpiar(celdaPublicacion);
    if (publicadoMetaMs !== null) {
      var metaIso = new Date(publicadoMetaMs).toISOString();
      celdaPublicacion.appendChild(document.createTextNode(cuando(metaIso)));
      celdaPublicacion.appendChild(document.createTextNode(' · '));
      if (Date.now() - publicadoMetaMs > UMBRAL_ANTIGUO_MS) {
        celdaPublicacion.setAttribute('data-estado', 'antiguo');
      } else {
        celdaPublicacion.removeAttribute('data-estado');
      }
      /* La marca hereda el pigmento del contenedor con data-estado. */
      celdaPublicacion.appendChild(marcaDato(hace(metaIso), null));
      if (publicadoFilasMs !== null && publicadoFilasMs > publicadoMetaMs) {
        celdaPublicacion.appendChild(document.createTextNode(' '));
        celdaPublicacion.appendChild(marcaDato('una fila es posterior', 'marca-dato--error'));
        celdaPublicacion.appendChild(paraLector(' El metadato del archivo declara una ' +
          'publicación anterior a la de alguna de sus filas; la última publicación del ' +
          'reloj se toma de las filas.'));
      }
    } else {
      celdaPublicacion.appendChild(ausente('sin fecha de publicación en el archivo'));
    }

    var pie = porId('panel-pie');
    if (pie) {
      limpiar(pie);
      pie.appendChild(document.createTextNode(
        'El archivo se declara «' + rotuloCondicion().replace(/\.$/, '') +
        '». Los dos archivos descargables llevan ese rótulo adentro: si uno circula suelto, ' +
        'tiene que poder identificarse igual.'));
      /* El contrato pide `estado` en la copia publicada: si falta, se avisa el lote. */
      var sinCondicion = 0;
      for (var c = 0; c < registros.length; c++) {
        if (!esTexto(registros[c].estado)) sinCondicion++;
      }
      if (sinCondicion) {
        pie.appendChild(document.createTextNode(' ' +
          (sinCondicion === registros.length
            ? 'Ningún registro declara la condición del dato (`estado`)'
            : sinCondicion + ' de ' + registros.length + ' registros no declaran la condición del dato (`estado`)') +
          ': el panel no afirma que sean mediciones reales.'));
      }
    }
  }

  /* --------------------------------------------------------------- cifras */

  function pintarCifras() {
    /* Acumulado de 24 horas: la ventana se declara y, si la serie no la
       cubre, se marca como parcial. No se presenta como total del evento. */
    texto('c-acumulado', uno(acumulado24) + ' mm');
    var nota24 = porId('c-acumulado-nota');
    limpiar(nota24);
    nota24.appendChild(document.createTextNode(
      'Lecturas del sensor entre el ' + corto(new Date(inicioVentanaMs)) +
      ' y el ' + corto(new Date(ultimoAutoMs)) + '.'));

    var item24 = porId('item-acumulado');
    if (!ventanaCompleta) {
      if (item24) item24.setAttribute('data-estado', 'parcial');
      nota24.appendChild(document.createTextNode(' '));
      /* Sin modificador: el pigmento y el nivel de agua los hereda del
         contenedor con data-estado="parcial". */
      nota24.appendChild(marcaDato('ventana incompleta', null));
    } else if (item24) {
      item24.removeAttribute('data-estado');
    }

    /* Total del archivo: es otra cosa y se dice cuál. */
    texto('c-total', uno(totalArchivo) + ' mm');
    var notaTotal = 'Suma de las ' + auto.length + ' ' +
      plural(auto.length, 'lectura', 'lecturas') + ' del sensor en todo el archivo (' +
      corto(new Date(primeroAutoMs)) + ' → ' + corto(new Date(ultimoAutoMs)) + ', ' +
      duracion(horasSensor) + '). No es una intensidad y no es un acumulado de 24 h.';
    if (Math.abs(totalArchivo - acumulado24) < 0.05) {
      notaTotal += ' Hoy coincide con el acumulado de 24 h porque la serie dura ' +
        duracion(horasSensor) + ': son dos cuentas distintas, no la misma.';
    }
    texto('c-total-nota', notaTotal);

    /* Intensidad: promedio del período, no intensidad de un intervalo. */
    if (horasSensor > 0) {
      texto('c-intensidad', uno(totalArchivo / horasSensor) + ' mm/h');
      texto('c-intensidad-nota', 'Promedio de ' + uno(totalArchivo) + ' mm en ' +
        duracion(horasSensor) + '. No es la intensidad de un intervalo de 10 minutos: ' +
        'el sketch de referencia emite un registro por pulsación, sin temporizador.');
    } else {
      ponerAusente('c-intensidad', 'no se puede calcular sin dos lecturas del sensor');
      texto('c-intensidad-nota', 'Hace falta más de una lectura del sensor para promediar.');
    }

    /* Vaciado del tubo: el acumulado del tramo arranca de nuevo ahí. */
    limpiar(porId('c-desde-corte'));
    limpiar(porId('c-desde-corte-nota'));
    if (ultimoCorte) {
      texto('c-desde-corte', uno(desdeCorte) + ' mm');
      var notaCorte = 'El tubo se vació a las ' + hora(ultimoCorte.fila.timestamp) +
        ' del ' + dia(ultimoCorte.fila.timestamp) +
        ' y el acumulado del tramo arranca de nuevo ahí. ' +
        (cortes.length === 1
          ? 'Es el único vaciado del archivo.'
          : 'Hay ' + cortes.length + ' vaciados en el archivo; se muestra el último.');
      texto('c-desde-corte-nota', notaCorte);
    } else {
      ponerAusente('c-desde-corte', 'no hubo vaciado del tubo');
      texto('c-desde-corte-nota',
        'No se registró un vaciado del tubo en este archivo, así que no hay un tramo que empiece de nuevo.');
    }

    /* Comparación con el pluviómetro manual: dos medidas distintas a la misma hora. */
    limpiar(porId('c-manual'));
    limpiar(porId('c-manual-nota'));
    if (ultimaManual && sensorAlManual !== null) {
      var diferencia = redondear(Math.abs(sensorAlManual - ultimaManual.rainfall_mm));
      texto('c-manual', uno(diferencia) + ' mm');
      texto('c-manual-nota', 'Sensor ' + uno(sensorAlManual) + ' mm contra manual ' +
        uno(ultimaManual.rainfall_mm) + ' mm a las ' + hora(ultimaManual.timestamp) +
        '. Es la diferencia entre las dos medidas a esa hora; el acumulado del sensor se ' +
        'toma desde el inicio de la serie, sin descontar el vaciado del tubo.');
    } else {
      ponerAusente('c-manual', ultimaManual
        ? 'sin lectura del sensor anterior a la lectura manual'
        : 'sin lectura manual en el archivo');
      texto('c-manual-nota', ultimaManual
        ? 'La lectura manual no tiene ninguna del sensor antes, así que no hay con qué comparar.'
        : 'El archivo no trae ninguna lectura del lector manual, así que no hay con qué comparar.');
    }

    /* Estado del período: la serie no cubre la ventana de 24 h. */
    var bloquePeriodo = porId('estado-periodo');
    if (bloquePeriodo) {
      if (auto.length && !ventanaCompleta) {
        texto('estado-periodo-texto',
          'La serie del sensor va del ' + corto(new Date(primeroAutoMs)) + ' al ' +
          corto(new Date(ultimoAutoMs)) + ': ' + duracion(horasSensor) + '. La ventana de 24 h ' +
          'que termina en la última lectura empieza el ' + corto(new Date(inicioVentanaMs)) +
          ', así que el acumulado de 24 h cubre solo ' +
          duracion((ultimoAutoMs - Math.max(primeroAutoMs, inicioVentanaMs)) / HORA_MS) +
          ' de 24 h. Se informa como parcial y no se anuncia como total.');
        texto('estado-periodo-pie',
          'Falta la serie anterior al ' + corto(new Date(primeroAutoMs)) +
          '. No se rellena con cero: se declara.');
        bloquePeriodo.hidden = false;
      } else {
        bloquePeriodo.hidden = true;
      }
    }
  }

  /* -------------------------------------------------------------- gráfico */

  function svgEl(nombre, atributos) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', nombre);
    for (var k in atributos) {
      if (Object.prototype.hasOwnProperty.call(atributos, k)) el.setAttribute(k, atributos[k]);
    }
    return el;
  }

  function dibujar() {
    var lienzo = porId('lienzo');
    if (!lienzo) return;
    limpiar(lienzo);
    if (!auto.length) return;

    lienzo.setAttribute('aria-label',
      'Gráfico de ' + auto.length + ' ' + plural(auto.length, 'lectura', 'lecturas') +
      ' del sensor entre el ' + corto(new Date(primeroAutoMs)) + ' y el ' +
      corto(new Date(ultimoAutoMs)) + '. Cada barra es la lluvia del registro; la línea es ' +
      'el acumulado del tramo, que se reinicia en cada vaciado del tubo.' +
      (cortes.length
        ? ' Hay ' + cortes.length + ' ' + plural(cortes.length, 'vaciado marcado', 'vaciados marcados') + '.'
        : ''));

    var W = Math.max(300, Math.round(lienzo.clientWidth || 900));
    var angosto = W < 620;
    var alto = angosto ? 300 : 320;
    var m = { t: angosto ? 26 : 34, r: angosto ? 40 : 84, b: 38, l: angosto ? 34 : 48 };
    var pw = W - m.l - m.r;
    var ph = alto - m.t - m.b;

    var maxBarraDato = 0;
    for (var i = 0; i < auto.length; i++) {
      if (auto[i].rainfall_mm > maxBarraDato) maxBarraDato = auto[i].rainfall_mm;
    }
    var maxBarra = Math.max(0.5, Math.ceil(maxBarraDato * 2) / 2);

    var maxAcumDato = 0;
    for (var a = 0; a < acumulados.length; a++) {
      if (acumulados[a].acumulado > maxAcumDato) maxAcumDato = acumulados[a].acumulado;
    }
    var pasoAcum = maxAcumDato <= 20 ? 5 : (maxAcumDato <= 60 ? 10 : 25);
    var maxAcum = Math.max(pasoAcum, Math.ceil(maxAcumDato / pasoAcum) * pasoAcum);

    var paso = pw / auto.length;
    var anchoBarra = Math.max(3, paso * 0.58);

    function x(indice) { return m.l + paso * (indice + 0.5); }
    function yBarra(v) { return m.t + ph - (v / maxBarra) * ph; }
    function yAcum(v) { return m.t + ph - (v / maxAcum) * ph; }

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + alto,
      role: 'presentation',
      focusable: 'false'
    });

    /* rejilla y eje izquierdo */
    var ticksY = angosto ? 2 : 4;
    for (var t = 0; t <= ticksY; t++) {
      var valor = (maxBarra / ticksY) * t;
      var y = yBarra(valor);
      svg.appendChild(svgEl('line', {
        x1: m.l, y1: y, x2: m.l + pw, y2: y,
        stroke: 'rgba(231,239,241,0.13)', 'stroke-width': 1
      }));
      var et = svgEl('text', {
        x: m.l - 10, y: y + 4, 'text-anchor': 'end',
        fill: '#9db4bb', 'font-size': 11
      });
      et.textContent = uno(valor);
      svg.appendChild(et);
    }

    /* eje derecho: acumulado del tramo */
    for (var v = 0; v <= maxAcum; v += pasoAcum) {
      var ya = yAcum(v);
      var ta = svgEl('text', {
        x: m.l + pw + 10, y: ya + 4, 'text-anchor': 'start',
        fill: '#6fc3cf', 'font-size': 11
      });
      ta.textContent = fmtNum0.format(v);
      svg.appendChild(ta);
    }

    /* barras: lluvia del registro */
    for (var b = 0; b < auto.length; b++) {
      var lectura = auto[b];
      var barra = svgEl('rect', {
        x: x(b) - anchoBarra / 2,
        y: yBarra(lectura.rainfall_mm),
        width: anchoBarra,
        height: Math.max(0, (lectura.rainfall_mm / maxBarra) * ph),
        fill: '#e8a32e',
        opacity: lectura.verified === false ? 0.55 : 0.92
      });
      var titulo = svgEl('title', {});
      titulo.textContent = hora(lectura.timestamp) + ' · ' + uno(lectura.rainfall_mm) + ' mm' +
        (lectura.verified === false ? ' · sin revisar' : '');
      barra.appendChild(titulo);
      svg.appendChild(barra);
    }

    /* línea del acumulado, que se corta en cada vaciado */
    var puntos = [];
    for (var k = 0; k < acumulados.length; k++) {
      puntos.push(x(k) + ',' + yAcum(acumulados[k].acumulado));
    }
    svg.appendChild(svgEl('polyline', {
      points: puntos.join(' '),
      fill: 'none',
      stroke: '#6fc3cf',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));

    /* cada vaciado, no solo el primero */
    for (var c = 0; c < cortes.length; c++) {
      var indiceCorte = auto.indexOf(cortes[c].fila);
      if (indiceCorte < 0) continue;
      var xc = x(indiceCorte);
      svg.appendChild(svgEl('line', {
        x1: xc, y1: m.t, x2: xc, y2: m.t + ph,
        stroke: '#f0c169', 'stroke-width': 1, 'stroke-dasharray': '3 4'
      }));
      var tc = svgEl('text', {
        x: Math.min(xc + 7, m.l + pw - 4),
        y: m.t + (c % 2 ? 26 : 12),
        'text-anchor': xc + 7 > m.l + pw - 4 ? 'end' : 'start',
        fill: '#f0c169', 'font-size': 11
      });
      tc.textContent = 'vaciado ' + hora(cortes[c].fila.timestamp);
      svg.appendChild(tc);
    }

    /* lectura manual sobre el eje del acumulado */
    manuales.forEach(function (lecturaManual) {
      var cercano = -1;
      for (var s = 0; s < auto.length; s++) {
        if (msDe(auto[s].timestamp) <= msDe(lecturaManual.timestamp)) cercano = s;
      }
      if (cercano < 0) return;
      var posX = x(cercano) + paso * 0.5;
      svg.appendChild(svgEl('line', {
        x1: posX, y1: yAcum(lecturaManual.rainfall_mm), x2: posX, y2: m.t + ph,
        stroke: 'rgba(240,193,105,0.35)', 'stroke-width': 1
      }));
      svg.appendChild(svgEl('circle', {
        cx: posX, cy: yAcum(lecturaManual.rainfall_mm), r: 5,
        fill: '#0f242c', stroke: '#f0c169', 'stroke-width': 2
      }));
      var haciaIzquierda = posX > m.l + pw * 0.62;
      var tm = svgEl('text', {
        x: haciaIzquierda ? posX - 10 : posX + 10,
        y: yAcum(lecturaManual.rainfall_mm) - 10,
        'text-anchor': haciaIzquierda ? 'end' : 'start',
        fill: '#f0c169', 'font-size': 11
      });
      tm.textContent = 'manual ' + uno(lecturaManual.rainfall_mm) + ' mm';
      svg.appendChild(tm);
    });

    /* eje de tiempo */
    for (var q = 0; q < auto.length; q++) {
      if (q % (angosto ? 10 : 6) !== 0) continue;
      var tt = svgEl('text', {
        x: x(q), y: m.t + ph + 22, 'text-anchor': 'middle',
        fill: '#9db4bb', 'font-size': 11
      });
      tt.textContent = hora(auto[q].timestamp);
      svg.appendChild(tt);
      svg.appendChild(svgEl('line', {
        x1: x(q), y1: m.t + ph, x2: x(q), y2: m.t + ph + 5,
        stroke: 'rgba(231,239,241,0.3)', 'stroke-width': 1
      }));
    }

    /* títulos de los dos ejes */
    if (!angosto) {
      var titulo1 = svgEl('text', { x: m.l, y: m.t - 12, fill: '#9db4bb', 'font-size': 11 });
      titulo1.textContent = 'mm por registro';
      svg.appendChild(titulo1);

      var titulo2 = svgEl('text', {
        x: m.l + pw + 10, y: m.t - 12, fill: '#6fc3cf', 'font-size': 11
      });
      titulo2.textContent = 'acumulado del tramo';
      svg.appendChild(titulo2);
    }

    lienzo.appendChild(svg);
  }

  /* ---------------------------------------------------------------- tabla */

  var filtro = 'todo';

  /* Los botones del filtro usan los valores reales de `source`: `automatico`
     y `manual`. Así no hay un tercer nombre para el sensor en el código. */
  function etiquetaFiltro() {
    if (filtro === 'automatico') return 'solo sensor automático';
    if (filtro === 'manual') return 'solo lector manual';
    return 'todos los canales';
  }

  function pintarTabla() {
    var cuerpo = document.querySelector('#tabla-registro tbody');
    if (!cuerpo) return;
    limpiar(cuerpo);

    var frag = document.createDocumentFragment();
    var visibles = 0;

    for (var i = 0; i < filasTabla.length; i++) {
      var item = filasTabla[i];
      var f = item.fila;
      if (filtro !== 'todo' && f.source !== filtro) continue;
      visibles++;

      var tr = document.createElement('tr');

      var tMedido = document.createElement('td');
      var tiempo = document.createElement('time');
      tiempo.setAttribute('datetime', f.timestamp);
      tiempo.textContent = corto(f.timestamp);
      tMedido.appendChild(tiempo);
      tr.appendChild(tMedido);

      var tLluvia = document.createElement('td');
      tLluvia.className = 'num cifra';
      tLluvia.textContent = uno(f.rainfall_mm);
      tr.appendChild(tLluvia);

      var tAcumulado = document.createElement('td');
      tAcumulado.className = 'num cifra';
      if (item.acumulado === null) {
        /* La lectura manual no suma al acumulado del sensor: no se inventa
           un número para llenar la celda. */
        tAcumulado.appendChild(ausente('Una lectura manual no suma al acumulado del sensor.'));
      } else {
        tAcumulado.appendChild(document.createTextNode(uno(item.acumulado)));
        if (item.corte) {
          tAcumulado.appendChild(document.createTextNode(' '));
          var marcaCorte = nodo('span', 'marca-fila', '·');
          marcaCorte.setAttribute('title', 'El tubo se vació en este registro');
          tAcumulado.appendChild(marcaCorte);
          tAcumulado.appendChild(paraLector(' Tubo vaciado en este registro: el acumulado del tramo arranca de nuevo acá.'));
        }
      }
      tr.appendChild(tAcumulado);

      var tTemp = document.createElement('td');
      tTemp.className = 'num cifra';
      var grados = temperatura(f);
      if (grados === null) {
        tTemp.appendChild(ausente(f.temperature_c === null
          ? 'Sin lectura de temperatura en este registro.'
          : 'Temperatura fuera del rango admitido; no se muestra.'));
      } else {
        tTemp.textContent = uno(grados);
      }
      tr.appendChild(tTemp);

      /* El punto de la fila, resuelto con el nombre de la estación cuando coincide. */
      var tPunto = document.createElement('td');
      tPunto.textContent = esTexto(estacion.id) && f.station_id === estacion.id && esTexto(estacion.name)
        ? f.station_id + ' · ' + estacion.name
        : f.station_id;
      tr.appendChild(tPunto);

      var tCanal = document.createElement('td');
      tCanal.textContent = CANALES[f.source] || f.source;
      tr.appendChild(tCanal);

      var tRevision = document.createElement('td');
      if (f.verified === true) {
        tRevision.textContent = 'Revisado';
      } else {
        tRevision.className = 'sin-revisar';
        tRevision.textContent = 'Sin revisar';
      }
      tr.appendChild(tRevision);

      var tPublicado = document.createElement('td');
      var horaPublicacion = publicado(f.timestamp, f.published_at);
      if (horaPublicacion) tPublicado.textContent = horaPublicacion;
      else tPublicado.appendChild(ausente('Sin hora de publicación en este registro.'));
      tr.appendChild(tPublicado);

      frag.appendChild(tr);
    }

    cuerpo.appendChild(frag);

    var resumen = 'Mostrando ' + visibles + ' de ' + registros.length + ' ' +
      plural(registros.length, 'registro', 'registros') + ' (' + etiquetaFiltro() + '). ' +
      auto.length + ' del sensor automático y ' + manuales.length + ' ' +
      plural(manuales.length, 'lectura manual', 'lecturas manuales') +
      ' en el archivo completo.';
    texto('filtro-estado', resumen);
  }

  /* ------------------------------------------------------------ históricos */

  function pintarHistoricos() {
    var cuerpo = document.querySelector('#historicos .tabla tbody');
    var aviso = porId('historico-estado');
    var leyendaTabla = document.querySelector('#historicos .tabla caption');
    if (!cuerpo) return;
    limpiar(cuerpo);

    var H = window.HISTORICOS;
    if (!H || !H.series || !Array.isArray(H.series.rows)) {
      /* El aviso se reemplaza por el error; no se suman dos mensajes. */
      if (aviso) {
        limpiar(aviso);
        aviso.className = 'aviso-vacio';
        aviso.setAttribute('data-estado', 'error');
        aviso.appendChild(nodo('p', 'aviso-vacio__titulo', 'No se pudo cargar la serie histórica'));
        aviso.appendChild(nodo('p', null, 'El archivo datos/historicos.js no llegó o no trae ' +
          'una serie. No se muestra ninguna cifra: sin dato no es cero.'));
      }
      if (leyendaTabla) leyendaTabla.textContent = 'Serie histórica no disponible';
      return;
    }

    /* El aviso, la fuente y el subtítulo salen de los metadatos del archivo. El texto
       de simulación aparece solo si el propio archivo lo declara. */
    var estadoSerie = (typeof H.status === 'string' ? H.status : '').toLowerCase();
    var fuenteSerie = esTexto(H.series.source) ? H.series.source : null;
    var declaracion = [H.label, H.series.source, H.series.name]
      .filter(function (x) { return typeof x === 'string'; }).join(' ');
    var simulada = /simulad|ficticia/i.test(declaracion);

    if (aviso) {
      limpiar(aviso);
      aviso.className = 'aviso-vacio';
      if (estadoSerie === 'pendiente') aviso.setAttribute('data-estado', 'vacio');
      else aviso.removeAttribute('data-estado');
      aviso.appendChild(nodo('p', 'aviso-vacio__titulo', estadoSerie === 'pendiente'
        ? 'Sin serie real incorporada'
        : (esTexto(H.series.name) ? H.series.name : 'Serie histórica')));
      aviso.appendChild(nodo('p', null, esTexto(H.explanation)
        ? H.explanation
        : 'El archivo no explica el estado de la serie; la página no agrega nada que el ' +
          'archivo no diga.'));
      if (simulada && esTexto(H.label)) {
        aviso.appendChild(nodo('p', 'estado__pie', H.label));
      }
    }

    if (leyendaTabla) {
      var partes = [];
      if (esTexto(H.series.name)) partes.push(H.series.name);
      if (esTexto(H.series.period)) partes.push('período ' + H.series.period);
      if (fuenteSerie) partes.push('fuente: ' + fuenteSerie);
      if (esTexto(H.series.unit)) partes.push(H.series.unit);
      leyendaTabla.textContent = partes.length ? partes.join(' · ') : 'Serie histórica';
    }

    var filas = H.series.rows;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var tr = document.createElement('tr');

      var tdDia = document.createElement('td');
      tdDia.textContent = String(f.date).split('-').reverse().join('-');
      tr.appendChild(tdDia);

      var tdTotal = document.createElement('td');
      tdTotal.className = 'num cifra';
      if (esNumero(f.total_mm)) {
        tdTotal.textContent = uno(f.total_mm) + ' mm';
      } else {
        /* Un vacío se conserva como vacío y se explica; no se rellena con cero. */
        tdTotal.appendChild(marcaDato('sin dato', 'marca-dato--vacio'));
        tdTotal.appendChild(paraLector(' Sin total para este día.'));
      }
      tr.appendChild(tdTotal);

      var tdFuente = document.createElement('td');
      if (fuenteSerie) {
        tdFuente.textContent = fuenteSerie;
      } else {
        tdFuente.appendChild(ausente('la serie no declara fuente'));
      }
      tr.appendChild(tdFuente);

      var tdNota = document.createElement('td');
      tdNota.textContent = f.note || 'Total del día. No se deriva intensidad horaria.';
      tr.appendChild(tdNota);

      frag.appendChild(tr);
    }
    cuerpo.appendChild(frag);
  }

  /* ------------------------------------------------------------- descargas */

  function bajar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var url = URL.createObjectURL(blob);
    var enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* El nombre del archivo usa la fecha del evento y la condición declarada,
     no la del día en que se descarga: una serie real no se descarga rotulada
     como simulada. */
  function nombreBase() {
    var referencia = registros.length ? registros[0].timestamp : new Date().toISOString();
    return 'maipo-vigia_' + condiciones().join('-') + '_' + ymd(referencia);
  }

  /* RFC 4180: comillas dobles y duplicado de las internas. Un salto de línea se
     reemplaza por un espacio para que el archivo se pueda volver a leer línea a línea, y
     un comienzo que Excel leería como fórmula se neutraliza con un apóstrofo. */
  function celdaCsv(valor) {
    var texto = (valor === null || valor === undefined) ? '' : String(valor);
    texto = texto.replace(/\r\n|\r|\n/g, ' ');
    if (/^[=+@\t-]/.test(texto)) texto = "'" + texto;
    if (/[";]/.test(texto)) texto = '"' + texto.replace(/"/g, '""') + '"';
    return texto;
  }

  function celdaNumero(valor) {
    return (valor === null || valor === undefined) ? '' : fmtNum1.format(valor);
  }

  function csv() {
    var lineas = [];
    lineas.push('# Maipo Vigia - ' + (esSimulado()
      ? 'DATOS SIMULADOS PARA PRUEBA'
      : 'CONDICION: ' + condiciones().join('-').toUpperCase()));
    lineas.push('# ' + rotuloCondicion());
    lineas.push('# Estacion: ' + (estacion.id || 'sin id') + ' - ' + (estacion.name || 'sin nombre'));
    lineas.push('# Sector: ' + (estacion.sector || 'no declarado'));
    lineas.push('# Zona horaria: ' + (estacion.zone || 'no declarada'));
    lineas.push('# Generado: ' + (meta.generated_at || 'no declarado') +
      ' | Publicado: ' + (meta.published_at || 'no declarado'));
    lineas.push('# Separador ; - decimales con coma - campos con ; o comilla entre comillas ' +
      'dobles (RFC 4180) - los saltos de linea de una nota se reemplazan por un espacio - ' +
      'sin columna de acumulado: el acumulado y la intensidad los calcula el panel y no se guardan');
    lineas.push('id;station_id;timestamp;published_at;rainfall_mm;temperature_c;source;verified;estado;tube_empty;note');
    for (var i = 0; i < registros.length; i++) {
      var m = registros[i];
      lineas.push([
        celdaCsv(m.id),
        celdaCsv(m.station_id),
        celdaCsv(m.timestamp),
        celdaCsv(m.published_at),
        celdaNumero(m.rainfall_mm),
        celdaNumero(m.temperature_c),
        celdaCsv(m.source),
        m.verified ? 'true' : 'false',
        celdaCsv(m.estado),
        m.tube_empty === true ? 'true' : 'false',
        celdaCsv(m.note)
      ].join(';'));
    }
    bajar(nombreBase() + '.csv', '\ufeff' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function json() {
    var salida = {
      label: meta.label || rotuloCondicion(),
      generated_at: meta.generated_at || null,
      published_at: meta.published_at || null,
      unit: 'mm de lluvia por registro del sensor',
      station: estacion,
      measurements: registros
    };
    bajar(nombreBase() + '.json', JSON.stringify(salida, null, 2), 'application/json');
  }

  /* ------------------------------------------------------------------ regla */

  function regla() {
    var agua = porId('agua');
    var marcas = Array.prototype.slice.call(document.querySelectorAll('.regla__marcas a'));
    var secciones = marcas.map(function (a) {
      return document.querySelector(a.getAttribute('href'));
    }).filter(Boolean);

    function marcar(seccionId) {
      marcas.forEach(function (a) {
        if (a.getAttribute('href') === '#' + seccionId) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }

    function progreso() {
      var alto = document.documentElement.scrollHeight - window.innerHeight;
      var p = alto > 0 ? window.scrollY / alto : 0;
      agua.style.height = (Math.min(1, Math.max(0, p)) * 100) + '%';
    }

    if ('IntersectionObserver' in window) {
      var observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) marcar(e.target.id);
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

      secciones.forEach(function (s) { observador.observe(s); });
    }

    /* El índice nunca queda sin sección actual: al abrir, la portada. */
    if (!document.querySelector('.regla__marcas a[aria-current]') && marcas.length) {
      marcar('portada');
    }

    window.addEventListener('scroll', progreso, { passive: true });
    window.addEventListener('resize', progreso);
    progreso();
  }

  /* --------------------------------------------------------------- arranque */

  function modo() {
    var nodoModo = porId('modo');
    if (!nodoModo) return;
    if (location.protocol === 'file:') {
      nodoModo.textContent = 'Abierta desde el disco, sin internet. Las tipografías, los datos y ' +
        'el gráfico viven en esta misma carpeta: no se descarga nada de la red.';
    } else {
      nodoModo.textContent = 'Abierta desde un servidor local o público. Todas las tipografías y ' +
        'los datos son archivos del mismo sitio: la página no depende de servicios externos.';
    }
  }

  function arrancar() {
    if (!registros.length) {
      ocultar('estado-carga');
      pintarFicha();
      ocultar('panel-datos');
      ocultar('estado-sin-sensor');
      texto('estado-vacio-texto', rechazos.length
        ? 'El archivo llegó, pero ninguno de sus ' + rechazos.length +
          ' registros cumple el contrato de siete campos, así que no se muestra ninguno. ' +
          'Un registro incompleto no se completa a mano.'
        : 'El archivo de datos no trae registros. Sin lecturas no hay acumulado, ' +
          'intensidad ni gráfico, y no se pone un cero en su lugar.');
      mostrar('estado-vacio');
      if (rechazos.length) mostrarRechazos();
      return;
    }

    ocultar('estado-carga');
    mostrar('panel-datos');

    if (rechazos.length) mostrarRechazos();

    pintarFicha();

    if (!auto.length) {
      /* Solo lecturas manuales: no se pinta ninguna cifra (ni cero ni guion con
         cálculos hechos) y el bloque lo explica. */
      ocultar('grafico-caja');
      ocultar('cifras');
      ocultar('estado-periodo');
      mostrar('estado-sin-sensor');
    } else if (!puntoUnico) {
      /* Varios puntos: no se suman mezclados. La tabla muestra el punto de cada fila. */
      ocultar('grafico-caja');
      ocultar('cifras');
      ocultar('estado-periodo');
      ocultar('estado-sin-sensor');
      texto('estado-puntos-texto', 'El archivo trae ' + puntos.length + ' puntos distintos (' +
        puntos.join(', ') + '). Un acumulado que sume puntos distintos no existe, así que no ' +
        'se calcula: la tabla muestra el punto de cada fila y los totales quedan fuera.');
      mostrar('estado-puntos');
    } else {
      mostrar('grafico-caja');
      mostrar('cifras');
      ocultar('estado-sin-sensor');
      ocultar('estado-puntos');
      pintarCifras();
      dibujar();
    }

    pintarTabla();
    pintarHistoricos();
    regla();
    modo();

    var redibujar;
    var lienzo = porId('lienzo');
    window.addEventListener('resize', function () {
      if (!lienzo || lienzo.offsetParent === null) return;
      clearTimeout(redibujar);
      redibujar = setTimeout(dibujar, 180);
    });

    var botones = document.querySelectorAll('[data-filtro]');
    Array.prototype.forEach.call(botones, function (boton) {
      boton.addEventListener('click', function () {
        filtro = boton.getAttribute('data-filtro');
        Array.prototype.forEach.call(botones, function (b) {
          b.setAttribute('aria-pressed', b === boton ? 'true' : 'false');
        });
        pintarTabla();
      });
    });

    var btnCsv = porId('btn-csv');
    if (btnCsv) btnCsv.addEventListener('click', csv);
    var btnJson = porId('btn-json');
    if (btnJson) btnJson.addEventListener('click', json);
  }

  function mostrarRechazos() {
    var listado = rechazos.slice(0, 5).map(function (r) {
      return r.id + ': ' + r.motivo;
    }).join('; ');
    /* Primero se muestra el bloque y después se escribe el resumen: así el cambio
       ocurre dentro de la región viva y se anuncia. */
    mostrar('estado-rechazos');
    texto('estado-rechazos-texto',
      'El archivo trae ' + rechazos.length + ' ' +
      plural(rechazos.length, 'registro', 'registros') +
      ' que no cumplen el contrato de siete campos y no se muestran. ' +
      'Motivos: ' + listado + (rechazos.length > 5 ? '; y más.' : '.'));
  }

  try {
    arrancar();
    window.__maipoIniciado = true;
  } catch (e) {
    /* Si algo se rompe, se dice en la página y no se deja «cargando» para siempre. */
    if (window.console && console.error) console.error(e);
    fallar('La página no pudo armar el registro: ' + (e && e.message ? e.message : 'error desconocido') + '.');
    window.__maipoIniciado = true;
  }
})();
