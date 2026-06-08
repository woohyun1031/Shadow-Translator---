import { isElementHidden, structuralTags } from '../utils/dom';

const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'OBJECT']);

export function extractOriginalAndTranslated(element) {
    let original = '';
    let translated = '';
    if (!element) return { original, translated };

    for (let child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            original += child.textContent;
            translated += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.classList && child.classList.contains('echo-original-text')) {
                continue;
            }

            const tag = child.tagName.toUpperCase();
            if (skipTags.has(tag)) {
                continue;
            }

            if (structuralTags.has(tag)) {
                continue;
            }

            if (isElementHidden(child)) {
                continue;
            }

            if (child.tagName === 'FONT' && child.hasAttribute('data-echo-original')) {
                original += child.getAttribute('data-echo-original');
                translated += child.textContent;
            } else {
                const nested = extractOriginalAndTranslated(child);
                original += nested.original;
                translated += nested.translated;
            }
        }
    }
    return { original, translated };
}
