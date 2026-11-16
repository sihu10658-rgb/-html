document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('inputCode');
  const output = document.getElementById('outputCode');
  const language = document.getElementById('language');
  const detected = document.getElementById('detectedLang');
  const inputStats = document.getElementById('inputStats');
  const outputStats = document.getElementById('outputStats');

  function currentLanguage() {
    if (language.value !== 'auto') {
      detected.textContent = `수동 지정: ${language.options[language.selectedIndex].text}`;
      return language.value;
    }
    const result = detectLanguage(input.value);
    detected.textContent = `감지된 언어: ${result.label}`;
    return result.lang;
  }

  function updateStats() {
    const before = new Blob([input.value || '']).size;
    const after = new Blob([output.value || '']).size;
    const ratio = before ? (((before - after) / before) * 100).toFixed(1) : '0';
    outputStats.textContent = `크기: ${after} bytes (절감률: ${ratio}%)`;
  }

  input.addEventListener('input', () => {
    inputStats.textContent = `크기: ${new Blob([input.value || '']).size} bytes`;
    currentLanguage();
  });
  language.addEventListener('change', currentLanguage);
  document.getElementById('btnOptimize').addEventListener('click', () => {
    output.value = minifyCode(input.value, currentLanguage());
    updateStats();
  });
  document.getElementById('btnFormat').addEventListener('click', () => {
    output.value = formatCode(input.value, currentLanguage());
    updateStats();
  });
  document.getElementById('btnCopy').addEventListener('click', async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      alert('클립보드에 복사되었습니다!');
    } catch (error) {
      output.select();
      document.execCommand('copy');
      alert('클립보드에 복사되었습니다!');
    }
  });
});
