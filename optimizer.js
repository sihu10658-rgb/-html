// optimizer.js
function detectLanguage(code) {
    if (!code.trim()) return { lang: 'js', label: '없음' };
    if (/<[a-z][\s\S]*>/i.test(code)) return { lang: 'html', label: 'HTML' };
    if (/#include|std::|cout/i.test(code)) return { lang: 'cpp', label: 'C++' };
    if (/def\s+\w+|import\s+\w+|print\(/i.test(code)) return { lang: 'python', label: 'Python' };
    if (/[\.#]?\w+\s*\{/i.test(code) && !/function|const|let|var/.test(code)) return { lang: 'css', label: 'CSS' };
    return { lang: 'js', label: 'JavaScript' };
}

function minifyCode(code, lang) {
    if (!code.trim()) return '';

    switch (lang) {
        case 'html':
            return code
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/>\s+</g, '><')
                .replace(/\s+/g, ' ');

        case 'css':
            return code
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\s*([\{\}\:\;\,])\s*/g, '$1')
                .replace(/\s+/g, ' ');

        case 'js':
            return code
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '')
                .replace(/\s*([\{\}\(\)\=\+\-\*\/\:\;\,\<\>])\s*/g, '$1')
                .replace(/\s+/g, ' ');

        case 'python':
            return code
                .split('\n')
                .map(line => line.replace(/#.*/, ''))
                .filter(line => line.trim() !== '')
                .join('\n');

        case 'cpp':
            return code
                .split('\n')
                .map(line => line.replace(/\/\/.*/, '').trim())
                .filter(Boolean)
                .join(' ');

        default:
            return code;
    }
}

function formatCode(code, lang) {
    if (!code.trim()) return '';

    if (lang === 'css') {
        return code
            .replace(/\s*\{\s*/g, ' {\n  ')
            .replace(/\s*;\s*/g, ';\n  ')
            .replace(/\s*\}\s*/g, '\n}\n\n');
    }

    if (lang === 'js' || lang === 'cpp') {
        let indent = 0;
        return code.split('\n').map(line => {
            let trimmed = line.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('}')) indent = Math.max(0, indent - 1);
            let indentedLine = '  '.repeat(indent) + trimmed;
            if (trimmed.endsWith('{')) indent++;
            return indentedLine;
        }).filter(Boolean).join('\n');
    }

    return code;
}

function getByteSize(str) {
    return new Blob([str]).size;
}
