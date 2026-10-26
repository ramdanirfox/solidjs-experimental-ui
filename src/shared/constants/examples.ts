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

export const EXAMPLES: IExample[] = [];

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
