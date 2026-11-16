function detectLanguage(code) {
  if (!code || !code.trim()) return { lang: 'js', label: 'JavaScript' };
  if (/<html|<!doctype|<body|<div|<script|<style/i.test(code)) return { lang: 'html', label: 'HTML' };

  const hasJavaScriptSyntax = /\b(?:function|const|let|var|return|new|class|async|await|throw|if|for|while|switch|import|export)\b|=>|(?:^|[;])\s*[\w$]+\s*=\s*(?:\{|\[|function\b)/m.test(code);
  const hasCssAtRule = /^\s*@(media|keyframes|import|supports|font-face)\b/im.test(code);
  const hasCssRule = /(?:^|\n)\s*(?:[.#][\w-]+|[a-zA-Z][\w-]*(?:\s*[,>+~]\s*[.#\w-]+)*)\s*\{[^{}]*\b[-\w]+\s*:\s*[^{};]+;?\s*\}/m.test(code);
  if ((hasCssAtRule || hasCssRule) && !hasJavaScriptSyntax) return { lang: 'css', label: 'CSS' };
  if (/\b(def\s+\w+|import\s+\w+|print\s*\()/i.test(code) && !/\b(class|function|const|let|var)\b/.test(code)) return { lang: 'python', label: 'Python' };
  if (/\b(?:#include|printf|scanf|malloc|typedef|struct)\b/.test(code)) return { lang: 'c', label: 'C' };
  if (/(?:\bstd::|class\s+\w+\s*\{|using\s+namespace\s+std)/.test(code)) return { lang: 'cpp', label: 'C++' };
  if (/\bpackage\s+\w+|\bfunc\s+\w+\s*\(|fmt\./.test(code)) return { lang: 'go', label: 'Go' };
  return { lang: 'js', label: 'JavaScript' };
}
