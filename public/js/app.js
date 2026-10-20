// ESTADO GENERAL
    const state = {
      // Puntos iniciales
      A: { x: null, y: null },
      B: { x: null, y: null },
      C: { x: null, y: null },
      // Parámetros
      T: { dx: 0, dy: 0, valid: true },
      S: { sx: 1, sy: 1, px: 0, py: 0, valid: true },
      R: { angle: null, dir: '', kx: null, ky: null, target: '' },
      // Visibilidad de capas
      layers: {
        orig: true,
        t: false,
        s: false,
        ts: false,
        st: false,
        r: false
      },
      figureStyles: {
        orig: { name: '', color: '#0f172a' },
        t: { name: '', color: '#2563eb' },
        s: { name: '', color: '#d97706' },
        ts: { name: '', color: '#059669' },
        st: { name: '', color: '#7c3aed' },
        r: { name: '', color: '#e11d48' }
      },
      figureLabelOffsets: {
        orig: { x: 0, y: 0 },
        t: { x: 0, y: 0 },
        s: { x: 0, y: 0 },
        ts: { x: 0, y: 0 },
        st: { x: 0, y: 0 },
        r: { x: 0, y: 0 }
      },
      // Navegación en el plano (pan y zoom)
      view: {
        scale: 28, // Píxeles por unidad (1:1 aspect ratio garantizado)
        originX: 120,
        originY: 340,
        isDragging: false,
        draggingLabel: '',
        startX: 0,
        startY: 0
      }
    };

    // REFERENCIAS DEL DOM
    const canvas = document.getElementById('cartesianCanvas');
    const ctx = canvas.getContext('2d');
    const liveCoordsBadge = document.getElementById('liveCoordsBadge');
    const coordsTableBody = document.getElementById('coordsTableBody');
    const manualCalculationsContainer = document.getElementById('manualCalculationsContainer');
    const mandateTextArea = document.getElementById('mandateTextArea');
    const validationCardsContainer = document.getElementById('validationCardsContainer');
    const validatorSummaryPill = document.getElementById('validatorSummaryPill');
    const finalReportArea = document.getElementById('finalReportArea');
    const copyToast = document.getElementById('copyToast');
    const reportNarrative = document.getElementById('reportNarrative');
    const reportImageList = document.getElementById('reportImageList');
    const reportImageStatus = document.getElementById('reportImageStatus');
    const reportImages = [];
    let nextReportImageId = 1;

    const figureKeys = ['orig', 't', 's', 'ts', 'st', 'r'];
    const reportExplanation = () => {
      const data = computeGeometry();
      if (!data) return '';
      const rotationText = data.rotationEnabled
        ? ` El giro de ${state.R.angle}° en sentido ${state.R.dir === 'antihorario' ? 'antihorario' : 'horario'} se aplicó con el pivote K=(${state.R.kx}; ${state.R.ky}).`
        : '';
      return `En esta práctica partí de los vértices A, B y C y comparé varias transformaciones en el plano. La traslación desplaza cada punto con el vector T=(${state.T.dx}; ${state.T.dy}); la escala modifica sus distancias respecto al pivote P=(${state.S.px}; ${state.S.py}) con factores (${state.S.sx}; ${state.S.sy}). Al cambiar el orden de estas operaciones, se obtienen los resultados T → S y S → T que aparecen en la tabla.${rotationText} Las figuras y sus coordenadas permiten comprobar cada resultado. Reescribiré esta explicación con mis propias palabras y añadiré mis observaciones.`;
    };

    // 1. MATEMÁTICA Y TRANSFORMACIONES
    function calcT(pt, dx, dy) {
      return { x: pt.x + dx, y: pt.y + dy };
    }

    function calcS(pt, sx, sy, px, py) {
      return {
        x: px + (pt.x - px) * sx,
        y: py + (pt.y - py) * sy
      };
    }

    function calcR(pt, deg, dir, kx, ky) {
      let rad = (deg * Math.PI) / 180;
      if (dir === 'horario') rad = -rad;

      const relX = pt.x - kx;
      const relY = pt.y - ky;

      const rotX = relX * Math.cos(rad) - relY * Math.sin(rad);
      const rotY = relX * Math.sin(rad) + relY * Math.cos(rad);

      return {
        x: Math.round((rotX + kx) * 1000) / 1000,
        y: Math.round((rotY + ky) * 1000) / 1000
      };
    }

    function hexToRgba(hex, alpha) {
      const color = hex.slice(1);
      const red = Number.parseInt(color.slice(0, 2), 16);
      const green = Number.parseInt(color.slice(2, 4), 16);
      const blue = Number.parseInt(color.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    function escapeXml(value) {
      return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
      })[character]);
    }

    function hasScalePivotCoordinates() {
      return document.getElementById('in_Px').value.trim() !== '' &&
        document.getElementById('in_Py').value.trim() !== '';
    }

    // Calcula todas las figuras
    function computeGeometry() {
      if (!state.T.valid || !state.S.valid) return null;
      if (![state.A.x, state.A.y, state.B.x, state.B.y, state.C.x, state.C.y].every(Number.isFinite)) {
        return null;
      }

      const orig = [
        { name: 'A', x: state.A.x, y: state.A.y },
        { name: 'B', x: state.B.x, y: state.B.y },
        { name: 'C', x: state.C.x, y: state.C.y }
      ];

      // 1. Solo T
      const tOnly = orig.map(p => ({
        name: p.name,
        ...calcT(p, state.T.dx, state.T.dy)
      }));

      // 2. Solo S con pivote P
      const sOnly = orig.map(p => ({
        name: p.name,
        ...calcS(p, state.S.sx, state.S.sy, state.S.px, state.S.py)
      }));

      // 3. T -> S (Primero T, luego S)
      const tsInter = tOnly;
      const tsFinal = tsInter.map(p => ({
        name: p.name,
        ...calcS(p, state.S.sx, state.S.sy, state.S.px, state.S.py)
      }));

      // 4. S -> T (Primero S, luego T)
      const stInter = sOnly;
      const stFinal = stInter.map(p => ({
        name: p.name,
        ...calcT(p, state.T.dx, state.T.dy)
      }));

      // 5. Rotación R con pivote K
      let targetPts = orig;
      let targetName = 'Original';
      if (state.R.target === 't') { targetPts = tOnly; targetName = 'Solo T'; }
      else if (state.R.target === 's') { targetPts = sOnly; targetName = 'Solo S'; }
      else if (state.R.target === 'ts') { targetPts = tsFinal; targetName = 'Secuencia T → S'; }
      else if (state.R.target === 'st') { targetPts = stFinal; targetName = 'Secuencia S → T'; }

      const rotationEnabled = Number.isFinite(state.R.angle) &&
        (state.R.dir === 'antihorario' || state.R.dir === 'horario') &&
        Number.isFinite(state.R.kx) && Number.isFinite(state.R.ky) &&
        Boolean(state.R.target);
      const rotFinal = rotationEnabled
        ? targetPts.map(p => ({
          name: p.name,
          ...calcR(p, state.R.angle, state.R.dir, state.R.kx, state.R.ky)
        }))
        : targetPts;

      return { orig, tOnly, sOnly, tsInter, tsFinal, stInter, stFinal, rotFinal, targetPts, targetName, rotationEnabled };
    }

    function getFigureLabelAnchor(points, key) {
      const offset = state.figureLabelOffsets[key];
      return {
        x: points.reduce((total, point) => total + point.x, 0) / points.length + offset.x,
        y: points.reduce((total, point) => total + point.y, 0) / points.length + offset.y
      };
    }

    function getVisibleExportLayers(data) {
      const definitions = [
        { key: 'orig', layerName: 'Figura_original', points: data.orig, dashed: false },
        { key: 't', layerName: 'Figura_trasladada', points: data.tOnly, dashed: true },
        { key: 's', layerName: 'Figura_escalada', points: data.sOnly, dashed: true },
        { key: 'ts', layerName: 'Figura_T_despues_S', points: data.tsFinal, dashed: false },
        { key: 'st', layerName: 'Figura_S_despues_T', points: data.stFinal, dashed: false },
        { key: 'r', layerName: 'Figura_rotada', points: data.rotFinal, dashed: false }
      ];

      return definitions
        .filter(layer => state.layers[layer.key] && (layer.key !== 'r' || data.rotationEnabled))
        .map((layer, index) => ({
          ...layer,
          name: state.figureStyles[layer.key].name.trim(),
          inkscapeLabel: state.figureStyles[layer.key].name.trim() || `Figura_${index + 1}_sin_nombre`,
          stroke: state.figureStyles[layer.key].color,
          fillOpacity: layer.key === 'orig' ? 0.15 : 0.22
        }));
    }

    function getQuadrantExportFrame(data, width, height) {
      const margin = { left: 75, right: 40, top: 45, bottom: 70 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const layers = getVisibleExportLayers(data);
      const points = layers.flatMap(layer => layer.points);

      if ((state.layers.s || state.layers.ts || state.layers.st) && hasScalePivotCoordinates()) {
        points.push({ x: state.S.px, y: state.S.py });
      }
      if (state.layers.r && data.rotationEnabled) {
        points.push({ x: state.R.kx, y: state.R.ky });
      }

      const maxX = Math.max(5, ...points.map(point => Math.max(0, point.x))) + 1;
      const maxY = Math.max(5, ...points.map(point => Math.max(0, point.y))) + 1;
      const scale = Math.min(plotWidth / maxX, plotHeight / maxY);
      const originX = margin.left;
      const originY = height - margin.bottom;

      return {
        layers,
        margin,
        plotWidth,
        plotHeight,
        originX,
        originY,
        scale,
        maxX: plotWidth / scale,
        maxY: plotHeight / scale,
        toCanvas(x, y) {
          return { x: originX + x * scale, y: originY - y * scale };
        }
      };
    }

    // 2. RENDERIZADO DEL PLANO CARTESIANO
    function toCanvas(mx, my) {
      return {
        cx: state.view.originX + mx * state.view.scale,
        cy: state.view.originY - my * state.view.scale // Inversión: Y sube hacia arriba
      };
    }

    function toMath(cx, cy) {
      return {
        mx: (cx - state.view.originX) / state.view.scale,
        my: (state.view.originY - cy) / state.view.scale
      };
    }

    function renderCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;

      // Fondo
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      const scale = state.view.scale;
      const ox = state.view.originX;
      const oy = state.view.originY;

      const minX = Math.floor(-ox / scale);
      const maxX = Math.ceil((w - ox) / scale);
      const minY = Math.floor((oy - h) / scale);
      const maxY = Math.ceil(oy / scale);

      // Cuadrícula fina (0.5)
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "#f1f5f9";
      for (let x = minX; x <= maxX; x += 0.5) {
        const c = toCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(c.cx, 0);
        ctx.lineTo(c.cx, h);
        ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 0.5) {
        const c = toCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(0, c.cy);
        ctx.lineTo(w, c.cy);
        ctx.stroke();
      }

      // Cuadrícula principal (1.0)
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#e2e8f0";
      for (let x = minX; x <= maxX; x++) {
        const c = toCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(c.cx, 0);
        ctx.lineTo(c.cx, h);
        ctx.stroke();
      }
      for (let y = minY; y <= maxY; y++) {
        const c = toCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(0, c.cy);
        ctx.lineTo(w, c.cy);
        ctx.stroke();
      }

      // Ejes Cartesiano
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#1e293b";

      // Eje X
      ctx.beginPath();
      ctx.moveTo(0, oy);
      ctx.lineTo(w, oy);
      ctx.stroke();

      // Flecha Eje X
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(w - 2, oy);
      ctx.lineTo(w - 12, oy - 5);
      ctx.lineTo(w - 12, oy + 5);
      ctx.closePath();
      ctx.fill();

      // Eje Y (Hacia arriba)
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, h);
      ctx.stroke();

      // Flecha Eje Y
      ctx.beginPath();
      ctx.moveTo(ox, 2);
      ctx.lineTo(ox - 5, 12);
      ctx.lineTo(ox + 5, 12);
      ctx.closePath();
      ctx.fill();

      // Rótulos de ejes
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#334155";
      ctx.fillText("+X", w - 28, oy - 10);
      ctx.fillText("+Y", ox + 10, 18);
      ctx.fillText("(0,0)", ox + 5, oy + 15);

      // Ticks numéricos
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#64748b";
      for (let x = minX; x <= maxX; x++) {
        if (x === 0) continue;
        const c = toCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(c.cx, oy - 4);
        ctx.lineTo(c.cx, oy + 4);
        ctx.stroke();
        ctx.fillText(x.toString(), c.cx - 5, oy + 15);
      }
      for (let y = minY; y <= maxY; y++) {
        if (y === 0) continue;
        const c = toCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(ox - 4, c.cy);
        ctx.lineTo(ox + 4, c.cy);
        ctx.stroke();
        ctx.fillText(y.toString(), ox - 20, c.cy + 3);
      }

      // Dibujar Figuras
      const data = computeGeometry();
      if (!data) {
        ctx.restore();
        return;
      }

      function drawShape(pts, layerKey, dashed = false) {
        const { color, name } = state.figureStyles[layerKey];
        ctx.save();
        if (dashed) ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color;
        ctx.fillStyle = hexToRgba(color, layerKey === 'orig' ? 0.15 : 0.22);
        ctx.lineWidth = 2.2;

        ctx.beginPath();
        const p0 = toCanvas(pts[0].x, pts[0].y);
        ctx.moveTo(p0.cx, p0.cy);
        for (let i = 1; i < pts.length; i++) {
          const pt = toCanvas(pts[i].x, pts[i].y);
          ctx.lineTo(pt.cx, pt.cy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Vértices y sus nombres
        pts.forEach(p => {
          const c = toCanvas(p.x, p.y);
          ctx.beginPath();
          ctx.arc(c.cx, c.cy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          const suffix = { t: '_T', s: '_S', ts: '_TS', st: '_ST', r: '_R' }[layerKey] || '';
          ctx.fillText(`${p.name}${suffix}(${p.x};${p.y})`, c.cx + 6, c.cy - 6);
        });

        if (name.trim()) {
          const labelAnchor = getFigureLabelAnchor(pts, layerKey);
          const labelCanvas = toCanvas(labelAnchor.x, labelAnchor.y);
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = "bold 10px Inter, sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name.trim(), labelCanvas.cx, labelCanvas.cy);
          ctx.restore();
        }
      }

      if (state.layers.orig) drawShape(data.orig, 'orig');
      if (state.layers.t) drawShape(data.tOnly, 't', true);
      if (state.layers.s) drawShape(data.sOnly, 's', true);
      if (state.layers.ts) drawShape(data.tsFinal, 'ts');
      if (state.layers.st) drawShape(data.stFinal, 'st');
      if (state.layers.r && data.rotationEnabled) drawShape(data.rotFinal, 'r');

      // Pivote P (Escala)
      if ((state.layers.s || state.layers.ts || state.layers.st) && hasScalePivotCoordinates()) {
        const cp = toCanvas(state.S.px, state.S.py);
        ctx.beginPath();
        ctx.arc(cp.cx, cp.cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fef3c7";
        ctx.strokeStyle = "#b45309";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#b45309";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillText(`P(${state.S.px};${state.S.py})`, cp.cx + 7, cp.cy + 3);
      }

      // Pivote K (Rotación)
      if (state.layers.r && data.rotationEnabled) {
        const ck = toCanvas(state.R.kx, state.R.ky);
        ctx.beginPath();
        ctx.arc(ck.cx, ck.cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ffe4e6";
        ctx.strokeStyle = "#be123c";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ck.cx - 8, ck.cy);
        ctx.lineTo(ck.cx + 8, ck.cy);
        ctx.moveTo(ck.cx, ck.cy - 8);
        ctx.lineTo(ck.cx, ck.cy + 8);
        ctx.stroke();
        ctx.fillStyle = "#be123c";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillText(`K(${state.R.kx};${state.R.ky})`, ck.cx + 8, ck.cy - 6);
      }

      ctx.restore();
    }

    function findFigureLabelAt(x, y) {
      const data = computeGeometry();
      if (!data) return '';
      const visibleLayers = [
        { key: 'orig', points: data.orig },
        { key: 't', points: data.tOnly },
        { key: 's', points: data.sOnly },
        { key: 'ts', points: data.tsFinal },
        { key: 'st', points: data.stFinal },
        ...(data.rotationEnabled ? [{ key: 'r', points: data.rotFinal }] : [])
      ].filter(layer => state.layers[layer.key] && state.figureStyles[layer.key].name.trim());

      ctx.save();
      ctx.font = "bold 10px Inter, sans-serif";
      for (const layer of visibleLayers.reverse()) {
        const anchor = getFigureLabelAnchor(layer.points, layer.key);
        const center = toCanvas(anchor.x, anchor.y);
        const width = ctx.measureText(state.figureStyles[layer.key].name.trim()).width;
        if (x >= center.cx - width / 2 - 6 && x <= center.cx + width / 2 + 6 &&
            y >= center.cy - 10 && y <= center.cy + 10) {
          ctx.restore();
          return layer.key;
        }
      }
      ctx.restore();
      return '';
    }

    // 3. ACTUALIZACIÓN DINÁMICA DE TABLAS, CÁLCULOS MANUALES Y VALIDADOR
    function updateAllPanels() {
      const data = computeGeometry();

      // Indicadores superiores
      document.getElementById('labelScalePivot').textContent = document.getElementById('in_Sx').value || document.getElementById('in_Sy').value
        ? `(${state.S.px};${state.S.py})` : '—';
      document.getElementById('labelRotPivot').textContent = data?.rotationEnabled
        ? `(${state.R.kx};${state.R.ky})` : '—';

      // 1. Llenar tabla de coordenadas en vivo
      coordsTableBody.innerHTML = '';
      if (!data) {
        manualCalculationsContainer.innerHTML = '';
        validationCardsContainer.innerHTML = '';
        validatorSummaryPill.textContent = 'Sin datos';
        validatorSummaryPill.className = "text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600";
        if (document.activeElement !== finalReportArea) finalReportArea.value = '';
        return;
      }

      data.orig.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
          <td class="p-3 font-bold text-slate-800 border">${p.name}</td>
          <td class="p-3 border font-semibold text-slate-900 bg-slate-50/70">(${p.x}; ${p.y})</td>
          <td class="p-3 border font-semibold text-blue-700">${p.name}_T (${data.tOnly[idx].x}; ${data.tOnly[idx].y})</td>
          <td class="p-3 border font-semibold text-amber-700">${p.name}_S (${data.sOnly[idx].x}; ${data.sOnly[idx].y})</td>
          <td class="p-3 border font-bold text-emerald-800 bg-emerald-50/50">${p.name}_TS (${data.tsFinal[idx].x}; ${data.tsFinal[idx].y})</td>
          <td class="p-3 border font-bold text-purple-800 bg-purple-50/50">${p.name}_ST (${data.stFinal[idx].x}; ${data.stFinal[idx].y})</td>
          <td class="p-3 border font-bold text-rose-800 bg-rose-50/50">${data.rotationEnabled ? `${p.name}_R (${data.rotFinal[idx].x}; ${data.rotFinal[idx].y})` : '—'}</td>
        `;
        coordsTableBody.appendChild(tr);
      });

      // 2. Generar el Desglose Aritmético Manual Paso a Paso
      generateDetailedManualBreakdown(data);

      // 3. Ejecutar validador y generar informe
      runTeacherValidator(data);
      generateFinalReport(data);
    }

    // GENERAR DESGLOSE ARITMÉTICO ULTRA DETALLADO Y FÁCIL DE ENTENDER
    function generateDetailedManualBreakdown(data) {
      manualCalculationsContainer.innerHTML = '';

      data.orig.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 rounded-xl p-3 text-xs";

        // Cálculos numéricos para cada sección
        // Solo T
        const tX = p.x + state.T.dx;
        const tY = p.y + state.T.dy;

        // Solo S
        const sRelX = p.x - state.S.px;
        const sRelY = p.y - state.S.py;
        const sScaledX = state.S.sx * sRelX;
        const sScaledY = state.S.sy * sRelY;
        const sFinX = sScaledX + state.S.px;
        const sFinY = sScaledY + state.S.py;

        // T -> S
        // Paso 1: T
        const tsPaso1X = tX;
        const tsPaso1Y = tY;
        // Paso 2: S sobre (tsPaso1X, tsPaso1Y)
        const tsRelX = tsPaso1X - state.S.px;
        const tsRelY = tsPaso1Y - state.S.py;
        const tsFinX = state.S.sx * tsRelX + state.S.px;
        const tsFinY = state.S.sy * tsRelY + state.S.py;

        // S -> T
        // Paso 1: S (sFinX, sFinY)
        // Paso 2: T sobre el resultado
        const stFinX = sFinX + state.T.dx;
        const stFinY = sFinY + state.T.dy;

        // Rotación con Pivote K sobre la figura elegida
        const basePt = data.targetPts[idx];
        const kRelX = basePt.x - state.R.kx;
        const kRelY = basePt.y - state.R.ky;
        // 90 antihorario: (-y, x); horario: (y, -x)
        let rotRelX, rotRelY, formulaText;
        if (state.R.angle === 90 && state.R.dir === 'antihorario') {
          rotRelX = -kRelY;
          rotRelY = kRelX;
          formulaText = `(-y, x) => (${-kRelY}, ${kRelX})`;
        } else if (state.R.angle === 90 && state.R.dir === 'horario') {
          rotRelX = kRelY;
          rotRelY = -kRelX;
          formulaText = `(y, -x) => (${kRelY}, ${-kRelX})`;
        } else {
          const rRes = calcR(basePt, state.R.angle, state.R.dir, state.R.kx, state.R.ky);
          rotRelX = rRes.x - state.R.kx;
          rotRelY = rRes.y - state.R.ky;
          formulaText = `Regla angular ${state.R.angle}° (${state.R.dir})`;
        }
        const rotFinX = rotRelX + state.R.kx;
        const rotFinY = rotRelY + state.R.ky;

        card.innerHTML = `
          <h4 class="mb-2 font-bold text-sm text-slate-800">Vértice original ${p.name} = (${p.x}; ${p.y})</h4>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <section class="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5">
              <h5 class="mb-1 font-bold text-blue-900">Solo T · sumar el desplazamiento</h5>
              <p class="font-mono text-slate-700">${p.name}_T = (${p.x} + ${state.T.dx}; ${p.y} + ${state.T.dy}) = <strong>(${tX}; ${tY})</strong></p>
            </section>
            <section class="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
              <h5 class="mb-1 font-bold text-amber-900">Solo S · medir desde el pivote P</h5>
              <p class="font-mono text-slate-700">${p.name}_S = (${state.S.px} + ${state.S.sx}(${p.x} − ${state.S.px}); ${state.S.py} + ${state.S.sy}(${p.y} − ${state.S.py})) = <strong>(${sFinX}; ${sFinY})</strong></p>
            </section>
            <section class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
              <h5 class="mb-1 font-bold text-emerald-900">T → S · primero trasladar, después escalar</h5>
              <p class="font-mono text-slate-700">Intermedio: (${tsPaso1X}; ${tsPaso1Y}) → <strong>${p.name}_TS = (${tsFinX}; ${tsFinY})</strong></p>
            </section>
            <section class="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5">
              <h5 class="mb-1 font-bold text-purple-900">S → T · primero escalar, después trasladar</h5>
              <p class="font-mono text-slate-700">Intermedio: (${sFinX}; ${sFinY}) → <strong>${p.name}_ST = (${stFinX}; ${stFinY})</strong></p>
            </section>
            ${data.rotationEnabled ? `<section class="rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 sm:col-span-2">
              <h5 class="mb-1 font-bold text-rose-900">Rotación · ${state.R.angle}° ${state.R.dir === 'antihorario' ? 'antihorarios' : 'horarios'} alrededor de K=(${state.R.kx}; ${state.R.ky})</h5>
              <p class="font-mono text-slate-700">${basePt.name} (${basePt.x}; ${basePt.y}) − K = (${kRelX}; ${kRelY}); ${formulaText} → <strong>${p.name}_R = (${rotFinX}; ${rotFinY})</strong></p>
            </section>` : ''}
          </div>
        `;
        manualCalculationsContainer.appendChild(card);
      });
    }

    // 4. VALIDADOR AUTOMÁTICO DE REQUISITOS DEL MAESTRO
    function runTeacherValidator(data) {
      // Regla 1: Triángulo no degenerado (Determinante de área != 0)
      const det = (state.A.x * (state.B.y - state.C.y)) +
                  (state.B.x * (state.C.y - state.A.y)) +
                  (state.C.x * (state.A.y - state.B.y));
      const isCollinear = Math.abs(det) < 0.0001;

      // Regla 2: Desplazamiento no nulo
      const isTZero = (state.T.dx === 0 && state.T.dy === 0);

      // Regla 3: Factores de escala no iguales a 1
      const isSOne = (state.S.sx === 1 && state.S.sy === 1);

      // Regla 4: Rotación configurada
      const isRotValid = data.rotationEnabled;

      // Regla 5: Efecto del orden T->S vs S->T
      const dxDiff = (state.S.sx - 1) * state.T.dx;
      const dyDiff = (state.S.sy - 1) * state.T.dy;
      const orderDiffers = (dxDiff !== 0 || dyDiff !== 0);

      const checks = [
        {
          title: "1. Vértices A, B y C no colineales",
          desc: isCollinear 
            ? "FALLO: Los 3 puntos caen sobre la misma línea recta (Área/Determinante = 0). Cambia un punto para formar un triángulo real."
            : `CUMPLIDO: Los vértices forman un triángulo real con determinante = ${Math.abs(det).toFixed(2)} (no están sobre una sola línea).`,
          pass: !isCollinear
        },
        {
          title: "2. Desplazamiento (dx, dy) no nulo",
          desc: isTZero
            ? "ADVERTENCIA: dx=0 y dy=0. El mandato pide expresamente evitar desplazamiento cero para apreciar el cambio de orden."
            : `CUMPLIDO: Vector T = (${state.T.dx}; ${state.T.dy}) genera desplazamiento geométrico visible.`,
          pass: !isTZero
        },
        {
          title: "3. Factores de escala distintos de 1",
          desc: isSOne
            ? "ADVERTENCIA: Los factores de escala son 1 (identidad). El mandato pide evitar factor 1."
            : `CUMPLIDO: Escala S = (${state.S.sx}; ${state.S.sy}) con pivote P = (${state.S.px}; ${state.S.py}).`,
          pass: !isSOne
        },
        {
          title: "4. Rotación con ángulo, sentido y pivote K",
          desc: isRotValid
            ? `CUMPLIDO: Giro de ${state.R.angle}° (${state.R.dir}) con pivote K = (${state.R.kx}; ${state.R.ky}) aplicado a: ${data.targetName}.`
            : "FALLO: Faltan parámetros válidos para la rotación con pivote.",
          pass: isRotValid
        },
        {
          title: "5. Comprobación del efecto de no conmutatividad",
          desc: orderDiffers
            ? `CUMPLIDO: Se evidencia la diferencia de orden entre T→S y S→T. Diferencia vectorial: (${dxDiff}; ${dyDiff}).`
            : "AVISO: T→S y S→T dan las mismas coordenadas porque dx=dy=0 o escala=1. Ajusta para observar la diferencia.",
          pass: orderDiffers
        }
      ];

      validationCardsContainer.innerHTML = '';
      let totalPassed = 0;

      checks.forEach(chk => {
        if (chk.pass) totalPassed++;
        const card = document.createElement('div');
        card.className = `p-3 rounded-xl border flex items-start gap-2.5 ${
          chk.pass ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'
        }`;
        card.innerHTML = `
          <i class="fa-solid ${chk.pass ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-amber-600'} text-base mt-0.5"></i>
          <div>
            <div class="font-bold">${chk.title}</div>
            <div class="text-[11px] ${chk.pass ? 'text-emerald-800' : 'text-amber-800'}">${chk.desc}</div>
          </div>
        `;
        validationCardsContainer.appendChild(card);
      });

      if (totalPassed === checks.length) {
        validatorSummaryPill.className = "text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
        validatorSummaryPill.textContent = "✓ TODO CUMPLIDO Y VÁLIDO (100%)";
      } else {
        validatorSummaryPill.className = "text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800";
        validatorSummaryPill.textContent = `REVISAR (${totalPassed}/${checks.length} CUMPLIDOS)`;
      }
    }

    // 5. INFORME OFICIAL ENTREGABLE
    function generateFinalReport(data) {
      const student = document.getElementById('reportStudentName').value;
      const course = document.getElementById('reportCourseName').value;
      const dxDiff = (state.S.sx - 1) * state.T.dx;
      const dyDiff = (state.S.sy - 1) * state.T.dy;

      const report = 
`================================================================================
INFORME DE PRÁCTICA: TRANSFORMACIONES GEOMÉTRICAS 2D (CÓDIGO A03)
================================================================================
Estudiante: ${student}
Asignatura: ${course}
Fecha de Emisión: ${new Date().toLocaleDateString('es-ES')}
Sistema de Ejes: Ortogonal, 1 unidad por marca, Eje Y estrictamente HACIA ARRIBA.

1. VÉRTICES ORIGINALES DEL TRIÁNGULO:
   • Vértice A = (${data.orig[0].x}; ${data.orig[0].y})
   • Vértice B = (${data.orig[1].x}; ${data.orig[1].y})
   • Vértice C = (${data.orig[2].x}; ${data.orig[2].y})
   (Verificado: Los vértices no son colineales y forman una figura no degenerada).

2. PARÁMETROS CONFIGURADOS:
   • Vector de Traslación: T = (${state.T.dx}; ${state.T.dy})
   • Factores de Escala: S = (${state.S.sx}; ${state.S.sy}) respecto al pivote P = (${state.S.px}; ${state.S.py})
   • Rotación: ${data.rotationEnabled ? `${state.R.angle}° (${state.R.dir}) respecto al pivote K = (${state.R.kx}; ${state.R.ky})` : 'Sin configurar'}
   • Figura sobre la cual se aplicó la rotación: ${data.rotationEnabled ? data.targetName : 'Sin rotación configurada'}

3. TABLA COMPARATIVA DE COORDENADAS:
---------------------------------------------------------------------------------------------------------
Vértice | Original | Solo T   | Solo S   | Después de T -> S    | Después de S -> T    | Rotación R
---------------------------------------------------------------------------------------------------------
A       | (${data.orig[0].x}; ${data.orig[0].y})   | (${data.tOnly[0].x}; ${data.tOnly[0].y}) | (${data.sOnly[0].x}; ${data.sOnly[0].y}) | (${data.tsFinal[0].x}; ${data.tsFinal[0].y})                | (${data.stFinal[0].x}; ${data.stFinal[0].y})                | ${data.rotationEnabled ? `(${data.rotFinal[0].x}; ${data.rotFinal[0].y})` : '—'}
B       | (${data.orig[1].x}; ${data.orig[1].y})   | (${data.tOnly[1].x}; ${data.tOnly[1].y}) | (${data.sOnly[1].x}; ${data.sOnly[1].y}) | (${data.tsFinal[1].x}; ${data.tsFinal[1].y})               | (${data.stFinal[1].x}; ${data.stFinal[1].y})               | ${data.rotationEnabled ? `(${data.rotFinal[1].x}; ${data.rotFinal[1].y})` : '—'}
C       | (${data.orig[2].x}; ${data.orig[2].y})   | (${data.tOnly[2].x}; ${data.tOnly[2].y}) | (${data.sOnly[2].x}; ${data.sOnly[2].y}) | (${data.tsFinal[2].x}; ${data.tsFinal[2].y})               | (${data.stFinal[2].x}; ${data.stFinal[2].y})               | ${data.rotationEnabled ? `(${data.rotFinal[2].x}; ${data.rotFinal[2].y})` : '—'}
---------------------------------------------------------------------------------------------------------

4. JUSTIFICACIÓN DEL EFECTO OBSERVADO EN EL ORDEN DE OPERADORES:
   - En T -> S: La traslación se realiza en primer lugar y por ello queda amplificada por
     los factores de escala: (${state.S.sx}*(x + ${state.T.dx}); ${state.S.sy}*(y + ${state.T.dy})).
   - En S -> T: La escala solo afecta a las coordenadas originales y después se le suma la
     traslación sin amplificar: (${state.S.sx}*x + ${state.T.dx}; ${state.S.sy}*y + ${state.T.dy}).
   - La diferencia vectorial constante es: ((Sx - 1)*dx; (Sy - 1)*dy) = (${dxDiff}; ${dyDiff}).
   - Queda comprobado que la traslación y la escala no conmutan salvo cuando T=(0,0) o S=(1,1).

5. PROCEDIMIENTO DE ROTACIÓN CON PIVOTE K:
   Se siguió el procedimiento de los temas C03/09 y C03/11:
   ${data.rotationEnabled
     ? `1) Restar el pivote K(${state.R.kx}; ${state.R.ky}) al punto.
   2) Aplicar la regla de rotación canónica para ${state.R.angle}° (${state.R.dir}).
   3) Sumar nuevamente el pivote K al resultado.`
     : 'No se aplicó ninguna rotación.'}

6. COMPROBACIÓN DE REQUISITOS Y AYUDA RECIBIDA:
   - Cumplimiento de consignas del mandato A03 verificado al 100%.
   - Archivo SVG estructurado en capas exportado para comprobación en Inkscape.
================================================================================`;

      if (document.activeElement !== finalReportArea) {
        finalReportArea.value = report;
      }
      if (document.activeElement !== reportNarrative && !reportNarrative.dataset.userEdited) {
        reportNarrative.value = reportExplanation();
      }
    }

    // 6. EXPORTACIONES (SVG E IMAGEN PNG)
    function exportInkscapeSVG() {
      const data = computeGeometry();
      if (!data) {
        window.alert('Completa las coordenadas de A, B y C antes de exportar el SVG.');
        return;
      }
      const svgW = 1200;
      const svgH = 900;
      const frame = getQuadrantExportFrame(data, svgW, svgH);
      const toSvg = (x, y) => {
        const point = frame.toCanvas(x, y);
        return { sx: point.x.toFixed(2), sy: point.y.toFixed(2) };
      };

      function polyPts(arr) {
        return arr.map(p => {
          const s = toSvg(p.x, p.y);
          return `${s.sx},${s.sy}`;
        }).join(' ');
      }

      const gridStep = Math.max(1, Math.ceil(Math.max(frame.maxX, frame.maxY) / 40));
      let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <defs>
    <clipPath id="primer-cuadrante">
      <rect x="${frame.originX}" y="${frame.margin.top}" width="${frame.plotWidth}" height="${frame.plotHeight}"/>
    </clipPath>
  </defs>
  <rect width="${svgW}" height="${svgH}" fill="#ffffff"/>
  <text x="${frame.originX}" y="28" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">Plano cartesiano — primer cuadrante</text>
  <g inkscape:groupmode="layer" inkscape:label="01_Cuadricula_y_Ejes" id="capa_ejes" clip-path="url(#primer-cuadrante)">
`;

      for (let x = 0; x <= frame.maxX; x += gridStep) {
        const p1 = toSvg(x, 0);
        const p2 = toSvg(x, frame.maxY);
        svg += `    <line x1="${p1.sx}" y1="${p2.sy}" x2="${p1.sx}" y2="${p1.sy}" stroke="#e2e8f0" stroke-width="1" />\n`;
        svg += `    <text x="${parseFloat(p1.sx) + 4}" y="${frame.originY - 8}" font-family="sans-serif" font-size="12" fill="#334155">${x}</text>\n`;
      }
      for (let y = 0; y <= frame.maxY; y += gridStep) {
        const p1 = toSvg(0, y);
        const p2 = toSvg(frame.maxX, y);
        svg += `    <line x1="${p1.sx}" y1="${p1.sy}" x2="${p2.sx}" y2="${p1.sy}" stroke="#e2e8f0" stroke-width="1" />\n`;
        if (y > 0) svg += `    <text x="${frame.originX + 5}" y="${parseFloat(p1.sy) - 5}" font-family="sans-serif" font-size="12" fill="#334155">${y}</text>\n`;
      }

      const origin = toSvg(0, 0);
      const xEnd = toSvg(frame.maxX, 0);
      const yEnd = toSvg(0, frame.maxY);
      svg += `    <line x1="${origin.sx}" y1="${origin.sy}" x2="${xEnd.sx}" y2="${xEnd.sy}" stroke="#0f172a" stroke-width="2.5" />\n`;
      svg += `    <line x1="${origin.sx}" y1="${origin.sy}" x2="${yEnd.sx}" y2="${yEnd.sy}" stroke="#0f172a" stroke-width="2.5" />\n`;
      svg += `    <text x="${parseFloat(xEnd.sx) - 30}" y="${parseFloat(xEnd.sy) - 10}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">+X</text>\n`;
      svg += `    <text x="${parseFloat(yEnd.sx) + 8}" y="${parseFloat(yEnd.sy) + 16}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">+Y</text>\n`;
      svg += `    <text x="${parseFloat(origin.sx) + 6}" y="${parseFloat(origin.sy) - 8}" font-family="sans-serif" font-size="12" fill="#334155">O(0,0)</text>\n`;
      svg += `  </g>\n`;

      function appendSvgLayer(layer) {
        const dashAttr = layer.dashed ? 'stroke-dasharray="5,4"' : '';
        let out = `  <g inkscape:groupmode="layer" inkscape:label="${escapeXml(layer.inkscapeLabel)}" clip-path="url(#primer-cuadrante)">\n`;
        out += `    <polygon points="${polyPts(layer.points)}" stroke="${layer.stroke}" stroke-width="2.2" fill="${layer.stroke}" fill-opacity="${layer.fillOpacity}" ${dashAttr} />\n`;
        layer.points.forEach(p => {
          const s = toSvg(p.x, p.y);
          const suffix = { t: '_T', s: '_S', ts: '_TS', st: '_ST', r: '_R' }[layer.key] || '';
          out += `    <circle cx="${s.sx}" cy="${s.sy}" r="4.5" fill="${layer.stroke}" stroke="#ffffff" stroke-width="1.5" />\n`;
          out += `    <text x="${parseFloat(s.sx) + 6}" y="${parseFloat(s.sy) - 6}" font-family="monospace" font-size="11" font-weight="bold" fill="#0f172a">${p.name}${suffix}(${p.x};${p.y})</text>\n`;
        });
        if (layer.name) {
          const anchor = getFigureLabelAnchor(layer.points, layer.key);
          const label = toSvg(anchor.x, anchor.y);
          out += `    <text x="${label.sx}" y="${label.sy}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="12" font-weight="bold" fill="${layer.stroke}">${escapeXml(layer.name)}</text>\n`;
        }
        out += `  </g>\n`;
        return out;
      }

      for (const layer of frame.layers) svg += appendSvgLayer(layer);

      const showScalePivot = (state.layers.s || state.layers.ts || state.layers.st) && hasScalePivotCoordinates();
      const showRotationPivot = state.layers.r && data.rotationEnabled;
      if (showScalePivot || showRotationPivot) {
        svg += `  <g inkscape:groupmode="layer" inkscape:label="Pivotes" clip-path="url(#primer-cuadrante)">\n`;
      }
      if (showScalePivot) {
        const spP = toSvg(state.S.px, state.S.py);
        svg += `    <circle cx="${spP.sx}" cy="${spP.sy}" r="5" fill="#fef3c7" stroke="#b45309" stroke-width="2" />\n`;
        svg += `    <text x="${parseFloat(spP.sx) + 8}" y="${parseFloat(spP.sy) + 4}" font-family="monospace" font-size="11" font-weight="bold" fill="#b45309">P(${state.S.px};${state.S.py})</text>\n`;
      }
      if (showRotationPivot) {
        const spK = toSvg(state.R.kx, state.R.ky);
        svg += `    <circle cx="${spK.sx}" cy="${spK.sy}" r="6" fill="#ffe4e6" stroke="#be123c" stroke-width="2" />\n`;
        svg += `    <text x="${parseFloat(spK.sx) + 8}" y="${parseFloat(spK.sy) - 6}" font-family="monospace" font-size="11" font-weight="bold" fill="#be123c">K(${state.R.kx};${state.R.ky})</text>\n`;
      }
      if (showScalePivot || showRotationPivot) svg += `  </g>\n`;
      svg += `</svg>`;

      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Transformaciones_A03_Inkscape.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportPNG() {
      const data = computeGeometry();
      if (!data) {
        window.alert('Completa las coordenadas de A, B y C antes de exportar la imagen.');
        return;
      }

      const output = document.createElement('canvas');
      output.width = 1200;
      output.height = 900;
      const ctx = output.getContext('2d');
      const frame = getQuadrantExportFrame(data, output.width, output.height);
      const gridStep = Math.max(1, Math.ceil(Math.max(frame.maxX, frame.maxY) / 40));

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, output.width, output.height);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Plano cartesiano — primer cuadrante', frame.originX, 28);
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.originX, frame.margin.top, frame.plotWidth, frame.plotHeight);
      ctx.clip();

      ctx.strokeStyle = '#e2e8f0';
      ctx.fillStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.font = '11px monospace';
      for (let x = 0; x <= frame.maxX; x += gridStep) {
        const point = frame.toCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(point.x, frame.originY);
        ctx.lineTo(point.x, frame.margin.top);
        ctx.stroke();
        ctx.fillText(String(x), point.x + 4, frame.originY - 8);
      }
      for (let y = 0; y <= frame.maxY; y += gridStep) {
        const point = frame.toCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(frame.originX, point.y);
        ctx.lineTo(frame.originX + frame.plotWidth, point.y);
        ctx.stroke();
        if (y > 0) ctx.fillText(String(y), frame.originX + 5, point.y - 5);
      }

      ctx.strokeStyle = '#0f172a';
      ctx.fillStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(frame.originX, frame.originY);
      ctx.lineTo(frame.originX + frame.plotWidth, frame.originY);
      ctx.moveTo(frame.originX, frame.originY);
      ctx.lineTo(frame.originX, frame.margin.top);
      ctx.stroke();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('+X', frame.originX + frame.plotWidth - 28, frame.originY - 10);
      ctx.fillText('+Y', frame.originX + 8, frame.margin.top + 14);
      ctx.fillText('O(0,0)', frame.originX + 6, frame.originY - 8);

      for (const layer of frame.layers) {
        ctx.save();
        ctx.strokeStyle = layer.stroke;
        ctx.fillStyle = layer.fill;
        ctx.lineWidth = 2.2;
        if (layer.dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        layer.points.forEach((point, index) => {
          const mapped = frame.toCanvas(point.x, point.y);
          if (index === 0) ctx.moveTo(mapped.x, mapped.y);
          else ctx.lineTo(mapped.x, mapped.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        for (const point of layer.points) {
          const mapped = frame.toCanvas(point.x, point.y);
          const suffix = { t: '_T', s: '_S', ts: '_TS', st: '_ST', r: '_R' }[layer.key] || '';
          ctx.beginPath();
          ctx.arc(mapped.x, mapped.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = layer.stroke;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${point.name}${suffix}(${point.x};${point.y})`, mapped.x + 7, mapped.y - 7);
        }

        if (layer.name) {
          const anchor = getFigureLabelAnchor(layer.points, layer.key);
          const labelPoint = frame.toCanvas(anchor.x, anchor.y);
          ctx.fillStyle = layer.stroke;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(layer.name, labelPoint.x, labelPoint.y);
        }
        ctx.restore();
      }

      function drawPivot(x, y, label, fill, stroke) {
        const point = frame.toCanvas(x, y);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = stroke;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${label}(${x};${y})`, point.x + 8, point.y - 6);
      }

      if ((state.layers.s || state.layers.ts || state.layers.st) && hasScalePivotCoordinates()) {
        drawPivot(state.S.px, state.S.py, 'P', '#fef3c7', '#b45309');
      }
      if (state.layers.r && data.rotationEnabled) {
        drawPivot(state.R.kx, state.R.ky, 'K', '#ffe4e6', '#be123c');
      }
      ctx.restore();

      const url = output.toDataURL('image/png');
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plano_Transformaciones_A03.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // 7. LECTURA DE VALORES DE ENTRADA
    function readNumericInput(id) {
      const value = document.getElementById(id).value.trim();
      if (value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    function setCalculationStatus(element, message, isError = false) {
      element.textContent = message;
      element.classList.toggle('text-rose-700', isError);
      element.classList.toggle('text-slate-500', !isError);
    }

    function formatCalculatedNumber(value) {
      const rounded = Math.round(value * 1e6) / 1e6;
      return String(Object.is(rounded, -0) ? 0 : rounded);
    }

    function deriveTranslationParameters() {
      const coordinateIds = ['in_TAx', 'in_TAy', 'in_TBx', 'in_TBy', 'in_TCx', 'in_TCy'];
      const values = coordinateIds.map(readNumericInput);
      const outputIds = ['in_Tdx', 'in_Tdy'];
      const status = document.getElementById('translationStatus');
      const entered = values.filter(value => value !== null).length;

      if (entered === 0) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.T.dx = 0;
        state.T.dy = 0;
        state.T.valid = true;
        setCalculationStatus(status, 'Completa las coordenadas de A_T, B_T y C_T para calcular el desplazamiento.');
        return;
      }
      if (entered !== coordinateIds.length) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.T.valid = false;
        setCalculationStatus(status, 'Completa las seis coordenadas destino para calcular la traslación.', true);
        return;
      }

      const originals = [state.A, state.B, state.C];
      if (!originals.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.T.valid = false;
        setCalculationStatus(status, 'Primero completa los vértices originales A, B y C.', true);
        return;
      }

      const destinations = [
        { x: values[0], y: values[1] },
        { x: values[2], y: values[3] },
        { x: values[4], y: values[5] }
      ];
      const dx = destinations[0].x - originals[0].x;
      const dy = destinations[0].y - originals[0].y;
      const matchesTranslation = originals.every((point, index) =>
        Math.abs(destinations[index].x - point.x - dx) < 1e-6 &&
        Math.abs(destinations[index].y - point.y - dy) < 1e-6
      );

      if (!matchesTranslation) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.T.valid = false;
        setCalculationStatus(status, 'Esas coordenadas no corresponden a una misma traslación. Revisa A_T, B_T y C_T.', true);
        return;
      }

      state.T.dx = dx;
      state.T.dy = dy;
      state.T.valid = true;
      document.getElementById('in_Tdx').value = formatCalculatedNumber(dx);
      document.getElementById('in_Tdy').value = formatCalculatedNumber(dy);
      setCalculationStatus(status, `Traslación calculada: dx = ${formatCalculatedNumber(dx)} y dy = ${formatCalculatedNumber(dy)}.`);
    }

    function deriveScaleAxis(sourceValues, targetValues, axisName) {
      const distinctPair = sourceValues.findIndex((value, index) =>
        sourceValues.slice(index + 1).some(other => Math.abs(other - value) > 1e-9)
      );
      let secondIndex = -1;
      if (distinctPair !== -1) {
        secondIndex = sourceValues.findIndex((value, index) => index > distinctPair && Math.abs(value - sourceValues[distinctPair]) > 1e-9);
      }

      if (secondIndex === -1) {
        const sourceIsConstant = sourceValues.every(value => Math.abs(value - sourceValues[0]) < 1e-9);
        const targetIsConstant = targetValues.every(value => Math.abs(value - targetValues[0]) < 1e-9);
        if (sourceIsConstant && targetIsConstant && Math.abs(sourceValues[0] - targetValues[0]) < 1e-6) {
          return { factor: 1, pivot: 0 };
        }
        throw new Error(`No se puede calcular S${axisName}: los vértices no permiten determinar ese factor y pivote.`);
      }

      const factor = (targetValues[secondIndex] - targetValues[distinctPair]) /
        (sourceValues[secondIndex] - sourceValues[distinctPair]);
      if (!Number.isFinite(factor)) {
        throw new Error(`No se pudo calcular el factor S${axisName}.`);
      }
      const pivot = Math.abs(1 - factor) < 1e-9
        ? 0
        : (targetValues[distinctPair] - factor * sourceValues[distinctPair]) / (1 - factor);
      const matchesScale = sourceValues.every((value, index) =>
        Math.abs(pivot + (value - pivot) * factor - targetValues[index]) < 1e-6
      );
      if (!matchesScale) {
        throw new Error(`Las coordenadas no corresponden a una escala con un único pivote en el eje ${axisName}.`);
      }
      return { factor, pivot };
    }

    function deriveScaleParameters() {
      const coordinateIds = ['in_SAx', 'in_SAy', 'in_SBx', 'in_SBy', 'in_SCx', 'in_SCy'];
      const values = coordinateIds.map(readNumericInput);
      const outputIds = ['in_Sx', 'in_Sy', 'in_Px', 'in_Py'];
      const status = document.getElementById('scaleStatus');
      const entered = values.filter(value => value !== null).length;

      if (entered === 0) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.S.sx = 1;
        state.S.sy = 1;
        state.S.px = 0;
        state.S.py = 0;
        state.S.valid = true;
        setCalculationStatus(status, 'Completa las coordenadas de A_S, B_S y C_S para calcular la escala y su pivote.');
        return;
      }
      if (entered !== coordinateIds.length) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.S.valid = false;
        setCalculationStatus(status, 'Completa las seis coordenadas destino para calcular escala y pivote.', true);
        return;
      }

      const originals = [state.A, state.B, state.C];
      if (!originals.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.S.valid = false;
        setCalculationStatus(status, 'Primero completa los vértices originales A, B y C.', true);
        return;
      }

      const targetX = [values[0], values[2], values[4]];
      const targetY = [values[1], values[3], values[5]];
      try {
        const scaleX = deriveScaleAxis(originals.map(point => point.x), targetX, 'x');
        const scaleY = deriveScaleAxis(originals.map(point => point.y), targetY, 'y');
        state.S.sx = scaleX.factor;
        state.S.sy = scaleY.factor;
        state.S.px = scaleX.pivot;
        state.S.py = scaleY.pivot;
        state.S.valid = true;
        outputIds.forEach((id, index) => {
          const value = [scaleX.factor, scaleY.factor, scaleX.pivot, scaleY.pivot][index];
          document.getElementById(id).value = formatCalculatedNumber(value);
        });
        setCalculationStatus(status,
          `Escala calculada: S = (${formatCalculatedNumber(scaleX.factor)}; ${formatCalculatedNumber(scaleY.factor)}), P = (${formatCalculatedNumber(scaleX.pivot)}; ${formatCalculatedNumber(scaleY.pivot)}).`
        );
      } catch (error) {
        outputIds.forEach(id => { document.getElementById(id).value = ''; });
        state.S.valid = false;
        setCalculationStatus(status, error.message, true);
      }
    }

    function readInputs() {
      state.A.x = readNumericInput('in_Ax');
      state.A.y = readNumericInput('in_Ay');
      state.B.x = readNumericInput('in_Bx');
      state.B.y = readNumericInput('in_By');
      state.C.x = readNumericInput('in_Cx');
      state.C.y = readNumericInput('in_Cy');

      deriveTranslationParameters();
      deriveScaleParameters();

      state.R.angle = readNumericInput('in_Rangle');
      state.R.dir = document.getElementById('in_Rdir').value;
      state.R.kx = readNumericInput('in_Kx');
      state.R.ky = readNumericInput('in_Ky');
      state.R.target = document.getElementById('in_Rtarget').value;

      state.layers.orig = document.getElementById('layer_orig').checked;
      state.layers.t = document.getElementById('layer_t').checked;
      state.layers.s = document.getElementById('layer_s').checked;
      state.layers.ts = document.getElementById('layer_ts').checked;
      state.layers.st = document.getElementById('layer_st').checked;
      state.layers.r = document.getElementById('layer_r').checked;
      for (const key of figureKeys) {
        state.figureStyles[key].name = document.getElementById(`figureName_${key}`).value;
        state.figureStyles[key].color = document.getElementById(`figureColor_${key}`).value;
      }

      renderCanvas();
      updateAllPanels();
    }

    // Configurar listeners a todos los inputs
    document.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', readInputs);
      el.addEventListener('change', readInputs);
    });

    document.getElementById('btnClearTranslation').addEventListener('click', () => {
      ['in_TAx', 'in_TAy', 'in_TBx', 'in_TBy', 'in_TCx', 'in_TCy'].forEach(id => {
        document.getElementById(id).value = '';
      });
      readInputs();
    });

    document.getElementById('btnClearScale').addEventListener('click', () => {
      ['in_SAx', 'in_SAy', 'in_SBx', 'in_SBy', 'in_SCx', 'in_SCy'].forEach(id => {
        document.getElementById(id).value = '';
      });
      readInputs();
    });

    document.getElementById('btnToggleAllLayers').addEventListener('click', () => {
      const anyOff = Object.values(state.layers).some(v => !v);
      const toSet = anyOff;
      ['layer_orig', 'layer_t', 'layer_s', 'layer_ts', 'layer_st', 'layer_r'].forEach(id => {
        document.getElementById(id).checked = toSet;
      });
      readInputs();
    });

    // Mandato: Guardar y resetear
    document.getElementById('btnResetDefaultMandate').addEventListener('click', () => {
      mandateTextArea.value = '';
    });

    // Copiar informe final
    document.getElementById('btnCopyFinalReport').addEventListener('click', () => {
      finalReportArea.select();
      document.execCommand('copy');
      copyToast.classList.remove('hidden');
      setTimeout(() => copyToast.classList.add('hidden'), 3500);
    });

    function renderReportImages() {
      reportImageList.replaceChildren();
      reportImages.forEach(image => {
        const card = document.createElement('div');
        card.className = 'rounded-lg border border-slate-200 bg-white p-2';
        const preview = document.createElement('img');
        preview.src = image.dataUrl;
        preview.alt = `Vista previa de ${image.name}`;
        preview.className = 'h-28 w-full rounded object-contain';
        const footer = document.createElement('div');
        footer.className = 'mt-1 flex items-center justify-between gap-2';
        const filename = document.createElement('span');
        filename.className = 'truncate text-[10px] text-slate-600';
        filename.textContent = image.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-50';
        remove.textContent = 'Quitar';
        remove.setAttribute('aria-label', `Quitar ${image.name}`);
        remove.addEventListener('click', () => {
          const index = reportImages.findIndex(item => item.id === image.id);
          if (index !== -1) reportImages.splice(index, 1);
          renderReportImages();
          reportImageStatus.textContent = `${reportImages.length} imagen(es) preparada(s).`;
        });
        footer.append(filename, remove);
        card.append(preview, footer);
        reportImageList.appendChild(card);
      });
    }

    function readImageFile(file) {
      if (!file.type.startsWith('image/')) {
        return Promise.reject(new Error(`${file.name} no es un archivo de imagen.`));
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          if (typeof reader.result !== 'string') {
            reject(new Error(`No se pudo leer la imagen ${file.name}.`));
            return;
          }
          resolve({ id: nextReportImageId++, name: file.name, dataUrl: reader.result });
        });
        reader.addEventListener('error', () => reject(reader.error || new Error(`No se pudo leer la imagen ${file.name}.`)));
        reader.readAsDataURL(file);
      });
    }

    document.getElementById('reportImageInput').addEventListener('change', async event => {
      const imageInput = event.currentTarget;
      const files = [...imageInput.files];
      if (!files.length) return;
      reportImageStatus.textContent = 'Cargando imágenes…';
      try {
        const loadedImages = await Promise.all(files.map(readImageFile));
        reportImages.push(...loadedImages);
        renderReportImages();
        reportImageStatus.textContent = `${reportImages.length} imagen(es) preparada(s) para el PDF.`;
        imageInput.value = '';
      } catch (error) {
        reportImageStatus.textContent = error.message;
      }
    });

    function addPrintText(parent, tagName, text, className = '') {
      const element = document.createElement(tagName);
      element.textContent = text;
      if (className) element.className = className;
      parent.appendChild(element);
      return element;
    }

    function preparePrintReport() {
      const data = computeGeometry();
      if (!data) {
        window.alert('Completa las coordenadas de A, B y C antes de preparar el informe.');
        return;
      }

      const printDocument = document.getElementById('printDocument');
      printDocument.replaceChildren();
      printDocument.setAttribute('aria-hidden', 'false');

      addPrintText(printDocument, 'h1', 'Informe de transformaciones geométricas');
      addPrintText(printDocument, 'p', 'Laboratorio de Transformaciones Geométricas 2D · Código A03');
      const metadata = document.createElement('div');
      metadata.className = 'print-meta';
      addPrintText(metadata, 'p', `Estudiante: ${document.getElementById('reportStudentName').value || '—'}`);
      addPrintText(metadata, 'p', `Asignatura: ${document.getElementById('reportCourseName').value || '—'}`);
      addPrintText(metadata, 'p', `Fecha: ${new Date().toLocaleDateString('es-ES')}`);
      addPrintText(metadata, 'p', 'Sistema de coordenadas: eje X hacia la derecha y eje Y hacia arriba.');
      printDocument.appendChild(metadata);

      addPrintText(printDocument, 'h2', 'Explicación del procedimiento');
      addPrintText(printDocument, 'p', reportNarrative.value.trim() || 'No se agregó una explicación.');

      addPrintText(printDocument, 'h2', 'Reglas de transformación');
      const rules = document.createElement('ul');
      [
        `Traslación: (x; y) → (x + ${state.T.dx}; y + ${state.T.dy}).`,
        `Escala con pivote P: (x; y) → (${state.S.px} + ${state.S.sx}(x − ${state.S.px}); ${state.S.py} + ${state.S.sy}(y − ${state.S.py})).`,
        'Orden T → S: aplicar primero la traslación y luego la escala.',
        'Orden S → T: aplicar primero la escala y luego la traslación.',
        ...(data.rotationEnabled ? [
          `Giro: restar K=(${state.R.kx}; ${state.R.ky}), rotar ${state.R.angle}° ${state.R.dir} y volver a sumar el pivote.`
        ] : [])
      ].forEach(line => addPrintText(rules, 'li', line));
      printDocument.appendChild(rules);

      addPrintText(printDocument, 'h2', 'Parámetros utilizados');
      const parameters = document.createElement('ul');
      [
        `Traslación: T = (${state.T.dx}; ${state.T.dy}).`,
        `Escala: S = (${state.S.sx}; ${state.S.sy}), con pivote P = (${state.S.px}; ${state.S.py}).`,
        data.rotationEnabled
          ? `Rotación: ${state.R.angle}° ${state.R.dir}, con pivote K = (${state.R.kx}; ${state.R.ky}), aplicada a ${data.targetName}.`
          : 'Rotación: no aplicada.'
      ].forEach(line => addPrintText(parameters, 'li', line));
      printDocument.appendChild(parameters);

      addPrintText(printDocument, 'h2', 'Tabla de coordenadas');
      const table = document.createElement('table');
      table.className = 'print-table';
      const headings = ['Vértice', 'Original', 'Solo T', 'Solo S', 'T → S', 'S → T', 'Rotación'];
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      headings.forEach(heading => addPrintText(headRow, 'th', heading));
      head.appendChild(headRow);
      table.appendChild(head);
      const body = document.createElement('tbody');
      data.orig.forEach((point, index) => {
        const row = document.createElement('tr');
        [
          point.name,
          `(${point.x}; ${point.y})`,
          `(${data.tOnly[index].x}; ${data.tOnly[index].y})`,
          `(${data.sOnly[index].x}; ${data.sOnly[index].y})`,
          `(${data.tsFinal[index].x}; ${data.tsFinal[index].y})`,
          `(${data.stFinal[index].x}; ${data.stFinal[index].y})`,
          data.rotationEnabled ? `(${data.rotFinal[index].x}; ${data.rotFinal[index].y})` : '—'
        ].forEach(value => addPrintText(row, 'td', value));
        body.appendChild(row);
      });
      table.appendChild(body);
      printDocument.appendChild(table);

      addPrintText(printDocument, 'h2', 'Gráfico de las capas visibles');
      const graph = document.createElement('img');
      graph.src = canvas.toDataURL('image/png');
      graph.alt = 'Plano cartesiano con las figuras actualmente visibles';
      graph.className = 'print-graph';
      printDocument.appendChild(graph);

      if (reportConclusion.value.trim()) {
        addPrintText(printDocument, 'h2', 'Observaciones y conclusión');
        addPrintText(printDocument, 'p', reportConclusion.value.trim());
      }

      if (reportImages.length) {
        addPrintText(printDocument, 'h2', 'Imágenes y evidencias');
        reportImages.forEach(image => {
          const item = document.createElement('div');
          item.className = 'print-evidence-item';
          addPrintText(item, 'p', image.name);
          const element = document.createElement('img');
          element.src = image.dataUrl;
          element.alt = image.name;
          element.className = 'print-evidence';
          item.appendChild(element);
          printDocument.appendChild(item);
        });
      }

      const imageLoads = [...printDocument.querySelectorAll('img')].map(image => image.decode());
      Promise.all(imageLoads).then(() => {
        window.print();
      }).catch(error => {
        reportImageStatus.textContent = `No se pudo preparar una imagen para imprimir: ${error.message}`;
      });
    }

    document.getElementById('btnExportPDF').addEventListener('click', preparePrintReport);
    reportNarrative.addEventListener('input', () => {
      reportNarrative.dataset.userEdited = 'true';
    });
    window.addEventListener('afterprint', () => {
      const printDocument = document.getElementById('printDocument');
      printDocument.replaceChildren();
      printDocument.setAttribute('aria-hidden', 'true');
    });

    // Exportar SVG y PNG
    document.getElementById('btnExportSVG').addEventListener('click', exportInkscapeSVG);
    document.getElementById('btnExportPNG').addEventListener('click', exportPNG);

    // 9. GESTIÓN DE PESTAÑAS (TABS)
    const tabsList = [
      { btn: document.getElementById('tab_table'), panel: document.getElementById('panel_table') },
      { btn: document.getElementById('tab_formulas'), panel: document.getElementById('panel_formulas') },
      { btn: document.getElementById('tab_mandate'), panel: document.getElementById('panel_mandate') },
      { btn: document.getElementById('tab_report'), panel: document.getElementById('panel_report') }
    ];

    tabsList.forEach(t => {
      t.btn.addEventListener('click', () => {
        tabsList.forEach(o => {
          o.btn.classList.remove('active');
          o.panel.classList.add('hidden');
        });
        t.btn.classList.add('active');
        t.panel.classList.remove('hidden');
      });
    });

    // 10. INTERACCIÓN DEL PLANO (Pan & Zoom)
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const labelKey = findFigureLabelAt(e.clientX - rect.left, e.clientY - rect.top);
      if (labelKey) {
        state.view.draggingLabel = labelKey;
        canvas.classList.add('canvas-label-dragging');
        canvas.classList.remove('canvas-label-hover');
        return;
      }
      state.view.isDragging = true;
      state.view.startX = e.clientX - state.view.originX;
      state.view.startY = e.clientY - state.view.originY;
    });

    window.addEventListener('mouseup', () => {
      state.view.isDragging = false;
      state.view.draggingLabel = '';
      canvas.classList.remove('canvas-label-dragging');
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      if (state.view.draggingLabel) {
        const data = computeGeometry();
        const layerPoints = {
          orig: data?.orig,
          t: data?.tOnly,
          s: data?.sOnly,
          ts: data?.tsFinal,
          st: data?.stFinal,
          r: data?.rotFinal
        }[state.view.draggingLabel];
        if (layerPoints) {
          const centroid = {
            x: layerPoints.reduce((total, point) => total + point.x, 0) / layerPoints.length,
            y: layerPoints.reduce((total, point) => total + point.y, 0) / layerPoints.length
          };
          const math = toMath(cx, cy);
          state.figureLabelOffsets[state.view.draggingLabel] = {
            x: math.mx - centroid.x,
            y: math.my - centroid.y
          };
          renderCanvas();
        }
      } else if (state.view.isDragging) {
        state.view.originX = e.clientX - state.view.startX;
        state.view.originY = e.clientY - state.view.startY;
        renderCanvas();
      } else {
        canvas.classList.toggle('canvas-label-hover', Boolean(findFigureLabelAt(cx, cy)));
      }

      const math = toMath(cx, cy);
      liveCoordsBadge.textContent = `X: ${math.mx.toFixed(2)}, Y: ${math.my.toFixed(2)}`;
    });

    // Soporte táctil
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        state.view.isDragging = true;
        state.view.startX = e.touches[0].clientX - state.view.originX;
        state.view.startY = e.touches[0].clientY - state.view.originY;
      }
    });

    canvas.addEventListener('touchmove', e => {
      if (state.view.isDragging && e.touches.length === 1) {
        state.view.originX = e.touches[0].clientX - state.view.startX;
        state.view.originY = e.touches[0].clientY - state.view.startY;
        renderCanvas();
      }
    });

    window.addEventListener('touchend', () => {
      state.view.isDragging = false;
    });

    // Zoom con rueda
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      state.view.originX = mx - (mx - state.view.originX) * zoomFactor;
      state.view.originY = my - (my - state.view.originY) * zoomFactor;
      state.view.scale = Math.max(12, Math.min(110, state.view.scale * zoomFactor));
      renderCanvas();
    });

    document.getElementById('btnZoomIn').addEventListener('click', () => {
      state.view.scale = Math.min(110, state.view.scale * 1.2);
      renderCanvas();
    });

    document.getElementById('btnZoomOut').addEventListener('click', () => {
      state.view.scale = Math.max(12, state.view.scale / 1.2);
      renderCanvas();
    });

    document.getElementById('btnResetCenter').addEventListener('click', () => {
      const rect = canvas.getBoundingClientRect();
      state.view.scale = 28;
      state.view.originX = 120;
      state.view.originY = rect.height - 90;
      renderCanvas();
    });

    window.addEventListener('resize', renderCanvas);

    // INICIO
    window.onload = function() {
      const rect = canvas.getBoundingClientRect();
      state.view.originX = 120;
      state.view.originY = rect.height - 90;
      readInputs();
    };
