/** Tipe minimal: paket tabulator-tables tidak menyertakan deklarasi. API lengkap: https://tabulator.info/docs/6.3 */
declare module "tabulator-tables" {
  export type TabulatorOptions = Record<string, any>;
  export class TabulatorFull {
    constructor(element: HTMLElement | string, options?: TabulatorOptions);
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback?: (...args: any[]) => void): void;
    destroy(): void;
    [method: string]: any;
  }
}
