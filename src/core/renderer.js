export function renderShadowText(block, text) {
    if (!text) return;

    // 이미 내부에 원본 텍스트가 렌더링되어 있다면 중복 방지를 위해 스킵 (상위 컨테이너 중복 방지)
    if (block.querySelector('.echo-original-text')) {
        return;
    }

    // 불필요하게 쪼개진 공백 정리
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    const grayTextDiv = document.createElement('div');
    grayTextDiv.className = 'echo-original-text notranslate';
    grayTextDiv.setAttribute('translate', 'no');
    grayTextDiv.style.color = '#787878';
    grayTextDiv.style.fontSize = '0.9em';
    grayTextDiv.style.marginTop = '6px';
    grayTextDiv.style.textAlign = 'left';
    grayTextDiv.style.lineHeight = '1.4';
    grayTextDiv.style.whiteSpace = 'pre-wrap';
    grayTextDiv.style.opacity = '0.8';
    grayTextDiv.textContent = cleanText;

    block.appendChild(grayTextDiv);
}

export function clearShadowTexts(container = document) {
    container.querySelectorAll('.echo-original-text').forEach((el) => el.remove());
}
