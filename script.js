'use strict';

// Browser-only tools: input is parsed/transformed as text and is never executed.
(() => {
  const LABELS = {
    html: 'HTML', css: 'CSS', js: 'JavaScript', python: 'Python',
    c: 'C', cpp: 'C++', go: 'Go'
  };
  const FORMAT_PARSERS = { html: 'html', css: 'css', js: 'babel' };
  const RAW_HTML_TAGS = new Set(['pre', 'textarea', 'script', 'style']);

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

  function formatCode(source, language) {
    const parser = FORMAT_PARSERS[language];
    if (!parser) throw new Error(`현재는 ${LABELS[language] || language} 정렬을 지원하지 않습니다. 원문은 변경하지 않았습니다.`);
    if (!window.prettier || !window.prettierPlugins) {
      throw new Error('정렬 도구를 불러오지 못했습니다. 인터넷 연결과 CDN 접속을 확인하세요. 원문은 변경하지 않았습니다.');
    }
    const pluginNames = language === 'js' ? ['babel', 'estree'] : language === 'html' ? ['html'] : ['postcss'];
    const plugins = pluginNames.map((name) => window.prettierPlugins[name]).filter(Boolean);
    if (plugins.length !== pluginNames.length) throw new Error('정렬 플러그인을 불러오지 못했습니다. 원문은 변경하지 않았습니다.');
    return window.prettier.format(source, {
      parser, plugins, tabWidth: 2, printWidth: 100, singleQuote: true, semi: true
    });
  }

  // A small tokenizer-based CSS whitespace minifier. Quoted strings and URLs are
  // copied verbatim; whitespace is only removed where CSS tokenization permits it.
  function minifyCss(source) {
    let result = '';
    let pendingSpace = false;
    let quote = '';
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];
      if (quote) {
        result += ch;
        if (ch === '\\' && i + 1 < source.length) result += source[++i];
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        if (pendingSpace && /[\w$#.)%]/.test(result.slice(-1))) result += ' ';
        pendingSpace = false;
        quote = ch;
        result += ch;
        continue;
      }
      if (ch === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        if (end === -1) throw new Error('CSS 주석이 닫히지 않았습니다. 원문은 변경하지 않았습니다.');
        const comment = source.slice(i, end + 2);
        if (comment.startsWith('/*!')) {
          if (pendingSpace && /[\w$#.)%]/.test(result.slice(-1))) result += ' ';
          result += comment;
        }
        i = end + 1;
        continue;
      }
      if (/\s/.test(ch)) {
        pendingSpace = true;
        continue;
      }
      if (pendingSpace && /[\w$#.)%]/.test(result.slice(-1)) && /[\w$#.(%-]/.test(ch)) result += ' ';
      pendingSpace = false;
      if (ch === ';' && next === '}') continue;
      result += ch;
    }
    if (quote) throw new Error('CSS 문자열이 닫히지 않았습니다. 원문은 변경하지 않았습니다.');
    return result.trim();
  }

  function findTagEnd(source, start) {
    let quote = '';
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') return i;
    }
    return -1;
  }

  function minifyHtml(source) {
    let result = '';
    let cursor = 0;
    let rawTag = '';
    while (cursor < source.length) {
      if (rawTag) {
        const closePattern = new RegExp(`<\\/\\s*${rawTag}\\s*>`, 'i');
        const remainder = source.slice(cursor);
        const match = closePattern.exec(remainder);
        if (!match) return result + remainder;
        result += remainder.slice(0, match.index) + match[0];
        cursor += match.index + match[0].length;
        rawTag = '';
        continue;
      }
      if (source.startsWith('<!--', cursor)) {
        const end = source.indexOf('-->', cursor + 4);
        if (end === -1) throw new Error('HTML 주석이 닫히지 않았습니다. 원문은 변경하지 않았습니다.');
        const comment = source.slice(cursor, end + 3);
        if (/^<!--[\s\S]*?--!?>$/.test(comment) && (/^<!--\s*\[if\b/i.test(comment) || /^<!--\s*!/.test(comment))) result += comment;
        cursor = end + 3;
        continue;
      }
      if (source[cursor] === '<') {
        const end = findTagEnd(source, cursor + 1);
        if (end === -1) {
          result += source.slice(cursor);
          break;
        }
        let tag = source.slice(cursor, end + 1);
        tag = tag.replace(/\s*=\s*/g, '=').replace(/\s+\/>$/, '/>').replace(/\s+>/, '>');
        result += tag;
        const opening = /^<\s*([a-z][\w:-]*)\b/i.exec(tag);
        const closing = /^<\s*\//.test(tag);
        if (opening && !closing && RAW_HTML_TAGS.has(opening[1].toLowerCase()) && !/\/\s*>$/.test(tag)) rawTag = opening[1];
        cursor = end + 1;
        continue;
      }
      const nextTag = source.indexOf('<', cursor);
      const end = nextTag === -1 ? source.length : nextTag;
      const text = source.slice(cursor, end);
      // Preserve text content while folding runs of ordinary HTML whitespace.
      result += text.replace(/[\t\n\f\r ]+/g, ' ');
      cursor = end;
    }
    return result.trim();
  }

  async function minifyCode(source, language) {
    if (language === 'html') return minifyHtml(source);
    if (language === 'css') return minifyCss(source);
    if (language !== 'js') throw new Error(`실제 압축은 HTML, CSS, JavaScript를 지원합니다. ${LABELS[language] || language} 원문은 변경하지 않았습니다.`);
    if (!window.Terser || typeof window.Terser.minify !== 'function') {
      throw new Error('JavaScript 압축 도구를 불러오지 못했습니다. 인터넷 연결과 CDN 접속을 확인하세요. 원문은 변경하지 않았습니다.');
    }
    const result = await window.Terser.minify(source, {
      compress: false, mangle: false, format: { comments: 'some' }
    });
    if (!result || typeof result.code !== 'string') throw new Error('압축 결과를 만들지 못했습니다. 원문은 변경하지 않았습니다.');
    return result.code;
  }

  // Heuristic hints only: these are not a parser, security audit, or proof of a bug.
  function findPotentialIssues(source, language) {
    const warnings = [];
    if (language === 'js') {
      const checks = [
        [/\beval\s*\(/, 'eval()은 동적 코드 실행으로 보안·유지보수 위험이 있습니다.'],
        [/\bdocument\.write\s*\(/, 'document.write()는 문서 로딩·입력 처리에서 예기치 않은 결과를 만들 수 있습니다.'],
        [/\bvar\s+[$\w]+/, 'var는 함수 범위로 동작합니다. let/const 사용이 의도에 맞는지 확인하세요.'],
        [/===?\s*[^=]|[^=!]==[^=]/, '느슨한 동등 비교(==)가 있는지 확인하세요.']
      ];
      for (const [pattern, message] of checks) {
        const match = pattern.exec(source);
        if (match) warnings.push({ line: source.slice(0, match.index).split('\n').length, message });
      }
    } else if (language === 'html') {
      const seenIds = new Set();
      const idPattern = /\bid\s*=\s*(["'])(.*?)\1/gi;
      let match;
      while ((match = idPattern.exec(source))) {
        if (seenIds.has(match[2])) {
          warnings.push({ line: source.slice(0, match.index).split('\n').length, message: `중복된 id="${match[2]}"가 있습니다.` });
          break;
        }
        seenIds.add(match[2]);
      }
      const unsafeLink = /<a\b(?=[^>]*\btarget\s*=\s*["']_blank["'])(?![^>]*\brel\s*=)[^>]*>/i.exec(source);
      if (unsafeLink) warnings.push({ line: source.slice(0, unsafeLink.index).split('\n').length, message: 'target="_blank" 링크에 rel="noopener noreferrer"를 추가하는 것이 좋습니다.' });
      const inlineHandler = /\bon[a-z]+\s*=\s*["']/i.exec(source);
      if (inlineHandler) warnings.push({ line: source.slice(0, inlineHandler.index).split('\n').length, message: '인라인 이벤트 핸들러는 콘텐츠 보안 정책과 유지보수 영향을 확인하세요.' });
    }
    return warnings;
  }

  function init() {
    const language = byId('language');
    const input = byId('inputCode');
    const output = byId('outputCode');
    const detected = byId('detectedLang');
    const inputStats = byId('inputStats');
    const outputStats = byId('outputStats');
    const alert = byId('statusMessage');
    const diagnostics = byId('diagnostics');
    let actionVersion = 0;

    function setMessage(message, type = 'info') {
      alert.textContent = message;
      alert.className = `status-message ${type}`;
      alert.hidden = !message;
    }

    function renderDiagnostics() {
      const lang = selectedLanguage(language, input.value);
      const warnings = findPotentialIssues(input.value, lang);
      diagnostics.replaceChildren();
      const heading = document.createElement('h2');
      heading.textContent = warnings.length ? `⚠️ 잠재적 주의 사항 ${warnings.length}건` : '코드 진단';
      diagnostics.appendChild(heading);
      if (!input.value.trim()) {
        const empty = document.createElement('p');
        empty.textContent = '코드를 입력하면 간단한 잠재 이슈 검사를 시작합니다.';
        diagnostics.appendChild(empty);
        return;
      }
      if (!warnings.length) {
        const clean = document.createElement('p');
        clean.textContent = '감지된 항목이 없습니다. 이 검사는 일부 패턴만 확인하며 코드가 안전하거나 오류가 없음을 보장하지 않습니다.';
        diagnostics.appendChild(clean);
        return;
      }
      const list = document.createElement('ul');
      for (const warning of warnings) {
        const item = document.createElement('li');
        item.textContent = `${warning.line}번째 줄: ${warning.message}`;
        list.appendChild(item);
      }
      diagnostics.appendChild(list);
      const note = document.createElement('p');
      note.className = 'diagnostics-note';
      note.textContent = '자동 진단은 휴리스틱 기반 안내이며, 문법 검사나 보안 검토를 대체하지 않습니다.';
      diagnostics.appendChild(note);
    }

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

    async function run(operation) {
      const thisAction = ++actionVersion;
      const source = input.value;
      const lang = updateLanguageStatus();
      if (!source.trim()) {
        output.value = '';
        updateStats();
        setMessage('입력 코드가 비어 있습니다.', 'warning');
        return;
      }
      setMessage(operation === 'format' ? '정렬 중…' : '압축 중…', 'info');
      try {
        const result = operation === 'format' ? await formatCode(source, lang) : await minifyCode(source, lang);
        if (thisAction !== actionVersion || input.value !== source) return;
        output.value = result;
        updateStats();
        setMessage(operation === 'format' ? '정렬을 완료했습니다.' : `${LABELS[lang] || lang} 압축을 완료했습니다.`, 'success');
      } catch (error) {
        if (thisAction !== actionVersion) return;
        console.warn('Transformation was not applied:', error);
        setMessage(error instanceof Error ? error.message : '변환에 실패했습니다. 원문은 변경하지 않았습니다.', 'error');
      }
    }

    async function copyOutput() {
      if (!output.value) {
        setMessage('복사할 결과가 없습니다.', 'warning');
        return;
      }
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(output.value);
        else {
          output.focus();
          output.select();
          if (!document.execCommand('copy')) throw new Error('복사 명령이 지원되지 않습니다.');
          input.focus();
        }
        setMessage('결과를 복사했습니다.', 'success');
      } catch (error) {
        console.error('Clipboard copy failed:', error);
        setMessage('복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.', 'error');
      }
    }

    language.addEventListener('change', () => { updateLanguageStatus(); renderDiagnostics(); });
    input.addEventListener('input', () => {
      actionVersion++;
      updateLanguageStatus();
      updateStats();
      renderDiagnostics();
    });
    byId('btnOptimize').addEventListener('click', () => run('minify'));
    byId('btnFormat').addEventListener('click', () => run('format'));
    byId('btnCopy').addEventListener('click', copyOutput);
    updateLanguageStatus();
    updateStats();
    renderDiagnostics();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
