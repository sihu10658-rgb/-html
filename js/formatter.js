function formatCode(code, lang) {
  if (!code || !code.trim()) return '';
  if (lang === 'css') {
    return code
      .replace(/\s*\{\s*/g, ' {\n  ')
      .replace(/\s*;\s*/g, ';\n  ')
      .replace(/\s*\}\s*/g, '\n}\n\n')
      .trim();
  }
  if (['js', 'c', 'cpp', 'go'].includes(lang)) {
    let indent = 0;
    const result = [];
    for (const rawLine of code.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('}')) indent = Math.max(0, indent - 1);
      result.push('  '.repeat(indent) + line);
      if (line.endsWith('{')) indent++;
    }
    return result.join('\n');
  }
  return code;
}
