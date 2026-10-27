import { Title } from "@solidjs/meta";
import { createMemo, createSignal, For, JSX, onCleanup, Show } from "solid-js";
import SharedTabulator, { type TabulatorInstance } from "~/shared/components/SharedTabulator";
import "./tabulator.css";

/* ---------- data contoh (deterministik) ---------- */
const DEPTS = ["Engineering", "Design", "Marketing", "Finance", "Operasional"];
const COUNTRIES = ["Indonesia", "Singapura", "Jepang", "Jerman", "Brasil"];
const ROLES = ["Junior", "Menengah", "Senior", "Lead", "Manajer"];
const FIRST = ["Ayu", "Budi", "Citra", "Dewi", "Eko", "Farah", "Gita", "Hadi", "Indra", "Joko", "Kirana", "Lukman", "Maya", "Nadia", "Omar", "Putri"];
const LAST = ["Santoso", "Wijaya", "Pratama", "Lestari", "Hidayat", "Saputra", "Nugroho", "Kusuma", "Halim", "Utami"];

const makeData = (n: number) => {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return Array.from({ length: n }, (_, i) => {
    const role = pick(ROLES);
    return {
      id: i + 1,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      dept: pick(DEPTS),
      role,
      country: pick(COUNTRIES),
      salary: Math.round((2500 + ROLES.indexOf(role) * 1800 + rnd() * 2500) / 50) * 50,
      rating: 1 + Math.floor(rnd() * 5),
      progress: Math.floor(rnd() * 101),
      active: rnd() > 0.2,
      joined: `${2015 + Math.floor(rnd() * 10)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
    };
  });
};

const FIELDS = [
  ["id", "ID"], ["name", "Nama"], ["dept", "Departemen"], ["role", "Jabatan"], ["country", "Negara"],
  ["salary", "Gaji"], ["rating", "Rating"], ["progress", "Progres"], ["active", "Aktif"], ["joined", "Bergabung"],
] as const;

const money = { symbol: "$", precision: 0 };

/* ---------- kontrol kecil ---------- */
const Sel = (p: { label: string; value: string | number; options: (string | number | [string | number, string])[]; onChange: (v: string) => void }) => (
  <label class="tb-row"><span>{p.label}</span>
    <select value={p.value} onChange={e => p.onChange(e.currentTarget.value)}>
      <For each={p.options}>{o => Array.isArray(o) ? <option value={o[0]}>{o[1]}</option> : <option value={o}>{o}</option>}</For>
    </select>
  </label>
);
const Chk = (p: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) => (
  <label class="tb-check" title={p.hint}><input type="checkbox" checked={p.checked} onChange={e => p.onChange(e.currentTarget.checked)} />{p.label}</label>
);
const Btn = (p: { onClick: () => void; children: JSX.Element; disabled?: boolean }) => (
  <button class="tb-btn" onClick={p.onClick} disabled={p.disabled}>{p.children}</button>
);

export default function PageTabulator() {
  /* fitur yang dipamerkan (init-only -> tabel dibangun ulang) */
  const [layout, setLayout] = createSignal("fitColumns");
  const [group, setGroup] = createSignal("");
  const [pageSize, setPageSize] = createSignal(0);
  const [selMode, setSelMode] = createSignal<"none" | "rows" | "range">("rows");
  const [movableCols, setMovableCols] = createSignal(true);
  const [movableRows, setMovableRows] = createSignal(false);
  const [frozen, setFrozen] = createSignal(true);
  const [calcs, setCalcs] = createSignal(true);
  const [editable, setEditable] = createSignal(true);
  const [history, setHistory] = createSignal(true);
  /* data & runtime */
  const [rowCount, setRowCount] = createSignal(200);
  const [live, setLive] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [hidden, setHidden] = createSignal<string[]>([]);
  /* ekspor */
  const [delimiter, setDelimiter] = createSignal(",");
  const [bom, setBom] = createSignal(true);
  const [range, setRange] = createSignal("active");
  /* status & log */
  const [stat, setStat] = createSignal({ total: 0, shown: 0, selected: 0 });
  const [log, setLog] = createSignal<string[]>([]);
  const [tbl, setTbl] = createSignal<TabulatorInstance>();
  let table: TabulatorInstance | undefined;

  const data = createMemo(() => makeData(rowCount()));
  const note = (m: string) => setLog(l => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 10));
  const refresh = () => table && setStat({ total: table.getDataCount(), shown: table.getDataCount("active"), selected: table.getSelectedRows().length });

  const columns = createMemo(() => {
    const ed = editable();
    const c = calcs();
    const e = (editor: any, extra: object = {}) => (ed ? { editor, ...extra } : {});
    return [
      { title: "ID", field: "id", width: 70, sorter: "number", hozAlign: "right", ...(c && { bottomCalc: "count" }) },
      { title: "Nama", field: "name", minWidth: 160, frozen: frozen(), headerFilter: "input", headerFilterPlaceholder: "cari nama", ...e("input", { validator: "required" }) },
      { title: "Departemen", field: "dept", minWidth: 130, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true }, ...e("list", { editorParams: { values: DEPTS } }) },
      { title: "Jabatan", field: "role", minWidth: 110, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true }, ...e("list", { editorParams: { values: ROLES } }) },
      { title: "Negara", field: "country", minWidth: 110, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true } },
      {
        title: "Gaji", field: "salary", minWidth: 120, sorter: "number", hozAlign: "right", formatter: "money", formatterParams: money,
        headerFilter: "number", headerFilterPlaceholder: "≥", headerFilterFunc: ">=",
        ...e("number", { editorParams: { min: 0 }, validator: ["required", "min:0"] }),
        ...(c && { bottomCalc: "avg", bottomCalcFormatter: "money", bottomCalcFormatterParams: money }),
      },
      { title: "Rating", field: "rating", width: 130, hozAlign: "center", sorter: "number", formatter: "star", ...e("star"), ...(c && { bottomCalc: "avg", bottomCalcParams: { precision: 1 } }) },
      {
        title: "Progres", field: "progress", width: 150, sorter: "number", formatter: "progress",
        formatterParams: { min: 0, max: 100, color: ["#ef4444", "#f59e0b", "#10b981"], legend: true }, ...e("range", { editorParams: { min: 0, max: 100 } }),
        ...(c && { bottomCalc: "avg", bottomCalcParams: { precision: 0 } }),
      },
      { title: "Aktif", field: "active", width: 90, hozAlign: "center", formatter: "tickCross", headerFilter: "tickCross", headerFilterParams: { tristate: true }, headerFilterEmptyCheck: (v: unknown) => v === null, ...e("tickCross") },
      { title: "Bergabung", field: "joined", width: 120, sorter: "string", headerFilter: "input", ...e("date") },
    ];
  });

  const options = createMemo(() => {
    const sel = selMode();
    const g = group();
    return {
      height: "100%",
      layout: layout(),
      placeholder: "Tidak ada data yang cocok",
      movableColumns: movableCols(),
      movableRows: movableRows(),
      history: history(),
      columnCalcs: "both",
      ...(pageSize() > 0 && { pagination: true, paginationSize: pageSize(), paginationSizeSelector: [10, 25, 50, 100], paginationCounter: "rows" }),
      ...(g && {
        groupBy: g, groupStartOpen: true, groupToggleElement: "header",
        groupHeader: (value: string, count: number, rows: { salary: number }[]) =>
          `${value} <span class="tb-gcount">${count} orang · total gaji $${rows.reduce((a, r) => a + r.salary, 0).toLocaleString("en-US")}</span>`,
      }),
      ...(sel === "rows" && {
        selectableRows: true,
        rowHeader: { headerSort: false, resizable: false, frozen: true, headerHozAlign: "center", hozAlign: "center", formatter: "rowSelection", titleFormatter: "rowSelection", width: 44, cellClick: (_e: unknown, cell: any) => cell.getRow().toggleSelect() },
      }),
      ...(sel === "range" && {
        selectableRange: 1, selectableRangeColumns: true, selectableRangeRows: true, selectableRangeClearCells: true, editTriggerEvent: "dblclick",
        clipboard: true, clipboardCopyStyled: false, clipboardCopyConfig: { rowHeaders: false, columnHeaders: false }, clipboardCopyRowRange: "range",
        clipboardPasteParser: "range", clipboardPasteAction: "range",
      }),
    };
  });

  const onReady = (t: TabulatorInstance) => {
    table = t;
    setTbl(t);
    hidden().forEach(f => t.hideColumn(f));
    const s = search().trim().toLowerCase();
    if (s) applySearch(s);
    t.on("cellEdited", (cell: any) => note(`cellEdited · ${cell.getField()}: ${cell.getOldValue()} → ${cell.getValue()}`));
    t.on("rowClick", (_e: unknown, row: any) => note(`rowClick · id=${row.getData().id}`));
    t.on("rowMoved", (row: any) => note(`rowMoved · id=${row.getData().id}`));
    t.on("columnMoved", (col: any) => note(`columnMoved · ${col.getField()}`));
    t.on("dataFiltered", (_f: unknown, rows: unknown[]) => { note(`dataFiltered · ${rows.length} baris`); refresh(); });
    t.on("rowSelectionChanged", refresh);
    t.on("dataLoaded", refresh);
    t.on("downloadComplete", () => note("downloadComplete"));
    refresh();
  };

  const applySearch = (s: string) => {
    if (!table) return;
    if (!s) return table.clearFilter();
    table.setFilter((row: Record<string, unknown>) => Object.values(row).some(v => String(v).toLowerCase().includes(s)));
  };
  const onSearch = (v: string) => { setSearch(v); applySearch(v.trim().toLowerCase()); };

  const toggleCol = (f: string) => {
    const off = hidden().includes(f);
    setHidden(h => (off ? h.filter(x => x !== f) : [...h, f]));
    off ? table?.showColumn(f) : table?.hideColumn(f);
  };

  /* simulasi live: ubah beberapa sel acak tanpa mengganti seluruh data */
  const liveId = setInterval(() => {
    if (!live() || !table) return;
    const rows = Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * rowCount())).map(id => ({
      id, progress: Math.floor(Math.random() * 101), salary: 3000 + Math.round(Math.random() * 90) * 50,
    }));
    table.updateData(rows);
  }, 800);
  onCleanup(() => clearInterval(liveId));

  /* ekspor */
  const exportCsv = () => table?.download("csv", "karyawan.csv", { delimiter: delimiter() === "\\t" ? "\t" : delimiter(), bom: bom() }, range());
  const exportJson = () => table?.download("json", "karyawan.json", {}, range());
  const exportHtml = () => table?.download("html", "karyawan.html", { style: true }, range());
  const importCsv = () => table?.import("csv", ".csv", "text").then(() => note("import CSV selesai")).catch((e: unknown) => note(`import gagal · ${e}`));
  const addRow = () => table?.addRow({ id: Date.now() % 100000, name: "Karyawan Baru", dept: DEPTS[0], role: ROLES[0], country: COUNTRIES[0], salary: 3000, rating: 3, progress: 0, active: true, joined: new Date().toISOString().slice(0, 10) }, true);
  const delSelected = () => { table?.getSelectedRows().forEach((r: any) => r.delete()); refresh(); };

  return (
    <div class="tb-page">
      <Title>Tabulator — SolidJS</Title>
      <aside class="tb-panel">
        <fieldset><legend>Tampilan & fitur</legend>
          <Sel label="Layout" value={layout()} onChange={setLayout} options={["fitColumns", "fitData", "fitDataStretch", "fitDataFill"]} />
          <Sel label="Pengelompokan" value={group()} onChange={setGroup} options={[["", "Tanpa"], ["dept", "Departemen"], ["country", "Negara"], ["role", "Jabatan"]]} />
          <Sel label="Paginasi" value={pageSize()} onChange={v => setPageSize(+v)} options={[[0, "Mati (virtual scroll)"], [10, "10 / halaman"], [25, "25 / halaman"], [50, "50 / halaman"]]} />
          <Sel label="Seleksi" value={selMode()} onChange={v => setSelMode(v as typeof selMode extends () => infer T ? T : never)} options={[["none", "Tanpa"], ["rows", "Baris (checkbox)"], ["range", "Rentang sel (gaya Excel)"]]} />
          <Chk label="Kolom bisa dipindah" checked={movableCols()} onChange={setMovableCols} />
          <Chk label="Baris bisa dipindah" checked={movableRows()} onChange={setMovableRows} />
          <Chk label="Bekukan kolom Nama" checked={frozen()} onChange={setFrozen} />
          <Chk label="Kalkulasi kolom (footer & grup)" checked={calcs()} onChange={setCalcs} />
          <Chk label="Edit sel + validasi" checked={editable()} onChange={setEditable} />
          <Chk label="Riwayat undo/redo" checked={history()} onChange={setHistory} />
          <div class="tb-hint">Opsi di atas bersifat init-only di Tabulator, jadi mengubahnya membangun ulang tabel.</div>
        </fieldset>
        <fieldset><legend>Data</legend>
          <Sel label="Jumlah baris" value={rowCount()} onChange={v => setRowCount(+v)} options={[50, 200, 1000, 5000, 20000]} />
          <Chk label="Simulasi live (updateData)" checked={live()} onChange={setLive} />
          <div class="tb-inline"><Btn onClick={addRow}>+ Baris</Btn><Btn onClick={delSelected} disabled={selMode() !== "rows"}>Hapus terpilih</Btn></div>
          <div class="tb-inline"><Btn onClick={() => tbl()?.undo()} disabled={!history()}>↶ Undo</Btn><Btn onClick={() => tbl()?.redo()} disabled={!history()}>↷ Redo</Btn></div>
        </fieldset>
        <fieldset><legend>Kolom tampil</legend>
          <div class="tb-cols"><For each={FIELDS}>{([f, t]) => <Chk label={t} checked={!hidden().includes(f)} onChange={() => toggleCol(f)} />}</For></div>
        </fieldset>
        <fieldset><legend>Ekspor & impor</legend>
          <Sel label="Rentang baris" value={range()} onChange={setRange} options={[["active", "Hasil filter (aktif)"], ["all", "Semua"], ["visible", "Terlihat"], ["selected", "Terpilih (mode baris)"]]} />
          <Sel label="Pemisah CSV" value={delimiter()} onChange={setDelimiter} options={[[",", "Koma ( , )"], [";", "Titik koma ( ; )"], ["\\t", "Tab"]]} />
          <Chk label="BOM UTF-8 (agar Excel membaca benar)" checked={bom()} onChange={setBom} />
          <div class="tb-inline"><Btn onClick={exportCsv}>Unduh CSV</Btn><Btn onClick={exportJson}>JSON</Btn><Btn onClick={exportHtml}>HTML</Btn></div>
          <div class="tb-inline"><Btn onClick={() => tbl()?.copyToClipboard(range() === "selected" ? "selected" : "active")}>Salin</Btn><Btn onClick={() => tbl()?.print("active", true)}>Cetak</Btn><Btn onClick={importCsv}>Impor CSV</Btn></div>
          <div class="tb-hint">XLSX & PDF juga didukung Tabulator, tetapi memerlukan pustaka SheetJS / jsPDF terpisah.</div>
        </fieldset>
      </aside>

      <section class="tb-main">
        <div class="tb-bar">
          <input class="tb-search" type="search" placeholder="Cari di semua kolom…" value={search()} onInput={e => onSearch(e.currentTarget.value)} />
          <span class="tb-stat">{stat().shown} / {stat().total} baris<Show when={selMode() === "rows"}> · {stat().selected} terpilih</Show></span>
        </div>
        <SharedTabulator class="tb-table" columns={columns()} data={data()} options={options()} onReady={onReady} />
        <ul class="tb-log"><For each={log()} fallback={<li>Belum ada event — coba edit sel, pindahkan kolom, atau filter.</li>}>{l => <li>{l}</li>}</For></ul>
      </section>
    </div>
  );
}
