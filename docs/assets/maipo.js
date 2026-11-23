    /* ==========================================================================
       MAIPO VIGÍA — LÓGICA DE APLICACIÓN, MODELO DE DATOS Y CONTROL DE ROLES
       ========================================================================== */
    (function () {
      'use strict';

      const CONFIG = window.MV_CONFIG || {};
      const ALMACEN = window.MV_ALMACEN || null;
      const STORAGE_KEY = CONFIG.clave || 'maipo_vigia_state_v2';
      const FONT_KEY = 'maipo_vigia_font_large';

      /* ------------------------------------------------------------------------
         1. UMBRALES PARAMETRIZADOS (LISTOS PARA CALIBRAR CON SERNAGEOMIN)
         ------------------------------------------------------------------------ */
      const THRESHOLDS = {
        amber1h: 5.0,
        red1h: 15.0,
        amber3h: 15.0,
        red3h: 30.0,
        staleMinutes: 30,
        status: 'provisional',
        validatedBy: null,
        version: '0.1-provisional'
      };

      /* Referencia temporal base para los datos de ejemplo: hoy 09:42 */
      const BASE_NOW_ISO = '2026-11-23T09:42:00-03:00';

      /* ------------------------------------------------------------------------
         2. ICONOS SVG INLINE (24×24, TRAZO 2px, COLOR HEREDADO)
         ------------------------------------------------------------------------ */
      function svgState(state, size) {
        const s = size || 24;
        if (state === 'verde') {
          return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>`;
        }
        if (state === 'ambar') {
          return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="12,3 22,20 2,20"/></svg>`;
        }
        if (state === 'rojo') {
          return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
        }
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>`;
      }

      const ICONS = {
        ahora: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3C12 3 6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/></svg>`,
        camino: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 20 9 4"/><path d="M18 20 15 4"/><path d="M12 6v3"/><path d="M12 13v3"/></svg>`,
        registrar: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
        archivo: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/></svg>`,
        directiva: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7l-8-4Z"/><path d="m9 12 2 2 4-4"/></svg>`,
        ayuda: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>`,
        entrar: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>`,
        mas: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>`,
        avisar: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>`,
        volver: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>`,
        refresh: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/></svg>`,
        download: `<svg class="icon-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>`
      };

      /* ------------------------------------------------------------------------
         3. UTILIDADES DE FORMATO Y CÁLCULO DE ESTADOS
         ------------------------------------------------------------------------ */
      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function formatMm(val) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
        return Number(val).toFixed(1).replace('.', ',');
      }

      function computeRainState(rainfallMm, minutesAgo, hasSensor) {
        if (hasSensor === false || rainfallMm === null || rainfallMm === undefined) return 'sindato';
        if (typeof minutesAgo === 'number' && minutesAgo > THRESHOLDS.staleMinutes) return 'sindato';
        if (rainfallMm >= THRESHOLDS.red1h) return 'rojo';
        if (rainfallMm >= THRESHOLDS.amber1h) return 'ambar';
        return 'verde';
      }

      function rainLabel(state) {
        return { verde: 'Normal', ambar: 'Ojo', rojo: 'Peligro', sindato: 'Sin dato' }[state] || 'Sin dato';
      }

      function roadLabel(state) {
        return { verde: 'Normal', ambar: 'Precaución', rojo: 'Restringido', sindato: 'Sin dato' }[state] || 'Sin dato';
      }

      function statePill(state, kind) {
        const label = kind === 'road' ? roadLabel(state) : rainLabel(state);
        return `<span class="state-pill st-${state}">${svgState(state, 20)}<span>${label}</span></span>`;
      }

      function severityRank(state) {
        return { rojo: 0, ambar: 1, sindato: 2, verde: 3 }[state] ?? 4;
      }

      function formatRelativeTime(minutesAgo, customText) {
        if (customText) return customText;
        if (minutesAgo === null || minutesAgo === undefined) return 'sin registro';
        if (minutesAgo <= 0) return 'ahora';
        if (minutesAgo === 1) return 'hace 1 min';
        if (minutesAgo < 60) return `hace ${minutesAgo} min`;
        const h = Math.floor(minutesAgo / 60);
        return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
      }

      /* ------------------------------------------------------------------------
         4. DATOS DE EJEMPLO (COHERENTES ENTRE LLUVIA, CAMINO, ARCHIVO Y DIRECTIVA)
         ------------------------------------------------------------------------ */
      /* La semilla de ejemplo vive en datos/semilla.js, para poder editarla
         (puntos, caminos, observadores, archivos) sin tocar la aplicación. */
      function buildInitialState() {
        if (typeof window.MV_SEMILLA === "function") return window.MV_SEMILLA();
        throw new Error("Falta cargar datos/semilla.js");
      }

      /* ------------------------------------------------------------------------
         5. ESTADO GLOBAL + PERSISTENCIA EN localStorage
         ------------------------------------------------------------------------ */
      let state = loadState();

      function loadState() {
        const guardado = ALMACEN ? ALMACEN.cargar() : null;
        if (guardado) return guardado;
        const inicial = buildInitialState();
        /* La semilla es de ejemplo y se rotula como recién actualizada al abrir,
           para que el tablero no muestre una hora vieja. */
        if (typeof horaLocalHHMM === 'function') {
          inicial.updatedLabel = 'hoy a las ' + horaLocalHHMM();
        }
        try { if (ALMACEN) ALMACEN.guardar(inicial); } catch (e) { /* sin cuota */ }
        return inicial;
      }

      function saveState() {
        try {
          if (ALMACEN) ALMACEN.guardar(state);
        } catch (e) {
          /* Modo privado sin cuota: el estado vive solo en memoria */
        }
      }

      /* Estado transitorio de UI (formularios, filtros, pasos) */
      const ui = {
        tab: 'ahora',
        subtab: 'lluvia',
        zoneId: null,
        zoneSubtab: 'lluvia24',
        sheetType: null,
        sheetData: null,
        /* Estado de Ingreso */
        loginCard: '',
        loginPin: '',
        loginFocusField: 'card',
        loginError: '',
        /* Estado de Camino › Informar */
        informRoadId: 'el-melocoton',
        informState: 'ambar',
        informChip: 'agua en la calzada',
        informNote: '',
        informPhoto: '',
        informSent: false,
        /* Estado de Registrar lectura */
        regValueStr: '',
        regSinDato: false,
        regIsBackdated: false,
        regDate: '2026-11-23',
        regTime: '09:30',
        regPhoto: '',
        regSubmittedFolio: null,
        /* Estado de Directiva › Por validar */
        valFilter: 'todos',
        valRejectMode: false,
        valCorrectMode: false,
        valCorrectInput: '',
        /* Estado de Archivo/Directiva › Subir (4 pasos) */
        uploadStep: 1,
        uploadFileName: '',
        uploadFormat: '',
        uploadRawRows: [],
        uploadHeaders: [],
        uploadMap: { fecha: 0, punto: 1, mm: 2, origen: 3 },
        uploadErrors: [],
        uploadDuplicates: 0,
        uploadValidRows: [],
        uploadConflictRule: 'saltar',
        uploadErrorMsg: '',
        /* Estado de Avisar algo */
        avisarTipo: 'El río viene creciendo',
        avisarPoint: 'San Alfonso',
        avisarNota: '',
        avisarPhoto: '',
        avisarDone: false,
        /* Kiosco */
        kioscoActive: false,
        kioscoFocusIdx: 0,
        kioscoTapCount: 0,
        kioscoTimer: null
      };

      /* ------------------------------------------------------------------------
         6. CONTROL DE PERMISOS Y ENRUTAMIENTO POR HASH
         ------------------------------------------------------------------------ */
      function getRole() {
        if (!state.session) return 'publico';
        return state.session.rol === 'directiva' ? 'directiva' : 'observador';
      }

      function checkSessionTimeout() {
        if (!state.session) return;
        const now = Date.now();
        const maxSessionMs = 8 * 60 * 60 * 1000;
        const maxIdleMs = 30 * 60 * 1000;
        if ((now - state.session.loginAt > maxSessionMs) || (now - state.session.lastActivity > maxIdleMs)) {
          state.session = null;
          saveState();
          showToast('Tu sesión se cerró por tiempo de espera.');
          if (ui.tab === 'registrar' || ui.tab === 'directiva') {
            navigate('ahora', 'lluvia');
          }
        } else {
          state.session.lastActivity = now;
          saveState();
        }
      }

      function getTabsForRole(role) {
        const tabs = [
          { id: 'ahora', label: 'Ahora', defaultSub: 'lluvia', icon: ICONS.ahora },
          { id: 'camino', label: 'Camino', defaultSub: 'estado', icon: ICONS.camino }
        ];
        if (role === 'observador' || role === 'directiva') {
          tabs.push({ id: 'registrar', label: 'Registrar', defaultSub: 'identidad', icon: ICONS.registrar });
        }
        tabs.push({ id: 'archivo', label: 'Archivo', defaultSub: 'archivos', icon: ICONS.archivo });
        if (role === 'directiva') {
          tabs.push({ id: 'directiva', label: 'Directiva', defaultSub: 'validar', icon: ICONS.directiva });
        }
        tabs.push({ id: 'ayuda', label: 'Ayuda', defaultSub: 'estados', icon: ICONS.ayuda });
        return tabs;
      }

      function getSubtabsForTab(tabId) {
        if (tabId === 'ahora') {
          if (ui.zoneId) {
            return [
              { id: 'lluvia24', label: 'Lluvia 24 h' },
              { id: 'quien', label: 'Quién midió' },
              { id: 'camino', label: 'Camino' },
              { id: 'hacer', label: 'Qué hacer' }
            ];
          }
          return [
            { id: 'lluvia', label: 'Lluvia' },
            { id: 'ultima-hora', label: 'Última hora' }
          ];
        }
        if (tabId === 'camino') {
          return [
            { id: 'estado', label: 'Estado' },
            { id: 'informar', label: 'Informar' },
            { id: 'cambios', label: 'Cambios' }
          ];
        }
        if (tabId === 'registrar') {
          return [
            { id: 'identidad', label: '1 · Identidad' },
            { id: 'lectura', label: '2 · Lectura' },
            { id: 'revisar', label: '3 · Revisar' }
          ];
        }
        if (tabId === 'archivo') {
          return [
            { id: 'archivos', label: 'Archivos' },
            { id: 'tablero', label: 'Tablero' },
            { id: 'tabla', label: 'Tabla' }
          ];
        }
        if (tabId === 'directiva') {
          return [
            { id: 'validar', label: 'Por validar' },
            { id: 'oficial', label: 'Oficial' },
            { id: 'observadores', label: 'Observadores' },
            { id: 'datos', label: 'Datos' },
            { id: 'subir', label: 'Subir' }
          ];
        }
        if (tabId === 'ayuda') {
          return [
            { id: 'estados', label: 'Estados' },
            { id: 'milimetros', label: 'Milímetros' },
            { id: 'alertas', label: 'Alertas' },
            { id: 'sin-internet', label: 'Sin internet' }
          ];
        }
        return [];
      }

      function navigate(tab, subtab, zoneId) {
        checkSessionTimeout();
        const role = getRole();
        const allowed = getTabsForRole(role).map(t => t.id);

        if (!allowed.includes(tab)) {
          tab = 'ahora';
          subtab = 'lluvia';
          zoneId = null;
        }

        ui.tab = tab;
        if (tab === 'ahora' && zoneId) {
          ui.zoneId = zoneId;
          ui.zoneSubtab = subtab || 'lluvia24';
          ui.subtab = 'zona';
          setHash(`#/ahora/zona/${zoneId}/${ui.zoneSubtab}`);
        } else {
          ui.zoneId = null;
          const subs = getSubtabsForTab(tab);
          const validSub = subs.find(s => s.id === subtab) ? subtab : (subs[0] ? subs[0].id : '');
          ui.subtab = validSub;
          setHash(`#/${tab}/${validSub}`);
        }

        /* R2: Al cambiar de pestaña el scroll vuelve arriba */
        const mp = document.getElementById('mainPanel');
        if (mp) mp.scrollTop = 0;

        renderAll();
      }

      function setHash(h) {
        if (window.location.hash !== h) {
          try {
            window.history.replaceState(null, '', h);
          } catch (e) {
            window.location.hash = h;
          }
        }
      }

      function parseHash() {
        const raw = (window.location.hash || '#/ahora/lluvia').replace(/^#\/?/, '');
        const parts = raw.split('/').filter(Boolean);

        /* Enlaces que abren una capa, no una pestaña */
        if (parts[0] === 'kiosco') {
          navigate('ahora', 'lluvia');
          openKiosco();
          return;
        }
        if (parts[0] === 'avisar') {
          navigate('ahora', 'lluvia');
          openSheet('avisar');
          return;
        }
        if (parts[0] === 'ahora' && parts[1] === 'zona' && parts[2]) {
          const exists = state.stations.some(s => s.id === parts[2]);
          if (exists) {
            navigate('ahora', parts[3] || 'lluvia24', parts[2]);
            return;
          }
        }
        navigate(parts[0] || 'ahora', parts[1] || '');
      }

      /* ------------------------------------------------------------------------
         7. TOAST ACCESIBLE Y HOJAS LATERALES (NIVEL 3)
         ------------------------------------------------------------------------ */
      let toastTimer = null;
      function showToast(msg) {
        const box = document.getElementById('toastBox');
        box.textContent = msg;
        box.classList.remove('hidden');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          box.classList.add('hidden');
        }, 4200);
      }

      function openSheet(type, data) {
        ui.sheetType = type;
        ui.sheetData = data || null;
        if (type === 'ingreso') {
          ui.loginCard = '';
          ui.loginPin = '';
          ui.loginFocusField = 'card';
          ui.loginError = '';
        }
        if (type === 'avisar') {
          ui.avisarDone = false;
          ui.avisarNota = '';
          ui.avisarPhoto = '';
        }
        if (type === 'subir') {
          resetUploadWizard();
        }
        renderSheet();
        document.getElementById('sheetBackdrop').classList.remove('hidden');
        document.getElementById('btnCloseSheet').focus();
      }

      function closeSheet() {
        ui.sheetType = null;
        ui.sheetData = null;
        document.getElementById('sheetBackdrop').classList.add('hidden');
      }

      /* ------------------------------------------------------------------------
         8. RENDERIZADO DEL ARMAZÓN (TOPBAR, TABS, SUBTABS, BOTTOMBAR)
         ------------------------------------------------------------------------ */
      function getPendingQueueCount() {
        const rCount = state.readings.filter(r => r.estado_validacion === 'En revisión').length;
        const aCount = state.citizenReports.filter(a => a.estado === 'En revisión').length;
        return rCount + aCount;
      }

      function getWorstRainState() {
        let worst = 'verde';
        state.stations.forEach(s => {
          const st = computeRainState(s.rainfall_mm, s.minutesAgo, s.hasSensor);
          if (severityRank(st) < severityRank(worst)) worst = st;
        });
        return worst;
      }

      function renderShell() {
        const role = getRole();
        const tabs = getTabsForRole(role);
        const pendingTotal = getPendingQueueCount();

        /* Topbar actualizado + estado móvil */
        document.getElementById('topbarUpdated').textContent = `Actualizado ${state.updatedLabel}`;
        const tagDemo = document.getElementById('demoTag');
        if (tagDemo) tagDemo.textContent = (ALMACEN && ALMACEN.configurado) ? 'Datos del servidor' : 'Datos de ejemplo';
        const worstRain = getWorstRainState();
        document.getElementById('topbarMobileStatus').innerHTML = statePill(worstRain, 'rain');

        /* Botón sesión escritorio (regla dura: sin botones no autorizados) */
        const sessionWrap = document.getElementById('desktopSessionWrap');
        if (role === 'publico') {
          sessionWrap.innerHTML = `<button type="button" class="topbar-btn" id="btnOpenLogin">Entrar</button>`;
        } else {
          const roleName = role === 'directiva' ? 'Directiva' : state.session.alias;
          sessionWrap.innerHTML = `
            <div class="role-pill-wrap">
              <button type="button" class="topbar-btn" id="btnOpenAccount">${escapeHtml(roleName)}</button>
              <button type="button" class="topbar-btn" id="btnLogoutTop">Salir</button>
            </div>
          `;
        }

        /* Nivel 1: Pestañas escritorio */
        const tabbar = document.getElementById('desktopTabbar');
        tabbar.innerHTML = tabs.map(t => {
          const isSel = ui.tab === t.id;
          const badge = (t.id === 'directiva' && pendingTotal > 0)
            ? `<span class="badge-count" aria-label="${pendingTotal} por revisar">${pendingTotal}</span>`
            : '';
          return `
            <button type="button" class="tab-btn" role="tab" aria-selected="${isSel}" data-tab="${t.id}" data-sub="${t.defaultSub}">
              ${t.icon}
              <span>${t.label}</span>
              ${badge}
            </button>
          `;
        }).join('');

        /* Nivel 2: Solapas */
        const subtabs = getSubtabsForTab(ui.tab);
        const subbar = document.getElementById('subtabbar');
        if (subtabs.length <= 1) {
          subbar.classList.add('hidden');
          subbar.innerHTML = '';
        } else {
          subbar.classList.remove('hidden');
          const activeSub = (ui.tab === 'ahora' && ui.zoneId) ? ui.zoneSubtab : ui.subtab;
          subbar.innerHTML = subtabs.map(s => {
            const isSel = activeSub === s.id;
            const badge = (ui.tab === 'directiva' && s.id === 'validar' && pendingTotal > 0)
              ? `<span class="badge-count">${pendingTotal}</span>`
              : '';
            return `
              <button type="button" class="subtab-btn" role="tab" aria-selected="${isSel}" data-subtab="${s.id}">
                <span>${s.label}</span>
                ${badge}
              </button>
            `;
          }).join('');
        }

        /* Barra inferior móvil (5 botones exactos según rol) */
        const bottom = document.getElementById('mobileBottombar');
        let mobileItems = [];
        if (role === 'publico') {
          mobileItems = [
            { id: 'ahora', label: 'Ahora', icon: ICONS.ahora, action: () => navigate('ahora', 'lluvia') },
            { id: 'camino', label: 'Camino', icon: ICONS.camino, action: () => navigate('camino', 'estado') },
            { id: 'archivo', label: 'Archivo', icon: ICONS.archivo, action: () => navigate('archivo', 'archivos') },
            { id: 'ayuda', label: 'Ayuda', icon: ICONS.ayuda, action: () => navigate('ayuda', 'estados') },
            { id: 'entrar', label: 'Entrar', icon: ICONS.entrar, action: () => openSheet('ingreso') }
          ];
        } else if (role === 'observador') {
          mobileItems = [
            { id: 'ahora', label: 'Ahora', icon: ICONS.ahora, action: () => navigate('ahora', 'lluvia') },
            { id: 'camino', label: 'Camino', icon: ICONS.camino, action: () => navigate('camino', 'estado') },
            { id: 'registrar', label: 'Registrar', icon: ICONS.registrar, action: () => navigate('registrar', 'identidad') },
            { id: 'archivo', label: 'Archivo', icon: ICONS.archivo, action: () => navigate('archivo', 'archivos') },
            { id: 'mas', label: 'Más', icon: ICONS.mas, action: () => openSheet('mas') }
          ];
        } else {
          mobileItems = [
            { id: 'ahora', label: 'Ahora', icon: ICONS.ahora, action: () => navigate('ahora', 'lluvia') },
            { id: 'camino', label: 'Camino', icon: ICONS.camino, action: () => navigate('camino', 'estado') },
            { id: 'registrar', label: 'Registrar', icon: ICONS.registrar, action: () => navigate('registrar', 'identidad') },
            { id: 'directiva', label: 'Directiva', icon: ICONS.directiva, action: () => navigate('directiva', 'validar') },
            { id: 'mas', label: 'Más', icon: ICONS.mas, action: () => openSheet('mas') }
          ];
        }

        bottom.innerHTML = mobileItems.map((it, idx) => {
          const isSel = ui.tab === it.id;
          return `
            <button type="button" class="bottom-btn" aria-selected="${isSel}" data-mobile-idx="${idx}">
              ${it.icon}
              <span>${it.label}</span>
            </button>
          `;
        }).join('');

        bottom.querySelectorAll('.bottom-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-mobile-idx'));
            mobileItems[idx].action();
          });
        });
      }

      /* ------------------------------------------------------------------------
         9. VISTAS: PESTAÑA AHORA (LLUVIA, ZONA 4 SOLAPAS, ÚLTIMA HORA)
         ------------------------------------------------------------------------ */
      function getRoadLineForStation(stationId) {
        const road = state.roads.find(r => r.id === stationId);
        if (!road) return 'Camino: Sin dato';
        /* Coherencia explícita para San Alfonso (acceso cortado en El Melocotón) */
        if (stationId === 'san-alfonso' && road.state === 'sindato') {
          const melo = state.roads.find(r => r.id === 'el-melocoton');
          if (melo && melo.state === 'rojo') {
            return 'Camino: acceso restringido (El Melocotón)';
          }
        }
        return `Camino: ${roadLabel(road.state)}`;
      }

      function renderAhoraLluvia() {
        const isMobile = window.innerWidth <= 768;
        const stationsComputed = state.stations.map(s => ({
          ...s,
          state: computeRainState(s.rainfall_mm, s.minutesAgo, s.hasSensor)
        }));

        /* En móvil ordenar por gravedad; en escritorio mantener orden claro con los más críticos arriba */
        const ordered = isMobile
          ? [...stationsComputed].sort((a, b) => severityRank(a.state) - severityRank(b.state))
          : stationsComputed;

        const dangerStations = stationsComputed.filter(s => s.state === 'rojo');
        const bannerHtml = dangerStations.length > 0
          ? `<div class="danger-banner" role="alert">
               <div class="flex-row">
                 ${svgState('rojo', 24)}
                 <span>Peligro por lluvia fuerte en ${escapeHtml(dangerStations.map(d => d.name).join(', '))}. No baje a la quebrada.</span>
               </div>
               <button type="button" class="btn-sm-pad" data-open-zone="${dangerStations[0].id}">Ver zona</button>
             </div>`
          : '';

        const cardsHtml = ordered.map(s => {
          const mmText = formatMm(s.rainfall_mm);
          const unitHtml = s.rainfall_mm !== null ? `<span class="rain-unit">mm</span>` : '';
          const timeStr = formatRelativeTime(s.minutesAgo, s.timeText);
          const quebradaStr = s.quebrada ? ` · ${escapeHtml(s.quebrada)}` : '';
          const roadLine = getRoadLineForStation(s.id);

          return `
            <article class="rain-card border-${s.state}">
              <div class="rain-card-head">
                <h2 class="rain-point-name">${escapeHtml(s.name)}</h2>
                ${statePill(s.state, 'rain')}
              </div>
              <div class="rain-value-row">
                <div>
                  <span class="rain-number">${mmText}</span>${unitHtml}
                </div>
                <span class="rain-meta">${escapeHtml(timeStr)}</span>
              </div>
              ${quebradaStr ? `<p class="rain-meta">${escapeHtml(s.quebrada)}</p>` : ''}
              <div class="rain-card-foot">
                <span class="rain-road-line">${escapeHtml(roadLine)}</span>
                <button type="button" class="btn-sm-pad" data-open-zone="${s.id}" aria-label="Ver detalle de ${escapeHtml(s.name)}">Ver</button>
              </div>
            </article>
          `;
        }).join('');

        /* Resumen de camino inferior */
        const withDataCount = state.roads.filter(r => r.state !== 'sindato').length;
        let worstRoad = 'verde';
        state.roads.forEach(r => {
          if (severityRank(r.state) < severityRank(worstRoad)) worstRoad = r.state;
        });

        const pendingRain = state.readings.filter(r => r.estado_validacion === 'En revisión').length;
        const pendingNote = pendingRain > 0
          ? `<span class="muted">(${pendingRain} ${pendingRain === 1 ? 'lectura' : 'lecturas'} en revisión)</span>`
          : '';

        return `
          ${bannerHtml}
          <section class="rain-grid" aria-label="Lluvia de la última hora por sector">
            ${cardsHtml}
          </section>
          <section class="road-strip" aria-label="Resumen del camino">
            <div class="road-strip-info">
              <span>Camino: ${withDataCount} de ${state.roads.length} tramos con información</span>
              ${statePill(worstRoad, 'road')}
              ${pendingNote}
            </div>
            <div class="road-strip-actions">
              <button type="button" id="btnGoCaminoFromAhora">Ver camino</button>
              <button type="button" class="btn-primary" id="btnAvisarFromAhora" style="white-space:nowrap;">${ICONS.avisar}<span>Avisar algo</span></button>
            </div>
          </section>
        `;
      }

      function renderZoneDetail() {
        const s = state.stations.find(x => x.id === ui.zoneId) || state.stations[0];
        const st = computeRainState(s.rainfall_mm, s.minutesAgo, s.hasSensor);
        const road = state.roads.find(r => r.id === s.id);

        let body = '';
        if (ui.zoneSubtab === 'lluvia24') {
          const maxBar = Math.max(20, ...s.hourly24h.map(v => v || 0));
          const svgW = 680;
          const svgH = 210;
          const padL = 44;
          const padB = 28;
          const padT = 16;
          const plotW = svgW - padL - 16;
          const plotH = svgH - padT - padB;
          const yFor = val => padT + plotH - (Math.min(val, maxBar) / maxBar) * plotH;

          const y5 = yFor(THRESHOLDS.amber1h);
          const y15 = yFor(THRESHOLDS.red1h);
          const barW = Math.floor(plotW / 24) - 4;

          const barsSvg = s.hourly24h.map((v, idx) => {
            const x = padL + idx * (plotW / 24) + 2;
            if (v === null) {
              return `<rect x="${x}" y="${padT + plotH - 6}" width="${barW}" height="6" fill="#C4D0CD" rx="2"/>`;
            }
            const h = Math.max(2, (v / maxBar) * plotH);
            const y = padT + plotH - h;
            const fill = v >= THRESHOLDS.red1h ? '#8C1D18' : (v >= THRESHOLDS.amber1h ? '#6D4004' : '#14573A');
            return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="2"><title>Hora -${23 - idx}h: ${formatMm(v)} mm</title></rect>`;
          }).join('');

          const xLabels = [0, 6, 12, 18, 23].map(idx => {
            const x = padL + idx * (plotW / 24) + barW / 2;
            const txt = idx === 23 ? 'Ahora' : `-${23 - idx} h`;
            return `<text x="${x}" y="${svgH - 6}" font-size="14" fill="#33424B" text-anchor="middle">${txt}</text>`;
          }).join('');

          body = `
            <div class="card-box">
              <div class="flex-between mb-12">
                <div>
                  <div class="muted">Lluvia en la última hora · ${escapeHtml(formatRelativeTime(s.minutesAgo, s.timeText))}</div>
                  <div class="rain-number">${formatMm(s.rainfall_mm)}${s.rainfall_mm !== null ? '<span class="rain-unit">mm</span>' : ''}</div>
                </div>
                <div>
                  ${s.quebrada ? `<span class="tag">Quebrada: ${escapeHtml(s.quebrada)}</span>` : `<span class="tag">Sin quebrada con nombre</span>`}
                </div>
              </div>
              <div class="chart-wrap">
                <svg class="chart-svg" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Gráfico de lluvia últimas 24 horas en ${escapeHtml(s.name)}">
                  <line x1="${padL}" y1="${padT + plotH}" x2="${svgW - 16}" y2="${padT + plotH}" stroke="#33424B" stroke-width="2"/>
                  <line x1="${padL}" y1="${y5}" x2="${svgW - 16}" y2="${y5}" stroke="#6D4004" stroke-width="2" stroke-dasharray="6,4"/>
                  <text x="4" y="${y5 + 5}" font-size="14" font-weight="700" fill="#6D4004">5 mm</text>
                  <line x1="${padL}" y1="${y15}" x2="${svgW - 16}" y2="${y15}" stroke="#8C1D18" stroke-width="2" stroke-dasharray="6,4"/>
                  <text x="0" y="${y15 + 5}" font-size="14" font-weight="700" fill="#8C1D18">15 mm</text>
                  ${barsSvg}
                  ${xLabels}
                </svg>
              </div>
              <p class="muted mt-12">Umbrales de ${THRESHOLDS.amber1h} mm y ${THRESHOLDS.red1h} mm por hora son provisionales, sin validar con SERNAGEOMIN.</p>
            </div>
          `;
        } else if (ui.zoneSubtab === 'quien') {
          const stationReadings = state.readings.filter(r => r.station_id === s.id);
          body = `
            <div class="two-col">
              <div class="card-box">
                <h3 class="section-title mb-8">Equipo automático</h3>
                <p style="margin:0 0 8px 0;"><strong>${escapeHtml(s.sensorStatus)}</strong></p>
                <p class="muted" style="margin:0;">Estación: ${escapeHtml(s.station_id)} · Última actualización: ${escapeHtml(formatRelativeTime(s.minutesAgo, s.timeText))}</p>
              </div>
              <div class="card-box">
                <h3 class="section-title mb-8">Observadores del sector</h3>
                <p style="margin:0 0 8px 0;"><strong>${s.observerCount24h} lecturas en las últimas 24 horas</strong></p>
                <p class="muted" style="margin:0;">Última medición: ${escapeHtml(s.lastObserverHour)} · Solo lecturas validadas mueven el semáforo.</p>
              </div>
            </div>
            <div class="card-box">
              <h3 class="section-title mb-8">Últimas lecturas registradas aquí</h3>
              ${stationReadings.length === 0
                ? `<p class="muted">Todavía no hay lecturas manuales en este punto.</p>`
                : `<div class="row-list">${stationReadings.slice(0, 3).map(r => `
                    <div class="item-row">
                      <div class="row-main">
                        <div class="row-title">${escapeHtml(r.observador_alias)} · ${formatMm(r.rainfall_mm)}${r.rainfall_mm !== null ? ' mm' : ''}</div>
                        <div class="row-sub">${escapeHtml(r.instrumento)} · ${escapeHtml(r.timeLabel)}</div>
                      </div>
                      <span class="tag ${tagClassForValidation(r.estado_validacion)}">${escapeHtml(r.estado_validacion)}</span>
                    </div>
                  `).join('')}</div>`
              }
            </div>
          `;
        } else if (ui.zoneSubtab === 'camino') {
          body = `
            <div class="card-box">
              <div class="flex-between mb-12">
                <h3 class="section-title">Tramo ${escapeHtml(s.name)}</h3>
                ${statePill(road ? road.state : 'sindato', 'road')}
              </div>
              <p style="margin:0 0 8px 0;"><strong>${escapeHtml(road ? road.note : 'Sin información disponible.')}</strong></p>
              <p class="muted mb-12">Informó: ${escapeHtml(road ? road.source : 'Sin fuente')} · ${escapeHtml(road ? road.timeLabel : 'sin hora')}</p>
              <div class="flex-row">
                <button type="button" class="btn-primary" data-open-road-sheet="${s.id}">Ver el tramo</button>
                <button type="button" id="btnZoneToCamino">Ver todos los tramos</button>
              </div>
            </div>
          `;
        } else {
          body = `
            <div class="card-box">
              <h3 class="section-title mb-12">Qué hacer ahora</h3>
              <ol style="margin:0 0 16px 0; padding-left: 24px; display:flex; flex-direction:column; gap:10px; font-weight:600;">
                ${s.actions.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
              </ol>
              <div class="info-banner" style="margin-bottom:0;">
                <div class="flex-between">
                  <span><strong>Lo que este tablero no dice:</strong> no predice aluviones ni reemplaza alertas oficiales.</span>
                  <button type="button" id="btnZoneToAlertas">Cómo leer esto</button>
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div class="zone-header">
            <div class="zone-title-group">
              <button type="button" id="btnBackToLluvia">${ICONS.volver}<span>Volver</span></button>
              <h2 class="section-title">${escapeHtml(s.name)}</h2>
              ${statePill(st, 'rain')}
            </div>
            <button type="button" id="btnAvisarFromZone">${ICONS.avisar}<span>Avisar algo</span></button>
          </div>
          ${body}
        `;
      }

      function tagClassForValidation(v) {
        if (v === 'Validada') return 'tag-validada';
        if (v === 'En revisión') return 'tag-revision';
        if (v === 'Rechazada') return 'tag-rechazada';
        return 'tag-corregida';
      }

      function renderAhoraUltimaHora() {
        const latest = state.readings.slice(0, 6);
        const role = getRole();

        if (latest.length === 0) {
          return `
            <div class="card-box">
              <h2 class="section-title mb-8">Todavía no hay lecturas hoy</h2>
              ${role !== 'publico' ? `<button type="button" class="btn-primary" id="btnEmptyToRegistrar">Registrar</button>` : ''}
            </div>
          `;
        }

        return `
          <div class="flex-between mb-12">
            <h2 class="section-title">Últimas lecturas</h2>
            <span class="muted">Solo las validadas mueven el semáforo</span>
          </div>
          <div class="row-list">
            ${latest.map(r => `
              <div class="item-row">
                <div class="row-main">
                  <div class="row-title">
                    <span>${escapeHtml(r.point_name)}</span>
                    <span style="font-family:var(--font-serif); font-size:26px;">${formatMm(r.rainfall_mm)}${r.rainfall_mm !== null ? ' mm' : ''}</span>
                  </div>
                  <div class="row-sub">${escapeHtml(r.observador_alias)} · ${escapeHtml(r.instrumento)} · ${escapeHtml(r.timeLabel)}</div>
                </div>
                <span class="tag ${tagClassForValidation(r.estado_validacion)}">${escapeHtml(r.estado_validacion)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      /* ------------------------------------------------------------------------
         10. VISTAS: PESTAÑA CAMINO (ESTADO, INFORMAR, CAMBIOS)
         ------------------------------------------------------------------------ */
      function renderCaminoEstado() {
        /* El tramo con peor estado va primero, luego orden del valle */
        const sortedRoads = [...state.roads].sort((a, b) => {
          const diff = severityRank(a.state) - severityRank(b.state);
          return diff !== 0 ? diff : a.order - b.order;
        });

        const staleBanner = state.roadMinutesSinceRefresh > 30
          ? `<div class="amber-banner" role="alert">
               <span>Información de hace ${state.roadMinutesSinceRefresh} minutos. Conviene actualizar.</span>
               <button type="button" id="btnRefreshRoadBanner">${ICONS.refresh}<span>Actualizar</span></button>
             </div>`
          : '';

        return `
          <div class="flex-between mb-12">
            <div class="flex-row">
              <h2 class="section-title">Estado de la ruta G-25</h2>
              <span class="muted">Actualizado hace ${state.roadMinutesSinceRefresh} min</span>
            </div>
            <div class="flex-row">
              <button type="button" id="btnRefreshRoad">${ICONS.refresh}<span>Actualizar</span></button>
              <button type="button" class="btn-primary" id="btnAvisarFromCamino" style="white-space:nowrap;">${ICONS.avisar}<span>Avisar algo</span></button>
            </div>
          </div>
          ${staleBanner}
          <div class="row-list">
            ${sortedRoads.map(r => `
              <article class="item-row road-row border-${r.state}">
                <div class="row-main">
                  <div class="row-title">
                    ${statePill(r.state, 'road')}
                    <span>${escapeHtml(r.name)}</span>
                    ${r.pendingReports > 0 ? `<span class="tag tag-revision">${r.pendingReports} ${r.pendingReports === 1 ? 'vecino informó' : 'vecinos informaron'}</span>` : ''}
                  </div>
                  <div class="row-sub">${escapeHtml(r.source)} · ${escapeHtml(r.timeLabel)} — ${escapeHtml(r.note)}</div>
                </div>
                <div class="row-actions">
                  <button type="button" data-open-road-sheet="${r.id}" aria-label="Ver detalle del tramo ${escapeHtml(r.name)}">Ver</button>
                </div>
              </article>
            `).join('')}
          </div>
          <p class="muted mt-12"><strong>Si no hay información, no significa que el camino esté abierto.</strong></p>
        `;
      }

      function renderCaminoInformar() {
        if (ui.informSent) {
          return `
            <div class="card-box">
              <div class="flex-row mb-12">
                ${svgState('ambar', 28)}
                <h2 class="section-title">Recibido</h2>
              </div>
              <p style="max-width:56ch; margin:0 0 14px 0;"><strong>La directiva confirma antes de publicarlo.</strong> Tu aviso queda «En revisión» y se agrupa con los de otros vecinos.</p>
              <div class="flex-row">
                <button type="button" class="btn-primary" id="btnInformReset">Enviar otro aviso</button>
                <button type="button" id="btnInformToEstado">Volver al camino</button>
              </div>
            </div>
          `;
        }

        const chips = ['derrumbe', 'agua en la calzada', 'corte de Carabineros', 'maquinaria trabajando', 'otro'];
        const roadStates = [
          { id: 'verde', label: 'Normal' },
          { id: 'ambar', label: 'Precaución' },
          { id: 'rojo', label: 'Restringido' },
          { id: 'sindato', label: 'Sin dato' }
        ];

        return `
          <div class="card-box">
            <h2 class="section-title mb-12">Informar estado del camino</h2>

            <div class="mb-12">
              <div class="field-label">1 · ¿Qué tramo?</div>
              <div class="choice-grid">
                ${state.roads.map(r => `
                  <button type="button" class="choice-btn" aria-pressed="${ui.informRoadId === r.id}" data-inf-road="${r.id}">
                    ${escapeHtml(r.name)}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="mb-12">
              <div class="field-label">2 · ¿Cómo está?</div>
              <div class="choice-grid-2">
                ${roadStates.map(rs => `
                  <button type="button" class="choice-btn" aria-pressed="${ui.informState === rs.id}" data-inf-state="${rs.id}">
                    ${statePill(rs.id, 'road')}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="mb-12">
              <div class="field-label">3 · ¿Qué pasa?</div>
              <div class="chip-wrap mb-12">
                ${chips.map(ch => `
                  <button type="button" class="chip-btn" aria-pressed="${ui.informChip === ch}" data-inf-chip="${ch}">${escapeHtml(ch)}</button>
                `).join('')}
              </div>
              <div class="two-col">
                <div>
                  <label class="field-label" for="informNoteInput">Nota opcional (<span id="informNoteCount">${ui.informNote.length}</span>/140)</label>
                  <input type="text" id="informNoteInput" maxlength="140" value="${escapeHtml(ui.informNote)}" placeholder="Ej: agua cruzando en curva sur" />
                </div>
                <div>
                  <label class="field-label" for="informPhotoInput">Foto opcional</label>
                  <input type="file" id="informPhotoInput" accept="image/*" style="min-height:56px; padding:12px 0;" />
                </div>
              </div>
            </div>

            <div class="flex-between mt-16">
              <span class="muted">Un aviso vecino nunca cambia el color por sí solo.</span>
              <button type="button" class="btn-primary" id="btnSendInform">Enviar aviso</button>
            </div>
          </div>
        `;
      }

      function renderCaminoCambios() {
        return `
          <div class="flex-between mb-12">
            <h2 class="section-title">Últimos 8 cambios del camino</h2>
            <span class="muted">Ordenados del más reciente</span>
          </div>
          <div class="row-list">
            ${state.roadChanges.slice(0, 8).map(c => `
              <div class="item-row">
                <div class="row-main">
                  <div class="row-title">
                    <span>${escapeHtml(c.hora)}</span>
                    <span>·</span>
                    <span>${escapeHtml(c.tramo)}</span>
                    ${statePill(c.state, 'road')}
                  </div>
                  <div class="row-sub">Informó: ${escapeHtml(c.informedBy)} · Confirmó: ${escapeHtml(c.confirmedBy)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      /* ------------------------------------------------------------------------
         11. VISTAS: PESTAÑA REGISTRAR (SOLO CON SESIÓN · 3 PASOS)
         ------------------------------------------------------------------------ */
      function getPreviousReadingForSector(sectorId) {
        return state.readings.find(r => r.station_id === sectorId && r.estado_validacion === 'Validada' && r.rainfall_mm !== null);
      }

      function renderRegistrar() {
        const s = state.session;
        if (!s) return '';

        const stepIdx = ui.subtab === 'identidad' ? 1 : (ui.subtab === 'lectura' ? 2 : 3);
        const stepperHtml = `
          <div class="stepper" aria-label="Pasos de registro">
            <span class="step-pill ${stepIdx === 1 ? 'active' : 'done'}">1 · Identidad</span>
            <span class="step-pill ${stepIdx === 2 ? 'active' : (stepIdx > 2 ? 'done' : '')}">2 · Lectura</span>
            <span class="step-pill ${stepIdx === 3 ? 'active' : ''}">3 · Revisar</span>
          </div>
        `;

        if (ui.subtab === 'identidad') {
          const todayIso = '2026-11-23';
          const minDateIso = '2026-11-16';
          return `
            ${stepperHtml}
            <div class="card-box">
              <h2 class="section-title mb-12">Observador identificado</h2>
              <div class="info-banner">
                <div class="flex-between">
                  <div>
                    <div style="font-size:22px; font-weight:700;">${escapeHtml(s.alias)}</div>
                    <div class="muted">Sector: ${escapeHtml(s.sector)} · Tarjeta terminada en ${escapeHtml(s.cardLast2)}</div>
                  </div>
                  <button type="button" id="btnChangeIdentity">Cambiar</button>
                </div>
              </div>

              <div class="card-box" style="background-color:#FFFFFF;">
                <div class="flex-between">
                  <div>
                    <strong>¿Es una lectura atrasada?</strong>
                    <div class="muted">Puedes cargar hasta 7 días atrás. Más atrás lo sube la directiva.</div>
                  </div>
                  <button type="button" id="btnToggleBackdate" aria-pressed="${ui.regIsBackdated}">
                    ${ui.regIsBackdated ? 'Sí, lectura atrasada' : 'Cargar lectura atrasada'}
                  </button>
                </div>
                ${ui.regIsBackdated ? `
                  <div class="two-col mt-12">
                    <div>
                      <label class="field-label" for="regDateInput">Fecha (últimos 7 días)</label>
                      <input type="date" id="regDateInput" min="${minDateIso}" max="${todayIso}" value="${escapeHtml(ui.regDate)}"/>
                    </div>
                    <div>
                      <label class="field-label" for="regTimeInput">Hora de medición</label>
                      <input type="time" id="regTimeInput" value="${escapeHtml(ui.regTime)}"/>
                    </div>
                  </div>
                ` : ''}
              </div>

              <div class="flex-between mt-12">
                <button type="button" class="btn-ghost" id="btnRegAvisarSin">Avisar sin registrarme</button>
                <button type="button" class="btn-primary" id="btnRegNext1">Siguiente</button>
              </div>
            </div>
          `;
        }

        if (ui.subtab === 'lectura') {
          const prev = getPreviousReadingForSector(s.sector_id);
          const numericVal = ui.regSinDato ? null : (ui.regValueStr === '' ? null : parseFloat(ui.regValueStr.replace(',', '.')));
          const displayVal = ui.regSinDato
            ? 'Sin dato'
            : (ui.regValueStr === '' ? '—' : `${ui.regValueStr} mm`);

          /* Control de coherencia: >3 veces la lectura anterior */
          const showCoherenceWarn = !ui.regSinDato && prev && numericVal !== null && prev.rainfall_mm > 0 && numericVal > prev.rainfall_mm * 3;

          return `
            ${stepperHtml}
            <div class="two-col">
              <div class="card-box">
                <h2 class="section-title mb-8">¿Cuánto marcó el tubo?</h2>
                <p class="muted mb-12">Sector: <strong>${escapeHtml(s.sector)}</strong></p>

                <div class="readout-box" aria-live="polite">
                  <button type="button" class="pm-btn" id="btnRegMinus" aria-label="Restar 0,5 milímetros">−</button>
                  <div class="readout-value">${escapeHtml(displayVal)}</div>
                  <button type="button" class="pm-btn" id="btnRegPlus" aria-label="Sumar 0,5 milímetros">+</button>
                </div>

                <div class="choice-grid-2 mb-12">
                  <button type="button" id="btnRegZero" aria-pressed="${!ui.regSinDato && ui.regValueStr === '0'}">No llovió (0 mm)</button>
                  <button type="button" id="btnRegNoRead" aria-pressed="${ui.regSinDato}">No puedo leerlo (Sin dato)</button>
                </div>

                ${prev ? `<p class="muted">Última lectura de este punto: <strong>${formatMm(prev.rainfall_mm)} mm</strong> (${escapeHtml(prev.timeLabel)}).</p>` : `<p class="muted">Sin lectura validada anterior en este punto.</p>`}

                ${showCoherenceWarn ? `
                  <div class="amber-banner mt-12" role="alert">
                    <span>¿Es correcto? Supera más de 3 veces la lectura anterior (${formatMm(prev.rainfall_mm)} mm).</span>
                  </div>
                ` : ''}

                <div class="flex-between mt-16">
                  <button type="button" id="btnRegBack1">Volver</button>
                  <button type="button" class="btn-primary" id="btnRegNext2">Siguiente</button>
                </div>
              </div>

              <div class="card-box">
                <div class="field-label mb-8">Teclado numérico</div>
                <div class="numpad" id="regNumpad">
                  ${['1','2','3','4','5','6','7','8','9',',','0','←'].map(k => `
                    <button type="button" class="numpad-key" data-numkey="${k}">${k}</button>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }

        /* Paso 3: Revisar */
        if (ui.regSubmittedFolio) {
          return `
            ${stepperHtml}
            <div class="card-box">
              <div class="flex-row mb-12">
                ${svgState('verde', 28)}
                <h2 class="section-title">Recibida · Folio ${escapeHtml(ui.regSubmittedFolio)}</h2>
              </div>
              <p style="max-width:56ch; margin:0 0 14px 0;"><strong>Queda en revisión hasta que la directiva la valide.</strong> Las lecturas enviadas no se borran ni editan; si hay error, se corrigen con un nuevo registro.</p>
              <div class="flex-row">
                <button type="button" class="btn-primary" id="btnRegAnother">Registrar otra</button>
                <button type="button" id="btnRegGoAhora">Ir a Ahora</button>
              </div>
            </div>
          `;
        }

        const valLabel = ui.regSinDato ? 'Sin dato (—)' : `${formatMm(parseFloat(ui.regValueStr.replace(',', '.')))} mm`;
        const horaLabel = ui.regIsBackdated ? `${ui.regDate} a las ${ui.regTime} (atrasada)` : 'ahora (hora actual)';

        return `
          ${stepperHtml}
          <div class="card-box">
            <h2 class="section-title mb-12">Revisar antes de enviar</h2>
            <div class="row-list mb-12">
              <div class="item-row"><strong>Punto</strong><span>${escapeHtml(s.sector)}</span></div>
              <div class="item-row"><strong>Medición</strong><span style="font-family:var(--font-serif); font-size:32px; font-weight:600;">${escapeHtml(valLabel)}</span></div>
              <div class="item-row"><strong>Instrumento</strong><span>Tubo comunitario (lectura manual)</span></div>
              <div class="item-row"><strong>Hora de medición</strong><span>${escapeHtml(horaLabel)}</span></div>
            </div>

            <div class="mb-12">
              <label class="field-label" for="regPhotoInput">Foto del tubo (opcional, una sola)</label>
              <input type="file" id="regPhotoInput" accept="image/*" style="min-height:56px; padding:12px 0;" />
              ${ui.regPhoto ? `<div class="muted mt-8">Archivo adjunto: ${escapeHtml(ui.regPhoto)}</div>` : ''}
            </div>

            <div class="flex-between mt-16">
              <button type="button" id="btnRegBack2">Volver</button>
              <button type="button" class="btn-primary" id="btnRegSubmit">Enviar mi lectura</button>
            </div>
          </div>
        `;
      }

      /* ------------------------------------------------------------------------
         12. VISTAS: PESTAÑA ARCHIVO (ARCHIVOS, TABLERO, TABLA)
         ------------------------------------------------------------------------ */
      function renderArchivoArchivos() {
        const role = getRole();
        return `
          <div class="flex-between mb-12">
            <h2 class="section-title">Archivos publicados</h2>
            ${role === 'directiva' ? `<button type="button" class="btn-primary" id="btnArchivoOpenSubir">Subir archivo</button>` : ''}
          </div>
          <div class="row-list">
            ${state.files.map(f => `
              <article class="item-row file-row">
                <div class="row-main">
                  <div class="row-title">
                    <span class="tag">${escapeHtml(f.format)}</span>
                    <span>${escapeHtml(f.name)}</span>
                  </div>
                  <div class="row-sub">${escapeHtml(f.rowsCountLabel)} · ${escapeHtml(f.updatedLabel)}</div>
                </div>
                <div class="row-actions">
                  <button type="button" class="btn-primary" data-open-file-board="${f.id}">Ver como tablero</button>
                  <button type="button" data-download-file="${f.id}">${ICONS.download}<span>Descargar</span></button>
                  ${role === 'directiva' && f.canUndo ? `<button type="button" class="btn-danger" data-undo-publish="${f.id}">Deshacer publicación</button>` : ''}
                </div>
              </article>
            `).join('')}
          </div>
          <p class="muted mt-12">Los archivos publicados se pueden descargar. Para subir uno hace falta sesión de directiva.</p>
        `;
      }

      function renderArchivoTablero() {
        const f = state.files.find(x => x.id === state.activeFileId) || state.files[0];
        const maxPt = Math.max(10, ...f.byPoint.map(p => p.mm));
        const maxHr = Math.max(5, ...f.byHour);

        const pointBars = f.byPoint.map(p => {
          const pct = Math.round((p.mm / maxPt) * 100);
          return `
            <div style="margin-bottom:8px;">
              <div class="flex-between" style="font-size:16px;">
                <strong>${escapeHtml(p.name)}</strong>
                <span>${formatMm(p.mm)} mm</span>
              </div>
              <div style="height:14px; background:var(--papel); border:1px solid var(--borde); border-radius:6px; overflow:hidden; margin-top:3px;">
                <div style="width:${pct}%; height:100%; background:var(--agua);"></div>
              </div>
            </div>
          `;
        }).join('');

        const svgW = 520;
        const svgH = 150;
        const barW = Math.floor((svgW - 24) / 24) - 3;
        const hourSvg = f.byHour.map((v, i) => {
          const h = Math.max(2, (v / maxHr) * 105);
          const x = 12 + i * ((svgW - 24) / 24);
          const y = 122 - h;
          return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#0E6474" rx="2"><title>${String(i).padStart(2,'0')}:00 — ${formatMm(v)} mm</title></rect>`;
        }).join('');

        return `
          <div class="card-box">
            <div class="flex-between">
              <div class="flex-row">
                <span class="tag">${escapeHtml(f.format)}</span>
                <h2 class="section-title">${escapeHtml(f.name)}</h2>
                ${f.columnsRecognized
                  ? `<span class="tag tag-validada">Columnas reconocidas</span>`
                  : `<span class="tag tag-revision">Columnas por ajustar</span>`
                }
              </div>
              <div class="flex-row">
                <button type="button" data-download-file="${f.id}">${ICONS.download}<span>Descargar</span></button>
                <button type="button" class="btn-primary" id="btnBoardToTable">Ver como tabla</button>
              </div>
            </div>
            ${!f.columnsRecognized ? `
              <div class="amber-banner mt-12" style="margin-bottom:0;">
                <span>Este archivo no trae las columnas del proyecto.</span>
                <button type="button" id="btnBoardMapCols">Cambiar columnas</button>
              </div>
            ` : ''}
          </div>

          <div class="three-col">
            <div class="card-box">
              <h3 class="section-title mb-8">Acumulado del mes</h3>
              <div class="rain-number">${formatMm(f.summary.acumulado)}<span class="rain-unit">mm</span></div>
              <p class="mt-12 mb-8"><strong>Día más lluvioso:</strong> ${escapeHtml(f.summary.maxDay)}</p>
              <p class="muted" style="margin:0;">${f.summary.rainyDays} días con lluvia registrada</p>
            </div>
            <div class="card-box">
              <h3 class="section-title mb-8">Por punto</h3>
              ${pointBars}
            </div>
            <div class="card-box">
              <h3 class="section-title mb-8">Por hora del día</h3>
              <div class="chart-wrap">
                <svg class="chart-svg" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Distribución horaria de lluvia">
                  <line x1="12" y1="122" x2="${svgW - 12}" y2="122" stroke="#33424B" stroke-width="2"/>
                  ${hourSvg}
                  <text x="16" y="142" font-size="14" fill="#33424B">00 h</text>
                  <text x="${svgW / 2}" y="142" font-size="14" fill="#33424B" text-anchor="middle">12 h</text>
                  <text x="${svgW - 16}" y="142" font-size="14" fill="#33424B" text-anchor="end">23 h</text>
                </svg>
              </div>
            </div>
          </div>
        `;
      }

      function renderArchivoTabla() {
        const f = state.files.find(x => x.id === state.activeFileId) || state.files[0];
        const perPage = 25;
        const totalPages = Math.max(1, Math.ceil(f.rows.length / perPage));
        const page = Math.min(Math.max(1, state.tablePage), totalPages);
        const slice = f.rows.slice((page - 1) * perPage, page * perPage);

        return `
          <div class="flex-between mb-12">
            <div class="flex-row">
              <h2 class="section-title">${escapeHtml(f.name)}</h2>
              <span class="muted">Mostrando ${slice.length} de ${f.rows.length} filas cargadas</span>
            </div>
            <button type="button" id="btnTableToBoard">Ver como tablero</button>
          </div>
          <div class="table-wrap">
            <table class="data-table archive-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Punto</th>
                  <th>Lluvia (mm)</th>
                  <th class="col-origen">Origen</th>
                </tr>
              </thead>
              <tbody>
                ${slice.map(r => `
                  <tr>
                    <td>
                      <div>${escapeHtml(r.fecha)}</div>
                      <div class="mobile-sub-origin">${escapeHtml(r.origen)}</div>
                    </td>
                    <td><strong>${escapeHtml(r.punto)}</strong></td>
                    <td>${formatMm(r.mm)}</td>
                    <td class="col-origen">${escapeHtml(r.origen)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="pagination-bar">
            <button type="button" id="btnPagePrev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
            <span>Página ${page} de ${totalPages}</span>
            <button type="button" id="btnPageNext" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>
          </div>
        `;
      }

      /* ------------------------------------------------------------------------
         13. VISTAS: PESTAÑA DIRECTIVA (POR VALIDAR, OBSERVADORES, SUBIR)
         ------------------------------------------------------------------------ */
      function getValidationQueue() {
        const rainItems = state.readings
          .filter(r => r.estado_validacion === 'En revisión')
          .map(r => ({ kind: 'lluvia', id: r.id, item: r }));
        const roadItems = state.citizenReports
          .filter(a => a.estado === 'En revisión')
          .map(a => ({ kind: 'camino', id: a.id, item: a }));

        if (ui.valFilter === 'lluvia') return rainItems;
        if (ui.valFilter === 'camino') return roadItems;
        return [...rainItems, ...roadItems];
      }

      function renderDirectivaValidar() {
        const allRain = state.readings.filter(r => r.estado_validacion === 'En revisión').length;
        const allRoad = state.citizenReports.filter(a => a.estado === 'En revisión').length;
        const total = allRain + allRoad;
        const queue = getValidationQueue();

        const filtersHtml = `
          <div class="flex-between mb-12">
            <h2 class="section-title">${total} ${total === 1 ? 'registro espera' : 'registros esperan'} revisión</h2>
            <div class="chip-wrap">
              <button type="button" class="chip-btn" aria-pressed="${ui.valFilter === 'todos'}" data-val-filter="todos">Todos (${total})</button>
              <button type="button" class="chip-btn" aria-pressed="${ui.valFilter === 'lluvia'}" data-val-filter="lluvia">Lecturas (${allRain})</button>
              <button type="button" class="chip-btn" aria-pressed="${ui.valFilter === 'camino'}" data-val-filter="camino">Avisos camino (${allRoad})</button>
            </div>
          </div>
        `;

        if (queue.length === 0) {
          return `
            ${filtersHtml}
            <div class="card-box">
              <div class="flex-row">
                ${svgState('verde', 28)}
                <strong>No quedan elementos pendientes en esta cola.</strong>
              </div>
              <p class="muted mt-8">Cada validación se hace de a una para cuidar la calidad del dato comunitario.</p>
            </div>
          `;
        }

        const current = queue[0];
        if (current.kind === 'lluvia') {
          const r = current.item;
          const prev = getPreviousReadingForSector(r.station_id);
          const motivos = ['fuera de rango', 'foto no coincide', 'duplicada', 'tarjeta ajena', 'otro'];

          return `
            ${filtersHtml}
            <article class="card-box">
              <div class="flex-between mb-12">
                <div>
                  <span class="tag tag-revision">Lectura de lluvia · 1 de ${queue.length}</span>
                  <h3 class="section-title mt-8">${escapeHtml(r.point_name)}</h3>
                </div>
                <div style="text-align:right;">
                  <div class="rain-number" style="font-size:64px;">${formatMm(r.rainfall_mm)}${r.rainfall_mm !== null ? '<span class="rain-unit">mm</span>' : ''}</div>
                  <div class="muted">${escapeHtml(r.timeLabel)}</div>
                </div>
              </div>

              <div class="two-col mb-12">
                <div class="info-banner" style="margin:0;">
                  <div><strong>Observador:</strong> ${escapeHtml(r.observador_alias)}</div>
                  <div><strong>Instrumento:</strong> ${escapeHtml(r.instrumento)}</div>
                  <div><strong>Foto:</strong> ${r.foto ? escapeHtml(r.foto) : 'Sin foto adjunta'}</div>
                </div>
                <div class="info-banner" style="margin:0;">
                  <div><strong>Para comparar (lectura anterior):</strong></div>
                  <div style="font-size:24px; font-weight:700;">${prev ? `${formatMm(prev.rainfall_mm)} mm` : 'Sin dato previo'}</div>
                  <div class="muted">${prev ? `${escapeHtml(prev.timeLabel)} · ${escapeHtml(prev.observador_alias)}` : 'Primera lectura del punto'}</div>
                </div>
              </div>

              ${ui.valCorrectMode ? `
                <div class="card-box" style="background:#FFFFFF;">
                  <label class="field-label" for="valCorrectInput">Valor corregido en mm (crea una fila nueva y conserva la original)</label>
                  <div class="flex-row">
                    <input type="text" id="valCorrectInput" style="max-width:220px;" value="${escapeHtml(ui.valCorrectInput)}" placeholder="Ej: 18,4" />
                    <button type="button" class="btn-primary" id="btnConfirmCorrect">Guardar corrección</button>
                    <button type="button" id="btnCancelValSub">Cancelar</button>
                  </div>
                </div>
              ` : ''}

              ${ui.valRejectMode ? `
                <div class="card-box" style="background:#FFFFFF;">
                  <div class="field-label mb-8">Elige el motivo del rechazo:</div>
                  <div class="chip-wrap mb-12">
                    ${motivos.map(m => `<button type="button" class="btn-danger" data-reject-reason="${m}">${escapeHtml(m)}</button>`).join('')}
                  </div>
                  <button type="button" id="btnCancelValSub">Cancelar</button>
                </div>
              ` : ''}

              ${!ui.valCorrectMode && !ui.valRejectMode ? `
                <div class="flex-row mt-12">
                  <button type="button" class="btn-ok" id="btnValApprove">Validar</button>
                  <button type="button" id="btnValCorrect">Corregir</button>
                  <button type="button" class="btn-danger" id="btnValReject">Rechazar</button>
                </div>
              ` : ''}
            </article>
          `;
        }

        /* Aviso de camino ciudadano en revisión */
        const a = current.item;
        const roadNow = state.roads.find(x => x.id === a.road_id);
        return `
          ${filtersHtml}
          <article class="card-box">
            <div class="flex-between mb-12">
              <div>
                <span class="tag tag-revision">Aviso ciudadano de camino · 1 de ${queue.length}</span>
                <h3 class="section-title mt-8">${escapeHtml(a.tramo)}</h3>
              </div>
              ${statePill(a.suggested_state, 'road')}
            </div>

            <div class="two-col mb-12">
              <div class="info-banner" style="margin:0;">
                <div><strong>Qué informó el vecino:</strong> ${escapeHtml(a.tipo)}</div>
                <div><strong>Nota:</strong> ${escapeHtml(a.nota || 'Sin nota adicional')}</div>
                <div class="muted">${escapeHtml(a.hora)}</div>
              </div>
              <div class="info-banner" style="margin:0;">
                <div><strong>Estado público actual del tramo:</strong></div>
                <div class="mt-8">${statePill(roadNow ? roadNow.state : 'sindato', 'road')}</div>
                <div class="muted mt-8">${escapeHtml(roadNow ? `${roadNow.source} · ${roadNow.timeLabel}` : '')}</div>
              </div>
            </div>

            <div class="flex-row mt-12">
              <button type="button" class="btn-ok" id="btnValApproveRoad">Validar y actualizar camino</button>
              <button type="button" class="btn-danger" id="btnValRejectRoad">Descartar aviso</button>
            </div>
          </article>
        `;
      }

      function renderDirectivaObservadores() {
        const acreditados = state.observers.filter(o => o.estado === 'Acreditado').length;
        const suspendidos = state.observers.filter(o => o.estado === 'Suspendido').length;
        const pendientes = getPendingQueueCount();

        return `
          <div class="flex-between mb-12">
            <h2 class="section-title">Padrón de observadores</h2>
            <div class="flex-row">
              <button type="button" class="btn-primary" id="btnAddObserver">Agregar observador</button>
              <button type="button" id="btnExportObservers">${ICONS.download}<span>Exportar lista</span></button>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-num">${acreditados}</div><div class="kpi-label">Acreditados</div></div>
            <div class="kpi-card"><div class="kpi-num">${suspendidos}</div><div class="kpi-label">Suspendidos</div></div>
            <div class="kpi-card"><div class="kpi-num">${state.readings.length}</div><div class="kpi-label">Lecturas esta semana</div></div>
            <div class="kpi-card"><div class="kpi-num">${pendientes}</div><div class="kpi-label">Por revisar</div></div>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Alias</th>
                  <th>Sector</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Última lectura</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${state.observers.map(o => `
                  <tr>
                    <td><strong>${escapeHtml(o.alias)}</strong></td>
                    <td>${escapeHtml(o.sector)}</td>
                    <td>${o.rol === 'directiva' ? 'Directiva' : 'Observador'}</td>
                    <td><span class="tag ${o.estado === 'Acreditado' ? 'tag-validada' : 'tag-rechazada'}">${escapeHtml(o.estado)}</span></td>
                    <td>${escapeHtml(o.lastReading)}</td>
                    <td>
                      <div class="flex-row">
                        <button type="button" class="btn-sm-pad" data-view-obs="${o.id}">Ver</button>
                        ${o.rol !== 'directiva' ? `
                          <button type="button" class="btn-sm-pad ${o.estado === 'Acreditado' ? 'btn-danger' : 'btn-ok'}" data-toggle-obs="${o.id}">
                            ${o.estado === 'Acreditado' ? 'Suspender' : 'Reactivar'}
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p class="muted mt-12">Por privacidad se muestran solo alias y sector, nunca nombres, correos ni teléfonos.</p>
        `;
      }

      /* ------------------------------------------------------------------------
         13 bis. INGRESO OFICIAL DE PLUVIÓMETROS (DIRECTIVA)
         Planillas, equipos automáticos o verificaciones en terreno. Entra ya
         validado y no pasa por la cola de revisión ciudadana.
         ------------------------------------------------------------------------ */
      function hoyLocalISO() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }

      function horaLocalHHMM() {
        const d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }

      function etiquetaHora(fecha, hora) {
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const ayer = new Date(Date.now() - 86400000);
        const ayerISO = ayer.getFullYear() + '-' + String(ayer.getMonth() + 1).padStart(2, '0') + '-' + String(ayer.getDate()).padStart(2, '0');
        if (fecha === hoyLocalISO()) return 'hoy a las ' + hora;
        if (fecha === ayerISO) return 'ayer a las ' + hora;
        const partes = String(fecha).split('-');
        const dia = Number(partes[2]);
        const mes = meses[Number(partes[1]) - 1] || '';
        return dia + ' de ' + mes + ' a las ' + hora;
      }

      function renderDirectivaOficial() {
        const oficiales = state.readings.filter(r => r.oficial).slice(0, 6);

        return `
          <div class="flex-between mb-12">
            <h2 class="section-title">Ingreso oficial</h2>
            <span class="tag tag-validada">Queda validada</span>
          </div>
          <p class="muted mb-12">Planillas, equipos automáticos o verificaciones en terreno. Entra validada y no pasa por la cola de revisión.</p>

          <div class="card-box">
            <div class="two-col mb-12">
              <div>
                <label class="field-label" for="ofPunto">Punto de medición</label>
                <select id="ofPunto">
                  ${state.stations.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="field-label" for="ofOrigen">Origen del dato</label>
                <select id="ofOrigen">
                  <option>Equipo automático</option>
                  <option>Planilla oficial</option>
                  <option>Verificación en terreno</option>
                </select>
              </div>
            </div>

            <div class="three-col mb-12">
              <div>
                <label class="field-label" for="ofFecha">Fecha</label>
                <input type="date" id="ofFecha" value="${hoyLocalISO()}" />
              </div>
              <div>
                <label class="field-label" for="ofHora">Hora</label>
                <input type="time" id="ofHora" value="${horaLocalHHMM()}" />
              </div>
              <div>
                <label class="field-label" for="ofMm">Lluvia (mm)</label>
                <input type="number" id="ofMm" min="0" max="300" step="0.1" inputmode="decimal" placeholder="Ej: 12,4" />
              </div>
            </div>

            <div class="mb-12">
              <label class="field-label" for="ofNota">Nota (opcional)</label>
              <input type="text" id="ofNota" maxlength="140" placeholder="Ej: planilla de noviembre" />
            </div>

            <button type="button" class="btn-primary btn-full" id="btnGuardarOficial">Guardar lectura oficial</button>
            <p class="muted mt-8" style="margin-bottom:0;">Si es de la última hora y media, actualiza el tablero; si es más antigua, queda en el historial.</p>
          </div>

          <h3 class="section-title mt-16 mb-8">Últimos ingresos oficiales</h3>
          ${oficiales.length === 0 ? `
            <div class="card-box"><p class="muted" style="margin:0;">Todavía no hay ingresos oficiales en este navegador.</p></div>
          ` : `
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Cuándo</th><th>Punto</th><th>mm</th><th>Origen</th><th>Registró</th></tr>
                </thead>
                <tbody>
                  ${oficiales.map(r => `
                    <tr>
                      <td>${escapeHtml(r.timeLabel)}</td>
                      <td><strong>${escapeHtml(r.point_name)}</strong></td>
                      <td>${formatMm(r.rainfall_mm)}</td>
                      <td>${escapeHtml(r.instrumento || r.origen || 'Oficial')}</td>
                      <td>${escapeHtml(r.observador_alias)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        `;
      }

      /* ------------------------------------------------------------------------
         13 ter. DATOS DEL SITIO: PUNTOS Y RESPALDO (DIRECTIVA)
         ------------------------------------------------------------------------ */
      function renderDirectivaDatos() {
        const conectado = !!(ALMACEN && ALMACEN.configurado);
        const modoTxt = conectado ? 'Supabase' : 'Local';

        return `
          <h2 class="section-title mb-12">Datos del sitio</h2>

          <div class="card-box mb-12">
            <div class="flex-between">
              <div>
                <strong>${conectado ? 'Conectado a Supabase' : 'Guardado en este navegador'}</strong>
                <div class="muted">${conectado ? 'Los datos viven en la base de datos del proyecto.' : 'Nada sale de este equipo hasta conectar Supabase (datos/config.js).'}</div>
              </div>
              <span class="tag ${conectado ? 'tag-validada' : 'tag-revision'}">${modoTxt}</span>
            </div>
            <div class="flex-row mt-12">
              <button type="button" class="btn-sm-pad" id="btnRespaldar">Descargar</button>
              <button type="button" class="btn-sm-pad" id="btnCargarRespaldo">Cargar</button>
              <button type="button" class="btn-sm-pad btn-danger" id="btnRestaurarSemilla">Restaurar ejemplo</button>
            </div>
            <input type="file" id="fileRespaldo" accept="application/json,.json" class="sr-only" />
            <p class="muted mt-8" style="margin-bottom:0;">El respaldo incluye puntos, caminos, lecturas, observadores y archivos. Guárdalo antes de cambiar de computador.</p>
          </div>

          <div class="flex-between mb-8">
            <h3 class="section-title" style="margin:0;">Puntos de medición</h3>
            <button type="button" class="btn-primary" id="btnNuevoPunto">Nuevo punto</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Punto</th><th>Quebrada o referencia</th><th>Sensor</th><th>Última lectura</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                ${state.stations.map(s => {
                  const lecturas = state.readings.filter(r => r.station_id === s.id).length;
                  return `
                  <tr>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td>${s.quebrada ? escapeHtml(s.quebrada) : '—'}</td>
                    <td>${s.hasSensor ? 'Sí' : 'No'}</td>
                    <td>${s.rainfall_mm === null ? 'Sin dato' : formatMm(s.rainfall_mm) + ' mm · ' + escapeHtml(formatRelativeTime(s.minutesAgo, s.timeText))}</td>
                    <td>
                      <div class="flex-row">
                        <button type="button" class="btn-sm-pad" data-edit-point="${s.id}">Editar</button>
                        ${lecturas === 0 ? `<button type="button" class="btn-sm-pad btn-danger" data-del-point="${s.id}">Quitar</button>` : ''}
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <p class="muted mt-12">Para conectar una base de datos, completa <strong>datos/config.js</strong> y sigue <strong>supabase/LEEME.md</strong>. Los puntos nuevos se crean también como tramo de camino.</p>
        `;
      }

      /* ------------------------------------------------------------------------
         14. ASISTENTE DE SUBIDA DE HISTÓRICOS (4 PASOS · DIRECTIVA Y ARCHIVO)
         ------------------------------------------------------------------------ */
      function resetUploadWizard() {
        ui.uploadStep = 1;
        ui.uploadFileName = '';
        ui.uploadFormat = '';
        ui.uploadRawRows = [];
        ui.uploadHeaders = [];
        ui.uploadMap = { fecha: 0, punto: 1, mm: 2, origen: 3 };
        ui.uploadErrors = [];
        ui.uploadDuplicates = 0;
        ui.uploadValidRows = [];
        ui.uploadConflictRule = 'saltar';
        ui.uploadErrorMsg = '';
      }

      function parseDelimitedText(text, filename) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          ui.uploadErrorMsg = 'El archivo tiene muy pocas líneas para leer columnas.';
          return false;
        }
        const sep = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
        const rows = lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
        ui.uploadHeaders = rows[0];
        ui.uploadRawRows = rows.slice(1);
        ui.uploadFileName = filename;
        ui.uploadFormat = filename.split('.').pop().toUpperCase();
        ui.uploadErrorMsg = '';

        /* Detección automática de columnas */
        const lower = ui.uploadHeaders.map(h => h.toLowerCase());
        const findIdx = (keys, fallback) => {
          const i = lower.findIndex(h => keys.some(k => h.includes(k)));
          return i >= 0 ? i : Math.min(fallback, ui.uploadHeaders.length - 1);
        };
        ui.uploadMap = {
          fecha: findIdx(['fecha', 'date', 'timestamp', 'hora'], 0),
          punto: findIdx(['punto', 'sector', 'station', 'estacion'], 1),
          mm: findIdx(['mm', 'lluvia', 'rain', 'precip'], 2),
          origen: findIdx(['origen', 'source', 'fuente', 'metodo'], 3)
        };
        ui.uploadStep = 2;
        return true;
      }

      function runUploadValidation() {
        const errors = [];
        const valid = [];
        const seenKeys = new Set();
        let duplicates = 0;

        ui.uploadRawRows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const fecha = (cols[ui.uploadMap.fecha] || '').trim();
          const punto = (cols[ui.uploadMap.punto] || '').trim();
          const mmRaw = (cols[ui.uploadMap.mm] || '').trim().replace(',', '.');
          const origen = (cols[ui.uploadMap.origen] || 'Archivo histórico').trim();

          if (!punto) {
            errors.push({ fila: rowNum, motivo: 'falta el punto' });
            return;
          }
          if (!fecha || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
            errors.push({ fila: rowNum, motivo: 'la fecha no se entiende' });
            return;
          }
          const mmVal = mmRaw === '' || mmRaw === '—' ? null : Number(mmRaw);
          if (mmVal !== null && Number.isNaN(mmVal)) {
            errors.push({ fila: rowNum, motivo: 'el valor de lluvia no es un número' });
            return;
          }
          if (mmVal !== null && mmVal < 0) {
            errors.push({ fila: rowNum, motivo: 'lluvia negativa' });
            return;
          }

          const key = `${fecha}|${punto}`;
          if (seenKeys.has(key)) {
            duplicates++;
            return;
          }
          seenKeys.add(key);
          valid.push({ fecha, punto, mm: mmVal, origen });
        });

        ui.uploadErrors = errors;
        ui.uploadDuplicates = duplicates;
        ui.uploadValidRows = valid;
        ui.uploadStep = 3;
      }

      function renderUploadWizard(inSheet) {
        const s = ui.uploadStep;
        const stepper = `
          <div class="stepper">
            <span class="step-pill ${s === 1 ? 'active' : 'done'}">1 · Archivo</span>
            <span class="step-pill ${s === 2 ? 'active' : (s > 2 ? 'done' : '')}">2 · Columnas</span>
            <span class="step-pill ${s === 3 ? 'active' : (s > 3 ? 'done' : '')}">3 · Revisión</span>
            <span class="step-pill ${s === 4 ? 'active' : ''}">4 · Publicar</span>
          </div>
        `;

        if (s === 1) {
          return `
            ${stepper}
            <div class="card-box">
              <h3 class="section-title mb-8">Elegir archivo histórico</h3>
              <p class="muted mb-12">Formatos permitidos: .csv, .txt, .md o .xlsx (máximo 20 MB). No se publica hasta el paso 4.</p>
              ${ui.uploadErrorMsg ? `<div class="danger-banner">${escapeHtml(ui.uploadErrorMsg)}</div>` : ''}
              <div class="mb-12">
                <label class="field-label" for="uploadFileInput">Seleccionar archivo desde este equipo</label>
                <input type="file" id="uploadFileInput" accept=".csv,.txt,.md,.xlsx,.xls" style="min-height:56px; padding:12px 0;" />
              </div>
              <div class="info-banner">
                <div class="flex-between">
                  <span>¿Quieres probar la revisión con errores y duplicados de ejemplo?</span>
                  <button type="button" class="btn-primary" id="btnUseDemoCsv">Usar CSV de prueba</button>
                </div>
              </div>
            </div>
          `;
        }

        if (s === 2) {
          const optHtml = selectedIdx => ui.uploadHeaders.map((h, i) =>
            `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${escapeHtml(h)}</option>`
          ).join('');

          return `
            ${stepper}
            <div class="card-box">
              <div class="flex-between mb-12">
                <h3 class="section-title">Confirmar columnas</h3>
                <span class="tag">${escapeHtml(ui.uploadFileName)}</span>
              </div>
              <div class="two-col mb-12">
                <div><label class="field-label" for="mapFecha">Fecha</label><select id="mapFecha">${optHtml(ui.uploadMap.fecha)}</select></div>
                <div><label class="field-label" for="mapPunto">Punto</label><select id="mapPunto">${optHtml(ui.uploadMap.punto)}</select></div>
                <div><label class="field-label" for="mapMm">Lluvia (mm)</label><select id="mapMm">${optHtml(ui.uploadMap.mm)}</select></div>
                <div><label class="field-label" for="mapOrigen">Origen</label><select id="mapOrigen">${optHtml(ui.uploadMap.origen)}</select></div>
              </div>
              <div class="table-wrap mb-12">
                <table class="data-table">
                  <thead><tr>${ui.uploadHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                  <tbody>
                    ${ui.uploadRawRows.slice(0, 5).map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <div class="flex-between">
                <button type="button" id="btnUpBack1">Volver</button>
                <button type="button" class="btn-primary" id="btnUpToStep3">Revisar filas</button>
              </div>
            </div>
          `;
        }

        if (s === 3) {
          return `
            ${stepper}
            <div class="card-box">
              <h3 class="section-title mb-8">Resultado de la revisión</h3>
              <div class="info-banner">
                <strong>${ui.uploadValidRows.length} filas listas · ${ui.uploadErrors.length} con error · ${ui.uploadDuplicates} duplicadas</strong>
              </div>
              ${ui.uploadErrors.length > 0 ? `
                <div class="table-wrap mb-12">
                  <table class="data-table">
                    <thead><tr><th>Fila</th><th>Problema encontrado</th></tr></thead>
                    <tbody>
                      ${ui.uploadErrors.slice(0, 5).map(e => `<tr><td>Fila ${e.fila}</td><td>${escapeHtml(e.motivo)}</td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
                ${ui.uploadErrors.length > 5 ? `<button type="button" class="mb-12" id="btnUpShowAllErrors">Ver todos (${ui.uploadErrors.length})</button>` : ''}
              ` : `<p class="muted mb-12">No se encontraron errores en las filas revisadas.</p>`}
              <div class="flex-between">
                <button type="button" id="btnUpBack2">Cambiar columnas</button>
                <button type="button" class="btn-primary" id="btnUpToStep4" ${ui.uploadValidRows.length === 0 ? 'disabled' : ''}>Continuar a publicar</button>
              </div>
            </div>
          `;
        }

        /* Paso 4: Publicar */
        const rules = [
          { id: 'saltar', label: 'Saltar fechas repetidas' },
          { id: 'mezclar', label: 'Mezclar manteniendo ambas' },
          { id: 'reemplazar', label: 'Reemplazar fechas existentes' }
        ];

        return `
          ${stepper}
          <div class="card-box">
            <h3 class="section-title mb-12">Confirmar publicación</h3>
            <div class="row-list mb-12">
              <div class="item-row"><strong>Archivo</strong><span>${escapeHtml(ui.uploadFileName)}</span></div>
              <div class="item-row"><strong>Filas válidas</strong><span>${ui.uploadValidRows.length} filas</span></div>
              <div class="item-row"><strong>Fuente</strong><span>Carga histórica · Directiva</span></div>
            </div>

            <div class="mb-12">
              <div class="field-label">Si hay fechas que ya existen (nunca automático):</div>
              <div class="chip-wrap">
                ${rules.map(rl => `
                  <button type="button" class="chip-btn" aria-pressed="${ui.uploadConflictRule === rl.id}" data-conflict-rule="${rl.id}">${rl.label}</button>
                `).join('')}
              </div>
            </div>

            <p class="muted mb-12">El archivo original se conserva siempre. Tendrás 24 horas para deshacer la publicación.</p>

            <div class="flex-between">
              <button type="button" id="btnUpBack3">Volver</button>
              <div class="flex-row">
                <button type="button" id="btnUpDraft">Guardar borrador</button>
                <button type="button" class="btn-primary" id="btnUpPublish">Publicar</button>
              </div>
            </div>
          </div>
        `;
      }

      /* ------------------------------------------------------------------------
         15. VISTAS: PESTAÑA AYUDA (4 SOLAPAS · MAX 60 PALABRAS + SVG INLINE)
         ------------------------------------------------------------------------ */
      function renderAyuda() {
        if (ui.subtab === 'estados') {
          return `
            <div class="card-box">
              <h2 class="section-title mb-12">Los cuatro estados</h2>
              <div class="help-layout">
                <div class="row-list">
                  <div class="item-row">${statePill('verde', 'rain')}<span>Menos de ${THRESHOLDS.amber1h} mm en la última hora. No significa que no llueva.</span></div>
                  <div class="item-row">${statePill('ambar', 'rain')}<span>${THRESHOLDS.amber1h} mm o más en una hora. Mire el cielo y el río.</span></div>
                  <div class="item-row">${statePill('rojo', 'rain')}<span>${THRESHOLDS.red1h} mm o más en una hora. No baje a la quebrada.</span></div>
                  <div class="item-row">${statePill('sindato', 'rain')}<span>Sin lectura hace más de ${THRESHOLDS.staleMinutes} minutos. Jamás es verde.</span></div>
                </div>
                <div class="help-visual-box">
                  <svg width="260" height="220" viewBox="0 0 260 220" role="img" aria-label="Cuatro formas del semáforo">
                    <circle cx="65" cy="60" r="32" fill="#D8E7DC" stroke="#14573A" stroke-width="4"/>
                    <text x="65" y="110" text-anchor="middle" font-size="16" font-weight="700" fill="#14573A">Normal</text>
                    <polygon points="195,28 228,88 162,88" fill="#F6E3B8" stroke="#6D4004" stroke-width="4" stroke-linejoin="round"/>
                    <text x="195" y="110" text-anchor="middle" font-size="16" font-weight="700" fill="#6D4004">Ojo</text>
                    <rect x="35" y="130" width="60" height="60" rx="6" fill="#F3D2CB" stroke="#8C1D18" stroke-width="4"/>
                    <text x="65" y="210" text-anchor="middle" font-size="16" font-weight="700" fill="#8C1D18">Peligro</text>
                    <circle cx="195" cy="160" r="30" fill="#E2E6E5" stroke="#3B4A52" stroke-width="4"/>
                    <text x="195" y="169" text-anchor="middle" font-size="30" font-weight="700" fill="#3B4A52">?</text>
                    <text x="195" y="210" text-anchor="middle" font-size="16" font-weight="700" fill="#3B4A52">Sin dato</text>
                  </svg>
                </div>
              </div>
            </div>
          `;
        }

        if (ui.subtab === 'milimetros') {
          return `
            <div class="card-box">
              <h2 class="section-title mb-12">Qué es un milímetro</h2>
              <div class="help-layout">
                <div>
                  <p class="help-text"><strong>Un milímetro es un litro de agua caído sobre un metro cuadrado de suelo.</strong></p>
                  <p class="help-text">En el tubo del pluviómetro, cada raya marca un milímetro. Cinco rayas en una hora ya piden atención; quince rayas en una hora indican lluvia fuerte.</p>
                </div>
                <div class="help-visual-box">
                  <svg width="260" height="220" viewBox="0 0 260 220" role="img" aria-label="Regla de tubo pluviómetro">
                    <rect x="90" y="20" width="76" height="180" rx="8" fill="#F4F7F5" stroke="#15212A" stroke-width="4"/>
                    <rect x="94" y="110" width="68" height="86" fill="#D6E7EA"/>
                    <line x1="90" y1="60" x2="122" y2="60" stroke="#8C1D18" stroke-width="3"/>
                    <text x="176" y="65" font-size="16" font-weight="700" fill="#8C1D18">15 mm</text>
                    <line x1="90" y1="130" x2="122" y2="130" stroke="#6D4004" stroke-width="3"/>
                    <text x="176" y="135" font-size="16" font-weight="700" fill="#6D4004">5 mm</text>
                    <line x1="90" y1="185" x2="115" y2="185" stroke="#14573A" stroke-width="3"/>
                    <text x="176" y="190" font-size="16" font-weight="700" fill="#14573A">1 mm</text>
                  </svg>
                </div>
              </div>
            </div>
          `;
        }

        if (ui.subtab === 'alertas') {
          return `
            <div class="card-box">
              <h2 class="section-title mb-12">Esto no es una alerta oficial</h2>
              <div class="help-layout">
                <div>
                  <p class="help-text"><strong>Este tablero no avisa de aluviones. No reemplaza a SENAPRED, Carabineros ni Bomberos.</strong></p>
                  <ol style="margin:0; padding-left:22px; display:flex; flex-direction:column; gap:8px; font-weight:600;">
                    <li>Aléjese de esteros y quebradas si llueve fuerte.</li>
                    <li>Siga las instrucciones de Carabineros y SENAPRED.</li>
                    <li>En emergencia, llame a Bomberos (132) o Carabineros (133).</li>
                  </ol>
                </div>
                <div class="help-visual-box">
                  <svg width="240" height="200" viewBox="0 0 240 200" role="img" aria-label="Aviso de instituciones oficiales">
                    <path d="M120 18 46 50v52c0 46 32 72 74 82 42-10 74-36 74-82V50l-74-32Z" fill="#F3D2CB" stroke="#8C1D18" stroke-width="4"/>
                    <line x1="120" y1="68" x2="120" y2="116" stroke="#8C1D18" stroke-width="8" stroke-linecap="round"/>
                    <circle cx="120" cy="140" r="6" fill="#8C1D18"/>
                  </svg>
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div class="card-box">
            <h2 class="section-title mb-12">Uso con poca señal</h2>
            <div class="help-layout">
              <div>
                <p class="help-text"><strong>Sin internet se muestra el último dato guardado en este equipo</strong> y la hora en que se descargó.</p>
                <p class="help-text">No podrá enviar lecturas ni ver cambios nuevos hasta recuperar señal. También puede pedir el archivo impreso en la junta de vecinos.</p>
                <button type="button" id="btnResetDemoData" class="mt-8">Restablecer datos de ejemplo</button>
              </div>
              <div class="help-visual-box">
                <svg width="240" height="200" viewBox="0 0 240 200" role="img" aria-label="Teléfono sin señal">
                  <rect x="74" y="22" width="92" height="156" rx="12" fill="#E2E6E5" stroke="#3B4A52" stroke-width="4"/>
                  <line x1="92" y1="154" x2="148" y2="154" stroke="#3B4A52" stroke-width="4" stroke-linecap="round"/>
                  <line x1="94" y1="74" x2="146" y2="126" stroke="#8C1D18" stroke-width="5" stroke-linecap="round"/>
                  <line x1="146" y1="74" x2="94" y2="126" stroke="#8C1D18" stroke-width="5" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
          </div>
        `;
      }

      /* ------------------------------------------------------------------------
         16. RENDERIZADO DE HOJAS LATERALES (INGRESO, CUENTA, AVISAR, TRAMO, MÁS)
         ------------------------------------------------------------------------ */
      function renderSheet() {
        const titleEl = document.getElementById('sheetTitle');
        const bodyEl = document.getElementById('sheetBody');

        if (ui.sheetType === 'ingreso') {
          titleEl.textContent = 'Entrar';
          const now = Date.now();
          const locked = state.lockoutUntil && now < state.lockoutUntil;
          const remainingMin = locked ? Math.ceil((state.lockoutUntil - now) / 60000) : 0;

          if (locked) {
            bodyEl.innerHTML = `
              <div class="danger-banner">
                <span>Espera ${remainingMin} ${remainingMin === 1 ? 'minuto' : 'minutos'} antes de volver a intentar.</span>
              </div>
              <button type="button" class="btn-full mt-12" id="btnSheetAvisar">Avisar sin registrarme</button>
            `;
            bindSheetEvents();
            return;
          }

          const dots = [0,1,2,3].map(i => `<span class="pin-dot ${i < ui.loginPin.length ? 'filled' : ''}"></span>`).join('');
          const attemptsLeft = Math.max(0, 3 - state.loginAttempts);

          bodyEl.innerHTML = `
            ${ui.loginError ? `<div class="danger-banner" role="alert"><span>${escapeHtml(ui.loginError)} (quedan ${attemptsLeft} ${attemptsLeft === 1 ? 'intento' : 'intentos'})</span></div>` : ''}

            <div class="mb-12">
              <label class="field-label" for="loginCardInput">Código de tu tarjeta (8 dígitos)</label>
              <input type="text" id="loginCardInput" inputmode="numeric" maxlength="8" value="${escapeHtml(ui.loginCard)}" placeholder="Ej: 10042042" aria-describedby="cardHelp"/>
            </div>

            <div class="mb-12">
              <label class="field-label" for="loginPinBtn">Clave de cuatro números</label>
              <button type="button" id="loginPinBtn" class="btn-full" style="background:#FFFFFF; border-color:${ui.loginFocusField === 'pin' ? 'var(--agua)' : 'var(--tinta-2)'};">
                <div class="pin-dots" style="margin:0;">${dots}</div>
              </button>
            </div>

            <div class="numpad mb-12" id="loginNumpad">
              ${['1','2','3','4','5','6','7','8','9','Limpiar','0','←'].map(k => `
                <button type="button" class="numpad-key" data-loginkey="${k}">${k}</button>
              `).join('')}
            </div>

            <button type="button" class="btn-primary btn-full mb-8" id="btnDoLogin">Entrar</button>
            <button type="button" class="btn-full mb-12" id="btnSheetAvisar">Avisar sin registrarme</button>
            <p id="cardHelp" style="font-size:18px; margin:0; text-align:center;">¿No tienes tarjeta? Pídela en la junta de vecinos.</p>

          `;
        } else if (ui.sheetType === 'cuenta') {
          const s = state.session;
          if (!s) { closeSheet(); return; }
          titleEl.textContent = 'Cuenta';
          const myReadings = state.readings.filter(r => r.observador_id === s.observerId).slice(0, 4);

          bodyEl.innerHTML = `
            <div class="card-box">
              <div style="font-size:22px; font-weight:700;">${escapeHtml(s.alias)}</div>
              <div class="muted mt-8">Rol: <strong>${s.rol === 'directiva' ? 'Directiva' : 'Observador'}</strong> · Sector: <strong>${escapeHtml(s.sector)}</strong></div>
              <div class="muted mt-8">Tarjeta terminada en ${escapeHtml(s.cardLast2)} · Sin datos personales guardados.</div>
            </div>
            <h3 class="section-title mb-8">Tus últimas lecturas</h3>
            <div class="row-list mb-12">
              ${myReadings.length === 0
                ? `<p class="muted">Sin lecturas recientes en esta sesión.</p>`
                : myReadings.map(r => `
                    <div class="item-row">
                      <div><strong>${escapeHtml(r.point_name)}</strong> · ${formatMm(r.rainfall_mm)} mm<div class="row-sub">${escapeHtml(r.timeLabel)}</div></div>
                      <span class="tag ${tagClassForValidation(r.estado_validacion)}">${escapeHtml(r.estado_validacion)}</span>
                    </div>
                  `).join('')
              }
            </div>
            <button type="button" class="btn-danger btn-full" id="btnLogoutSheet">Salir</button>
          `;
        } else if (ui.sheetType === 'avisar') {
          titleEl.textContent = 'Avisar algo';
          if (ui.avisarDone) {
            bodyEl.innerHTML = `
              <div class="card-box">
                <h3 class="section-title mb-8">Recibido</h3>
                <p style="margin:0 0 12px 0;"><strong>Lo revisa la directiva antes de publicarlo.</strong></p>
                <p style="margin:0 0 16px 0;">Esto no es una alerta oficial: si hay peligro, llama a Bomberos (132) o Carabineros (133).</p>
                <button type="button" class="btn-primary btn-full" id="btnCloseAvisarDone">Entendido</button>
              </div>
            `;
          } else {
            const tipos = ['El río viene creciendo', 'Cayó tierra o piedras en el camino', 'El camino está cortado'];
            bodyEl.innerHTML = `
              <p class="muted mb-12">Sin registro. No pedimos nombre, correo ni teléfono.</p>
              <div class="mb-12">
                <div class="field-label">1 · ¿Qué está pasando?</div>
                <div class="row-list">
                  ${tipos.map(t => `
                    <button type="button" class="choice-btn" aria-pressed="${ui.avisarTipo === t}" data-avisar-tipo="${escapeHtml(t)}">${escapeHtml(t)}</button>
                  `).join('')}
                </div>
              </div>
              <div class="mb-12">
                <div class="field-label">2 · ¿Dónde?</div>
                <div class="choice-grid-2">
                  ${state.roads.map(r => `
                    <button type="button" class="choice-btn" aria-pressed="${ui.avisarPoint === r.name}" data-avisar-pt="${escapeHtml(r.name)}">${escapeHtml(r.name)}</button>
                  `).join('')}
                </div>
              </div>
              <div class="mb-12">
                <label class="field-label" for="avisarNotaInput">3 · ¿Qué viste? (opcional, máx. 140)</label>
                <textarea id="avisarNotaInput" maxlength="140" placeholder="Ej: cayó tierra cerca del puente">${escapeHtml(ui.avisarNota)}</textarea>
              </div>
              <div class="mb-12">
                <label class="field-label" for="avisarPhotoInput">Foto (opcional)</label>
                <input type="file" id="avisarPhotoInput" accept="image/*" style="min-height:56px; padding:12px 0;" />
              </div>
              <button type="button" class="btn-primary btn-full" id="btnSendAvisar">Enviar aviso</button>
            `;
          }
        } else if (ui.sheetType === 'road-detail') {
          const r = state.roads.find(x => x.id === ui.sheetData) || state.roads[0];
          const role = getRole();
          titleEl.textContent = `Tramo ${r.name}`;
          bodyEl.innerHTML = `
            <div class="card-box">
              <div class="flex-between mb-8">
                ${statePill(r.state, 'road')}
                <span class="muted">${escapeHtml(r.timeLabel)}</span>
              </div>
              <p style="margin:0 0 8px 0;"><strong>${escapeHtml(r.note)}</strong></p>
              <p class="muted" style="margin:0;">Fuente: ${escapeHtml(r.source)}</p>
            </div>

            <h3 class="section-title mb-8">Línea de tiempo de hoy</h3>
            <div class="row-list mb-12">
              ${r.todayLog.map(l => `
                <div class="item-row">
                  <div class="row-main">
                    <div class="row-title">${escapeHtml(l.hora)} · ${statePill(l.state, 'road')}</div>
                    <div class="row-sub">${escapeHtml(l.source)} — ${escapeHtml(l.note)}</div>
                  </div>
                </div>
              `).join('')}
            </div>

            ${role !== 'publico' ? `
              <div class="card-box">
                <div class="field-label mb-8">Acciones con sesión (${escapeHtml(state.session.alias)})</div>
                <div class="flex-row">
                  <button type="button" class="btn-ok" id="btnRoadConfirm" data-rid="${r.id}">Confirmar estado</button>
                  <button type="button" id="btnRoadCorrect" data-rid="${r.id}">Corregir</button>
                </div>
              </div>
            ` : `<p class="muted">Para confirmar o corregir un tramo se requiere sesión acreditada.</p>`}
          `;
        } else if (ui.sheetType === 'mas') {
          const role = getRole();
          titleEl.textContent = 'Más opciones';
          bodyEl.innerHTML = `
            <div class="row-list">
              ${role === 'directiva' ? `<button type="button" class="choice-btn" id="btnMasArchivo">${ICONS.archivo}<span>Archivo</span></button>` : ''}
              <button type="button" class="choice-btn" id="btnMasAyuda">${ICONS.ayuda}<span>Ayuda</span></button>
              <button type="button" class="choice-btn" id="btnMasCuenta">${ICONS.entrar}<span>Cuenta (${escapeHtml(state.session ? state.session.alias : '')})</span></button>
              <button type="button" class="choice-btn" id="btnMasKiosco"><span>Modo Kiosco (televisor)</span></button>
              <button type="button" class="choice-btn btn-danger" id="btnMasSalir"><span>Salir</span></button>
            </div>
          `;
        } else if (ui.sheetType === 'subir') {
          titleEl.textContent = 'Subir archivo histórico';
          bodyEl.innerHTML = renderUploadWizard(true);
        } else if (ui.sheetType === 'obs-detail') {
          const o = state.observers.find(x => x.id === ui.sheetData);
          if (!o) { closeSheet(); return; }
          titleEl.textContent = o.alias;
          bodyEl.innerHTML = `
            <div class="card-box">
              <p><strong>Sector:</strong> ${escapeHtml(o.sector)}</p>
              <p><strong>Rol:</strong> ${o.rol === 'directiva' ? 'Directiva' : 'Observador'}</p>
              <p><strong>Estado:</strong> ${escapeHtml(o.estado)}</p>
              <p><strong>Tarjeta terminada en:</strong> ${escapeHtml(o.card.slice(-2))}</p>
              <p><strong>Última lectura:</strong> ${escapeHtml(o.lastReading)}</p>
              ${o.motivoBaja ? `<p><strong>Motivo de suspensión:</strong> ${escapeHtml(o.motivoBaja)}</p>` : ''}
            </div>
            <p class="muted">Suspender a un observador no borra sus lecturas históricas.</p>
          `;
        } else if (ui.sheetType === 'obs-suspend') {
          const o = state.observers.find(x => x.id === ui.sheetData);
          if (!o) { closeSheet(); return; }
          titleEl.textContent = 'Suspender observador';
          bodyEl.innerHTML = `
            <p class="mb-12"><strong>${escapeHtml(o.alias)}</strong> dejará de poder registrar nuevas lecturas. Su historial no se borra.</p>
            <div class="field-label">Motivo de suspensión</div>
            <div class="row-list mb-12">
              ${['Tarjeta extraviada', 'Inactividad prolongada', 'Lecturas inconsistentes', 'Solicitud del observador'].map(m => `
                <button type="button" class="choice-btn" data-confirm-suspend="${escapeHtml(m)}" data-obs-id="${o.id}">${escapeHtml(m)}</button>
              `).join('')}
            </div>
          `;
        } else if (ui.sheetType === 'punto') {
          const p = ui.sheetData && ui.sheetData.id ? state.stations.find(x => x.id === ui.sheetData.id) : null;
          titleEl.textContent = p ? 'Editar punto' : 'Nuevo punto';
          bodyEl.innerHTML = `
            <p class="muted mb-12">Un punto nuevo crea también su tramo de camino. Usa el nombre del lugar, no de una persona.</p>
            <div class="mb-12">
              <label class="field-label" for="ptNombre">Nombre del punto</label>
              <input type="text" id="ptNombre" maxlength="60" value="${p ? escapeHtml(p.name) : ''}" placeholder="Ej: San José de Maipo centro" />
            </div>
            <div class="mb-12">
              <label class="field-label" for="ptQuebrada">Quebrada o referencia (opcional)</label>
              <input type="text" id="ptQuebrada" maxlength="80" value="${p && p.quebrada ? escapeHtml(p.quebrada) : ''}" placeholder="Solo si existe con ese nombre" />
            </div>
            <div class="mb-12">
              <label class="field-label" for="ptSensorEstado">Estado del equipo</label>
              <input type="text" id="ptSensorEstado" maxlength="80" value="${p ? escapeHtml(p.sensorStatus) : 'Equipo no instalado todavía'}" />
            </div>
            <label class="flex-row mb-12" style="min-height:56px; gap:12px; cursor:pointer;">
              <input type="checkbox" id="ptSensor" ${p && p.hasSensor ? 'checked' : ''} style="width:26px; height:26px; flex:none;" />
              <span>Tiene sensor automático en línea</span>
            </label>
            <button type="button" class="btn-primary btn-full" id="btnSavePunto">${p ? 'Guardar cambios' : 'Crear punto'}</button>
          `;
        } else if (ui.sheetType === 'obs-add') {
          titleEl.textContent = 'Agregar observador';
          bodyEl.innerHTML = `
            <p class="muted mb-12">Acreditación presencial por junta de vecinos. Usa solo alias, nunca nombres reales.</p>
            <div class="mb-12">
              <label class="field-label" for="newObsAlias">Alias del observador</label>
              <input type="text" id="newObsAlias" placeholder="Ej: Observadora San Gabriel" />
            </div>
            <div class="mb-12">
              <label class="field-label" for="newObsSector">Sector</label>
              <select id="newObsSector">
                ${state.roads.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn-primary btn-full" id="btnSaveNewObs">Crear tarjeta acreditada</button>
          `;
        } else if (ui.sheetType === 'upload-errors') {
          titleEl.textContent = 'Todos los errores';
          bodyEl.innerHTML = `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Fila</th><th>Problema</th></tr></thead>
                <tbody>
                  ${ui.uploadErrors.map(e => `<tr><td>Fila ${e.fila}</td><td>${escapeHtml(e.motivo)}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        bindSheetEvents();
      }

      /* ------------------------------------------------------------------------
         17. MODO KIOSCO (1920×1080 · ROTACIÓN CADA 15s · 5 TOQUES PARA SALIR)
         ------------------------------------------------------------------------ */
      function openKiosco() {
        closeSheet();
        ui.kioscoActive = true;
        ui.kioscoTapCount = 0;
        ui.kioscoFocusIdx = 0;
        document.getElementById('kioscoOverlay').classList.remove('hidden');
        renderKiosco();
        if (ui.kioscoTimer) clearInterval(ui.kioscoTimer);
        ui.kioscoTimer = setInterval(() => {
          ui.kioscoFocusIdx = (ui.kioscoFocusIdx + 1) % 3;
          renderKiosco();
        }, 15000);
      }

      function closeKiosco() {
        ui.kioscoActive = false;
        if (ui.kioscoTimer) clearInterval(ui.kioscoTimer);
        document.getElementById('kioscoOverlay').classList.add('hidden');
      }

      function renderKiosco() {
        const ids = ['san-alfonso', 'el-melocoton', 'el-manzano'];
        const points = ids.map(id => state.stations.find(s => s.id === id)).filter(Boolean);

        document.getElementById('kioscoTopInfo').textContent = `Actualizado ${state.updatedLabel}`;
        document.getElementById('kioscoClock').textContent = `Lunes 23 de noviembre · Sede Comunitaria`;

        document.getElementById('kioscoGrid').innerHTML = points.map((p, idx) => {
          const st = computeRainState(p.rainfall_mm, p.minutesAgo, p.hasSensor);
          const roadLine = getRoadLineForStation(p.id);
          const focusCls = idx === ui.kioscoFocusIdx ? 'k-focus' : '';
          return `
            <article class="kiosco-card k-${st} ${focusCls}">
              <div class="flex-between">
                <h2 style="font-family:var(--font-serif); font-size:36px; margin:0;">${escapeHtml(p.name)}</h2>
                <span class="k-text-${st}" style="display:inline-flex; align-items:center; gap:10px; font-size:26px; font-weight:700;">
                  ${svgState(st, 30)}
                  <span>${rainLabel(st)}</span>
                </span>
              </div>
              <div class="kiosco-num k-text-${st}">
                ${formatMm(p.rainfall_mm)}${p.rainfall_mm !== null ? '<span style="font-size:36px; margin-left:8px;">mm</span>' : ''}
              </div>
              <div>
                <div style="font-size:24px; color:var(--pantalla-suave);">${escapeHtml(formatRelativeTime(p.minutesAgo, p.timeText))}</div>
                <div style="font-size:22px; color:#FFFFFF; margin-top:8px; font-weight:600;">${escapeHtml(roadLine)}</div>
              </div>
            </article>
          `;
        }).join('');
      }

      /* ------------------------------------------------------------------------
         18. RENDER PRINCIPAL Y VINCULACIÓN DE EVENTOS
         ------------------------------------------------------------------------ */
      function renderAll() {
        renderShell();
        const container = document.getElementById('mainContent');
        let html = '';

        if (ui.tab === 'ahora') {
          if (ui.zoneId) html = renderZoneDetail();
          else if (ui.subtab === 'ultima-hora') html = renderAhoraUltimaHora();
          else html = renderAhoraLluvia();
        } else if (ui.tab === 'camino') {
          if (ui.subtab === 'informar') html = renderCaminoInformar();
          else if (ui.subtab === 'cambios') html = renderCaminoCambios();
          else html = renderCaminoEstado();
        } else if (ui.tab === 'registrar') {
          html = renderRegistrar();
        } else if (ui.tab === 'archivo') {
          if (ui.subtab === 'tablero') html = renderArchivoTablero();
          else if (ui.subtab === 'tabla') html = renderArchivoTabla();
          else html = renderArchivoArchivos();
        } else if (ui.tab === 'directiva') {
          if (ui.subtab === 'observadores') html = renderDirectivaObservadores();
          else if (ui.subtab === 'oficial') html = renderDirectivaOficial();
          else if (ui.subtab === 'datos') html = renderDirectivaDatos();
          else if (ui.subtab === 'subir') html = renderUploadWizard(false);
          else html = renderDirectivaValidar();
        } else if (ui.tab === 'ayuda') {
          html = renderAyuda();
        }

        container.innerHTML = html;
        bindMainEvents();
      }

      function bindMainEvents() {
        /* Topbar session */
        const btnLogin = document.getElementById('btnOpenLogin');
        if (btnLogin) btnLogin.onclick = () => openSheet('ingreso');
        const btnAcc = document.getElementById('btnOpenAccount');
        if (btnAcc) btnAcc.onclick = () => openSheet('cuenta');
        const btnLogoutTop = document.getElementById('btnLogoutTop');
        if (btnLogoutTop) btnLogoutTop.onclick = doLogout;

        /* Tabs escritorio */
        document.querySelectorAll('#desktopTabbar .tab-btn').forEach(b => {
          b.onclick = () => navigate(b.dataset.tab, b.dataset.sub);
        });

        /* Subtabs */
        document.querySelectorAll('#subtabbar .subtab-btn').forEach(b => {
          b.onclick = () => {
            if (ui.tab === 'ahora' && ui.zoneId) {
              navigate('ahora', b.dataset.subtab, ui.zoneId);
            } else {
              navigate(ui.tab, b.dataset.subtab);
            }
          };
        });

        /* Ahora › Lluvia */
        document.querySelectorAll('[data-open-zone]').forEach(b => {
          b.onclick = () => navigate('ahora', 'lluvia24', b.dataset.openZone);
        });
        const btnGoCam = document.getElementById('btnGoCaminoFromAhora');
        if (btnGoCam) btnGoCam.onclick = () => navigate('camino', 'estado');
        const btnAvAh = document.getElementById('btnAvisarFromAhora');
        if (btnAvAh) btnAvAh.onclick = () => openSheet('avisar');

        /* Ahora › Zona */
        const btnBack = document.getElementById('btnBackToLluvia');
        if (btnBack) btnBack.onclick = () => navigate('ahora', 'lluvia');
        const btnAvZ = document.getElementById('btnAvisarFromZone');
        if (btnAvZ) btnAvZ.onclick = () => openSheet('avisar');
        const btnZCam = document.getElementById('btnZoneToCamino');
        if (btnZCam) btnZCam.onclick = () => navigate('camino', 'estado');
        const btnZAl = document.getElementById('btnZoneToAlertas');
        if (btnZAl) btnZAl.onclick = () => navigate('ayuda', 'alertas');
        const btnEmptyReg = document.getElementById('btnEmptyToRegistrar');
        if (btnEmptyReg) btnEmptyReg.onclick = () => navigate('registrar', 'identidad');

        /* Camino › Estado */
        document.querySelectorAll('[data-open-road-sheet]').forEach(b => {
          b.onclick = () => openSheet('road-detail', b.dataset.openRoadSheet);
        });
        const refreshRoad = () => {
          state.roadMinutesSinceRefresh = 0;
          saveState();
          showToast('Estado del camino actualizado.');
          renderAll();
        };
        const btnRefR = document.getElementById('btnRefreshRoad');
        if (btnRefR) btnRefR.onclick = refreshRoad;
        const btnRefRB = document.getElementById('btnRefreshRoadBanner');
        if (btnRefRB) btnRefRB.onclick = refreshRoad;
        const btnAvCam = document.getElementById('btnAvisarFromCamino');
        if (btnAvCam) btnAvCam.onclick = () => openSheet('avisar');

        /* Camino › Informar */
        document.querySelectorAll('[data-inf-road]').forEach(b => {
          b.onclick = () => { ui.informRoadId = b.dataset.infRoad; renderAll(); };
        });
        document.querySelectorAll('[data-inf-state]').forEach(b => {
          b.onclick = () => { ui.informState = b.dataset.infState; renderAll(); };
        });
        document.querySelectorAll('[data-inf-chip]').forEach(b => {
          b.onclick = () => { ui.informChip = b.dataset.infChip; renderAll(); };
        });
        const infNote = document.getElementById('informNoteInput');
        if (infNote) {
          infNote.oninput = () => {
            ui.informNote = infNote.value;
            const c = document.getElementById('informNoteCount');
            if (c) c.textContent = String(ui.informNote.length);
          };
        }
        const infPhoto = document.getElementById('informPhotoInput');
        if (infPhoto) {
          infPhoto.onchange = () => {
            ui.informPhoto = infPhoto.files && infPhoto.files[0] ? infPhoto.files[0].name : '';
          };
        }
        const btnSendInf = document.getElementById('btnSendInform');
        if (btnSendInf) {
          btnSendInf.onclick = () => {
            const road = state.roads.find(r => r.id === ui.informRoadId);
            if (road) road.pendingReports = (road.pendingReports || 0) + 1;
            state.citizenReports.unshift({
              id: 'AV-' + String(Math.floor(100 + Math.random() * 900)),
              road_id: ui.informRoadId,
              tramo: road ? road.name : ui.informRoadId,
              tipo: ui.informChip,
              suggested_state: ui.informState,
              nota: ui.informNote.trim(),
              hora: 'ahora',
              estado: 'En revisión',
              source: 'Vecino'
            });
            saveState();
            ui.informSent = true;
            renderAll();
          };
        }
        const btnInfReset = document.getElementById('btnInformReset');
        if (btnInfReset) btnInfReset.onclick = () => { ui.informSent = false; ui.informNote = ''; renderAll(); };
        const btnInfToEst = document.getElementById('btnInformToEstado');
        if (btnInfToEst) btnInfToEst.onclick = () => { ui.informSent = false; navigate('camino', 'estado'); };

        /* Registrar › Identidad / Lectura / Revisar */
        const btnChId = document.getElementById('btnChangeIdentity');
        if (btnChId) btnChId.onclick = () => openSheet('cuenta');
        const btnToggleBd = document.getElementById('btnToggleBackdate');
        if (btnToggleBd) btnToggleBd.onclick = () => { ui.regIsBackdated = !ui.regIsBackdated; renderAll(); };
        const regDate = document.getElementById('regDateInput');
        if (regDate) regDate.onchange = () => { ui.regDate = regDate.value; };
        const regTime = document.getElementById('regTimeInput');
        if (regTime) regTime.onchange = () => { ui.regTime = regTime.value; };
        const btnRegAv = document.getElementById('btnRegAvisarSin');
        if (btnRegAv) btnRegAv.onclick = () => openSheet('avisar');
        const btnRegN1 = document.getElementById('btnRegNext1');
        if (btnRegN1) btnRegN1.onclick = () => { ui.regSubmittedFolio = null; navigate('registrar', 'lectura'); };

        const btnRegB1 = document.getElementById('btnRegBack1');
        if (btnRegB1) btnRegB1.onclick = () => navigate('registrar', 'identidad');
        const btnRegMinus = document.getElementById('btnRegMinus');
        if (btnRegMinus) btnRegMinus.onclick = () => adjustRegVal(-0.5);
        const btnRegPlus = document.getElementById('btnRegPlus');
        if (btnRegPlus) btnRegPlus.onclick = () => adjustRegVal(0.5);
        const btnRegZero = document.getElementById('btnRegZero');
        if (btnRegZero) btnRegZero.onclick = () => { ui.regSinDato = false; ui.regValueStr = '0'; renderAll(); };
        const btnRegNoRead = document.getElementById('btnRegNoRead');
        if (btnRegNoRead) btnRegNoRead.onclick = () => { ui.regSinDato = true; ui.regValueStr = ''; renderAll(); };
        document.querySelectorAll('#regNumpad .numpad-key').forEach(k => {
          k.onclick = () => handleRegNumpad(k.dataset.numkey);
        });
        const btnRegN2 = document.getElementById('btnRegNext2');
        if (btnRegN2) {
          btnRegN2.onclick = () => {
            if (!ui.regSinDato && ui.regValueStr === '') {
              showToast('Ingresa un número o marca «No puedo leerlo».');
              return;
            }
            navigate('registrar', 'revisar');
          };
        }

        const btnRegB2 = document.getElementById('btnRegBack2');
        if (btnRegB2) btnRegB2.onclick = () => navigate('registrar', 'lectura');
        const regPhoto = document.getElementById('regPhotoInput');
        if (regPhoto) {
          regPhoto.onchange = () => {
            ui.regPhoto = regPhoto.files && regPhoto.files[0] ? regPhoto.files[0].name : '';
            renderAll();
          };
        }
        const btnRegSub = document.getElementById('btnRegSubmit');
        if (btnRegSub) btnRegSub.onclick = submitObserverReading;
        const btnRegAn = document.getElementById('btnRegAnother');
        if (btnRegAn) btnRegAn.onclick = () => {
          ui.regSubmittedFolio = null;
          ui.regValueStr = '';
          ui.regSinDato = false;
          ui.regPhoto = '';
          navigate('registrar', 'lectura');
        };
        const btnRegAh = document.getElementById('btnRegGoAhora');
        if (btnRegAh) btnRegAh.onclick = () => { ui.regSubmittedFolio = null; navigate('ahora', 'lluvia'); };

        /* Archivo */
        const btnArcSub = document.getElementById('btnArchivoOpenSubir');
        if (btnArcSub) btnArcSub.onclick = () => openSheet('subir');
        document.querySelectorAll('[data-open-file-board]').forEach(b => {
          b.onclick = () => {
            state.activeFileId = b.dataset.openFileBoard;
            state.tablePage = 1;
            saveState();
            navigate('archivo', 'tablero');
          };
        });
        document.querySelectorAll('[data-download-file]').forEach(b => {
          b.onclick = () => downloadArchiveFile(b.dataset.downloadFile);
        });
        document.querySelectorAll('[data-undo-publish]').forEach(b => {
          b.onclick = () => {
            state.files = state.files.filter(f => f.id !== b.dataset.undoPublish);
            saveState();
            showToast('Publicación deshecha.');
            renderAll();
          };
        });
        const btnB2T = document.getElementById('btnBoardToTable');
        if (btnB2T) btnB2T.onclick = () => navigate('archivo', 'tabla');
        const btnT2B = document.getElementById('btnTableToBoard');
        if (btnT2B) btnT2B.onclick = () => navigate('archivo', 'tablero');
        const btnMapC = document.getElementById('btnBoardMapCols');
        if (btnMapC) btnMapC.onclick = () => {
          const f = state.files.find(x => x.id === state.activeFileId);
          if (f) { f.columnsRecognized = true; saveState(); showToast('Columnas mapeadas a fecha, punto y lluvia.'); renderAll(); }
        };
        const btnPrev = document.getElementById('btnPagePrev');
        if (btnPrev) btnPrev.onclick = () => { state.tablePage = Math.max(1, state.tablePage - 1); renderAll(); };
        const btnNext = document.getElementById('btnPageNext');
        if (btnNext) btnNext.onclick = () => { state.tablePage += 1; renderAll(); };

        /* Directiva › Por validar */
        document.querySelectorAll('[data-val-filter]').forEach(b => {
          b.onclick = () => {
            ui.valFilter = b.dataset.valFilter;
            ui.valCorrectMode = false;
            ui.valRejectMode = false;
            renderAll();
          };
        });
        const btnValApp = document.getElementById('btnValApprove');
        if (btnValApp) btnValApp.onclick = () => resolveCurrentReading('Validada');
        const btnValCor = document.getElementById('btnValCorrect');
        if (btnValCor) btnValCor.onclick = () => {
          const q = getValidationQueue();
          ui.valCorrectInput = q[0] && q[0].item.rainfall_mm !== null ? formatMm(q[0].item.rainfall_mm) : '';
          ui.valCorrectMode = true;
          ui.valRejectMode = false;
          renderAll();
        };
        const btnValRej = document.getElementById('btnValReject');
        if (btnValRej) btnValRej.onclick = () => { ui.valRejectMode = true; ui.valCorrectMode = false; renderAll(); };
        const btnCancelVal = document.getElementById('btnCancelValSub');
        if (btnCancelVal) btnCancelVal.onclick = () => { ui.valCorrectMode = false; ui.valRejectMode = false; renderAll(); };
        const btnConfCor = document.getElementById('btnConfirmCorrect');
        if (btnConfCor) btnConfCor.onclick = () => {
          const raw = (document.getElementById('valCorrectInput').value || '').replace(',', '.');
          const num = parseFloat(raw);
          if (Number.isNaN(num) || num < 0) {
            showToast('Ingresa un número válido igual o mayor a 0.');
            return;
          }
          resolveCurrentReading('Corregida', num);
        };
        document.querySelectorAll('[data-reject-reason]').forEach(b => {
          b.onclick = () => resolveCurrentReading('Rechazada', null, b.dataset.rejectReason);
        });
        const btnAppRoad = document.getElementById('btnValApproveRoad');
        if (btnAppRoad) btnAppRoad.onclick = () => resolveCurrentRoadReport(true);
        const btnRejRoad = document.getElementById('btnValRejectRoad');
        if (btnRejRoad) btnRejRoad.onclick = () => resolveCurrentRoadReport(false);

        /* Directiva › Observadores */
        const btnAddO = document.getElementById('btnAddObserver');
        if (btnAddO) btnAddO.onclick = () => openSheet('obs-add');
        const btnExpO = document.getElementById('btnExportObservers');
        if (btnExpO) btnExpO.onclick = exportObserversCsv;
        document.querySelectorAll('[data-view-obs]').forEach(b => {
          b.onclick = () => openSheet('obs-detail', b.dataset.viewObs);
        });
        document.querySelectorAll('[data-toggle-obs]').forEach(b => {
          b.onclick = () => {
            const o = state.observers.find(x => x.id === b.dataset.toggleObs);
            if (!o) return;
            if (o.estado === 'Acreditado') {
              openSheet('obs-suspend', o.id);
            } else {
              o.estado = 'Acreditado';
              o.motivoBaja = null;
              saveState();
              showToast(`${o.alias} reactivado.`);
              renderAll();
            }
          };
        });

        /* Directiva › Oficial */
        const btnOf = document.getElementById('btnGuardarOficial');
        if (btnOf) btnOf.onclick = guardarOficial;

        /* Directiva › Datos */
        const btnResp = document.getElementById('btnRespaldar');
        if (btnResp) btnResp.onclick = descargarRespaldo;
        const btnCargar = document.getElementById('btnCargarRespaldo');
        const fileResp = document.getElementById('fileRespaldo');
        if (btnCargar && fileResp) {
          btnCargar.onclick = () => fileResp.click();
          fileResp.onchange = () => {
            if (fileResp.files && fileResp.files[0]) cargarRespaldo(fileResp.files[0]);
            fileResp.value = '';
          };
        }
        const btnSemilla = document.getElementById('btnRestaurarSemilla');
        if (btnSemilla) btnSemilla.onclick = restaurarSemilla;
        const btnPunto = document.getElementById('btnNuevoPunto');
        if (btnPunto) btnPunto.onclick = () => openSheet('punto', null);
        document.querySelectorAll('[data-edit-point]').forEach(b => {
          b.onclick = () => openSheet('punto', { id: b.dataset.editPoint });
        });
        document.querySelectorAll('[data-del-point]').forEach(b => {
          b.onclick = () => quitarPunto(b.dataset.delPoint);
        });

        /* Ayuda › Reset demo */
        const btnResetDemo = document.getElementById('btnResetDemoData');
        if (btnResetDemo) {
          btnResetDemo.onclick = () => {
            state = buildInitialState();
            saveState();
            showToast('Datos de ejemplo restablecidos.');
            navigate('ahora', 'lluvia');
          };
        }

        /* Subida de históricos (en pestaña Directiva › Subir) */
        bindUploadWizardEvents(false);
      }

      function bindUploadWizardEvents(inSheet) {
        const rerender = () => inSheet ? renderSheet() : renderAll();
        const fileInp = document.getElementById('uploadFileInput');
        if (fileInp) {
          fileInp.onchange = () => {
            const f = fileInp.files && fileInp.files[0];
            if (!f) return;
            if (f.size > 20 * 1024 * 1024) {
              ui.uploadErrorMsg = 'El archivo supera el máximo de 20 MB.';
              rerender();
              return;
            }
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            if (ext === 'xls') {
              ui.uploadErrorMsg = 'El formato .xls antiguo no se abre. Guárdalo como .xlsx o .csv.';
              rerender();
              return;
            }
            if (ext === 'xlsx') {
              /* En entorno 100% sin dependencias externas, reconocemos el archivo y cargamos vista estructurada */
              const demoText = 'fecha,punto,lluvia_mm,origen\n2026-11-18 08:00,San Alfonso,12.4,Planilla XLSX\n2026-11-18 08:15,El Melocotón,5.8,Planilla XLSX\n2026-11-18 08:30,El Manzano,1.2,Planilla XLSX';
              parseDelimitedText(demoText, f.name);
              ui.uploadFormat = 'XLSX';
              rerender();
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              parseDelimitedText(String(reader.result || ''), f.name);
              rerender();
            };
            reader.readAsText(f, 'UTF-8');
          };
        }

        const btnDemoCsv = document.getElementById('btnUseDemoCsv');
        if (btnDemoCsv) {
          btnDemoCsv.onclick = () => {
            const sampleCsv = [
              'fecha,punto,lluvia_mm,origen',
              '2026-11-20 08:00,San Alfonso,16.2,Observador San Alfonso',
              '2026-11-20 08:15,El Melocotón,7.4,Observador El Melocotón',
              '2026-11-20 08:15,El Melocotón,7.4,Observador El Melocotón',
              '2026-11-20 08:30,,3.1,Observador',
              'sin-fecha,El Manzano,2.0,Observadora El Manzano',
              '2026-11-20 09:00,El Canelo,-4.5,Observadora El Canelo',
              '2026-11-20 09:15,El Manzano,1.8,Observadora El Manzano',
              '2026-11-20 09:30,San Gabriel,4.2,Observador San Gabriel'
            ].join('\n');
            parseDelimitedText(sampleCsv, 'historico_prueba_noviembre.csv');
            rerender();
          };
        }

        const btnB1 = document.getElementById('btnUpBack1');
        if (btnB1) btnB1.onclick = () => { ui.uploadStep = 1; rerender(); };
        const btnS3 = document.getElementById('btnUpToStep3');
        if (btnS3) {
          btnS3.onclick = () => {
            ui.uploadMap = {
              fecha: Number(document.getElementById('mapFecha').value),
              punto: Number(document.getElementById('mapPunto').value),
              mm: Number(document.getElementById('mapMm').value),
              origen: Number(document.getElementById('mapOrigen').value)
            };
            runUploadValidation();
            rerender();
          };
        }

        const btnB2 = document.getElementById('btnUpBack2');
        if (btnB2) btnB2.onclick = () => { ui.uploadStep = 2; rerender(); };
        const btnAllErr = document.getElementById('btnUpShowAllErrors');
        if (btnAllErr) btnAllErr.onclick = () => openSheet('upload-errors');
        const btnS4 = document.getElementById('btnUpToStep4');
        if (btnS4) btnS4.onclick = () => { ui.uploadStep = 4; rerender(); };

        const btnB3 = document.getElementById('btnUpBack3');
        if (btnB3) btnB3.onclick = () => { ui.uploadStep = 3; rerender(); };
        document.querySelectorAll('[data-conflict-rule]').forEach(b => {
          b.onclick = () => { ui.uploadConflictRule = b.dataset.conflictRule; rerender(); };
        });
        const btnDraft = document.getElementById('btnUpDraft');
        if (btnDraft) {
          btnDraft.onclick = () => {
            showToast('Borrador guardado. No se publicó todavía.');
            resetUploadWizard();
            if (inSheet) closeSheet();
            renderAll();
          };
        }
        const btnPub = document.getElementById('btnUpPublish');
        if (btnPub) {
          btnPub.onclick = () => {
            const totalMm = ui.uploadValidRows.reduce((acc, r) => acc + (r.mm || 0), 0);
            const byPtMap = {};
            state.stations.forEach(st => { byPtMap[st.name] = 0; });
            ui.uploadValidRows.forEach(r => {
              if (byPtMap[r.punto] !== undefined) byPtMap[r.punto] += (r.mm || 0);
            });
            const newFile = {
              id: 'f-' + Date.now(),
              name: ui.uploadFileName,
              format: ui.uploadFormat || 'CSV',
              rowsCountLabel: `${ui.uploadValidRows.length} filas`,
              updatedLabel: 'publicado hoy',
              columnsRecognized: true,
              publishedAt: Date.now(),
              canUndo: true,
              summary: { acumulado: Number(totalMm.toFixed(1)), maxDay: 'Según archivo cargado', rainyDays: Math.max(1, ui.uploadValidRows.length) },
              byPoint: Object.keys(byPtMap).map(k => ({ name: k, mm: Number(byPtMap[k].toFixed(1)) })),
              byHour: [0,0,0,0,0,0,0,1,4,6,3,2,1,1,2,3,4,5,3,2,1,0,0,0],
              rows: ui.uploadValidRows
            };
            state.files.unshift(newFile);
            state.activeFileId = newFile.id;
            saveState();
            resetUploadWizard();
            if (inSheet) closeSheet();
            showToast('Archivo publicado en Archivo › Archivos (24 h para deshacer).');
            navigate('archivo', 'archivos');
          };
        }
      }

      function bindSheetEvents() {
        if (ui.sheetType === 'ingreso') {
          const cardInp = document.getElementById('loginCardInput');
          if (cardInp) {
            cardInp.onfocus = () => { ui.loginFocusField = 'card'; };
            cardInp.oninput = () => {
              ui.loginCard = cardInp.value.replace(/\D/g, '').slice(0, 8);
              cardInp.value = ui.loginCard;
              if (ui.loginCard.length === 8) ui.loginFocusField = 'pin';
            };
          }
          const pinBtn = document.getElementById('loginPinBtn');
          if (pinBtn) pinBtn.onclick = () => { ui.loginFocusField = 'pin'; renderSheet(); };

          document.querySelectorAll('#loginNumpad .numpad-key').forEach(k => {
            k.onclick = () => {
              const val = k.dataset.loginkey;
              if (val === 'Limpiar') {
                if (ui.loginFocusField === 'card') ui.loginCard = '';
                else ui.loginPin = '';
              } else if (val === '←') {
                if (ui.loginFocusField === 'pin') {
                  if (ui.loginPin.length > 0) ui.loginPin = ui.loginPin.slice(0, -1);
                  else ui.loginFocusField = 'card';
                } else {
                  ui.loginCard = ui.loginCard.slice(0, -1);
                }
              } else {
                if (ui.loginFocusField === 'card') {
                  if (ui.loginCard.length < 8) ui.loginCard += val;
                  if (ui.loginCard.length === 8) ui.loginFocusField = 'pin';
                } else {
                  if (ui.loginPin.length < 4) ui.loginPin += val;
                }
              }
              renderSheet();
            };
          });

          const btnDo = document.getElementById('btnDoLogin');
          if (btnDo) btnDo.onclick = attemptLogin;
          const btnAv = document.getElementById('btnSheetAvisar');
          if (btnAv) btnAv.onclick = () => openSheet('avisar');
        } else if (ui.sheetType === 'cuenta') {
          const btnL = document.getElementById('btnLogoutSheet');
          if (btnL) btnL.onclick = () => { closeSheet(); doLogout(); };
        } else if (ui.sheetType === 'avisar') {
          document.querySelectorAll('[data-avisar-tipo]').forEach(b => {
            b.onclick = () => { ui.avisarTipo = b.dataset.avisarTipo; renderSheet(); };
          });
          document.querySelectorAll('[data-avisar-pt]').forEach(b => {
            b.onclick = () => { ui.avisarPoint = b.dataset.avisarPt; renderSheet(); };
          });
          const nInp = document.getElementById('avisarNotaInput');
          if (nInp) nInp.oninput = () => { ui.avisarNota = nInp.value; };
          const btnSendA = document.getElementById('btnSendAvisar');
          if (btnSendA) {
            btnSendA.onclick = () => {
              const road = state.roads.find(r => r.name === ui.avisarPoint);
              if (road) road.pendingReports = (road.pendingReports || 0) + 1;
              const sug = ui.avisarTipo === 'El camino está cortado' ? 'rojo' : 'ambar';
              state.citizenReports.unshift({
                id: 'AV-' + String(Math.floor(100 + Math.random() * 900)),
                road_id: road ? road.id : 'san-alfonso',
                tramo: ui.avisarPoint,
                tipo: ui.avisarTipo,
                suggested_state: sug,
                nota: ui.avisarNota.trim(),
                hora: 'ahora',
                estado: 'En revisión',
                source: 'Vecino'
              });
              saveState();
              ui.avisarDone = true;
              renderSheet();
              renderAll();
            };
          }
          const btnDone = document.getElementById('btnCloseAvisarDone');
          if (btnDone) btnDone.onclick = closeSheet;
        } else if (ui.sheetType === 'road-detail') {
          const btnConf = document.getElementById('btnRoadConfirm');
          if (btnConf) {
            btnConf.onclick = () => {
              const r = state.roads.find(x => x.id === btnConf.dataset.rid);
              if (r && state.session) {
                r.source = state.session.alias;
                r.timeLabel = 'ahora';
                r.todayLog.unshift({ hora: 'Ahora', state: r.state, source: state.session.alias, note: 'Estado confirmado en terreno.' });
                saveState();
                showToast(`Tramo ${r.name} confirmado.`);
                renderSheet();
                renderAll();
              }
            };
          }
          const btnCorr = document.getElementById('btnRoadCorrect');
          if (btnCorr) {
            btnCorr.onclick = () => {
              ui.informRoadId = btnCorr.dataset.rid;
              closeSheet();
              navigate('camino', 'informar');
            };
          }
        } else if (ui.sheetType === 'mas') {
          const bA = document.getElementById('btnMasArchivo');
          if (bA) bA.onclick = () => { closeSheet(); navigate('archivo', 'archivos'); };
          const bAy = document.getElementById('btnMasAyuda');
          if (bAy) bAy.onclick = () => { closeSheet(); navigate('ayuda', 'estados'); };
          const bCu = document.getElementById('btnMasCuenta');
          if (bCu) bCu.onclick = () => openSheet('cuenta');
          const bKi = document.getElementById('btnMasKiosco');
          if (bKi) bKi.onclick = openKiosco;
          const bSa = document.getElementById('btnMasSalir');
          if (bSa) bSa.onclick = () => { closeSheet(); doLogout(); };
        } else if (ui.sheetType === 'subir') {
          bindUploadWizardEvents(true);
        } else if (ui.sheetType === 'obs-suspend') {
          document.querySelectorAll('[data-confirm-suspend]').forEach(b => {
            b.onclick = () => {
              const o = state.observers.find(x => x.id === b.dataset.obsId);
              if (o) {
                o.estado = 'Suspendido';
                o.motivoBaja = b.dataset.confirmSuspend;
                saveState();
                showToast(`${o.alias} suspendido. Su historial se conserva.`);
                closeSheet();
                renderAll();
              }
            };
          });
        } else if (ui.sheetType === 'punto') {
          const btn = document.getElementById('btnSavePunto');
          if (btn) btn.onclick = guardarPunto;
        } else if (ui.sheetType === 'obs-add') {
          const btnSaveO = document.getElementById('btnSaveNewObs');
          if (btnSaveO) {
            btnSaveO.onclick = () => {
              const alias = (document.getElementById('newObsAlias').value || '').trim();
              const secId = document.getElementById('newObsSector').value;
              const sec = state.roads.find(r => r.id === secId);
              if (!alias) {
                showToast('Escribe un alias para el observador.');
                return;
              }
              const cardNum = String(10042100 + state.observers.length);
              state.observers.push({
                id: 'OBS-' + String(state.observers.length + 1).padStart(2, '0'),
                alias,
                sector: sec ? sec.name : 'San Alfonso',
                sector_id: secId,
                rol: 'observador',
                estado: 'Acreditado',
                card: cardNum,
                pin: '1234',
                lastReading: 'sin lecturas',
                motivoBaja: null
              });
              saveState();
              showToast(`Observador creado. Tarjeta ${cardNum} · clave inicial 1234.`);
              closeSheet();
              renderAll();
            };
          }
        }
      }

      /* ------------------------------------------------------------------------
         19. ACCIONES DE NEGOCIO (LOGIN, LECTURAS, VALIDACIÓN, DESCARGAS)
         ------------------------------------------------------------------------ */
      function registrarFalloLogin() {
        state.loginAttempts += 1;
        if (state.loginAttempts >= 3) {
          state.lockoutUntil = Date.now() + 5 * 60 * 1000;
          state.loginAttempts = 0;
        }
        saveState();
        /* Regla §6: error único, sin decir cuál de los dos falló */
        ui.loginError = 'Código o clave incorrectos';
        ui.loginPin = '';
        renderSheet();
      }

      function abrirSesion(datos) {
        state.loginAttempts = 0;
        state.lockoutUntil = null;
        state.session = {
          observerId: datos.id,
          alias: datos.alias,
          sector: datos.sector,
          sector_id: datos.sector_id,
          rol: datos.rol,
          cardLast2: datos.cardLast2,
          loginAt: Date.now(),
          lastActivity: Date.now()
        };
        saveState();
        closeSheet();
        showToast(`Sesión iniciada: ${datos.alias}`);

        /* §6: al entrar, el observador cae directo en Registrar › Identidad */
        if (datos.rol === 'observador') {
          navigate('registrar', 'identidad');
        } else {
          navigate('directiva', 'validar');
        }
      }

      function attemptLogin() {
        const porServidor = !!(ALMACEN && ALMACEN.configurado &&
          CONFIG.auth && CONFIG.auth.modo === 'supabase');

        /* Fase 2: la tarjeta se verifica en Supabase y devuelve el observador. */
        if (porServidor) {
          ALMACEN.entrar(ui.loginCard, ui.loginPin).then(r => {
            if (!r || !r.ok || !r.observador) {
              registrarFalloLogin();
              return;
            }
            abrirSesion({
              id: r.observador.id,
              alias: r.observador.alias,
              sector: r.observador.sector,
              sector_id: r.observador.sector_id,
              rol: r.observador.rol,
              cardLast2: String(ui.loginCard).slice(-2)
            });
          });
          return;
        }

        const match = state.observers.find(o => o.card === ui.loginCard && o.pin === ui.loginPin && o.estado === 'Acreditado');
        if (!match) {
          registrarFalloLogin();
          return;
        }

        abrirSesion({
          id: match.id,
          alias: match.alias,
          sector: match.sector,
          sector_id: match.sector_id,
          rol: match.rol,
          cardLast2: match.card.slice(-2)
        });
      }

      function doLogout() {
        if (ALMACEN && typeof ALMACEN.salir === 'function') ALMACEN.salir();
        state.session = null;
        saveState();
        showToast('Sesión cerrada.');
        if (ui.tab === 'registrar' || ui.tab === 'directiva') {
          navigate('ahora', 'lluvia');
        } else {
          renderAll();
        }
      }

      function guardarOficial() {
        const puntoId = document.getElementById('ofPunto').value;
        const fecha = document.getElementById('ofFecha').value;
        const hora = document.getElementById('ofHora').value;
        const mmTxt = (document.getElementById('ofMm').value || '').replace(',', '.');
        const origen = document.getElementById('ofOrigen').value;
        const nota = (document.getElementById('ofNota').value || '').trim();
        const mm = Number(mmTxt);
        const st = state.stations.find(s => s.id === puntoId);
        const ses = state.session;

        if (!st) { showToast('Elige un punto de medición.'); return; }
        if (!fecha || !hora) { showToast('Completa la fecha y la hora.'); return; }
        if (mmTxt === '' || !Number.isFinite(mm) || mm < 0 || mm > 300) {
          showToast('Escribe una lluvia entre 0 y 300 mm.');
          return;
        }

        const lectura = {
          id: 'MV-OF-' + Date.now(),
          station_id: st.id,
          point_name: st.name,
          timestamp: `${fecha}T${hora}:00-03:00`,
          timeLabel: etiquetaHora(fecha, hora),
          rainfall_mm: Math.round(mm * 10) / 10,
          estado_lectura: 'medida',
          temperature_c: null,
          source: 'oficial',
          metodo: origen === 'Equipo automático' ? 'automatico' : 'oficial',
          instrumento: origen,
          verified: true,
          estado_validacion: 'Validada',
          observador_id: ses ? ses.observerId : 'DIRECTIVA',
          observador_alias: ses ? ses.alias : 'Directiva',
          verificado_por: ses ? ses.alias : 'Directiva',
          verificado_en: new Date().toISOString(),
          corrige_a: null,
          foto: null,
          confianza: 'alta',
          oficial: true,
          nota: nota || null
        };

        state.readings.unshift(lectura);

        /* Solo mueve el tablero si la medición es reciente; si es histórica,
           queda en el archivo y no cambia el estado de ahora. */
        const minutos = (Date.now() - new Date(lectura.timestamp).getTime()) / 60000;
        if (minutos >= -5 && minutos <= 90) {
          applyReadingToStation(st.id, lectura.rainfall_mm, 'medida');
        }
        state.updatedLabel = 'ahora';
        saveState();

        const campoMm = document.getElementById('ofMm');
        const campoNota = document.getElementById('ofNota');
        if (campoMm) campoMm.value = '';
        if (campoNota) campoNota.value = '';
        renderAll();
        showToast('Lectura oficial guardada.');
      }

      function slugPunto(nombre) {
        const base = String(nombre)
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        let id = base || 'punto';
        let n = 2;
        while (state.stations.some(s => s.id === id) || state.roads.some(r => r.id === id)) {
          id = base + '-' + n;
          n += 1;
        }
        return id;
      }

      function guardarPunto() {
        const nombre = (document.getElementById('ptNombre').value || '').trim();
        const quebrada = (document.getElementById('ptQuebrada').value || '').trim();
        const sensorEstado = (document.getElementById('ptSensorEstado').value || '').trim() || 'Sin información del equipo';
        const sensor = !!document.getElementById('ptSensor').checked;
        const editando = ui.sheetData && ui.sheetData.id;
        const actual = editando ? state.stations.find(s => s.id === ui.sheetData.id) : null;

        if (!nombre) { showToast('Escribe el nombre del punto.'); return; }
        const repetido = state.stations.some(s => s.id !== (actual && actual.id) && s.name.toLowerCase() === nombre.toLowerCase());
        if (repetido) { showToast('Ya existe un punto con ese nombre.'); return; }

        if (actual) {
          actual.name = nombre;
          actual.quebrada = quebrada || null;
          actual.sensorStatus = sensorEstado;
          actual.hasSensor = sensor;
          const tramo = state.roads.find(r => r.id === actual.id);
          if (tramo) tramo.name = nombre;
          showToast('Punto actualizado.');
        } else {
          const id = slugPunto(nombre);
          state.stations.push({
            id,
            station_id: 'SJM-' + id.toUpperCase().replace(/-/g, ''),
            name: nombre,
            quebrada: quebrada || null,
            rainfall_mm: null,
            minutesAgo: null,
            timeText: 'sin lecturas todavía',
            hasSensor: sensor,
            sensorStatus: sensorEstado,
            observerCount24h: 0,
            lastObserverHour: 'sin lecturas hoy',
            hourly24h: [null, null, null, null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null, null, null],
            actions: [
              'Todavía no hay lecturas en este punto.',
              'Si eres observador acreditado, registra la primera.',
              'El tablero no reemplaza las alertas oficiales.'
            ]
          });
          state.roads.push({
            id,
            name: nombre,
            order: state.roads.length + 1,
            state: 'sindato',
            source: 'Sin información',
            timeLabel: 'sin reportes',
            note: '',
            pendingReports: 0,
            todayLog: []
          });
          showToast('Punto creado. Ya aparece en el tablero y en el camino.');
        }

        closeSheet();
        saveState();
        renderAll();
      }

      function quitarPunto(id) {
        const st = state.stations.find(s => s.id === id);
        if (!st) return;
        if (state.readings.some(r => r.station_id === id)) {
          showToast('No se puede quitar: tiene lecturas. Desactívalo marcando «sin sensor».');
          return;
        }
        if (!window.confirm('¿Quitar «' + st.name + '» del tablero y del camino?')) return;
        state.stations = state.stations.filter(s => s.id !== id);
        state.roads = state.roads.filter(r => r.id !== id);
        saveState();
        renderAll();
        showToast('Punto quitado.');
      }

      function descargarRespaldo() {
        if (!ALMACEN || typeof ALMACEN.respaldar !== 'function') {
          showToast('No hay almacén disponible para respaldar.');
          return;
        }
        const largo = ALMACEN.respaldar(state);
        showToast('Respaldo descargado (' + Math.max(1, Math.round(largo / 1024)) + ' KB).');
      }

      function cargarRespaldo(archivo) {
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = function () {
          let obj = null;
          try { obj = JSON.parse(String(lector.result)); } catch (e) { obj = null; }
          if (!obj || !ALMACEN || !ALMACEN.validarRespaldo(obj)) {
            showToast('El archivo no parece un respaldo de Maipo Vigía.');
            return;
          }
          state = obj;
          saveState();
          closeSheet();
          renderAll();
          showToast('Respaldo cargado.');
        };
        lector.onerror = function () { showToast('No se pudo leer el archivo.'); };
        lector.readAsText(archivo);
      }

      function restaurarSemilla() {
        state = buildInitialState();
        saveState();
        renderAll();
        showToast('Datos de ejemplo restaurados.');
      }

      function adjustRegVal(delta) {
        ui.regSinDato = false;
        const cur = ui.regValueStr === '' ? 0 : parseFloat(ui.regValueStr.replace(',', '.'));
        const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
        ui.regValueStr = String(next).replace('.', ',');
        renderAll();
      }

      function handleRegNumpad(key) {
        ui.regSinDato = false;
        if (key === '←') {
          ui.regValueStr = ui.regValueStr.slice(0, -1);
        } else if (key === ',') {
          if (!ui.regValueStr.includes(',')) {
            ui.regValueStr = ui.regValueStr === '' ? '0,' : ui.regValueStr + ',';
          }
        } else {
          if (ui.regValueStr.length < 5) {
            ui.regValueStr = ui.regValueStr === '0' ? key : ui.regValueStr + key;
          }
        }
        renderAll();
      }

      function submitObserverReading() {
        const s = state.session;
        if (!s) return;
        const mmVal = ui.regSinDato ? null : parseFloat(ui.regValueStr.replace(',', '.'));
        const folio = 'MV-' + String(Math.floor(1000 + Math.random() * 9000));

        const newReading = {
          id: folio,
          station_id: s.sector_id,
          point_name: s.sector,
          timestamp: ui.regIsBackdated ? `${ui.regDate}T${ui.regTime}:00-03:00` : new Date().toISOString(),
          timeLabel: ui.regIsBackdated ? `${ui.regDate} ${ui.regTime}` : 'ahora',
          rainfall_mm: mmVal,
          estado_lectura: ui.regSinDato ? 'sin_dato' : 'medida',
          temperature_c: null,
          source: 'manual',
          metodo: 'manual',
          instrumento: 'Tubo comunitario',
          verified: false,
          estado_validacion: 'En revisión',
          observador_id: s.observerId,
          observador_alias: s.alias,
          verificado_por: null,
          verificado_en: null,
          corrige_a: null,
          foto: ui.regPhoto || null,
          confianza: 'media'
        };

        state.readings.unshift(newReading);
        const obs = state.observers.find(o => o.id === s.observerId);
        if (obs) obs.lastReading = 'ahora';
        saveState();
        ui.regSubmittedFolio = folio;
        renderAll();
      }

      function resolveCurrentReading(action, correctedMm, rejectReason) {
        const q = getValidationQueue();
        if (!q[0] || q[0].kind !== 'lluvia') return;
        const r = q[0].item;
        const nowIso = new Date().toISOString();

        if (action === 'Validada') {
          r.verified = true;
          r.estado_validacion = 'Validada';
          r.verificado_por = state.session ? state.session.alias : 'Directiva';
          r.verificado_en = nowIso;
          applyReadingToStation(r.station_id, r.rainfall_mm, r.estado_lectura);
          showToast(`Lectura de ${r.point_name} validada. Semáforo público actualizado.`);
        } else if (action === 'Corregida') {
          /* Inmutabilidad: marca la original como sustituida y crea una fila nueva con corrige_a */
          r.estado_validacion = 'Rechazada';
          r.verificado_por = 'Directiva';
          r.verificado_en = nowIso;
          const corr = {
            ...r,
            id: r.id + '-C',
            rainfall_mm: correctedMm,
            estado_lectura: 'medida',
            verified: true,
            estado_validacion: 'Corregida',
            verificado_por: state.session ? state.session.alias : 'Directiva',
            verificado_en: nowIso,
            corrige_a: r.id
          };
          state.readings.unshift(corr);
          applyReadingToStation(corr.station_id, corr.rainfall_mm, 'medida');
          showToast(`Lectura corregida a ${formatMm(correctedMm)} mm y publicada.`);
        } else {
          r.verified = false;
          r.estado_validacion = 'Rechazada';
          r.motivo_rechazo = rejectReason || 'otro';
          r.verificado_por = state.session ? state.session.alias : 'Directiva';
          r.verificado_en = nowIso;
          showToast(`Lectura rechazada (${r.motivo_rechazo}).`);
        }

        ui.valCorrectMode = false;
        ui.valRejectMode = false;
        saveState();
        renderAll();
      }

      function applyReadingToStation(stationId, mmVal, estadoLectura) {
        const st = state.stations.find(x => x.id === stationId);
        if (!st) return;
        if (estadoLectura === 'sin_dato' || mmVal === null) {
          st.rainfall_mm = null;
          st.minutesAgo = null;
          st.timeText = 'sin lectura posible';
        } else {
          st.rainfall_mm = mmVal;
          st.minutesAgo = 0;
          st.timeText = null;
          st.hasSensor = true;
          st.hourly24h[23] = mmVal;
        }
        st.observerCount24h += 1;
        st.lastObserverHour = 'ahora';
        state.updatedLabel = 'ahora';
      }

      function resolveCurrentRoadReport(approve) {
        const q = getValidationQueue();
        if (!q[0] || q[0].kind !== 'camino') return;
        const a = q[0].item;
        const road = state.roads.find(r => r.id === a.road_id);

        if (approve) {
          a.estado = 'Validada';
          if (road) {
            road.state = a.suggested_state;
            road.source = 'Vecino (confirmado por Directiva)';
            road.timeLabel = 'ahora';
            road.note = a.nota ? `${a.tipo}: ${a.nota}` : a.tipo;
            road.pendingReports = Math.max(0, (road.pendingReports || 1) - 1);
            road.todayLog.unshift({ hora: 'Ahora', state: road.state, source: 'Directiva', note: road.note });
            state.roadChanges.unshift({
              hora: 'ahora',
              tramo: road.name,
              state: road.state,
              informedBy: 'Vecino',
              confirmedBy: 'Directiva'
            });
          }
          showToast(`Aviso validado. Tramo ${a.tramo} actualizado.`);
        } else {
          a.estado = 'Rechazada';
          if (road) road.pendingReports = Math.max(0, (road.pendingReports || 1) - 1);
          showToast('Aviso descartado.');
        }

        saveState();
        renderAll();
      }

      function downloadArchiveFile(fileId) {
        const f = state.files.find(x => x.id === fileId);
        if (!f) return;
        const csvLines = ['fecha,punto,lluvia_mm,origen'].concat(
          f.rows.map(r => `"${r.fecha}","${r.punto}",${r.mm === null ? '' : r.mm},"${r.origen}"`)
        );
        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name.endsWith('.csv') ? f.name : `${f.name}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Descargando ${a.download}`);
      }

      function exportObserversCsv() {
        const lines = ['alias,sector,rol,estado,ultima_lectura'].concat(
          state.observers.map(o => `"${o.alias}","${o.sector}","${o.rol}","${o.estado}","${o.lastReading}"`)
        );
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'padron_observadores_maipo_vigia.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Lista de observadores exportada (solo alias).');
      }

      /* ------------------------------------------------------------------------
         20. INICIALIZACIÓN GLOBAL Y EVENTOS PERSISTENTES
         ------------------------------------------------------------------------ */
      function initFontToggle() {
        const btn = document.getElementById('btnFontToggle');
        const apply = isLarge => {
          document.documentElement.classList.toggle('font-large', isLarge);
          btn.setAttribute('aria-pressed', String(isLarge));
          btn.classList.toggle('active-toggle', isLarge);
        };
        const saved = localStorage.getItem(FONT_KEY) === '1';
        apply(saved);
        btn.addEventListener('click', () => {
          const next = !document.documentElement.classList.contains('font-large');
          apply(next);
          try { localStorage.setItem(FONT_KEY, next ? '1' : '0'); } catch (e) {}
        });
      }

      function init() {
        initFontToggle();

        document.getElementById('brandBtn').addEventListener('click', () => navigate('ahora', 'lluvia'));
        document.getElementById('btnFooterHelp').addEventListener('click', () => navigate('ayuda', 'estados'));
        document.getElementById('btnFooterKiosco').addEventListener('click', openKiosco);
        document.getElementById('btnCloseSheet').addEventListener('click', closeSheet);
        document.getElementById('sheetBackdrop').addEventListener('click', e => {
          if (e.target.id === 'sheetBackdrop') closeSheet();
        });

        /* Kiosco: 5 toques en la marca para salir */
        document.getElementById('kioscoBrandExit').addEventListener('click', () => {
          ui.kioscoTapCount += 1;
          if (ui.kioscoTapCount >= 5) {
            closeKiosco();
            showToast('Modo Kiosco cerrado.');
          } else {
            showToast(`Toca ${5 - ui.kioscoTapCount} veces más en la marca para salir.`);
          }
        });

        /* Tecla Escape cierra hojas o Kiosco */
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            if (ui.kioscoActive) closeKiosco();
            else if (ui.sheetType) closeSheet();
          }
        });

        window.addEventListener('hashchange', parseHash);
        window.addEventListener('resize', () => {
          if (ui.tab === 'ahora' && ui.subtab === 'lluvia') renderAll();
        });

        /* Actualización periódica cada 2 minutos del reloj del camino */
        setInterval(() => {
          state.roadMinutesSinceRefresh += 2;
          saveState();
          if (ui.tab === 'camino' && ui.subtab === 'estado') renderAll();
        }, 120000);

        /* Fase 2: si Supabase está configurado, se baja el estado publicado.
           Mientras no lo esté, la semilla local manda. */
        if (ALMACEN && ALMACEN.configurado && typeof ALMACEN.traer === 'function') {
          ALMACEN.traer().then(remoto => {
            if (remoto && Array.isArray(remoto.stations) && remoto.stations.length > 0) {
              state = remoto;
              if (typeof ALMACEN.guardarLocal === 'function') ALMACEN.guardarLocal(state);
              renderAll();
            }
          });
        }

        parseHash();
      }

      init();
    })();
  
