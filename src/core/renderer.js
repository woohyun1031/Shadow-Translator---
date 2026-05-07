import { structuralTags } from '../utils/dom';

export function renderShadowText(block, text) {
    if (!text) return;

    // 직계 자식 중에서 이미 렌더링된 원본 텍스트 컨테이너가 있는지 확인
    let grayTextDiv = null;
    for (let child of block.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains('echo-original-text')) {
            grayTextDiv = child;
            break;
        }
    }

    // 불필요하게 쪼개진 공백 정리
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) {
        if (grayTextDiv) grayTextDiv.remove();
        return;
    }

    if (!grayTextDiv) {
        grayTextDiv = document.createElement('div');
        grayTextDiv.className = 'echo-original-text notranslate';
        grayTextDiv.setAttribute('translate', 'no');
        grayTextDiv.style.color = '#787878';
        grayTextDiv.style.fontSize = '0.9em';
        grayTextDiv.style.marginTop = '6px';
        grayTextDiv.style.textAlign = 'left';
        grayTextDiv.style.lineHeight = '1.4';
        grayTextDiv.style.whiteSpace = 'pre-wrap';
        grayTextDiv.style.opacity = '0.8';

        // 가장 가까운 다음 블록 요소(예: <p>)를 찾아 그 앞에 삽입하여, 번역문 바로 아래 위치하도록 보장
        let insertBeforeNode = null;
        for (let child of block.childNodes) {
            if (
                child.nodeType === Node.ELEMENT_NODE &&
                structuralTags.has(child.tagName.toUpperCase())
            ) {
                insertBeforeNode = child;
                break;
            }
        }

        if (insertBeforeNode) {
            block.insertBefore(grayTextDiv, insertBeforeNode);
        } else {
            block.appendChild(grayTextDiv);
        }
    }

    grayTextDiv.textContent = cleanText;
}

export function clearShadowTexts(container = document) {
    container.querySelectorAll('.echo-original-text').forEach((el) => el.remove());
}
