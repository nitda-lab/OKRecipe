// ReactMarkdown で描画したHTMLに見出し・リスト・表のスタイルを当てる Tailwind の
// 任意バリアント群。typography プラグインを使わず、チャットとレシピで共通利用する。
export const MARKDOWN_TYPO =
  '[&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold ' +
  '[&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold ' +
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top ' +
  '[&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-200 [&_th]:px-2 [&_th]:py-1 ' +
  '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5'
