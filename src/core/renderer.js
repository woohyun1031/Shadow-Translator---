import { structuralTags } from '../utils/dom';
import { DEFAULT_SHADOW_STYLE } from './defaults';

let currentStyle = { ...DEFAULT_SHADOW_STYLE };

function applyStyleToNode(el, s) {
    el.style.color = s.color;
    el.style.fontSize = `${s.fontSize}em`;
    el.style.marginTop = `${s.marginTop}px`;
    el.style.textAlign = s.textAlign;
    el.style.lineHeight = String(s.lineHeight);
    el.style.whiteSpace = 'pre-wrap';
    el.style.opacity = String(s.opacity);
}

export function setShadowStyle(partial) {
    currentStyle = { ...DEFAULT_SHADOW_STYLE, ...(partial || {}) };
    document
        .querySelectorAll('.echo-original-text')
        .forEach((el) => applyStyleToNode(el, currentStyle));
}

// 비교용 정규화: 모든 공백 제거 (번역기가 기호 주변 공백을 임의로 가감하므로)
const normalizeForCompare = (s) => s.replace(/\s+/g, '');

export function renderShadowText(block, text, translated) {
    if (!text) return;

    // 직계 자식 중에서 이미 렌더링된 원본 텍스트 컨테이너가 있는지 확인
    let grayTextDiv = null;
    for (let child of block.childNodes) {
        if (
            child.nodeType === Node.ELEMENT_NODE &&
            child.classList.contains('echo-original-text')
        ) {
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

    // 번역기가 실제로 번역하지 않은 경우(숫자·기호·코드 등 원문 == 번역문)
    // shadow는 같은 내용을 중복 표시할 뿐이므로 만들지 않는다
    if (translated != null && normalizeForCompare(cleanText) === normalizeForCompare(translated)) {
        if (grayTextDiv) grayTextDiv.remove();
        return;
    }

    if (!grayTextDiv) {
        grayTextDiv = document.createElement('div');
        grayTextDiv.className = 'echo-original-text notranslate';
        grayTextDiv.setAttribute('translate', 'no');
        applyStyleToNode(grayTextDiv, currentStyle);

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
