export const structuralTags = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
    'LI', 'TD', 'TH', 'BLOCKQUOTE', 'DD', 'DT', 'FIGCAPTION',
    'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'SECTION', 'ARTICLE', 'BODY',
    'SUMMARY', 'DETAILS', 'PRE', 'ADDRESS', 'CAPTION', 'FIGURE', 'DIALOG'
]);

export function getBlockContainer(node) {
    let current = node;
    const skipElements = new Set(['BUTTON', 'LABEL', 'INPUT', 'FORM', 'SELECT', 'OPTION', 'TEXTAREA']);
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (skipElements.has(current.tagName.toUpperCase())) {
            return null; 
        }
        if (structuralTags.has(current.tagName.toUpperCase())) {
            return current;
        }
        current = current.parentNode;
    }
    return node.ownerDocument ? node.ownerDocument.body : null;
}

export function isElementHidden(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    if (element.hasAttribute('aria-hidden') && element.getAttribute('aria-hidden') === 'true') {
        return true;
    }
    if (element.hasAttribute('hidden')) {
        return true;
    }
    
    if (element.classList) {
        const hiddenClasses = ['sr-only', 'visually-hidden', 'screen-reader-text', 'hide', 'd-none', 'hidden', 'invisible', 'show-on-focus'];
        for (let cls of hiddenClasses) {
            if (element.classList.contains(cls)) {
                return true;
            }
        }
    }
    
    if (element.style && (element.style.display === 'none' || element.style.visibility === 'hidden' || element.style.opacity === '0')) {
        return true;
    }

    if (window.getComputedStyle) {
        const style = window.getComputedStyle(element);
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
            return true;
        }
    }

    return false;
}
