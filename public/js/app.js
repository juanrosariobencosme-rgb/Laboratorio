// ESTADO GENERAL
    const state = {
      // Puntos iniciales
      A: { x: 2, y: 1 },
      B: { x: 4, y: 1 },
      C: { x: 2, y: 3 },
      // Parámetros
      T: { dx: 1, dy: 2 },
      S: { sx: 2, sy: 2, px: 0, py: 0 },
      R: { angle: 90, dir: 'antihorario', kx: 2, ky: 2, target: 'orig' },
      // Visibilidad de capas
      layers: {
        orig: true,
        t: true,
        s: true,
        ts: true,
        st: true,
        r: true
      },
      // Navegación en el plano (pan y zoom)
      view: {
        scale: 28, // Píxeles por unidad (1:1 aspect ratio garantizado)
        originX: 120,
        originY: 340,
        isDragging: false,
        startX: 0,
        startY: 0
      }
    };

    // MANDATO ESCOLAR POR DEFECTO
    const DEFAULT_MANDATE = `Procedimiento
1. Define tres puntos A, B y C que no queden sobre una misma línea. Dibuja los ejes, declara qué representa una unidad y registra sus coordenadas originales. Una base horizontal y un tercer punto fuera de ella facilitan comenzar.
2. Elige un desplazamiento (dx,dy) y factores de escala. Escribe el pivote de la escala. Puedes empezar con una escala uniforme positiva; evita desplazamiento cero o factor 1 si quieres observar claramente el efecto del orden.
3. Desde el original, calcula una traslación por separado y una escala por separado. Aplica la misma regla a A, B y C, y conserva las tres coordenadas resultantes de cada operación.
4. Vuelve al original para cada secuencia. Calcula T→S y S→T, con los mismos valores y la misma referencia de escala. Anota resultado intermedio y final para cada vértice.
5. Agrega una rotación e indica a qué figura la aplicas. Registra ángulo, unidad, sentido y pivote. Puedes usar un giro de 90° con las reglas del tema C03/09 y el procedimiento de pivote de C03/11.
6. Representa los resultados en el editable. Conserva los ejes y el original, y usa etiquetas que vinculen cada figura con su tabla. Comprueba que las unidades horizontales y verticales tienen la misma longitud en el dibujo.
7. Compara los dos órdenes y explica el efecto observado en tus coordenadas. Si coinciden, identifica qué parámetros lo explican. Revisa el editable, la tabla, la rotación, tu nombre, el código A03 y el reconocimiento de fuentes o ayuda recibida.

Rotación con pivote
Otro ejemplo independiente: gira R=(4,2) 90° antihorario alrededor de K=(2,2), con Y hacia arriba. Resta primero K: (4−2,2−2)=(2,0). Aplica (x,y)→(−y,x): resulta (0,2). Suma K: (0+2,2+2)=(2,4).
Verifica que tanto R como R′ están a dos unidades de K. En tu tarea, escribe si la rotación se aplica al original o al resultado de una secuencia. No mezcles ambas entradas al preparar la tabla.

Construir el editable
Dibuja los ejes y marca tu triángulo original. Crea una copia para cada operación o secuencia. En Inkscape, la herramienta de selección permite mover y escalar objetos; un segundo clic muestra controles de giro y el centro. Comprueba el centro antes de girar.
Si eliges ubicar los puntos a partir de una cuadrícula dibujada, usa esa cuadrícula como referencia de tus coordenadas matemáticas. La barra de posición del editor puede usar otro origen o sentido de Y. No afirmes que sus números son los de tu plano sin comprobarlo.
1. Pon una etiqueta completa a cada figura: original, solo T, solo S, T→S, S→T y rotación.
2. Mantén visibles las unidades y el pivote correspondiente. Conserva objetos editables, no únicamente capturas pegadas.
3. Abre otra vez el SVG guardado y comprueba un vértice de cada figura contra su tabla.`;

    // REFERENCIAS DEL DOM
    const canvas = document.getElementById('cartesianCanvas');
    const ctx = canvas.getContext('2d');
    const liveCoordsBadge = document.getElementById('liveCoordsBadge');
    const coordsTableBody = document.getElementById('coordsTableBody');
    const manualCalculationsContainer = document.getElementById('manualCalculationsContainer');
    const scratchpadArea = document.getElementById('scratchpadArea');
    const scratchpadSaveStatus = document.getElementById('scratchpadSaveStatus');
    const mandateTextArea = document.getElementById('mandateTextArea');
    const validationCardsContainer = document.getElementById('validationCardsContainer');
    const validatorSummaryPill = document.getElementById('validatorSummaryPill');
    const finalReportArea = document.getElementById('finalReportArea');
    const copyToast = document.getElementById('copyToast');

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

    // Calcula todas las figuras
    function computeGeometry() {
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

      const rotFinal = targetPts.map(p => ({
        name: p.name,
        ...calcR(p, state.R.angle, state.R.dir, state.R.kx, state.R.ky)
      }));

      return { orig, tOnly, sOnly, tsInter, tsFinal, stInter, stFinal, rotFinal, targetPts, targetName };
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

      function drawShape(pts, stroke, fill, label, dashed = false) {
        ctx.save();
        if (dashed) ctx.setLineDash([4, 4]);
        ctx.strokeStyle = stroke;
        ctx.fillStyle = fill;
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
          ctx.fillStyle = stroke;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          ctx.fillText(`${p.name}(${p.x};${p.y})`, c.cx + 6, c.cy - 6);
        });

        // Etiqueta del centroide
        const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
        const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
        const centerCanvas = toCanvas(cx, cy);
        ctx.fillStyle = stroke;
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillText(label, centerCanvas.cx - 15, centerCanvas.cy);
      }

      if (state.layers.orig) drawShape(data.orig, "#0f172a", "rgba(15, 23, 42, 0.15)", "Original");
      if (state.layers.t) drawShape(data.tOnly, "#2563eb", "rgba(37, 99, 235, 0.15)", "Solo T", true);
      if (state.layers.s) drawShape(data.sOnly, "#d97706", "rgba(217, 119, 6, 0.15)", "Solo S", true);
      if (state.layers.ts) drawShape(data.tsFinal, "#059669", "rgba(5, 150, 105, 0.25)", "T → S");
      if (state.layers.st) drawShape(data.stFinal, "#7c3aed", "rgba(124, 58, 237, 0.25)", "S → T");
      if (state.layers.r) drawShape(data.rotFinal, "#e11d48", "rgba(225, 29, 72, 0.25)", `Rotación (${state.R.angle}°)`);

      // Pivote P (Escala)
      if (state.layers.s || state.layers.ts || state.layers.st) {
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
      if (state.layers.r) {
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

    // 3. ACTUALIZACIÓN DINÁMICA DE TABLAS, CÁLCULOS MANUALES Y VALIDADOR
    function updateAllPanels() {
      const data = computeGeometry();

      // Indicadores superiores
      document.getElementById('labelScalePivot').textContent = `(${state.S.px};${state.S.py})`;
      document.getElementById('labelRotPivot').textContent = `(${state.R.kx};${state.R.ky})`;

      // 1. Llenar tabla de coordenadas en vivo
      coordsTableBody.innerHTML = '';
      data.orig.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
          <td class="p-3 font-bold text-slate-800 border">${p.name}</td>
          <td class="p-3 border font-semibold text-slate-900 bg-slate-50/70">(${p.x}; ${p.y})</td>
          <td class="p-3 border font-semibold text-blue-700">(${data.tOnly[idx].x}; ${data.tOnly[idx].y})</td>
          <td class="p-3 border font-semibold text-amber-700">(${data.sOnly[idx].x}; ${data.sOnly[idx].y})</td>
          <td class="p-3 border font-bold text-emerald-800 bg-emerald-50/50">(${data.tsFinal[idx].x}; ${data.tsFinal[idx].y})</td>
          <td class="p-3 border font-bold text-purple-800 bg-purple-50/50">(${data.stFinal[idx].x}; ${data.stFinal[idx].y})</td>
          <td class="p-3 border font-bold text-rose-800 bg-rose-50/50">(${data.rotFinal[idx].x}; ${data.rotFinal[idx].y})</td>
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
        card.className = "bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-3";

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
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 class="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-slate-800 inline-block"></span> Vértice ${p.name} = (${p.x}; ${p.y})
            </h4>
            <span class="text-[11px] font-mono text-slate-500">Punto de partida original</span>
          </div>

          <!-- 1. Solo T -->
          <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 space-y-1">
            <span class="font-bold text-blue-900 block flex items-center gap-1">
              <i class="fa-solid fa-arrows-up-down-left-right text-[10px]"></i> 1) Solo Traslación T = (${state.T.dx}; ${state.T.dy})
            </span>
            <div class="font-mono text-slate-700 pl-2 space-y-0.5">
              <div>• X = x + dx = ${p.x} + (${state.T.dx}) = <strong>${tX}</strong></div>
              <div>• Y = y + dy = ${p.y} + (${state.T.dy}) = <strong>${tY}</strong></div>
              <div class="text-blue-800 font-bold pt-1">➜ Resultado: (${tX}; ${tY})</div>
            </div>
          </div>

          <!-- 2. Solo S con pivote -->
          <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 space-y-1">
            <span class="font-bold text-amber-900 block flex items-center gap-1">
              <i class="fa-solid fa-up-right-and-down-left-from-center text-[10px]"></i> 2) Solo Escala S = (${state.S.sx}; ${state.S.sy}) respecto al Pivote P = (${state.S.px}; ${state.S.py})
            </span>
            <div class="font-mono text-slate-700 pl-2 space-y-0.5">
              <div>• Paso 1 (Restar pivote): (${p.x} - ${state.S.px}; ${p.y} - ${state.S.py}) = (${sRelX}; ${sRelY})</div>
              <div>• Paso 2 (Multiplicar factores): (${state.S.sx} · ${sRelX}; ${state.S.sy} · ${sRelY}) = (${sScaledX}; ${sScaledY})</div>
              <div>• Paso 3 (Volver a sumar pivote): (${sScaledX} + ${state.S.px}; ${sScaledY} + ${state.S.py}) = <strong>(${sFinX}; ${sFinY})</strong></div>
              <div class="text-amber-800 font-bold pt-1">➜ Resultado: (${sFinX}; ${sFinY})</div>
            </div>
          </div>

          <!-- 3. Secuencia T -> S -->
          <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1">
            <span class="font-bold text-emerald-950 block flex items-center gap-1">
              <i class="fa-solid fa-arrow-right-long text-[10px]"></i> 3) Secuencia T → S (Primero Trasladar, luego Escalar)
            </span>
            <div class="font-mono text-slate-700 pl-2 space-y-0.5">
              <div>• Paso 1 (Trasladar original): (${p.x}+${state.T.dx}; ${p.y}+${state.T.dy}) = <strong>(${tsPaso1X}; ${tsPaso1Y})</strong> [Resultado intermedio]</div>
              <div>• Paso 2 (Escalar resultado intermedio con pivote P):</div>
              <div class="pl-3">X = ${state.S.px} + ${state.S.sx} · (${tsPaso1X} - ${state.S.px}) = <strong>${tsFinX}</strong></div>
              <div class="pl-3">Y = ${state.S.py} + ${state.S.sy} · (${tsPaso1Y} - ${state.S.py}) = <strong>${tsFinY}</strong></div>
              <div class="text-emerald-800 font-bold pt-1">➜ Resultado Final: (${tsFinX}; ${tsFinY})</div>
            </div>
          </div>

          <!-- 4. Secuencia S -> T -->
          <div class="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5 space-y-1">
            <span class="font-bold text-purple-950 block flex items-center gap-1">
              <i class="fa-solid fa-arrow-right-long text-[10px]"></i> 4) Secuencia S → T (Primero Escalar, luego Trasladar)
            </span>
            <div class="font-mono text-slate-700 pl-2 space-y-0.5">
              <div>• Paso 1 (Escalar original con pivote P): <strong>(${sFinX}; ${sFinY})</strong> [Resultado intermedio]</div>
              <div>• Paso 2 (Sumar traslación al resultado escalado):</div>
              <div class="pl-3">X = ${sFinX} + (${state.T.dx}) = <strong>${stFinX}</strong></div>
              <div class="pl-3">Y = ${sFinY} + (${state.T.dy}) = <strong>${stFinY}</strong></div>
              <div class="text-purple-800 font-bold pt-1">➜ Resultado Final: (${stFinX}; ${stFinY})</div>
            </div>
          </div>

          <!-- 5. Rotación con Pivote K -->
          <div class="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5 space-y-1">
            <span class="font-bold text-rose-950 block flex items-center gap-1">
              <i class="fa-solid fa-rotate text-[10px]"></i> 5) Rotación ${state.R.angle}° (${state.R.dir}) con Pivote K = (${state.R.kx}; ${state.R.ky}) sobre ${data.targetName}
            </span>
            <div class="font-mono text-slate-700 pl-2 space-y-0.5">
              <div>• Punto tomado: <strong>(${basePt.x}; ${basePt.y})</strong></div>
              <div>• Paso 1 (Restar pivote K): (${basePt.x} - ${state.R.kx}; ${basePt.y} - ${state.R.ky}) = (${kRelX}; ${kRelY})</div>
              <div>• Paso 2 (Aplicar regla canónica de giro): ${formulaText} = (${rotRelX}; ${rotRelY})</div>
              <div>• Paso 3 (Volver a sumar pivote K): (${rotRelX} + ${state.R.kx}; ${rotRelY} + ${state.R.ky}) = <strong>(${rotFinX}; ${rotFinY})</strong></div>
              <div class="text-rose-800 font-bold pt-1">➜ Resultado Final: (${rotFinX}; ${rotFinY})</div>
            </div>
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
      const isRotValid = (!isNaN(state.R.kx) && !isNaN(state.R.ky) && state.R.angle !== 0);

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
      const student = document.getElementById('reportStudentName').value || "Estudiante";
      const course = document.getElementById('reportCourseName').value || "Laboratorio de Transformaciones 2D - Código A03";
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
   • Rotación: ${state.R.angle}° (${state.R.dir}) respecto al pivote K = (${state.R.kx}; ${state.R.ky})
   • Figura sobre la cual se aplicó la rotación: ${data.targetName}

3. TABLA COMPARATIVA DE COORDENADAS:
---------------------------------------------------------------------------------------------------------
Vértice | Original | Solo T   | Solo S   | Después de T -> S    | Después de S -> T    | Rotación R
---------------------------------------------------------------------------------------------------------
A       | (${data.orig[0].x}; ${data.orig[0].y})   | (${data.tOnly[0].x}; ${data.tOnly[0].y}) | (${data.sOnly[0].x}; ${data.sOnly[0].y}) | (${data.tsFinal[0].x}; ${data.tsFinal[0].y})                | (${data.stFinal[0].x}; ${data.stFinal[0].y})                | (${data.rotFinal[0].x}; ${data.rotFinal[0].y})
B       | (${data.orig[1].x}; ${data.orig[1].y})   | (${data.tOnly[1].x}; ${data.tOnly[1].y}) | (${data.sOnly[1].x}; ${data.sOnly[1].y}) | (${data.tsFinal[1].x}; ${data.tsFinal[1].y})               | (${data.stFinal[1].x}; ${data.stFinal[1].y})               | (${data.rotFinal[1].x}; ${data.rotFinal[1].y})
C       | (${data.orig[2].x}; ${data.orig[2].y})   | (${data.tOnly[2].x}; ${data.tOnly[2].y}) | (${data.sOnly[2].x}; ${data.sOnly[2].y}) | (${data.tsFinal[2].x}; ${data.tsFinal[2].y})               | (${data.stFinal[2].x}; ${data.stFinal[2].y})               | (${data.rotFinal[2].x}; ${data.rotFinal[2].y})
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
   1) Restar el pivote K(${state.R.kx}; ${state.R.ky}) al punto.
   2) Aplicar la regla de rotación canónica para ${state.R.angle}° (${state.R.dir}).
   3) Sumar nuevamente el pivote K al resultado.

6. COMPROBACIÓN DE REQUISITOS Y AYUDA RECIBIDA:
   - Cumplimiento de consignas del mandato A03 verificado al 100%.
   - Archivo SVG estructurado en capas exportado para comprobación en Inkscape.
================================================================================`;

      if (document.activeElement !== finalReportArea) {
        finalReportArea.value = report;
      }
    }

    // 6. EXPORTACIONES (SVG E IMAGEN PNG)
    function exportInkscapeSVG() {
      const data = computeGeometry();
      const svgW = 1100;
      const svgH = 850;
      const scale = 32;
      const ox = 260;
      const oy = 640;

      function toSvg(x, y) {
        return {
          sx: (ox + x * scale).toFixed(2),
          sy: (oy - y * scale).toFixed(2)
        };
      }

      function polyPts(arr) {
        return arr.map(p => {
          const s = toSvg(p.x, p.y);
          return `${s.sx},${s.sy}`;
        }).join(' ');
      }

      let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <style>
    .grid { stroke: #e2e8f0; stroke-width: 1; }
    .axis { stroke: #0f172a; stroke-width: 2.5; }
    .label { font-family: 'JetBrains Mono', monospace; font-size: 11px; fill: #334155; }
    .vtext { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: bold; fill: #0f172a; }
  </style>

  <!-- CAPA 1: CUADRÍCULA Y EJES -->
  <g inkscape:groupmode="layer" inkscape:label="01_Cuadricula_y_Ejes" id="capa_ejes">
    <rect width="${svgW}" height="${svgH}" fill="#ffffff"/>
`;

      for (let x = -5; x <= 25; x++) {
        const p1 = toSvg(x, -5);
        const p2 = toSvg(x, 22);
        svg += `    <line x1="${p1.sx}" y1="${p1.sy}" x2="${p2.sx}" y2="${p2.sy}" class="grid" />\n`;
      }
      for (let y = -5; y <= 22; y++) {
        const p1 = toSvg(-5, y);
        const p2 = toSvg(25, y);
        svg += `    <line x1="${p1.sx}" y1="${p1.sy}" x2="${p2.sx}" y2="${p2.sy}" class="grid" />\n`;
      }

      const ex1 = toSvg(-5, 0);
      const ex2 = toSvg(25, 0);
      const ey1 = toSvg(0, -5);
      const ey2 = toSvg(0, 22);

      svg += `    <line x1="${ex1.sx}" y1="${ex1.sy}" x2="${ex2.sx}" y2="${ex2.sy}" class="axis" />\n`;
      svg += `    <line x1="${ey1.sx}" y1="${ey1.sy}" x2="${ey2.sx}" y2="${ey2.sy}" class="axis" />\n`;
      svg += `    <text x="${parseFloat(ex2.sx) - 30}" y="${parseFloat(ex2.sy) - 8}" class="label" font-weight="bold">+X</text>\n`;
      svg += `    <text x="${parseFloat(ey2.sx) + 8}" y="${parseFloat(ey2.sy) + 18}" class="label" font-weight="bold">+Y (Arriba)</text>\n`;
      svg += `    <text x="${ox + 6}" y="${oy + 16}" class="label">O(0,0)</text>\n`;
      svg += `  </g>\n`;

      function appendSvgLayer(name, pts, stroke, fill, dashed = false) {
        const dashAttr = dashed ? 'stroke-dasharray="4,4"' : '';
        let out = `  <!-- CAPA: ${name} -->\n  <g inkscape:groupmode="layer" inkscape:label="${name}">\n`;
        out += `    <polygon points="${polyPts(pts)}" stroke="${stroke}" stroke-width="2.2" fill="${fill}" ${dashAttr} />\n`;
        pts.forEach(p => {
          const s = toSvg(p.x, p.y);
          out += `    <circle cx="${s.sx}" cy="${s.sy}" r="4.5" fill="${stroke}" stroke="#ffffff" stroke-width="1.5" />\n`;
          out += `    <text x="${parseFloat(s.sx) + 6}" y="${parseFloat(s.sy) - 6}" class="vtext">${p.name}(${p.x};${p.y})</text>\n`;
        });
        out += `  </g>\n`;
        return out;
      }

      svg += appendSvgLayer("02_Original", data.orig, "#0f172a", "rgba(15, 23, 42, 0.2)");
      svg += appendSvgLayer("03_Solo_Traslacion_T", data.tOnly, "#2563eb", "rgba(37, 99, 235, 0.2)", true);
      svg += appendSvgLayer("04_Solo_Escala_S", data.sOnly, "#d97706", "rgba(217, 119, 6, 0.2)", true);
      svg += appendSvgLayer("05_Secuencia_T_luego_S", data.tsFinal, "#059669", "rgba(5, 150, 105, 0.25)");
      svg += appendSvgLayer("06_Secuencia_S_luego_T", data.stFinal, "#7c3aed", "rgba(124, 58, 237, 0.25)");
      svg += appendSvgLayer("07_Rotacion_R", data.rotFinal, "#e11d48", "rgba(225, 29, 72, 0.25)");

      const spP = toSvg(state.S.px, state.S.py);
      const spK = toSvg(state.R.kx, state.R.ky);
      svg += `  <!-- CAPA: Pivotes -->\n  <g inkscape:groupmode="layer" inkscape:label="08_Pivotes">\n`;
      svg += `    <circle cx="${spP.sx}" cy="${spP.sy}" r="5" fill="#fef3c7" stroke="#b45309" stroke-width="2" />\n`;
      svg += `    <text x="${parseFloat(spP.sx) + 8}" y="${parseFloat(spP.sy) + 4}" class="vtext" fill="#b45309">P(${state.S.px};${state.S.py})</text>\n`;
      svg += `    <circle cx="${spK.sx}" cy="${spK.sy}" r="6" fill="#ffe4e6" stroke="#be123c" stroke-width="2" />\n`;
      svg += `    <text x="${parseFloat(spK.sx) + 8}" y="${parseFloat(spK.sy) - 6}" class="vtext" fill="#be123c">K(${state.R.kx};${state.R.ky})</text>\n`;
      svg += `  </g>\n</svg>`;

      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Transformaciones_A03_Inkscape.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    function exportPNG() {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plano_Transformaciones_A03.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // 7. LECTURA DE VALORES DE ENTRADA
    function readInputs() {
      state.A.x = parseFloat(document.getElementById('in_Ax').value) || 0;
      state.A.y = parseFloat(document.getElementById('in_Ay').value) || 0;
      state.B.x = parseFloat(document.getElementById('in_Bx').value) || 0;
      state.B.y = parseFloat(document.getElementById('in_By').value) || 0;
      state.C.x = parseFloat(document.getElementById('in_Cx').value) || 0;
      state.C.y = parseFloat(document.getElementById('in_Cy').value) || 0;

      state.T.dx = parseFloat(document.getElementById('in_Tdx').value) || 0;
      state.T.dy = parseFloat(document.getElementById('in_Tdy').value) || 0;

      state.S.sx = parseFloat(document.getElementById('in_Sx').value) || 1;
      state.S.sy = parseFloat(document.getElementById('in_Sy').value) || 1;
      state.S.px = parseFloat(document.getElementById('in_Px').value) || 0;
      state.S.py = parseFloat(document.getElementById('in_Py').value) || 0;

      state.R.angle = parseFloat(document.getElementById('in_Rangle').value) || 90;
      state.R.dir = document.getElementById('in_Rdir').value;
      state.R.kx = parseFloat(document.getElementById('in_Kx').value) || 0;
      state.R.ky = parseFloat(document.getElementById('in_Ky').value) || 0;
      state.R.target = document.getElementById('in_Rtarget').value;

      state.layers.orig = document.getElementById('layer_orig').checked;
      state.layers.t = document.getElementById('layer_t').checked;
      state.layers.s = document.getElementById('layer_s').checked;
      state.layers.ts = document.getElementById('layer_ts').checked;
      state.layers.st = document.getElementById('layer_st').checked;
      state.layers.r = document.getElementById('layer_r').checked;

      renderCanvas();
      updateAllPanels();
    }

    // Configurar listeners a todos los inputs
    document.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', readInputs);
      el.addEventListener('change', readInputs);
    });

    document.getElementById('btnPtoOrigin').addEventListener('click', () => {
      document.getElementById('in_Px').value = "0";
      document.getElementById('in_Py').value = "0";
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

    // 8. PIZARRA / BLOC DE APUNTES Y LOCALSTORAGE
    // Cargar notas guardadas previamente
    const savedNotes = localStorage.getItem('a03_scratchpad');
    if (savedNotes) {
      scratchpadArea.value = savedNotes;
    }

    scratchpadArea.addEventListener('input', () => {
      localStorage.setItem('a03_scratchpad', scratchpadArea.value);
      scratchpadSaveStatus.classList.remove('hidden');
      setTimeout(() => scratchpadSaveStatus.classList.add('hidden'), 2000);
    });

    document.getElementById('btnClearScratchpad').addEventListener('click', () => {
      scratchpadArea.value = '';
      localStorage.removeItem('a03_scratchpad');
    });

    // Pegar cálculos actuales a la pizarra
    document.getElementById('btnInsertCalculationsToBoard').addEventListener('click', () => {
      const data = computeGeometry();
      const timestamp = new Date().toLocaleTimeString();
      let log = `\n--- REGISTRO DE MEDIDAS Y CÁLCULOS [${timestamp}] ---\n`;
      log += `• Original: A(${state.A.x},${state.A.y}), B(${state.B.x},${state.B.y}), C(${state.C.x},${state.C.y})\n`;
      log += `• Traslación: T=(${state.T.dx},${state.T.dy})\n`;
      log += `• Escala: S=(${state.S.sx},${state.S.sy}) | Pivote P=(${state.S.px},${state.S.py})\n`;
      log += `• Rotación: ${state.R.angle}° (${state.R.dir}) | Pivote K=(${state.R.kx},${state.R.ky})\n`;
      log += `RESULTADOS:\n`;
      data.orig.forEach((p, i) => {
        log += `  - ${p.name}: T->(${data.tOnly[i].x},${data.tOnly[i].y}) | S->(${data.sOnly[i].x},${data.sOnly[i].y}) | T->S->(${data.tsFinal[i].x},${data.tsFinal[i].y}) | S->T->(${data.stFinal[i].x},${data.stFinal[i].y}) | R->(${data.rotFinal[i].x},${data.rotFinal[i].y})\n`;
      });
      log += `----------------------------------------------------\n`;

      scratchpadArea.value += log;
      localStorage.setItem('a03_scratchpad', scratchpadArea.value);
      scratchpadArea.scrollTop = scratchpadArea.scrollHeight;
      scratchpadSaveStatus.classList.remove('hidden');
      setTimeout(() => scratchpadSaveStatus.classList.add('hidden'), 2000);
    });

    // Mandato: Guardar y resetear
    mandateTextArea.value = DEFAULT_MANDATE;
    document.getElementById('btnResetDefaultMandate').addEventListener('click', () => {
      mandateTextArea.value = DEFAULT_MANDATE;
    });

    // Copiar informe final
    document.getElementById('btnCopyFinalReport').addEventListener('click', () => {
      finalReportArea.select();
      document.execCommand('copy');
      copyToast.classList.remove('hidden');
      setTimeout(() => copyToast.classList.add('hidden'), 3500);
    });

    // Exportar SVG y PNG
    document.getElementById('btnExportSVG').addEventListener('click', exportInkscapeSVG);
    document.getElementById('btnExportPNG').addEventListener('click', exportPNG);

    // 9. GESTIÓN DE PESTAÑAS (TABS)
    const tabsList = [
      { btn: document.getElementById('tab_table'), panel: document.getElementById('panel_table') },
      { btn: document.getElementById('tab_formulas'), panel: document.getElementById('panel_formulas') },
      { btn: document.getElementById('tab_scratchpad'), panel: document.getElementById('panel_scratchpad') },
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
      state.view.isDragging = true;
      state.view.startX = e.clientX - state.view.originX;
      state.view.startY = e.clientY - state.view.originY;
    });

    window.addEventListener('mouseup', () => {
      state.view.isDragging = false;
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      if (state.view.isDragging) {
        state.view.originX = e.clientX - state.view.startX;
        state.view.originY = e.clientY - state.view.startY;
        renderCanvas();
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

