import { detectLanguage, minifyCode, formatCode, getByteSize } from './optimizer.js';

const inputArea = document.getElementById('inputCode');
const outputArea = document.getElementById('outputCode');
const langSelect = document.getElementById('language');
const detectedLangText = document.getElementById('detectedLang');

function getCurrentLanguage() {
    if (langSelect.value === 'auto') {
        const result = detectLanguage(inputArea.value);
        detectedLangText.innerText = `감지된 언어: ${result.label}`;
        return result.lang;
    }
    return langSelect.value;
}

function updateStats() {
    const inSize = getByteSize(inputArea.value);
    const outSize = getByteSize(outputArea.value);
    const ratio = inSize > 0 ? (((inSize - outSize) / inSize) * 100).toFixed(1) : 0;
    document.getElementById('outputStats').innerText = `크기: ${outSize} bytes (절감률: ${ratio}%)`;
}

// 입력 이벤트 처리
inputArea.addEventListener('input', () => {
    document.getElementById('inputStats').innerText = `크기: ${getByteSize(inputArea.value)} bytes`;
    getCurrentLanguage();
});

// 드롭다운 변경 처리
langSelect.addEventListener('change', () => {
    if (langSelect.value !== 'auto') {
        detectedLangText.innerText = `수동 지정: ${langSelect.options[langSelect.selectedIndex].text}`;
    } else {
        getCurrentLanguage();
    }
});

// 버튼 클릭 이벤트 연결
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
