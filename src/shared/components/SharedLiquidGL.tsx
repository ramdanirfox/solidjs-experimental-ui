import { createEffect, createUniqueId, JSX, on, onCleanup, onMount, splitProps } from "solid-js";

/** Opsi liquidGL (tanpa `target`, karena wrapper mengurusnya sendiri). */
export interface ILiquidGLOptions {
  engine?: "auto" | "webgpu" | "webgl2" | "webgl";
  snapshot?: string;
  resolution?: number;
  zIndex?: number;
  refraction?: number;
  aberration?: number;
  bevelDepth?: number;
  bevelWidth?: number;
  frost?: number;
  shadow?: boolean;
  specular?: boolean;
  reveal?: "none" | "fade";
  tilt?: boolean;
  tiltFactor?: number;
  tiltEase?: number;
  draggable?: boolean;
  interaction?: "none" | "fluid";
  interactionStrength?: number;
  interactionRadius?: number;
  interactionViscosity?: number;
  magnify?: number;
  tint?: string | null;
}

/** Instance lens yang dikembalikan liquidGL. */
export interface ILiquidGLLens {
  destroy(): void;
  setTint?(value: string | null): void;
  setDraggable?(value: boolean): void;
}

export interface ISharedLiquidGLProps extends ILiquidGLOptions, Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref" | "draggable"> {
  /** Dipanggil setelah frame pertama dirender. */
  onReady?: (lens: ILiquidGLLens) => void;
  ref?: (el: HTMLDivElement) => void;
}

const OPTION_KEYS = [
  "engine", "snapshot", "resolution", "zIndex", "refraction", "aberration", "bevelDepth", "bevelWidth", "frost",
  "shadow", "specular", "reveal", "tilt", "tiltFactor", "tiltEase", "draggable", "interaction",
  "interactionStrength", "interactionRadius", "interactionViscosity", "magnify", "tint",
] as const;

/**
 * Pembungkus tipis liquid-gl: satu <div> = satu lensa kaca.
 * - liquid-gl di-import dinamis di onMount (butuh `window`, jadi aman untuk SSR).
 * - Lensa dibuat ulang bila opsi berubah, dan dihancurkan saat unmount.
 * - `tint` & `draggable` memakai setter runtime sehingga tidak perlu membuat ulang lensa.
 * Catatan: semua lensa di satu halaman harus memakai `zIndex` efektif yang sama.
 */
export default function SharedLiquidGL(props: ISharedLiquidGLProps) {
  const [local, rest] = splitProps(props, [...OPTION_KEYS, "onReady", "ref", "children"]);
  const id = `shared-lgl-${createUniqueId()}`;
  let el!: HTMLDivElement;
  let lens: ILiquidGLLens | undefined;
  let alive = true;
  let seq = 0;

  const collect = () => {
    const o: Record<string, unknown> = {};
    for (const k of OPTION_KEYS) if (local[k] !== undefined) o[k] = local[k];
    return o;
  };

  const destroy = () => {
    try { lens?.destroy(); } catch (e) { console.warn("[SharedLiquidGL] destroy gagal", e); }
    lens = undefined;
  };

  const create = async () => {
    const my = ++seq;
    const { default: liquidGL } = await import("liquid-gl");
    if (!alive || my !== seq) return;
    destroy();
    const { tint, draggable, ...opts } = collect();
    const res = (liquidGL as any)({
      ...opts,
      tint: tint ?? null,
      draggable: !!draggable,
      target: `[data-shared-lgl="${id}"]`,
      on: { init: (l: ILiquidGLLens) => local.onReady?.(l) },
    });
    lens = Array.isArray(res) ? res[0] : res;
  };

  onMount(() => {
    local.ref?.(el);
    // Tunggu satu frame agar layout (termasuk latar halaman) sudah final sebelum snapshot.
    requestAnimationFrame(() => alive && create());
  });

  // Opsi struktural → buat ulang lensa (lewati eksekusi pertama; onMount yang menanganinya).
  createEffect(on(
    () => OPTION_KEYS.filter(k => k !== "tint" && k !== "draggable").map(k => local[k]),
    () => { if (lens) create(); },
    { defer: true },
  ));
  createEffect(() => { const t = local.tint; lens?.setTint?.(t ?? null); });
  createEffect(() => { const d = local.draggable; lens?.setDraggable?.(!!d); });

  onCleanup(() => { alive = false; seq++; destroy(); });

  return (
    <div {...rest} ref={el} data-shared-lgl={id}>
      {local.children}
    </div>
  );
}
