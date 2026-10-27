import { Title } from "@solidjs/meta";
import { createSignal, For } from "solid-js";
import type { DockviewApi } from "dockview-core";
import SharedDockview from "~/shared/components/SharedDockview";
import Counter from "~/components/Counter";
import PageLiquidGL from "./liquid-gl";
import "./dockview.css";

const NotesPanel = () => {
  // State di dalam panel ikut bertahan saat tab disembunyikan (renderer 'always') atau layout dimuat ulang.
  const [text, setText] = createSignal("Ketik di sini, lalu pindah tab / seret panel.");
  return <textarea class="dv-notes" value={text()} onInput={e => setText(e.currentTarget.value)} />;
};

const CounterPanel = (p: { panelId?: string }) => (
  <div class="dv-pad"><p>Panel: {p.panelId}</p><Counter /></div>
);

const GlassPanel = () => <div class="dv-pad"><PageLiquidGL /></div>;

const PANELS = { notes: NotesPanel, counter: CounterPanel, glass: GlassPanel };
type View = keyof typeof PANELS;
const VIEWS = Object.keys(PANELS) as View[];
const STORAGE_KEY = "sjx-dockview-layout";

export default function PageDockview() {
  let api: DockviewApi | undefined;
  let seq = 0;

  const add = (view: View) => {
    const id = `p${++seq}`;
    api?.addPanel({ id, title: `${view} #${seq}`, component: view });
  };

  const swapActive = () => {
    const panel = api?.activePanel;
    if (!panel) return;
    const cur = (panel.params as { view?: View } | undefined)?.view ?? (panel.api.component as View);
    const next = VIEWS[(VIEWS.indexOf(cur) + 1) % VIEWS.length];
    panel.api.updateParameters({ view: next });
  };

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(api?.toJSON())); } catch { /* storage diblokir */ } };
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // reuseExistingPanels: panel dengan id yang sama tidak dibuat ulang, jadi isinya (state Solid) tetap hidup.
      if (raw) api?.fromJSON(JSON.parse(raw), { reuseExistingPanels: true });
    } catch { /* abaikan layout rusak */ }
  };

  return (
    <div class="dv-page">
      <Title>Dockview — SolidJS</Title>
      <div class="dv-toolbar">
        <For each={VIEWS}>{v => <button onClick={() => add(v)}>+ {v}</button>}</For>
        <button onClick={swapActive}>Tukar komponen panel aktif</button>
        <button onClick={save}>Simpan layout</button>
        <button onClick={load}>Muat layout</button>
      </div>
      <SharedDockview
        class="dv-host"
        panels={PANELS}
        onReady={a => {
          api = a;
          a.addPanel({ id: "p-notes", title: "Catatan", component: "notes" });
          a.addPanel({ id: "p-counter", title: "Counter", component: "counter", position: { referencePanel: "p-notes", direction: "right" } });
          seq = 0;
        }}
      />
    </div>
  );
}
