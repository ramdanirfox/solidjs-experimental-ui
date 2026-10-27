import { Title } from "@solidjs/meta";
import { createSignal, For } from "solid-js";
import SharedLiquidGL from "~/shared/components/SharedLiquidGL";
import "./liquid-gl.css";

const PRESETS = {
  Default: { refraction: 0, bevelDepth: 0.052, bevelWidth: 0.211, frost: 2 },
  Alien: { refraction: 0.073, bevelDepth: 0.2, bevelWidth: 0.156, frost: 2, specular: false },
  Frost: { refraction: 0, bevelDepth: 0.035, bevelWidth: 0.119, frost: 0.9 },
  Edge: { refraction: 0.047, bevelDepth: 0.136, bevelWidth: 0.076, frost: 2, specular: false },
} as const;
type PresetName = keyof typeof PRESETS;

export default function PageLiquidGL() {
  const [preset, setPreset] = createSignal<PresetName>("Default");
  const [aberration, setAberration] = createSignal(0);
  const [tint, setTint] = createSignal<string | null>(null);
  const [fluid, setFluid] = createSignal(false);

  return (
    <div class="lgl-page">
      <Title>liquidGL — SolidJS</Title>

      {/* Latar berwarna + teks: bahan yang dibiaskan oleh kaca. */}
      <section class="lgl-stage">
        <h1 class="lgl-bg-title">Liquid Glass</h1>
        <p class="lgl-bg-sub">Geser kaca di atas teks dan gambar ini untuk melihat pembiasannya.</p>
        <div class="lgl-blobs" aria-hidden="true"><i /><i /><i /></div>

        <SharedLiquidGL
          class="lgl-pane lgl-pane-main"
          {...PRESETS[preset()]}
          aberration={aberration()}
          tint={tint()}
          interaction={fluid() ? "fluid" : "none"}
          draggable
        >
          <div class="lgl-pane-content">
            <strong>Panel kaca (bisa diseret)</strong>
            <span>Preset: {preset()}</span>
          </div>
        </SharedLiquidGL>

        <SharedLiquidGL class="lgl-pane lgl-pane-small" refraction={0.03} bevelDepth={0.1} bevelWidth={0.3} frost={0} tilt>
          <div class="lgl-pane-content"><strong>Tilt</strong><span>hover saya</span></div>
        </SharedLiquidGL>
      </section>

      <section class="lgl-controls">
        <div class="lgl-group">
          <span class="lgl-label">Preset</span>
          <For each={Object.keys(PRESETS) as PresetName[]}>
            {name => <button classList={{ on: preset() === name }} onClick={() => setPreset(name)}>{name}</button>}
          </For>
        </div>
        <label class="lgl-group">
          <span class="lgl-label">Aberasi kromatik {aberration().toFixed(2)}</span>
          <input type="range" min="0" max="1" step="0.05" value={aberration()} onInput={e => setAberration(+e.currentTarget.value)} />
        </label>
        <div class="lgl-group">
          <span class="lgl-label">Tint</span>
          <button classList={{ on: tint() === null }} onClick={() => setTint(null)}>Tanpa</button>
          <button classList={{ on: tint() === "rgba(8, 10, 20, 0.25)" }} onClick={() => setTint("rgba(8, 10, 20, 0.25)")}>Gelap</button>
          <button classList={{ on: tint() === "rgba(70, 50, 180, 0.35)" }} onClick={() => setTint("rgba(70, 50, 180, 0.35)")}>Ungu</button>
        </div>
        <label class="lgl-group">
          <input type="checkbox" checked={fluid()} onChange={e => setFluid(e.currentTarget.checked)} />
          <span class="lgl-label">Interaksi fluid</span>
        </label>
      </section>
    </div>
  );
}
