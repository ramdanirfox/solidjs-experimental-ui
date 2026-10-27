/** Daftar halaman contoh — satu sumber untuk beranda, navigasi atas, dan pencarian (src/app.tsx). */
export interface IExample {
  route: string;
  title: string;
  /** Label pendek untuk navigasi. */
  short: string;
  desc: string;
  tags: string[];
  gradient: string;
  icon: string;
  featured?: boolean;
  badge?: string;
  /** Kata kunci tambahan untuk pencarian. */
  keywords?: string[];
}

export const EXAMPLES: IExample[] = [
  {
    route: "liquid-gl",
    title: "liquidGL — Liquid Glass",
    short: "Liquid Glass",
    desc: "Efek kaca cair (refraksi WebGPU/WebGL) lewat pembungkus tipis <SharedLiquidGL>: preset, aberasi kromatik, tint, tilt, panel yang bisa diseret, dan interaksi fluid.",
    tags: ["liquid-gl", "WebGPU", "WebGL", "client-only"],
    gradient: "linear-gradient(135deg, #312e81, #0ea5e9)",
    icon: "M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z",
    featured: true,
    badge: "Baru",
    keywords: ["glass", "kaca", "liquid", "refraksi", "refraction", "shader", "glassmorphism", "webgl", "webgpu"],
  },
  {
    route: "dockview",
    title: "Dockview Layout",
    short: "Dockview",
    desc: "Layout panel ala IDE lewat pembungkus tipis <SharedDockview> (dockview-core): isi panel dirender dengan <Portal> sehingga context tetap terbaca, komponen panel bisa ditukar saat runtime, serta simpan/muat layout.",
    tags: ["dockview-core", "Portal", "layout", "client-only"],
    gradient: "linear-gradient(135deg, #0f766e, #38bdf8)",
    icon: "M3 4h18v16H3z M3 10h18 M10 10v10",
    badge: "Baru",
    keywords: ["panel", "tab", "docking", "ide", "split", "layout", "goldenlayout", "drag"],
  },
  {
    route: "uplot",
    title: "uPlot Chart Lab",
    short: "uPlot",
    desc: "Chart time-series uPlot lewat @dschz/solid-uplot: ganti tipe (line/spline/step/area/bars/points), tebal garis & bar, warna, simulasi data live, label serta tooltip & legend berbasis JSX Solid, dan log event chart.",
    tags: ["uplot", "@dschz/solid-uplot", "chart", "live data", "client-only"],
    gradient: "linear-gradient(135deg, #4f46e5, #0ea5e9)",
    icon: "M3 3v18h18 M7 15l4-5 3 3 5-7",
    badge: "Baru",
    keywords: ["grafik", "chart", "line", "bar", "time series", "tooltip", "legend", "realtime", "streaming"],
  },
  {
    route: "tabulator",
    title: "Tabulator Data Grid",
    short: "Tabulator",
    desc: "Data grid MIT lewat pembungkus tipis <SharedTabulator>: sort & header filter, edit + validasi, grup, kalkulasi, seleksi baris/rentang sel, kolom beku, undo/redo, data live, serta ekspor CSV/JSON/HTML, salin, cetak, dan impor CSV.",
    tags: ["tabulator-tables", "grid", "CSV export", "client-only"],
    gradient: "linear-gradient(135deg, #0369a1, #22d3ee)",
    icon: "M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18",
    featured: true,
    badge: "Baru",
    keywords: ["tabel", "table", "grid", "ag-grid", "csv", "export", "excel", "filter", "sort", "edit", "grouping", "pagination"],
  },
  {
    route: "air-datepicker",
    title: "Air Datepicker",
    short: "Datepicker",
    desc: "Pemilih tanggal lewat pembungkus tipis <SharedAirDatepicker>: popup/inline, satu/banyak/rentang tanggal, timepicker, locale, min/max, sel kustom, tombol kustom, nilai terkontrol, dan dua input tertaut.",
    tags: ["air-datepicker", "date", "range", "client-only"],
    gradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
    icon: "M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4",
    badge: "Baru",
    keywords: ["tanggal", "kalender", "calendar", "date", "picker", "waktu", "time", "range", "rentang", "locale"],
  },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export interface ExampleHit { example: IExample; score: number }

/** Cari contoh: semua kata kueri harus cocok (judul > tag/kata kunci > deskripsi). */
export function searchExamples(query: string, list: IExample[] = EXAMPLES): ExampleHit[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return list.map(example => ({ example, score: 0 }));
  const out: ExampleHit[] = [];
  for (const ex of list) {
    const title = norm(ex.title + " " + ex.short), tags = norm(ex.tags.join(" ") + " " + (ex.keywords ?? []).join(" ")), desc = norm(ex.desc), route = norm(ex.route);
    let score = 0, ok = true;
    for (const t of terms) {
      if (title.includes(t)) score += title.startsWith(t) ? 12 : 8;
      else if (route.includes(t)) score += 6;
      else if (tags.includes(t)) score += 5;
      else if (desc.includes(t)) score += 2;
      else { ok = false; break; }
    }
    if (ok) out.push({ example: ex, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
