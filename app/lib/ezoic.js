export function runEzoic(fn) {
  if (typeof window === "undefined") return;
  window.ezstandalone = window.ezstandalone || {};
  window.ezstandalone.cmd = window.ezstandalone.cmd || [];
  window.ezstandalone.cmd.push(fn);
}
