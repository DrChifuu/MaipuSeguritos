/* ============================================================================
   SEMILLA DE MAIPO VIGÍA — se puede editar sin tocar la aplicación.
   Cada punto, camino, observador y archivo de ejemplo nace aquí.
   Los valores son de demostración: no son mediciones reales.
   ========================================================================== */
(function () {
  "use strict";

function buildInitialState() {
  const ahora = Date.now();

  const stations = [
    {
      id: 'san-alfonso',
      station_id: 'SJM-SANALFONSO-01',
      name: 'San Alfonso',
      quebrada: 'Estero San Alfonso',
      rainfall_mm: null,
      minutesAgo: null,
      measuredAt: null,
      lastObserverAt: null,
      timeText: 'equipo no instalado',
      hasSensor: false,
      sensorStatus: 'Equipo no instalado todavía',
      observerCount24h: 0,
      lastObserverHour: 'sin lecturas hoy',
      hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                  null, null, null, null, null, null, null, null, null, null, null, null],
      actions: [
        'El punto todavía no tiene equipo instalado.',
        'Si eres observador acreditado, registra una lectura manual.',
        'El tablero no reemplaza las alertas oficiales.'
      ]
    },
    {
      id: 'el-melocoton',
      station_id: 'SJM-ELMELOCOTON-01',
      name: 'El Melocotón',
      quebrada: null,
      rainfall_mm: null,
      minutesAgo: null,
      measuredAt: null,
      lastObserverAt: null,
      timeText: 'equipo no instalado',
      hasSensor: false,
      sensorStatus: 'Equipo no instalado todavía',
      observerCount24h: 0,
      lastObserverHour: 'sin lecturas hoy',
      hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                  null, null, null, null, null, null, null, null, null, null, null, null],
      actions: [
        'El punto todavía no tiene equipo instalado.',
        'No hay lecturas que confirmen lluvia en este sector.',
        'Consulta el camino antes de bajar al valle.'
      ]
    },
    {
      id: 'el-manzano',
      station_id: 'SJM-ELMANZANO-01',
      name: 'El Manzano',
      quebrada: null,
      rainfall_mm: null,
      minutesAgo: null,
      measuredAt: null,
      lastObserverAt: null,
      timeText: 'equipo no instalado',
      hasSensor: false,
      sensorStatus: 'Equipo no instalado todavía',
      observerCount24h: 0,
      lastObserverHour: 'sin lecturas hoy',
      hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                  null, null, null, null, null, null, null, null, null, null, null, null],
      actions: [
        'El punto todavía no tiene equipo instalado.',
        'Una lectura manual acreditada puede activar el semáforo.',
        'El tablero no reemplaza las alertas oficiales.'
      ]
    },
    {
      id: 'el-canelo',
      station_id: 'SJM-ELCANELO-01',
      name: 'El Canelo',
      quebrada: null,
      rainfall_mm: null,
      minutesAgo: null,
      measuredAt: null,
      lastObserverAt: null,
      timeText: 'equipo no instalado',
      hasSensor: false,
      sensorStatus: 'Equipo no instalado todavía',
      observerCount24h: 0,
      lastObserverHour: 'sin lecturas hoy',
      hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                  null, null, null, null, null, null, null, null, null, null, null, null],
      actions: [
        'El punto todavía no tiene equipo instalado.',
        'No hay datos para afirmar que el sector esté seco.',
        'Consulta los tramos altos antes de subir.'
      ]
    },
    {
      id: 'san-gabriel',
      station_id: 'SJM-SANGABRIEL-01',
      name: 'San Gabriel',
      quebrada: null,
      rainfall_mm: null,
      minutesAgo: null,
      measuredAt: null,
      lastObserverAt: null,
      timeText: 'equipo no instalado',
      hasSensor: false,
      sensorStatus: 'Equipo no instalado todavía',
      observerCount24h: 0,
      lastObserverHour: 'sin lecturas hoy',
      hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                  null, null, null, null, null, null, null, null, null, null, null, null],
      actions: [
        'El punto todavía no tiene equipo instalado.',
        'No asumas que está despejado por falta de datos.',
        'Consulta con Carabineros antes de subir.'
      ]
    },
    {
      id: 'plaza-de-armas',
      station_id: 'SJM-PLAZA-01',
      name: 'Plaza de Armas',
      quebrada: null,
      rainfall_mm: null,
      minutesAgo: null,
      measuredAt: null,
      lastObserverAt: null,
      timeText: 'equipo no instalado',
      hasSensor: false,
      sensorStatus: 'Equipo no instalado todavía',
      observerCount24h: 0,
      lastObserverHour: 'sin lecturas hoy',
      hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                  null, null, null, null, null, null, null, null, null, null, null, null],
      actions: [
        'El punto todavía no tiene equipo instalado.',
        'Revise el punto más cercano en El Canelo.',
        'Si es observador acreditado, puede registrar lectura manual.'
      ]
    }
  ];

  /* Orden exacto del valle: Plaza de Armas -> San Gabriel (4 con dato, 2 sin dato) */
  const roads = [
    {
      id: 'plaza-de-armas',
      name: 'Plaza de Armas',
      order: 1,
      updatedAt: null,
      state: 'sindato',
      source: 'Sin información',
      timeLabel: 'sin reporte reciente',
      note: 'Sin reporte confirmado todavía.',
      pendingReports: 0,
      todayLog: []
    },
    {
      id: 'el-canelo',
      name: 'El Canelo',
      order: 2,
      updatedAt: null,
      state: 'sindato',
      source: 'Sin información',
      timeLabel: 'sin reporte reciente',
      note: 'Sin reporte confirmado todavía.',
      pendingReports: 0,
      todayLog: []
    },
    {
      id: 'el-manzano',
      name: 'El Manzano',
      order: 3,
      updatedAt: null,
      state: 'sindato',
      source: 'Sin información',
      timeLabel: 'sin reporte reciente',
      note: 'Sin reporte confirmado todavía.',
      pendingReports: 0,
      todayLog: []
    },
    {
      id: 'el-melocoton',
      name: 'El Melocotón',
      order: 4,
      updatedAt: null,
      state: 'sindato',
      source: 'Sin información',
      timeLabel: 'sin reporte reciente',
      note: 'Sin reporte confirmado todavía.',
      pendingReports: 0,
      todayLog: []
    },
    {
      id: 'san-alfonso',
      name: 'San Alfonso',
      order: 5,
      updatedAt: null,
      state: 'sindato',
      source: 'Sin información',
      timeLabel: 'sin reporte reciente',
      note: 'Sin reporte confirmado todavía.',
      pendingReports: 0,
      todayLog: []
    },
    {
      id: 'san-gabriel',
      name: 'San Gabriel',
      order: 6,
      updatedAt: null,
      state: 'sindato',
      source: 'Sin información',
      timeLabel: 'sin reporte reciente',
      note: 'Sin reporte confirmado todavía.',
      pendingReports: 0,
      todayLog: []
    }
  ];

  const roadChanges = [];

  /* Lecturas con contrato de datos extendido y coherente (snake_case) */
  const readings = [];

  /* Avisos ciudadanos pendientes para la cola de Directiva */
  const citizenReports = [];

  /* Padrón: 8 observadores (6 acreditados, 2 suspendidos), solo alias y los 6 sectores permitidos */
  const observers = [
    { id: 'OBS-01', lastReadingAt: null, alias: 'Observador San Alfonso', sector: 'San Alfonso', sector_id: 'san-alfonso', rol: 'observador', estado: 'Acreditado', card: '10042042', pin: '1234', lastReading: 'sin lecturas', motivoBaja: null },
    { id: 'OBS-02', lastReadingAt: null, alias: 'Observadora El Manzano', sector: 'El Manzano', sector_id: 'el-manzano', rol: 'observador', estado: 'Acreditado', card: '10042051', pin: '2222', lastReading: 'sin lecturas', motivoBaja: null },
    { id: 'OBS-03', lastReadingAt: null, alias: 'Directiva', sector: 'Plaza de Armas', sector_id: 'plaza-de-armas', rol: 'directiva', estado: 'Acreditado', card: '90000001', pin: '9999', lastReading: 'sin lecturas', motivoBaja: null },
    { id: 'OBS-04', lastReadingAt: null, alias: 'Observador El Melocotón', sector: 'El Melocotón', sector_id: 'el-melocoton', rol: 'observador', estado: 'Acreditado', card: '10042063', pin: '3333', lastReading: 'sin lecturas', motivoBaja: null },
    { id: 'OBS-05', lastReadingAt: null, alias: 'Observadora El Canelo', sector: 'El Canelo', sector_id: 'el-canelo', rol: 'observador', estado: 'Acreditado', card: '10042074', pin: '4444', lastReading: 'sin lecturas', motivoBaja: null },
    { id: 'OBS-06', lastReadingAt: null, alias: 'Observador San Gabriel', sector: 'San Gabriel', sector_id: 'san-gabriel', rol: 'observador', estado: 'Acreditado', card: '10042085', pin: '5555', lastReading: 'sin lecturas', motivoBaja: null },
    { id: 'OBS-07', lastReadingAt: null, alias: 'Observador Plaza de Armas', sector: 'Plaza de Armas', sector_id: 'plaza-de-armas', rol: 'observador', estado: 'Suspendido', card: '10042096', pin: '6666', lastReading: 'sin lecturas', motivoBaja: 'Tarjeta extraviada, en reposición.' },
    { id: 'OBS-08', lastReadingAt: null, alias: 'Observadora San Alfonso 2', sector: 'San Alfonso', sector_id: 'san-alfonso', rol: 'observador', estado: 'Suspendido', card: '10042099', pin: '7777', lastReading: 'sin lecturas', motivoBaja: 'Cambio temporal de domicilio.' }
  ];

  /* 4 archivos publicados según §15 */
  const sampleRowsNovember = generateArchiveRows(60, 'Automático LoRa');
  const sampleRowsManual = generateArchiveRows(35, 'Observador acreditado');

  const files = [
    {
      id: 'f-2',
      name: 'lecturas_manuales_2026.csv',
      format: 'CSV',
      isDefaultFormat: true,
      rowsCountLabel: '312 filas',
      updatedLabel: 'actualizado el 14 de noviembre',
      columnsRecognized: true,
      publishedAt: null,
      canUndo: false,
      summary: { acumulado: 36.8, maxDay: '14 de noviembre (16,0 mm)', rainyDays: 6 },
      byPoint: [
        { name: 'San Alfonso', mm: 36.8 },
        { name: 'El Melocotón', mm: 19.2 },
        { name: 'El Manzano', mm: 9.5 },
        { name: 'El Canelo', mm: 5.1 },
        { name: 'San Gabriel', mm: 12.2 },
        { name: 'Plaza de Armas', mm: 3.0 }
      ],
      byHour: [0,0,0,0,0,0,0.5,1.8,3.2,4.1,2.0,1.2,0.8,0.6,1.1,2.2,3.4,4.8,3.9,2.8,1.9,1.3,0.8,0.4],
      rows: sampleRowsManual
    },
    {
      id: 'f-1',
      name: 'lluvia_2026_11.xlsx',
      format: 'XLSX',
      rowsCountLabel: '12.480 filas',
      updatedLabel: 'actualizado el 15 de noviembre',
      columnsRecognized: true,
      publishedAt: null,
      canUndo: false,
      summary: { acumulado: 41.2, maxDay: '14 de noviembre (18,4 mm)', rainyDays: 7 },
      byPoint: [
        { name: 'San Alfonso', mm: 41.2 },
        { name: 'El Melocotón', mm: 24.6 },
        { name: 'El Manzano', mm: 11.4 },
        { name: 'El Canelo', mm: 6.8 },
        { name: 'San Gabriel', mm: 14.0 },
        { name: 'Plaza de Armas', mm: 4.2 }
      ],
      byHour: [0.4,0.2,0.1,0,0,0,0.3,0.8,1.5,2.4,1.9,1.2,0.9,1.4,2.8,3.6,4.5,5.1,4.2,3.1,2.4,1.8,1.5,1.1],
      rows: sampleRowsNovember
    },
    {
      id: 'f-3',
      name: 'bitacora_observadores.md',
      format: 'MD',
      rowsCountLabel: '48 entradas',
      updatedLabel: 'actualizado el 10 de noviembre',
      columnsRecognized: true,
      publishedAt: null,
      canUndo: false,
      summary: { acumulado: 22.4, maxDay: '9 de noviembre (10,2 mm)', rainyDays: 4 },
      byPoint: [
        { name: 'San Alfonso', mm: 22.4 },
        { name: 'El Melocotón', mm: 12.0 },
        { name: 'El Manzano', mm: 6.4 },
        { name: 'El Canelo', mm: 3.2 },
        { name: 'San Gabriel', mm: 8.5 },
        { name: 'Plaza de Armas', mm: 2.1 }
      ],
      byHour: [0,0,0,0,0,0,0,1.2,2.4,2.8,1.5,1.0,0.6,0.4,0.8,1.6,2.2,2.9,2.1,1.4,0.9,0.4,0.2,0],
      rows: generateArchiveRows(28, 'Bitácora Markdown')
    },
    {
      id: 'f-4',
      name: 'lecturas_transcritas_2026.txt',
      format: 'TXT',
      rowsCountLabel: '96 filas',
      updatedLabel: 'actualizado el 8 de noviembre',
      columnsRecognized: false,
      publishedAt: null,
      canUndo: false,
      summary: { acumulado: 18.6, maxDay: '7 de noviembre (8,4 mm)', rainyDays: 3 },
      byPoint: [
        { name: 'San Alfonso', mm: 18.6 },
        { name: 'El Melocotón', mm: 10.4 },
        { name: 'El Manzano', mm: 5.0 },
        { name: 'El Canelo', mm: 2.4 },
        { name: 'San Gabriel', mm: 6.8 },
        { name: 'Plaza de Armas', mm: 1.5 }
      ],
      byHour: [0,0,0,0,0,0,0.2,0.9,1.8,2.2,1.4,0.8,0.5,0.4,0.7,1.3,1.9,2.4,1.8,1.1,0.7,0.3,0.2,0],
      rows: generateArchiveRows(30, 'Transcripción TXT')
    }
  ];

  return {
    updatedAt: ahora,
    roadRefreshedAt: ahora - 2 * 60000,
    updatedLabel: 'hoy a las 09:42',
    roadMinutesSinceRefresh: 2,
    myReportIds: [],
    avisarCooldownUntil: null,
    lastDailyArchiveDate: null,
    session: null,
    loginAttempts: 0,
    lockoutUntil: null,
    stations,
    roads,
    roadChanges,
    readings,
    citizenReports,
    observers,
    files,
    activeFileId: 'f-2',
    tablePage: 1
  };
}

function generateArchiveRows(count, origenDefault) {
  const pts = ['San Alfonso', 'El Melocotón', 'El Manzano', 'El Canelo', 'San Gabriel', 'Plaza de Armas'];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const day = 15 - (i % 10);
    const hour = String(7 + (i % 14)).padStart(2, '0');
    const min = String((i * 13) % 60).padStart(2, '0');
    const pt = pts[i % pts.length];
    const val = pt === 'Plaza de Armas' && i % 5 === 0 ? null : Number((((i * 1.7) % 14.5) + 0.2).toFixed(1));
    rows.push({
      fecha: `2026-11-${String(day).padStart(2, '0')} ${hour}:${min}`,
      punto: pt,
      mm: val,
      origen: i % 3 === 0 ? 'Observador acreditado' : origenDefault
    });
  }
  return rows;
}

  window.MV_SEMILLA = function () { return buildInitialState(); };
  window.MV_GENERAR_FILAS = function (n, origen) { return generateArchiveRows(n, origen); };
})();
