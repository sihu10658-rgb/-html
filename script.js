'use strict';

// Keep this as a classic script (not an ES module) so the app also works from file://.
(() => {
  const LABELS = {
    html: 'HTML', css: 'CSS', js: 'JavaScript', python: 'Python',
    c: 'C', cpp: 'C++', go: 'Go'
  };

  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`필요한 화면 요소를 찾을 수 없습니다: #${id}`);
    return element;
  }

  function byteSize(text) {
    return new TextEncoder().encode(text).length;
  }

  function detectLanguage(source) {
    const code = source.trim();
    if (!code) return 'js';

    // Prioritize distinctive syntax; ambiguous snippets should be selected manually.
    if (/<!doctype\s+html|<\/?(?:html|head|body|div|main|section|script|style)\b/i.test(code)) return 'html';
    if (/^\s*#include\s*[<"]|\b(?:printf|scanf)\s*\(/m.test(code)) return 'c';
    if (/\b(?:std::|cout\s*<<|cin\s*>>)|^\s*using\s+namespace\s+std\s*;/m.test(code)) return 'cpp';
    if (/^\s*package\s+\w+\s*$|^\s*func\s+\w+\s*\(|\bfmt\.(?:Print|Scan)/m.test(code)) return 'go';
    if (/^\s*(?:def\s+\w+|class\s+\w+\s*\(|from\s+\w+\s+import\s+|import\s+\w+)|^\s*print\s*\(/m.test(code)) return 'python';
    if (/^[\s\S]*?(?:^|\n)\s*(?:@media\b|[.#][\w-]+(?:\s+[.#]?[\w-]+)*\s*\{|(?:color|background|display|margin|padding|font-size)\s*:)/im.test(code)) return 'css';
    return 'js';
  }

  function selectedLanguage(select, source) {
    return select.value === 'auto' ? detectLanguage(source) : select.value;
  }

  function minifyCss(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,])\s*/g, '$1')
      .replace(/;}/g, '}')
      .trim();
  }

  // Deliberately conservative: preserve spaces and comments when removing them could
  // change tokenization. A full JavaScript minifier requires a parser.
  function minifyJs(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|\s)\/\/[^\n\r]*/g, '$1')
      .replace(/[\t ]+/g, ' ')
      .replace(/\s*([{};,])\s*/g, '$1')
      .trim();
  }

  function minifyHtml(code) {
    // Avoid changing whitespace inside preformatted or text-sensitive elements.
    return code
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function formatHtml(code) {
    return code.replace(/>\s*</g, '>\n<').trim();
  }

  function formatCss(code) {
    return code
      .replace(/\s*\{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*\}\s*/g, '\n}\n')
      .replace(/\n[\t ]*\n+/g, '\n')
      .trim();
  }

  function formatBracedCode(code) {
    const lines = code.replace(/\s*([{};])\s*/g, '$1\n').split(/\r?\n/);
    let depth = 0;
    const formatted = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('}')) depth = Math.max(0, depth - 1);
      formatted.push(`${'  '.repeat(depth)}${line}`);
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      depth = Math.max(0, depth + opens - closes);
    }
    return formatted.join('\n');
  }

  function transform(source, language, operation) {
    if (!source.trim()) return '';
    if (operation === 'format') {
      if (language === 'html') return formatHtml(source);
      if (language === 'css') return formatCss(source);
      if (['js', 'c', 'cpp', 'go'].includes(language)) return formatBracedCode(source);
      return source; // Python indentation is meaningful; do not strip it.
    }

    if (language === 'html') return minifyHtml(source);
    if (language === 'css') return minifyCss(source);
    if (language === 'js') return minifyJs(source);
    // Whitespace and indentation are significant in Python and can be meaningful
    // in C-family languages too. Preserve source rather than risk corrupting it.
    return source;
  }

  function init() {
    const language = byId('language');
    const input = byId('inputCode');
    const output = byId('outputCode');
    const detected = byId('detectedLang');
    const inputStats = byId('inputStats');
    const outputStats = byId('outputStats');
    const copyButton = byId('btnCopy');

    function updateLanguageStatus() {
      const selected = selectedLanguage(language, input.value);
      const prefix = language.value === 'auto' ? '감지' : '선택';
      detected.textContent = `${prefix}: ${LABELS[selected] || LABELS.js}`;
      return selected;
    }

    function updateStats() {
      const before = byteSize(input.value);
      const after = byteSize(output.value);
      const reduction = before ? ((before - after) / before) * 100 : 0;
      inputStats.textContent = `입력 크기: ${before} bytes`;
      outputStats.textContent = `결과 크기: ${after} bytes (절감률: ${reduction.toFixed(1)}%)`;
    }

    function run(operation) {
      const lang = updateLanguageStatus();
      output.value = transform(input.value, lang, operation);
      updateStats();
    }

    async function copyOutput() {
      if (!output.value) {
        detected.textContent = '복사할 결과가 없습니다.';
        return;
      }
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(output.value);
        } else {
          output.focus();
          output.select();
          if (!document.execCommand('copy')) throw new Error('복사 명령이 지원되지 않습니다.');
          input.focus();
        }
        detected.textContent = '결과를 복사했습니다.';
      } catch (error) {
        console.error('Clipboard copy failed:', error);
        detected.textContent = '복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.';
      }
    }

    language.addEventListener('change', updateLanguageStatus);
    input.addEventListener('input', () => {
      updateLanguageStatus();
      updateStats();
    });
    byId('btnOptimize').addEventListener('click', () => run('minify'));
    byId('btnFormat').addEventListener('click', () => run('format'));
    copyButton.addEventListener('click', copyOutput);

    updateLanguageStatus();
    updateStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
