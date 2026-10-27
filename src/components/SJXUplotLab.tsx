import { Component, createEffect, createMemo, createSignal, For, JSX, on, onCleanup, Show, untrack } from "solid-js";
import uPlot from "uplot";
import { SolidUplot, createPluginBus } from "@dschz/solid-uplot";
import { cursor, focusSeries, legend, tooltip } from "@dschz/solid-uplot/plugins";
import type { CursorPluginMessageBus, FocusSeriesPluginMessageBus, LegendProps, TooltipProps } from "@dschz/solid-uplot/plugins";
import "./SJXUplotLab.css";

type ChartType = "line" | "spline" | "step" | "area" | "bars" | "points";
type Placement = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const MAX_SERIES = 3;
const NAMES = ["CPU", "Memori", "Jaringan"];
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Data awal: random walk per series, x = detik epoch (skala waktu uPlot). */
const generate = (n: number, vol: number): uPlot.AlignedData => {
  const now = Math.floor(Date.now() / 1000);
  const xs = Array.from({ length: n }, (_, i) => now - (n - 1 - i));
  const ys = Array.from({ length: MAX_SERIES }, (_, s) => {
    let v = 40 + s * 15;
    return xs.map(() => (v = Math.max(0, v + (Math.random() - 0.5) * vol)));
  });
  return [xs, ...ys];
};

/** Tambah satu titik di ujung kanan, buang yang paling lama bila melewati jendela. */
const advance = (d: uPlot.AlignedData, n: number, vol: number, dt: number): uPlot.AlignedData => {
  const xs = d[0] as number[];
  const ys = (d.slice(1) as number[][]).map(a => [...a, Math.max(0, a[a.length - 1] + (Math.random() - 0.5) * vol)].slice(-n));
  return [[...xs, xs[xs.length - 1] + dt].slice(-n), ...ys];
};

/* ---- easing & util animasi ---- */
const EASING = {
  linear: (t: number) => t,
  "ease-out": (t: number) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  bounce: (t: number) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};
type EasingName = keyof typeof EASING;
const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

/* ---- kontrol kecil ---- */
const Row = (p: { label: string; children: JSX.Element }) => <label class="ul-row"><span>{p.label}</span>{p.children}</label>;
const Num = (p: { label: string; value: number; min: number; max: number; step?: number; onInput: (v: number) => void }) => (
  <Row label={`${p.label}: ${p.value}`}>
    <input type="range" min={p.min} max={p.max} step={p.step ?? 1} value={p.value} onInput={e => p.onInput(+e.currentTarget.value)} />
  </Row>
);
const Check = (p: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label class="ul-check"><input type="checkbox" checked={p.checked} onChange={e => p.onChange(e.currentTarget.checked)} />{p.label}</label>
);
const Text = (p: { label: string; value: string; onInput: (v: string) => void }) => (
  <Row label={p.label}><input type="text" value={p.value} onInput={e => p.onInput(e.currentTarget.value)} /></Row>
);

export default function SJXUplotLab() {
  /* tipe & gaya */
  const [type, setType] = createSignal<ChartType>("line");
  const [count, setCount] = createSignal(2);
  const [lineWidth, setLineWidth] = createSignal(2);
  const [barWidth, setBarWidth] = createSignal(0.6);
  const [barRadius, setBarRadius] = createSignal(0.2);
  const [fillAlpha, setFillAlpha] = createSignal(0.25);
  const [pointSize, setPointSize] = createSignal(6);
  const [showPoints, setShowPoints] = createSignal(false);
  const [colors, setColors] = createSignal(["#4f46e5", "#0ea5e9", "#f59e0b"]);
  const [grid, setGrid] = createSignal(true);
  /* data */
  const [windowSize, setWindowSize] = createSignal(60);
  const [volatility, setVolatility] = createSignal(10);
  const [live, setLive] = createSignal(true);
  const [interval, setIntervalMs] = createSignal(500);
  const [autoScale, setAutoScale] = createSignal(true);
  const [raw, setRaw] = createSignal(generate(60, 10));
  /* label & tooltip */
  const [xLabel, setXLabel] = createSignal("Waktu");
  const [yLabel, setYLabel] = createSignal("Penggunaan");
  const [prefix, setPrefix] = createSignal("");
  const [suffix, setSuffix] = createSignal("%");
  const [decimals, setDecimals] = createSignal(1);
  const [tipOn, setTipOn] = createSignal(true);
  const [tipPlacement, setTipPlacement] = createSignal<Placement>("top-right");
  const [tipTitle, setTipTitle] = createSignal("Titik");
  const [tipDelta, setTipDelta] = createSignal(true);
  const [legendOn, setLegendOn] = createSignal(true);
  const [legendPlacement, setLegendPlacement] = createSignal<"top-left" | "top-right">("top-left");
  /* animasi (uPlot tidak punya animasi bawaan: kita men-tween data lewat requestAnimationFrame) */
  const [animGrow, setAnimGrow] = createSignal(true);
  const [animSmooth, setAnimSmooth] = createSignal(true);
  const [animScroll, setAnimScroll] = createSignal(true);
  const [animMs, setAnimMs] = createSignal(450);
  const [easing, setEasing] = createSignal<EasingName>("ease-out");
  /* event */
  const [events, setEvents] = createSignal<string[]>([]);
  const [hover, setHover] = createSignal("—");
  let chart: uPlot | undefined;
  let raf = 0;
  let animBusy = false;                 // true selama tween berjalan (data ditulis langsung ke instance uPlot)
  let yFix: [number, number] | undefined; // skala Y dikunci selama grow-in agar tinggi bar benar-benar tumbuh
  let tickFlag = false;                 // pembaruan data berasal dari tick live (bukan ganti tipe / regenerasi)
  const log = (msg: string) => setEvents(l => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 12));

  const fmt = (v: number | null | undefined) => (v == null ? "—" : `${prefix()}${v.toFixed(decimals())}${suffix()}`);

  /* data: jendela berubah -> bangkitkan ulang; live -> geser terus */
  createEffect(on(windowSize, n => setRaw(generate(n, volatility())), { defer: true }));
  createEffect(() => {
    if (!live()) return;
    const ms = interval();
    const id = setInterval(() => { tickFlag = true; setRaw(d => advance(d, windowSize(), volatility(), ms / 1000)); }, ms);
    onCleanup(() => clearInterval(id));
  });
  const data = createMemo(() => raw().slice(0, 1 + count()) as uPlot.AlignedData);

  /* ---- animasi ---- */
  const stopAnim = () => { cancelAnimationFrame(raf); animBusy = false; yFix = undefined; };
  onCleanup(stopAnim);
  const run = (frame: (e: number) => void, done: () => void) => {
    cancelAnimationFrame(raf);
    const ease = EASING[easing()], t0 = performance.now(), ms = Math.max(50, animMs());
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      frame(ease(t));
      if (t < 1) raf = requestAnimationFrame(step); else done();
    };
    raf = requestAnimationFrame(step);
  };
  /** Tulis frame langsung ke chart. setData(…, false) tidak menggambar ulang, jadi redraw() dipanggil manual. */
  const paint = (u: uPlot, d: uPlot.AlignedData) => { u.setData(d, false); u.redraw(); };

  /** Grow-in: nilai Y dikalikan 0→1 dengan skala Y dikunci ke rentang akhir. */
  const grow = (u: uPlot) => {
    if (!animGrow()) return;
    const target = data();
    const ys = target.slice(1) as number[][];
    const vals = ys.flat().filter(v => v != null);
    if (!vals.length) return;
    const lo = Math.min(0, ...vals), hi = Math.max(...vals);
    yFix = [lo, hi + (hi - lo) * 0.15];
    animBusy = true;
    run(
      e => paint(u, [target[0], ...ys.map(a => a.map(v => (v == null ? v : v * e)))] as uPlot.AlignedData),
      () => { yFix = undefined; animBusy = false; paint(u, data()); setShown(data()); },
    );
  };

  /** Data yang ditampilkan SolidUplot. Selama tween, nilainya sengaja ditahan agar tidak menimpa frame. */
  const [shown, setShown] = createSignal<uPlot.AlignedData>(untrack(data));
  createEffect(on(data, (next, prev) => {
    const u = chart, isTick = tickFlag;
    tickFlag = false;
    if (!u || !prev || !isTick || !autoScale() || !(animSmooth() || animScroll())) {
      if (!animBusy || !isTick) { stopAnim(); setShown(next); }
      return;
    }
    // Tick live: titik terakhir "tumbuh" dari titik sebelumnya; jendela X bisa ikut bergeser mulus.
    const px = prev[0] as number[], nx = next[0] as number[], n = px.length;
    if (n < 2 || nx.length !== n || prev.length !== next.length) { stopAnim(); setShown(next); return; }
    const py = prev.slice(1) as number[][], ny = next.slice(1) as number[][];
    const scroll = animScroll();
    animBusy = true;
    run(
      e => {
        const x = lerp(px[n - 1], nx[n - 1], e);
        paint(u, [[...px, x], ...py.map((a, i) => [...a, lerp(a[n - 1], ny[i][n - 1], e)])] as uPlot.AlignedData);
        u.setScale("x", { min: scroll ? lerp(px[0], nx[0], e) : px[0], max: x });
      },
      () => { animBusy = false; setShown(next); },
    );
  }, { defer: true }));

  /* konfigurasi series (perubahan di sini membuat ulang chart) */
  const series = createMemo<uPlot.Series[]>(() => {
    const t = type();
    const paths =
      t === "bars" ? uPlot.paths.bars!({ size: [barWidth(), 120], radius: barRadius() })
      : t === "spline" ? uPlot.paths.spline!()
      : t === "step" ? uPlot.paths.stepped!({ align: 1 })
      : t === "points" ? (() => null)
      : uPlot.paths.linear!();
    return [
      { label: xLabel() },
      ...colors().slice(0, count()).map((c, i): uPlot.Series => ({
        label: NAMES[i],
        stroke: c,
        width: t === "points" ? 0 : lineWidth(),
        fill: t === "area" || t === "bars" ? rgba(c, t === "bars" ? Math.max(fillAlpha(), 0.4) : fillAlpha()) : undefined,
        paths,
        points: { show: showPoints() || t === "points", size: pointSize(), fill: c, stroke: c },
        value: (_u, v) => fmt(v),
      })),
    ];
  });

  const axes = createMemo<uPlot.Axis[]>(() => [
    { label: xLabel(), grid: { show: grid() }, stroke: "#64748b" },
    { label: yLabel(), size: 70, grid: { show: grid() }, stroke: "#64748b", values: (_u, v) => v.map(x => fmt(x)) },
  ]);

  /* tooltip & legend ditulis dengan JSX Solid; membaca sinyal kontrol sehingga ikut berubah tanpa membuat ulang chart */
  const Tip: Component<TooltipProps> = p => (
    <div class="ul-tip">
      <div class="ul-tip-title">{tipTitle()} #{p.cursor.idx} · {new Date(p.cursor.xValue * 1000).toLocaleTimeString()}</div>
      <For each={p.seriesData}>{s => {
        const v = () => p.u.data[s.seriesIdx]?.[p.cursor.idx] as number | null | undefined;
        const d = () => { const i = p.cursor.idx, a = p.u.data[s.seriesIdx] as number[]; return i > 0 && a[i] != null && a[i - 1] != null ? a[i] - a[i - 1] : null; };
        return (
          <Show when={s.visible}>
            <div class="ul-tip-row">
              <i style={{ background: String(s.stroke) }} />
              <span>{s.label}</span>
              <b>{fmt(v())}</b>
              <Show when={tipDelta() && d() != null}><em classList={{ up: d()! >= 0, down: d()! < 0 }}>{d()! >= 0 ? "▲" : "▼"} {Math.abs(d()!).toFixed(decimals())}</em></Show>
            </div>
          </Show>
        );
      }}</For>
    </div>
  );

  const Leg: Component<LegendProps> = p => (
    <div class="ul-legend">
      <For each={p.seriesData}>{s => (
        <button classList={{ off: !s.visible }} onClick={() => p.u.setSeries(s.seriesIdx, { show: !s.visible })}>
          <i style={{ background: String(s.stroke) }} />{s.label}
        </button>
      )}</For>
    </div>
  );

  const scales: uPlot.Scales = {
    x: { time: true },
    y: { range: (_u, min, max) => yFix ?? uPlot.rangeNum(min, max, 0.1, true) },
  };

  const bus = createPluginBus<CursorPluginMessageBus & FocusSeriesPluginMessageBus>();

  /* plugin uPlot biasa: hook native sebagai "chart event handlers" */
  const eventsPlugin: uPlot.Plugin = {
    hooks: {
      ready: u => {
        u.over.addEventListener("click", () => {
          const i = u.cursor.idx;
          if (i != null) log(`click · idx=${i} · ${(u.data.slice(1) as number[][]).map(a => fmt(a[i])).join(" / ")}`);
        });
      },
      // setData(…, false) (resetScales=false) tidak menggambar ulang; saat auto-skala mati kita gambar sendiri.
      setData: u => { if (!autoScale() && !animBusy) queueMicrotask(() => u.redraw()); },
      setSelect: u => { if (u.select.width > 0) log(`select (drag-zoom) · ${Math.round(u.select.width)}px lebar`); },
      setSeries: (_u, idx, opts) => { if (idx != null && opts && "show" in opts) log(`series ${NAMES[idx - 1]} ${opts.show ? "ditampilkan" : "disembunyikan"}`); },
    },
  };

  const plugins = createMemo(() => [
    cursor(),
    focusSeries({ pxThreshold: 20 }),
    ...(tipOn() ? [tooltip(Tip, { placement: tipPlacement() })] : []),
    ...(legendOn() ? [legend(Leg, { placement: legendPlacement() })] : []),
    eventsPlugin,
  ]);

  const setColor = (i: number, c: string) => setColors(l => l.map((x, j) => (j === i ? c : x)));

  return (
    <div class="ul-lab">
      <aside class="ul-panel">
        <fieldset><legend>Tipe & gaya</legend>
          <Row label="Tipe chart">
            <select value={type()} onChange={e => setType(e.currentTarget.value as ChartType)}>
              <option value="line">Line</option><option value="spline">Spline</option><option value="step">Step</option>
              <option value="area">Area</option><option value="bars">Bars</option><option value="points">Points (scatter)</option>
            </select>
          </Row>
          <Num label="Jumlah series" value={count()} min={1} max={MAX_SERIES} onInput={setCount} />
          <Show when={type() !== "bars" && type() !== "points"}><Num label="Tebal garis" value={lineWidth()} min={1} max={10} onInput={setLineWidth} /></Show>
          <Show when={type() === "bars"}>
            <Num label="Lebar bar" value={barWidth()} min={0.1} max={1} step={0.05} onInput={setBarWidth} />
            <Num label="Radius bar" value={barRadius()} min={0} max={0.5} step={0.05} onInput={setBarRadius} />
          </Show>
          <Show when={type() === "area"}><Num label="Opasitas isi" value={fillAlpha()} min={0} max={1} step={0.05} onInput={setFillAlpha} /></Show>
          <Show when={type() !== "bars"}><Check label="Tampilkan titik" checked={showPoints()} onChange={setShowPoints} /></Show>
          <Show when={showPoints() || type() === "points"}><Num label="Ukuran titik" value={pointSize()} min={2} max={16} onInput={setPointSize} /></Show>
          <div class="ul-colors"><For each={colors().slice(0, count())}>{(c, i) => (
            <label>{NAMES[i()]}<input type="color" value={c} onInput={e => setColor(i(), e.currentTarget.value)} /></label>
          )}</For></div>
          <Check label="Garis grid" checked={grid()} onChange={setGrid} />
        </fieldset>

        <fieldset><legend>Data & simulasi live</legend>
          <Check label="Live data" checked={live()} onChange={setLive} />
          <Num label="Interval (ms)" value={interval()} min={100} max={2000} step={100} onInput={setIntervalMs} />
          <Num label="Jumlah titik (jendela)" value={windowSize()} min={10} max={300} step={10} onInput={setWindowSize} />
          <Num label="Volatilitas" value={volatility()} min={1} max={40} onInput={setVolatility} />
          <Check label="Auto-skala saat data berubah" checked={autoScale()} onChange={setAutoScale} />
          <button class="ul-btn" onClick={() => setRaw(generate(windowSize(), volatility()))}>Bangkitkan ulang data</button>
        </fieldset>

        <fieldset><legend>Animasi (tween manual)</legend>
          <Check label="Grow-in saat chart dibuat" checked={animGrow()} onChange={setAnimGrow} />
          <Check label="Titik live tumbuh mulus" checked={animSmooth()} onChange={setAnimSmooth} />
          <Check label="Jendela X bergeser mulus" checked={animScroll()} onChange={setAnimScroll} />
          <Num label="Durasi (ms)" value={animMs()} min={100} max={1500} step={50} onInput={setAnimMs} />
          <Row label="Easing">
            <select value={easing()} onChange={e => setEasing(e.currentTarget.value as EasingName)}>
              <For each={Object.keys(EASING)}>{k => <option>{k}</option>}</For>
            </select>
          </Row>
          <button class="ul-btn" onClick={() => chart && grow(chart)}>Putar ulang grow-in</button>
          <div class="ul-hint">Durasi di atas interval live membuat animasi saling memotong (lompat). Animasi tick & geser hanya aktif saat auto-skala menyala.</div>
        </fieldset>

        <fieldset><legend>Label & tooltip (JSX Solid)</legend>
          <Text label="Label sumbu X" value={xLabel()} onInput={setXLabel} />
          <Text label="Label sumbu Y" value={yLabel()} onInput={setYLabel} />
          <Text label="Prefix nilai" value={prefix()} onInput={setPrefix} />
          <Text label="Suffix nilai" value={suffix()} onInput={setSuffix} />
          <Num label="Desimal" value={decimals()} min={0} max={4} onInput={setDecimals} />
          <Check label="Tooltip" checked={tipOn()} onChange={setTipOn} />
          <Show when={tipOn()}>
            <Row label="Posisi tooltip">
              <select value={tipPlacement()} onChange={e => setTipPlacement(e.currentTarget.value as Placement)}>
                <option>top-right</option><option>top-left</option><option>bottom-right</option><option>bottom-left</option>
              </select>
            </Row>
            <Text label="Judul tooltip" value={tipTitle()} onInput={setTipTitle} />
            <Check label="Tampilkan selisih ▲▼" checked={tipDelta()} onChange={setTipDelta} />
          </Show>
          <Check label="Legend (klik = tampil/sembunyi)" checked={legendOn()} onChange={setLegendOn} />
          <Show when={legendOn()}>
            <Row label="Posisi legend">
              <select value={legendPlacement()} onChange={e => setLegendPlacement(e.currentTarget.value as "top-left" | "top-right")}>
                <option>top-left</option><option>top-right</option>
              </select>
            </Row>
          </Show>
        </fieldset>
      </aside>

      <section class="ul-main">
        <div class="ul-chart">
          <SolidUplot
            autoResize
            data={shown()}
            series={series()}
            axes={axes()}
            scales={scales}
            plugins={plugins()}
            pluginBus={bus}
            resetScales={autoScale()}
            onCreate={u => { chart = u; log("onCreate · chart dibuat"); untrack(() => grow(u)); }}
            onCursorMove={({ cursor: c, seriesData }) => setHover(`idx ${c.idx} · ` + seriesData.map(s => `${s.label}: ${fmt(chart?.data[s.seriesIdx]?.[c.idx] as number)}`).join(" · "))}
          />
        </div>
        <div class="ul-status"><b>onCursorMove</b> {hover()}</div>
        <div class="ul-actions">
          <button class="ul-btn" onClick={() => { chart?.setScale("x", { min: chart.data[0][0]!, max: chart.data[0][chart.data[0].length - 1]! }); log("reset zoom (setScale)"); }}>Reset zoom</button>
          <button class="ul-btn" onClick={() => setEvents([])}>Kosongkan log</button>
          <span class="ul-hint">Seret di chart untuk zoom, dobel-klik untuk reset, klik legend untuk toggle series.</span>
        </div>
        <ul class="ul-log"><For each={events()} fallback={<li>Belum ada event.</li>}>{e => <li>{e}</li>}</For></ul>
      </section>
    </div>
  );
}
