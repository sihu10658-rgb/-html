// app.js (맨 위 import 구문 삭제됨)
const inputArea = document.getElementById('inputCode');
const outputArea = document.getElementById('outputCode');
const langSelect = document.getElementById('language');
const detectedLangText = document.getElementById('detectedLang');

function getCurrentLanguage() {
    if (langSelect.value !== 'auto') {
        const selectedText = langSelect.options[langSelect.selectedIndex].text;
        detectedLangText.innerText = `수동 지정: ${selectedText}`;
        return langSelect.value;
    }

    const result = detectLanguage(inputArea.value);
    detectedLangText.innerText = `감지된 언어: ${result.label}`;
    return result.lang;
}

function updateStats() {
    const inSize = getByteSize(inputArea.value);
    const outSize = getByteSize(outputArea.value);
    const ratio = inSize > 0 ? (((inSize - outSize) / inSize) * 100).toFixed(1) : 0;
    document.getElementById('outputStats').innerText = `크기: ${outSize} bytes (절감률: ${ratio}%)`;
}

inputArea.addEventListener('input', () => {
    document.getElementById('inputStats').innerText = `크기: ${getByteSize(inputArea.value)} bytes`;
    getCurrentLanguage();
});

langSelect.addEventListener('change', () => {
    getCurrentLanguage();
});

document.getElementById('btnOptimize').addEventListener('click', () => {
    const lang = getCurrentLanguage();
    outputArea.value = minifyCode(inputArea.value, lang);
    updateStats();
});

document.getElementById('btnFormat').addEventListener('click', () => {
    const lang = getCurrentLanguage();
    outputArea.value = formatCode(inputArea.value, lang);
    updateStats();
});

document.getElementById('btnCopy').addEventListener('click', () => {
    if (!outputArea.value) return;
    outputArea.select();
    document.execCommand('copy');
    alert('클립보드에 복사되었습니다!');
});
