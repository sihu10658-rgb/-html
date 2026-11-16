const REGEX_PREFIX_KEYWORDS = new Set([
  'return', 'throw', 'case', 'delete', 'void', 'typeof',
  'instanceof', 'in', 'of', 'yield', 'await', 'else', 'do'
]);

function minifyTokens(code, lineComments = true) {
  let out = '';
  let pendingSpace = false;
  let canStartRegex = true;
  const isWord = ch => !!ch && /[\w$]/.test(ch);

  for (let i = 0; i < code.length;) {
    const c = code[i];
    const n = code[i + 1] || '';
    if (/\s/.test(c)) { pendingSpace = true; i++; continue; }
    if (c === '/' && n === '/' && lineComments) {
      i += 2;
      while (i < code.length && code[i] !== '\n' && code[i] !== '\r') i++;
      pendingSpace = true;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      if (i < code.length) i += 2;
      pendingSpace = true;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      if (pendingSpace && isWord(out[out.length - 1])) out += ' ';
      pendingSpace = false;
      const quote = c;
      out += c;
      i++;
      while (i < code.length) {
        const current = code[i++];
        out += current;
        if (current === '\\' && i < code.length) out += code[i++];
        else if (current === quote) break;
      }
      canStartRegex = false;
      continue;
    }
    if (c === '/' && canStartRegex) {
      if (pendingSpace && isWord(out[out.length - 1])) out += ' ';
      pendingSpace = false;
      out += c;
      i++;
      let inCharacterClass = false;
      while (i < code.length) {
        const current = code[i++];
        out += current;
        if (current === '\\' && i < code.length) out += code[i++];
        else if (current === '[') inCharacterClass = true;
        else if (current === ']') inCharacterClass = false;
        else if (current === '/' && !inCharacterClass) {
          while (i < code.length && /[a-z]/i.test(code[i])) out += code[i++];
          break;
        } else if (current === '\n' || current === '\r') break;
      }
      canStartRegex = false;
      continue;
    }
    if (pendingSpace && isWord(out[out.length - 1]) && isWord(c)) out += ' ';
    pendingSpace = false;
    if (/[\w$]/.test(c)) {
      const start = i;
      while (i < code.length && /[\w$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      out += word;
      canStartRegex = REGEX_PREFIX_KEYWORDS.has(word);
      continue;
    }
    out += c;
    i++;
    if (c === ')' || c === ']' || c === '}' || c === '.' || c === '`') canStartRegex = false;
    else if ('([{,;:?=!~+-*/%&|^'.includes(c)) canStartRegex = true;
  }
  return out.trim();
}

function minifyCSS(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').trim();
}

function findScriptClose(code, start) {
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let regexAllowed = true;
  for (let i = start; i < code.length;) {
    const c = code[i];
    const n = code[i + 1] || '';
    if (!quote && !lineComment && !blockComment && /^<\/script\s*>/i.test(code.slice(i))) {
      const match = code.slice(i).match(/^<\/script\s*>/i);
      return { index: i, end: i + match[0].length };
    }
    if (lineComment) { if (c === '\n' || c === '\r') lineComment = false; i++; continue; }
    if (blockComment) {
      if (c === '*' && n === '/') { blockComment = false; i += 2; }
      else i++;
      continue;
    }
    if (quote) {
      if (c === '\\') i += Math.min(2, code.length - i);
      else { if (c === quote) quote = null; i++; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '/' && n === '/') { lineComment = true; i += 2; continue; }
    if (c === '/' && n === '*') { blockComment = true; i += 2; continue; }
    if (c === '/' && regexAllowed) {
      i++;
      let inClass = false;
      while (i < code.length) {
        const current = code[i++];
        if (current === '\\') i++;
        else if (current === '[') inClass = true;
        else if (current === ']') inClass = false;
        else if (current === '/' && !inClass) {
          while (i < code.length && /[a-z]/i.test(code[i])) i++;
          break;
        } else if (current === '\n' || current === '\r') break;
      }
      regexAllowed = false;
      continue;
    }
    if (/[\w$]/.test(c)) {
      const wordStart = i;
      while (i < code.length && /[\w$]/.test(code[i])) i++;
      regexAllowed = REGEX_PREFIX_KEYWORDS.has(code.slice(wordStart, i));
      continue;
    }
    if (!/\s/.test(c)) regexAllowed = !(/[)\]}]/.test(c) || c === ',');
    i++;
  }
  return null;
}

function minifyCode(code, lang) {
  if (!code || !code.trim()) return '';
  if (lang === 'html') {
    const clean = code.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_, open, body, close) => open + minifyCSS(body) + close);
    const scriptOpen = /<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi;
    let result = '';
    let last = 0;
    let opening;
    while ((opening = scriptOpen.exec(clean))) {
      const bodyStart = scriptOpen.lastIndex;
      const closing = findScriptClose(clean, bodyStart);
      if (!closing) {
        result += clean.slice(last, bodyStart) + minifyTokens(clean.slice(bodyStart), true);
        last = clean.length;
        break;
      }
      const body = minifyTokens(clean.slice(bodyStart, closing.index), true).replace(/<\/script/gi, '<\\/script');
      result += clean.slice(last, bodyStart) + body + clean.slice(closing.index, closing.end);
      last = closing.end;
      scriptOpen.lastIndex = closing.end;
    }
    if (last < clean.length) result += clean.slice(last);
    return result.replace(/>\s+</g, '><').trim();
  }
  if (lang === 'css') return minifyCSS(code);
  if (['js', 'c', 'cpp', 'go'].includes(lang)) return minifyTokens(code, true);
  if (lang === 'python') return code.split('\n').filter(line => line.trim()).join('\n');
  return code;
}
