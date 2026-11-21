'use strict';

// Classic script: the app can be opened from file://. Formatter/minifier libraries
// are pinned browser builds loaded by code.html; no source is evaluated or executed.
(() => {
  const LABELS = {
    html: 'HTML', css: 'CSS', js: 'JavaScript', python: 'Python',
    c: 'C', cpp: 'C++', go: 'Go'
  };
  const FORMAT_PARSERS = { html: 'html', css: 'css', js: 'babel' };

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

    // Prefer distinctive syntax first. Generic calls such as print() are deliberately
    // not treated as Python because they are also valid in JavaScript.
    if (/<!doctype\s+html|<\/?(?:html|head|body|div|main|section|script|style)\b/i.test(code)) return 'html';
    if (/\b(?:std::|cout\s*<<|cin\s*>>)|^\s*using\s+namespace\s+std\s*;/m.test(code)) return 'cpp';
    if (/^\s*package\s+\w+\s*$|^\s*func\s+\w+\s*\(|\bfmt\.(?:Print|Scan)/m.test(code)) return 'go';
    if (/^\s*(?:def\s+\w+|class\s+\w+\s*(?:\(|:)|from\s+\w+\s+import\s+|import\s+\w+\s*$)/m.test(code)) return 'python';
    if (/^\s*#include\s*[<"]|\b(?:printf|scanf)\s*\(/m.test(code)) return 'c';
    if (/^\s*(?:@media\b|[.#][\w-]+(?:\s+[.#]?[\w-]+)*\s*\{|(?:color|background|display|margin|padding|font-size)\s*:)/im.test(code)) return 'css';
    return 'js';
  }

  function selectedLanguage(select, source) {
    return select.value === 'auto' ? detectLanguage(source) : select.value;
  }

  function formatCode(source, language) {
    const parser = FORMAT_PARSERS[language];
    if (!parser) {
      throw new Error(`현재는 ${LABELS[language] || language} 정렬을 지원하지 않습니다. 원문은 변경하지 않았습니다.`);
    }
    if (!window.prettier || !window.prettierPlugins) {
      throw new Error('정렬 도구를 불러오지 못했습니다. 인터넷 연결과 CDN 접속을 확인하세요. 원문은 변경하지 않았습니다.');
    }

    const pluginNames = language === 'js'
      ? ['babel', 'estree']
      : language === 'html'
        ? ['html']
        : ['postcss'];
    const plugins = pluginNames.map((name) => window.prettierPlugins[name]).filter(Boolean);
    if (plugins.length !== pluginNames.length) {
      throw new Error('정렬 플러그인을 불러오지 못했습니다. 원문은 변경하지 않았습니다.');
    }

    return window.prettier.format(source, {
      parser,
      plugins,
      tabWidth: 2,
      printWidth: 100,
      singleQuote: true,
      semi: true
    });
  }

  async function minifyCode(source, language) {
    if (language === 'css') {
      if (!window.csso || typeof window.csso.minify !== 'function') {
        throw new Error('CSS 압축 도구를 불러오지 못했습니다. 인터넷 연결과 CDN 접속을 확인하세요. 원문은 변경하지 않았습니다.');
      }
      const result = window.csso.minify(source);
      if (!result || typeof result.css !== 'string') {
        throw new Error('CSS 압축 결과를 만들지 못했습니다. 원문은 변경하지 않았습니다.');
      }
      return result.css;
    }

    if (language !== 'js') {
      throw new Error(`실제 압축은 JavaScript와 CSS만 지원합니다. ${LABELS[language] || language} 원문은 변경하지 않았습니다.`);
    }
    if (!window.Terser || typeof window.Terser.minify !== 'function') {
      throw new Error('JavaScript 압축 도구를 불러오지 못했습니다. 인터넷 연결과 CDN 접속을 확인하세요. 원문은 변경하지 않았습니다.');
    }

    // Terser parses JavaScript before rewriting it. Compression/mangling are disabled
    // to avoid changing runtime semantics or public names; whitespace/comments shrink.
    const result = await window.Terser.minify(source, {
      compress: false,
      mangle: false,
      format: { comments: 'some' }
    });
    if (!result || typeof result.code !== 'string') {
      throw new Error('압축 결과를 만들지 못했습니다. 원문은 변경하지 않았습니다.');
    }
    return result.code;
  }

  function init() {
    const language = byId('language');
    const input = byId('inputCode');
    const output = byId('outputCode');
    const detected = byId('detectedLang');
    const capability = byId('capabilityStatus');
    const inputStats = byId('inputStats');
    const outputStats = byId('outputStats');
    let actionVersion = 0;

    function updateLanguageStatus() {
      const selected = selectedLanguage(language, input.value);
      const prefix = language.value === 'auto' ? '감지' : '선택';
      detected.textContent = `${prefix}: ${LABELS[selected] || LABELS.js}`;
      const canFormat = Object.hasOwn(FORMAT_PARSERS, selected);
      const canMinify = selected === 'js' || selected === 'css';
      const actions = [canFormat ? '정렬 지원' : '정렬 미지원', canMinify ? '압축 지원' : '압축 미지원'];
      capability.textContent = `${LABELS[selected] || selected}: ${actions.join(' · ')}`;
      return selected;
    }

    function updateStats() {
      const before = byteSize(input.value);
      const after = byteSize(output.value);
      const reduction = before ? ((before - after) / before) * 100 : 0;
      inputStats.textContent = `입력 크기: ${before} bytes`;
      outputStats.textContent = `결과 크기: ${after} bytes (절감률: ${reduction.toFixed(1)}%)`;
    }

    async function run(operation) {
      const thisAction = ++actionVersion;
      const source = input.value;
      const lang = updateLanguageStatus();
      if (!source.trim()) {
        output.value = '';
        updateStats();
        detected.textContent = '입력 코드가 비어 있습니다.';
        return;
      }

      detected.textContent = operation === 'format' ? '정렬 중…' : '압축 중…';
      try {
        const result = operation === 'format'
          ? await formatCode(source, lang)
          : await minifyCode(source, lang);
        // Do not publish a stale result if the user edited the input meanwhile.
        if (thisAction !== actionVersion || input.value !== source) return;
        output.value = result;
        updateStats();
        detected.textContent = operation === 'format' ? '정렬 완료' : '압축 완료';
      } catch (error) {
        if (thisAction !== actionVersion) return;
        console.warn('Transformation was not applied:', error);
        detected.textContent = error instanceof Error ? error.message : '변환에 실패했습니다. 원문은 변경하지 않았습니다.';
      }
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
      actionVersion++;
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
