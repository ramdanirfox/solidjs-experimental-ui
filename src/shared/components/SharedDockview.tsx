import { Component, createSignal, For, JSX, onCleanup, onMount, Setter, splitProps } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { createDockview, themeLight, type DockviewApi, type DockviewOptions, type DockviewTheme, type IContentRenderer } from "dockview-core";
import "dockview-core/dist/styles/dockview.css";

/** Params panel dockview; `view` (opsional) menimpa nama komponen sehingga komponen panel bisa ditukar saat runtime. */
export interface ISharedDockviewPanelParams {
  view?: string;
  [key: string]: unknown;
}

export interface ISharedDockviewProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref"> {
  /** Registry komponen: nama -> komponen Solid. Dibaca saja; jangan diganti saat runtime. */
  panels: Record<string, Component<any>>;
  theme?: DockviewTheme;
  /** 'always' menjaga isi panel tetap hidup saat tersembunyi (peta, canvas WebGL, scroll). Default 'always'. */
  defaultRenderer?: "always" | "onlyWhenVisible";
  /** Opsi dockview lain (disableDnd, singleTabMode, dst.). */
  options?: Omit<DockviewOptions, "theme" | "defaultRenderer">;
  /** Dipanggil sekali setelah dockview siap; gunakan api untuk addPanel / toJSON / fromJSON. */
  onReady?: (api: DockviewApi) => void;
}

/** Satu panel yang sedang terpasang. Identitas objek dipakai <For>, jadi jangan membuat ulang entri. */
interface IMountedPanel {
  id: string;
  element: HTMLElement;
  view: () => string;
  params: () => Record<string, unknown>;
  setView: Setter<string>;
  setParams: Setter<Record<string, unknown>>;
}

/**
 * Pembungkus tipis dockview-core. Isi panel dirender Solid lewat <Portal> ke elemen panel dockview,
 * sehingga tetap berada di pohon komponen yang sama (context, router, meta tetap terbaca).
 * Hanya entri yang ditambah/dihapus; panel tetangga tidak dibuat ulang saat satu panel berubah.
 */
export default function SharedDockview(props: ISharedDockviewProps) {
  const [local, rest] = splitProps(props, ["panels", "theme", "defaultRenderer", "options", "onReady", "class"]);
  const [mounted, setMounted] = createSignal<IMountedPanel[]>([]);
  let host!: HTMLDivElement;
  let api: DockviewApi | undefined;

  const createEntry = (id: string, name: string): IMountedPanel => {
    const element = document.createElement("div");
    element.style.cssText = "width:100%;height:100%;overflow:auto";
    const [view, setView] = createSignal(name);
    const [params, setParams] = createSignal<Record<string, unknown>>({});
    return { id, element, view, params, setView, setParams };
  };

  onMount(() => {
    api = createDockview(host, {
      ...local.options,
      theme: local.theme ?? themeLight,
      defaultRenderer: local.defaultRenderer ?? "always",
      createComponent: ({ id, name }): IContentRenderer => {
        const entry = createEntry(id, name);
        setMounted(list => [...list, entry]);
        const apply = (p?: ISharedDockviewPanelParams) => {
          const { view, ...others } = p ?? {};
          entry.setView(view ?? name);
          entry.setParams(others);
        };
        const disposers: Array<() => void> = [];
        return {
          element: entry.element,
          init: ({ params, api: panelApi }) => {
            apply(params as ISharedDockviewPanelParams);
            const sub = panelApi.onDidParametersChange(p => apply(p as ISharedDockviewPanelParams));
            disposers.push(() => sub.dispose());
          },
          dispose: () => {
            disposers.forEach(d => d());
            setMounted(list => list.filter(e => e !== entry));
          },
        };
      },
    });
    local.onReady?.(api);
  });

  onCleanup(() => { api?.dispose(); api = undefined; });

  return (
    <>
      <div {...rest} ref={host} class={local.class} />
      <For each={mounted()}>
        {p => (
          <Portal mount={p.element} ref={(d: HTMLElement) => { d.style.cssText = "width:100%;height:100%"; }}>
            <Dynamic component={local.panels[p.view()]} {...p.params()} panelId={p.id} />
          </Portal>
        )}
      </For>
    </>
  );
}
