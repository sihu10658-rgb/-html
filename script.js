'use strict';

// Classic script: this app can be opened directly from file://.
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

    // Detection only affects the label; it never selects a risky transformation.
    if (/<!doctype\s+html|<\/?(?:html|head|body|div|main|section|script|style)\b/i.test(code)) return 'html';
    if (/\b(?:std::|cout\s*<<|cin\s*>>)|^\s*using\s+namespace\s+std\s*;/m.test(code)) return 'cpp';
    if (/^\s*#include\s*[<"]|\b(?:printf|scanf)\s*\(/m.test(code)) return 'c';
    if (/^\s*package\s+\w+\s*$|^\s*func\s+\w+\s*\(|\bfmt\.(?:Print|Scan)/m.test(code)) return 'go';
    if (/^\s*(?:def\s+\w+|class\s+\w+\s*\(|from\s+\w+\s+import\s+|import\s+\w+)|^\s*print\s*\(/m.test(code)) return 'python';
    if (/^\s*(?:@media\b|[.#][\w-]+(?:\s+[.#]?[\w-]+)*\s*\{|(?:color|background|display|margin|padding|font-size)\s*:)/im.test(code)) return 'css';
    return 'js';
  }

  function selectedLanguage(select, source) {
    return select.value === 'auto' ? detectLanguage(source) : select.value;
  }

  // Fail-safe mode: regex-based formatting/minification can change program meaning.
  // Until language parsers and round-trip tests are added, return the exact input.
  function transform(source) {
    return source;
  }

  function init() {
    const language = byId('language');
    const input = byId('inputCode');
    const output = byId('outputCode');
    const detected = byId('detectedLang');
    const inputStats = byId('inputStats');
    const outputStats = byId('outputStats');

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
      updateLanguageStatus();
      output.value = transform(input.value, operation);
      updateStats();
      detected.textContent = input.value
        ? '안전 모드: 코드 손상 방지를 위해 원문을 그대로 출력했습니다.'
        : '입력 코드가 비어 있습니다.';
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
    byId('btnCopy').addEventListener('click', copyOutput);

    updateLanguageStatus();
    updateStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
