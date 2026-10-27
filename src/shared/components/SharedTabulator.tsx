import { createEffect, JSX, on, onCleanup, splitProps, untrack } from "solid-js";
import "tabulator-tables/dist/css/tabulator.min.css";

/** Instance Tabulator (TabulatorFull). Tipe minimal ada di src/shared/types/tabulator-tables.d.ts. */
export type TabulatorInstance = import("tabulator-tables").TabulatorFull;

export interface ISharedTabulatorProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref"> {
  columns: Record<string, any>[];
  data: Record<string, any>[];
  /** Opsi tabel lain. Opsi bersifat init-only di Tabulator, jadi perubahan `options`/`columns` membangun ulang tabel. */
  options?: Record<string, any>;
  /** Dipanggil setelah event `tableBuilt` (aman memanggil method tabel). Dipanggil lagi setelah dibangun ulang. */
  onReady?: (table: TabulatorInstance) => void;
}

/**
 * Pembungkus tipis Tabulator (TabulatorFull: semua modul termasuk download, import, clipboard, range).
 * - Di-import dinamis, jadi aman untuk SSR.
 * - Perubahan `data` memakai replaceData (posisi scroll terjaga); perubahan `options`/`columns` membangun ulang tabel.
 * - Untuk update sel/baris tanpa mengganti seluruh data, panggil updateData/addRow lewat instance dari `onReady`.
 */
export default function SharedTabulator(props: ISharedTabulatorProps) {
  const [local, rest] = splitProps(props, ["columns", "data", "options", "onReady"]);
  let host!: HTMLDivElement;
  let table: TabulatorInstance | undefined;
  let built = false;
  let alive = true;
  let seq = 0;

  const destroy = () => {
    try { table?.destroy(); } catch (e) { console.warn("[SharedTabulator] destroy gagal", e); }
    table = undefined;
    built = false;
  };

  const build = async () => {
    const my = ++seq;
    const { TabulatorFull } = await import("tabulator-tables");
    if (!alive || my !== seq) return;
    destroy();
    const t = new TabulatorFull(host, { ...local.options, columns: local.columns, data: untrack(() => local.data) });
    table = t;
    t.on("tableBuilt", () => {
      if (table !== t) return;
      built = true;
      local.onReady?.(t);
    });
  };

  // Baca dependensi secara sinkron (sebelum await) agar ikut terlacak.
  createEffect(() => { local.options; local.columns; build(); });
  createEffect(on(() => local.data, d => { if (built) table?.replaceData(d); }, { defer: true }));

  onCleanup(() => { alive = false; seq++; destroy(); });

  return <div {...rest} ref={host} />;
}
