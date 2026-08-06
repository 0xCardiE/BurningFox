/* Minimal Chrome extension typings so tsc can resolve `chrome` without @types/chrome. */
declare namespace chrome {
  const runtime: any;
  const storage: any;
  const tabs: any;
  const windows: any;
  const sidePanel: any;
  const scripting: any;
  const action: any;
}

declare const chrome: typeof chrome;
