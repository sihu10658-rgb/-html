'use strict';

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
    if (/<!doctype\s+html|<\/\?(?:xml)|<\/?(?:html|head|body|div|main|section|script|style)\b/i.test(code)) return 'html';
    if (/\b(?:std::|cout\s*<<|cin\s*>>)|^\s*using\s+namespace\s+std\s*;/m.test(code)) return 'cpp';
    if (/^\s*package\s+\w+\s*$|^\s*func\s+\w+\s*\(|\bfmt\.(?:Print|Scan)/m.test(code)) return 'go';
    if (/^\s*(?:def\s+\w+|class\s+\w+(?:\s*\(|\s*:)|from\s+\w+\s+import\s+|import\s+\w+\s*$)/m.test(code)) return 'python';
    if (/^\s*#include\s*[<"]|\b(?:printf|scanf)\s*\(/m.test(code)) return 'c';
    if (/^\s*(?:@media\b|[.#][\w-]+(?:\s+[.#]?[\w-]+)*\s*\{|(?:color|background|display|margin|padding|font-size)\s*:)/im.test(code)) return 'css';
    return 'js';
  }

  function selectedLanguage(select, source) {
    return select.value === 'auto' ? detectLanguage(source) : select.value;
  }

  function formatCode(source, language) {
    const parser = FORMAT_PARSERS[language];
    if (!parser) throw new Error(`현재는 ${LABELS[language] || language} 정렬을 지원하지 않습니다. 원문은 변경하지 않았습니다.`);
    if (!window.prettier || !window.prettierPlugins) throw new Error('정렬 도구를 불러오지 못했습니다. 원문은 변경하지 않았습니다.');

    const pluginNames = language === 'js' ? ['babel', 'estree'] : language === 'html' ? ['html'] : ['postcss'];
    const plugins = pluginNames.map((name) => window.prettierPlugins[name]).filter(Boolean);
    if (plugins.length !== pluginNames.length) throw new Error('정렬 플러그인을 불러오지 못했습니다. 원문은 변경하지 않았습니다.');

    return window.prettier.format(source, { parser, plugins, tabWidth: 2, printWidth: 100, singleQuote: true, semi: true });
  }

  async function minifyCode(source, language) {
    if (language === 'css') {
      if (!window.csso || typeof window.csso.minify !== 'function') throw new Error('CSS 압축 도구를 불러오지 못했습니다.');
      const result = window.csso.minify(source);
      if (!result || typeof result.css !== 'string') throw new Error('CSS 압축 결과를 만들지 못했습니다.');
      return result.css;
    }
    if (language !== 'js') throw new Error(`실제 압축은 JavaScript와 CSS만 지원합니다. ${LABELS[language] || language} 원문은 변경하지 않았습니다.`);
    if (!window.Terser || typeof window.Terser.minify !== 'function') throw new Error('JavaScript 압축 도구를 불러오지 못했습니다.');

    const result = await window.Terser.minify(source, { compress: false, mangle: false, format: { comments: 'some' } });
    if (!result || typeof result.code !== 'string') throw new Error('압축 결과를 만들지 못했습니다.');
    return result.code;
  }

  function checkJavaScript(source) {
    const problems = [];
    try {
      new Function(source);
    } catch (error) {
      return [`JavaScript 문법 오류: ${error.message}`];
    }

    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/\b(?:eval|document\.write)\s*\(/.test(line)) problems.push(`${index + 1}행: 실행 중 위험이 있는 API 사용`);
      if (/console\.log\s*\(/.test(line)) problems.push(`${index + 1}행: 디버그 로그 사용`);
      if (/\b(?:==)\b/.test(line) && !/===/.test(line)) problems.push(`${index + 1}행: 느슨한 비교(==)를 발견했습니다. === 비교를 고려하세요.`);
    });

    if (/\b(?:null|undefined)/.test(source)) problems.push('null 또는 undefined 관련 표현을 확인하세요.');
    return problems;
  }

  function checkHtml(source) {
    const problems = [];
    const stack = [];
    const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const tokens = source.match(/<\/?[a-z][^>]*>/gi) || [];

    if (!/^\s*<!doctype\s+html/i.test(source)) problems.push('DOCTYPE 선언이 없습니다.');
    tokens.forEach((token) => {
      const opening = /^<([a-z][\w:-]*)/i.exec(token);
      if (!opening) return;
      const name = opening[1].toLowerCase();
      if (/^<\//.test(token)) {
        const expected = stack.pop();
        if (expected !== name) problems.push(`닫는 태그에 문제가 있습니다: </${name}> (열린 태그: ${expected || '없음'})`);
      } else if (!/\/\s*>$/.test(token) && !voidTags.has(name)) {
        stack.push(name);
      }
    });
    stack.forEach((name) => problems.push(`닫히지 않은 태그: <${name}>`));
    return problems;
  }

  function checkCss(source) {
    const problems = [];
    const braces = [...source].filter((char) => char === '{').length - [...source].filter((char) => char === '}').length;
    if (braces !== 0) problems.push(braces > 0 ? 'CSS 중괄호가 닫히지 않았습니다.' : 'CSS에 여분의 닫는 중괄호가 있습니다.');
    if (/([^{};]+):\s*;/.test(source)) problems.push('값이 없는 CSS 속성이 있을 수 있습니다.');
    return problems;
  }

  function checkPython(source) {
    const problems = [];
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^(?:\s+)?(?:if|for|while|def|class).*[^:]\s*$/.test(line) && !/['"]/.test(line)) {
        problems.push(`${index + 1}행: 콜론(:)이 필요한 제어문 또는 함수 정의를 확인하세요.`);
      }
      if (/\bprint\s+[^(]/.test(line)) problems.push(`${index + 1}행: Python print는 print(...) 형식을 사용해야 합니다.`);
    });
    return problems;
  }

  function checkCFamily(source) {
    const problems = [];
    const braceBalance = (source.match(/\{/g) || []).length - (source.match(/\}/g) || []).length;
    const parenBalance = (source.match(/\(/g) || []).length - (source.match(/\)/g) || []).length;
    if (braceBalance !== 0) problems.push(braceBalance > 0 ? '중괄호가 닫히지 않았습니다.' : '여분의 닫는 중괄호가 있습니다.');
    if (parenBalance !== 0) problems.push(parenBalance > 0 ? '소괄호가 닫히지 않았습니다.' : '여분의 닫는 소괄호가 있습니다.');
    if (/[^;{}]\s*\n/.test(source) && !source.includes('#include')) problems.push('세미콜론 누락 가능성을 확인하세요.');
    return problems;
  }

  function checkGo(source) {
    const problems = [];
    if (!/^\s*package\s+\w+/m.test(source)) problems.push('Go package 선언이 없습니다.');
    const braceBalance = (source.match(/\{/g) || []).length - (source.match(/\}/g) || []).length;
    if (braceBalance !== 0) problems.push('Go 중괄호 균형이 맞지 않습니다.');
    return problems;
  }

  function runBugCheck(source, language) {
    if (!source.trim()) return ['검사할 코드가 없습니다.'];
    let problems = [];
    if (language === 'js') problems = checkJavaScript(source);
    else if (language === 'html') problems = checkHtml(source);
    else if (language === 'css') problems = checkCss(source);
    else if (language === 'python') problems = checkPython(source);
    else if (language === 'c' || language === 'cpp') problems = checkCFamily(source);
    else if (language === 'go') problems = checkGo(source);

    return problems.length ? problems.map((problem, index) => `${index + 1}. ${problem}`) : ['문제가 발견되지 않았습니다. 하지만 완전한 컴파일 검사가 아니므로 실제 실행 테스트도 해주세요.'];
  }

  function init() {
    const language = byId('language');
    const input = byId('inputCode');
    const output = byId('outputCode');
    const detected = byId('detectedLang');
    const capability = byId('capabilityStatus');
    const inputStats = byId('inputStats');
    const outputStats = byId('outputStats');

    function updateStats() {
      inputStats.textContent = `입력 크기: ${byteSize(input.value)} bytes`;
      outputStats.textContent = `결과 크기: ${byteSize(output.value)} bytes`;
    }

    function updateLanguageStatus() {
      const selected = selectedLanguage(language, input.value);
      const prefix = language.value === 'auto' ? '감지' : '선택';
      detected.textContent = `${prefix}: ${LABELS[selected] || LABELS.js}`;
      capability.textContent = `${LABELS[selected] || selected}: 버그 검사 지원 · 정렬/압축은 일부 언어만 지원`;
      return selected;
    }

    language.addEventListener('change', updateLanguageStatus);
    input.addEventListener('input', () => { updateLanguageStatus(); updateStats(); });

    byId('btnCheck').addEventListener('click', () => {
      const selected = updateLanguageStatus();
      output.value = runBugCheck(input.value, selected).join('\n');
      updateStats();
      detected.textContent = '버그 검사 완료';
    });

    byId('btnFormat').addEventListener('click', async () => {
      try {
        const selected = updateLanguageStatus();
        output.value = await formatCode(input.value, selected);
        updateStats();
        detected.textContent = '정렬 완료';
      } catch (error) {
        detected.textContent = error instanceof Error ? error.message : '정렬에 실패했습니다.';
      }
    });

    byId('btnOptimize').addEventListener('click', async () => {
      try {
        const selected = updateLanguageStatus();
        output.value = await minifyCode(input.value, selected);
        updateStats();
        detected.textContent = '압축 완료';
      } catch (error) {
        detected.textContent = error instanceof Error ? error.message : '압축에 실패했습니다.';
      }
    });

    byId('btnCopy').addEventListener('click', async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(output.value);
        else {
          output.focus(); output.select();
          if (!document.execCommand('copy')) throw new Error('복사 실패');
        }
        detected.textContent = '결과를 복사했습니다.';
      } catch (error) {
        detected.textContent = '복사에 실패했습니다.';
      }
    });

    updateLanguageStatus();
    updateStats();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
