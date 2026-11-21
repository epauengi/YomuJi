const JAPANESE_RUN = /([\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}〜～（）／]+)/u;

export function GrammarText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span lang="vi" className={`font-sans ${className}`}>
      {text.split(JAPANESE_RUN).map((part, index) =>
        index % 2 ? <span key={index} lang="ja" className="jp-text">{part}</span> : part
      )}
    </span>
  );
}
