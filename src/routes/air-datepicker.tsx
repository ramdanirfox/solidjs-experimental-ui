import { Title } from "@solidjs/meta";
import { createEffect, createMemo, createSignal, For, JSX, Show } from "solid-js";
import type AirDatepicker from "air-datepicker";
import type { AirDatepickerOptions } from "air-datepicker";
import SharedAirDatepicker, { AIR_DATEPICKER_LOCALES, type SharedAirDatepickerLocale } from "~/shared/components/SharedAirDatepicker";
import "./air-datepicker.css";

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(startOfDay(d).getTime() + n * DAY);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- kontrol kecil ---------- */
const Sel = (p: { label: string; value: string | number; options: (string | number | [string | number, string])[]; onChange: (v: string) => void }) => (
  <label class="adp-row"><span>{p.label}</span>
    <select value={p.value} onChange={e => p.onChange(e.currentTarget.value)}>
      <For each={p.options}>{o => Array.isArray(o) ? <option value={o[0]}>{o[1]}</option> : <option value={o}>{o}</option>}</For>
    </select>
  </label>
);
const Chk = (p: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label class="adp-check"><input type="checkbox" checked={p.checked} onChange={e => p.onChange(e.currentTarget.checked)} />{p.label}</label>
);
const Btn = (p: { onClick: () => void; children: JSX.Element }) => <button class="adp-btn" onClick={p.onClick}>{p.children}</button>;

export default function PageAirDatepicker() {
  /* tampilan & seleksi */
  const [inline, setInline] = createSignal(false);
  const [selection, setSelection] = createSignal<"single" | "multiple" | "range" | "dynamic">("single");
  const [maxMulti, setMaxMulti] = createSignal(3);
  const [granularity, setGranularity] = createSignal<"days" | "months" | "years">("days");
  const [format, setFormat] = createSignal("dd MMMM yyyy");
  const [locale, setLocale] = createSignal<SharedAirDatepickerLocale>("id");
  const [firstDay, setFirstDay] = createSignal(1);
  const [accent, setAccent] = createSignal("#4f46e5");
  /* waktu */
  const [timepicker, setTimepicker] = createSignal(false);
  const [onlyTime, setOnlyTime] = createSignal(false);
  const [timeFormat, setTimeFormat] = createSignal("HH:mm");
  const [minutesStep, setMinutesStep] = createSignal(5);
  /* batasan & tampilan sel */
  const [limit, setLimit] = createSignal(false);
  const [noWeekends, setNoWeekends] = createSignal(false);
  const [mark17, setMark17] = createSignal(true);
  const [blockSunday, setBlockSunday] = createSignal(false);
  const [buttons, setButtons] = createSignal<"none" | "preset" | "custom">("preset");
  const [autoClose, setAutoClose] = createSignal(false);
  const [otherMonths, setOtherMonths] = createSignal(true);
  const [fixedHeight, setFixedHeight] = createSignal(false);
  const [toggleSelected, setToggleSelected] = createSignal(true);
  /* nilai & log */
  const [dates, setDates] = createSignal<Date[]>([]);
  const [log, setLog] = createSignal<string[]>([]);
  const [dp, setDp] = createSignal<AirDatepicker>();
  const note = (m: string) => setLog(l => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 10));

  const options = createMemo<AirDatepickerOptions>(() => {
    const s = selection(), g = granularity();
    const today = startOfDay(new Date());
    const btn = buttons();
    return {
      firstDay: firstDay(),
      view: g,
      minView: g,
      dateFormat: format(),
      range: s === "range" || s === "dynamic",
      dynamicRange: s === "dynamic",
      multipleDates: s === "multiple" ? maxMulti() : false,
      timepicker: timepicker() || onlyTime(),
      onlyTimepicker: onlyTime(),
      timeFormat: timeFormat(),
      minutesStep: minutesStep(),
      minDate: limit() ? addDays(today, -10) : false,
      maxDate: limit() ? addDays(today, 30) : false,
      autoClose: autoClose(),
      showOtherMonths: otherMonths(),
      fixedHeight: fixedHeight(),
      toggleSelected: toggleSelected(),
      buttons: btn === "none" ? false : btn === "preset" ? ["today", "clear"] : [
        { content: "Besok", onClick: (d: AirDatepicker) => d.selectDate(addDays(new Date(), 1)) },
        { content: "+7 hari", onClick: (d: AirDatepicker) => d.selectDate(addDays(new Date(), 7)) },
        "clear",
      ],
      // Dipanggil per sel: bisa menonaktifkan sel atau menambah kelas / HTML kustom.
      onRenderCell: ({ date, cellType }) => {
        if (cellType !== "day") return;
        const dow = date.getDay();
        if (noWeekends() && (dow === 0 || dow === 6)) return { disabled: true };
        if (mark17() && date.getDate() === 17) return { classes: "adp-mark", html: `${date.getDate()}<i class="adp-dot"></i>`, attrs: { title: "Tanggal 17 (contoh sel kustom)" } };
      },
      // Mengembalikan false membatalkan pemilihan.
      onBeforeSelect: ({ date }) => {
        if (blockSunday() && date.getDay() === 0) { note(`onBeforeSelect · ${iso(date)} (Minggu) ditolak`); return false; }
        return true;
      },
      onSelect: ({ formattedDate }) => note(`onSelect · ${[formattedDate].flat().join(" → ") || "(kosong)"}`),
      onChangeView: v => note(`onChangeView · ${v}`),
      onChangeViewDate: ({ month, year }) => note(`onChangeViewDate · ${year}-${String(month + 1).padStart(2, "0")}`),
      onShow: done => { if (done) note("onShow"); },
      onHide: done => { if (done) note("onHide"); },
    };
  });

  /* warna aksen lewat CSS variable pada elemen kalender (popup berada di luar pohon halaman) */
  createEffect(() => { dp()?.$datepicker?.style.setProperty("--adp-accent-color", accent()); });

  const readout = createMemo(() => dates().map(d => ({
    iso: timepicker() || onlyTime() ? d.toISOString() : iso(d),
    text: dp()?.formatDate(d, format() + (timepicker() || onlyTime() ? " " + timeFormat() : "")) ?? "",
  })));

  /* dua input tertaut: tanggal akhir tak boleh sebelum tanggal mulai */
  const [start, setStart] = createSignal<Date[]>([]);
  const [end, setEnd] = createSignal<Date[]>([]);
  const nights = () => (start()[0] && end()[0] ? Math.round((+startOfDay(end()[0]) - +startOfDay(start()[0])) / DAY) : null);
  const startOpts = createMemo<AirDatepickerOptions>(() => ({ dateFormat: "dd MMM yyyy", minDate: addDays(new Date(), 0), maxDate: end()[0] ?? false, autoClose: true }));
  const endOpts = createMemo<AirDatepickerOptions>(() => ({ dateFormat: "dd MMM yyyy", minDate: start()[0] ?? addDays(new Date(), 0), maxDate: false, autoClose: true }));

  return (
    <div class="adp-page">
      <Title>Air Datepicker — SolidJS</Title>
      <aside class="adp-panel">
        <fieldset><legend>Mode & seleksi</legend>
          <Chk label="Inline (kalender selalu tampil)" checked={inline()} onChange={setInline} />
          <Sel label="Seleksi" value={selection()} onChange={v => setSelection(v as ReturnType<typeof selection>)} options={[["single", "Satu tanggal"], ["multiple", "Beberapa tanggal"], ["range", "Rentang"], ["dynamic", "Rentang dinamis"]]} />
          <Show when={selection() === "multiple"}>
            <Sel label="Maksimum tanggal" value={maxMulti()} onChange={v => setMaxMulti(+v)} options={[2, 3, 5, 10]} />
          </Show>
          <Sel label="Granularitas" value={granularity()} onChange={v => setGranularity(v as ReturnType<typeof granularity>)} options={[["days", "Hari"], ["months", "Bulan"], ["years", "Tahun"]]} />
          <Sel label="Format tanggal" value={format()} onChange={setFormat} options={["dd MMMM yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "EEEE, d MMM yyyy", "MMMM yyyy", "yyyy"]} />
          <Sel label="Locale" value={locale()} onChange={v => setLocale(v as SharedAirDatepickerLocale)} options={AIR_DATEPICKER_LOCALES} />
          <Sel label="Hari pertama pekan" value={firstDay()} onChange={v => setFirstDay(+v)} options={[[0, "Minggu"], [1, "Senin"], [6, "Sabtu"]]} />
          <label class="adp-row"><span>Warna aksen</span><input type="color" value={accent()} onInput={e => setAccent(e.currentTarget.value)} /></label>
        </fieldset>
        <fieldset><legend>Waktu</legend>
          <Chk label="Tampilkan timepicker" checked={timepicker()} onChange={setTimepicker} />
          <Chk label="Hanya waktu" checked={onlyTime()} onChange={setOnlyTime} />
          <Sel label="Format waktu" value={timeFormat()} onChange={setTimeFormat} options={[["HH:mm", "24 jam"], ["hh:mm aa", "12 jam (AM/PM)"]]} />
          <Sel label="Langkah menit" value={minutesStep()} onChange={v => setMinutesStep(+v)} options={[1, 5, 10, 15, 30]} />
        </fieldset>
        <fieldset><legend>Batasan & sel kustom</legend>
          <Chk label="Batasi −10 … +30 hari (min/maxDate)" checked={limit()} onChange={setLimit} />
          <Chk label="Nonaktifkan akhir pekan (onRenderCell)" checked={noWeekends()} onChange={setNoWeekends} />
          <Chk label="Tandai tanggal 17 dengan HTML kustom" checked={mark17()} onChange={setMark17} />
          <Chk label="Tolak hari Minggu (onBeforeSelect)" checked={blockSunday()} onChange={setBlockSunday} />
          <Sel label="Tombol" value={buttons()} onChange={v => setButtons(v as ReturnType<typeof buttons>)} options={[["none", "Tanpa"], ["preset", "Hari ini + Hapus"], ["custom", "Kustom (Besok, +7 hari)"]]} />
          <Chk label="Tutup otomatis setelah memilih" checked={autoClose()} onChange={setAutoClose} />
          <Chk label="Tampilkan hari bulan lain" checked={otherMonths()} onChange={setOtherMonths} />
          <Chk label="Tinggi tetap (6 baris)" checked={fixedHeight()} onChange={setFixedHeight} />
          <Chk label="Klik lagi = batalkan pilihan" checked={toggleSelected()} onChange={setToggleSelected} />
        </fieldset>
      </aside>

      <section class="adp-main">
        <div class="adp-card">
          <h3>Picker utama</h3>
          <SharedAirDatepicker
            class="adp-input"
            placeholder="Pilih tanggal…"
            inline={inline()}
            locale={locale()}
            options={options()}
            value={dates()}
            onChange={d => setDates(d)}
            onReady={setDp}
          />
          <div class="adp-actions">
            <Btn onClick={() => dp()?.selectDate(new Date())}>Hari ini</Btn>
            <Btn onClick={() => dp()?.selectDate(`${new Date().getFullYear()}-12-25`)}>25 Des</Btn>
            <Btn onClick={() => dp()?.prev()}>‹ Sebelumnya</Btn>
            <Btn onClick={() => dp()?.next()}>Berikutnya ›</Btn>
            <Btn onClick={() => dp()?.setCurrentView("years")}>Lihat tahun</Btn>
            <Btn onClick={() => dp()?.setViewDate(new Date(2030, 0, 1))}>Lompat 2030</Btn>
            <Btn onClick={() => setDates([])}>Kosongkan</Btn>
            <Show when={!inline()}><Btn onClick={() => dp()?.show()}>Show</Btn><Btn onClick={() => dp()?.hide()}>Hide</Btn></Show>
          </div>
          <div class="adp-out">
            <b>Nilai terkontrol ({dates().length})</b>
            <For each={readout()} fallback={<span class="adp-muted">— belum ada —</span>}>{r => <div><code>{r.iso}</code> <span class="adp-muted">{r.text}</span></div>}</For>
          </div>
        </div>

        <div class="adp-card">
          <h3>Dua input tertaut (nilai terkontrol)</h3>
          <div class="adp-pair">
            <SharedAirDatepicker class="adp-input" placeholder="Check-in" options={startOpts()} value={start()} onChange={setStart} />
            <span>→</span>
            <SharedAirDatepicker class="adp-input" placeholder="Check-out" options={endOpts()} value={end()} onChange={setEnd} />
          </div>
          <div class="adp-muted">{nights() == null ? "Pilih kedua tanggal." : `${nights()} malam`}</div>
        </div>

        <ul class="adp-log"><For each={log()} fallback={<li>Belum ada event — pilih tanggal, ganti tampilan, atau buka popup.</li>}>{l => <li>{l}</li>}</For></ul>
      </section>
    </div>
  );
}
