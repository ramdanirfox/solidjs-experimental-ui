import { createEffect, JSX, on, onCleanup, splitProps, untrack } from "solid-js";
import { Dynamic } from "solid-js/web";
import type AirDatepicker from "air-datepicker";
import type { AirDatepickerOptions } from "air-datepicker";
import "air-datepicker/air-datepicker.css";

/** Locale dimuat malas (hanya yang dipakai yang ikut terunduh). Tambahkan kode lain dari air-datepicker/locale/* bila perlu. */
const LOCALES = {
  id: () => import("air-datepicker/locale/id"),
  en: () => import("air-datepicker/locale/en"),
  de: () => import("air-datepicker/locale/de"),
  fr: () => import("air-datepicker/locale/fr"),
  es: () => import("air-datepicker/locale/es"),
  ja: () => import("air-datepicker/locale/ja"),
  ar: () => import("air-datepicker/locale/ar"),
};
export type SharedAirDatepickerLocale = keyof typeof LOCALES;
export const AIR_DATEPICKER_LOCALES = Object.keys(LOCALES) as SharedAirDatepickerLocale[];

export interface ISharedAirDatepickerProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "ref"> {
  /** Opsi air-datepicker. Perubahan diterapkan lewat dp.update(), yang MENGGABUNGKAN opsi: matikan opsi dengan nilai eksplisit (mis. minDate: false), jangan menghapus key-nya. */
  options?: AirDatepickerOptions;
  locale?: SharedAirDatepickerLocale;
  /** Tampilkan kalender langsung (elemen jadi <div>) alih-alih popup dari <input>. Mengganti nilai ini membangun ulang. */
  inline?: boolean;
  /** Nilai terkontrol. Pembaruan dari luar tidak memicu onChange. */
  value?: Date[];
  onChange?: (dates: Date[], formatted: string[], dp: AirDatepicker) => void;
  /** Dipanggil setelah instance dibuat (juga setelah dibangun ulang). */
  onReady?: (dp: AirDatepicker) => void;
}

const sameDates = (a: Date[], b: Date[]) => a.length === b.length && a.every((d, i) => +d === +b[i]);

/**
 * Pembungkus tipis air-datepicker.
 * - Di-import dinamis (butuh DOM), jadi aman untuk SSR.
 * - `options` reaktif lewat update(); `locale`/`inline` membangun ulang instance.
 * - `value` terkontrol dua arah: onChange saat pengguna memilih, selectDate(…, { silent: true }) saat nilai dari luar berubah.
 */
export default function SharedAirDatepicker(props: ISharedAirDatepickerProps) {
  const [local, rest] = splitProps(props, ["options", "locale", "inline", "value", "onChange", "onReady"]);
  let el!: HTMLElement;
  let dp: AirDatepicker | undefined;
  let alive = true;
  let seq = 0;

  const destroy = () => {
    try { dp?.destroy(); } catch (e) { console.warn("[SharedAirDatepicker] destroy gagal", e); }
    dp = undefined;
  };

  const build = async () => {
    const my = ++seq;
    const [{ default: Datepicker }, loc] = await Promise.all([import("air-datepicker"), LOCALES[local.locale ?? "id"]()]);
    if (!alive || my !== seq) return;
    destroy();
    const opts = untrack(() => local.options);
    const instance = new Datepicker(el as HTMLInputElement, {
      ...opts,
      locale: loc.default,
      inline: !!local.inline,
      selectedDates: untrack(() => local.value) ?? false,
      onSelect: p => {
        opts?.onSelect?.(p);
        const dates = Array.isArray(p.date) ? p.date : p.date ? [p.date] : [];
        const fmt = Array.isArray(p.formattedDate) ? p.formattedDate : p.formattedDate ? [p.formattedDate] : [];
        local.onChange?.(dates, fmt, instance);
      },
    });
    dp = instance;
    local.onReady?.(instance);
  };

  // Dependensi dibaca sinkron sebelum await agar terlacak.
  createEffect(() => { local.locale; local.inline; build(); });
  createEffect(on(() => local.options, o => { if (dp && o) dp.update(o, { silent: true }); }, { defer: true }));
  createEffect(() => {
    const v = local.value;
    if (!dp || !v || sameDates(v, dp.selectedDates)) return;
    dp.clear({ silent: true });
    if (v.length) dp.selectDate(v, { silent: true });
  });

  onCleanup(() => { alive = false; seq++; destroy(); });

  return <Dynamic component={local.inline ? "div" : "input"} ref={(e: HTMLElement) => (el = e)} {...(local.inline ? {} : { type: "text", readOnly: true })} {...(rest as object)} />;
}
