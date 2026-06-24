// アプリ共通のスタイル（モダン・ニュートラル / zinc系）。
// 各コンポーネントで className に展開して見た目を統一する。
export const ui = {
  btnPrimary:
    'inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50',
  btnSecondary:
    'inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50',
  // 小さめのボタン
  btnPrimarySm:
    'inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50',
  btnSecondarySm:
    'inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50',
  // text-base(16px)をモバイル既定にし、iOSのフォーカス時自動ズームを防ぐ（sm以上で14px）
  input:
    'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 sm:text-sm',
  card: 'rounded-xl border border-zinc-200 bg-white shadow-sm',
  chip: 'rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100',
  chipActive:
    'rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs font-medium text-white',
  h1: 'text-lg font-semibold tracking-tight text-zinc-900',
  muted: 'text-zinc-500',
}
