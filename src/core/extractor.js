import { isElementHidden } from '../utils/dom';

export function extractOriginalTextDeep(element) {
    let result = '';
    if (!element) return result;

    for (let child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            result += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.classList && child.classList.contains('echo-original-text')) {
                continue;
            }
            
            const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'OBJECT']);
            if (skipTags.has(child.tagName.toUpperCase())) {
                continue;
            }

            if (isElementHidden(child)) {
                continue;
            }
            
            if (child.tagName === 'FONT' && child.hasAttribute('data-echo-original')) {
                result += child.getAttribute('data-echo-original');
            } else {
                result += extractOriginalTextDeep(child);
            }
        }
    }
    return result;
}
