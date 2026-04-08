import { getBlockContainer } from '../utils/dom';
import { extractOriginalTextDeep } from './extractor';
import { renderShadowText, clearShadowTexts } from './renderer';

const pendingBlocks = new Set();
const processedBlocks = new WeakSet();
let renderTimeout = null;

const observer = new MutationObserver((mutations) => {
    let hasChanges = false;
    const targetMap = new Map();

    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            if (!targetMap.has(mutation.target)) {
                targetMap.set(mutation.target, { removed: [], added: [] });
            }
            const record = targetMap.get(mutation.target);

            mutation.removedNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                    record.removed.push(node);
                } 
                else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'FONT' || (node.querySelector && node.querySelector('font'))) {
                        const block = getBlockContainer(mutation.target);
                        if (block) {
                            setTimeout(() => {
                                if (!block.querySelector('font')) {
                                    block.querySelectorAll('.echo-original-text').forEach(el => el.remove());
                                    processedBlocks.delete(block);
                                }
                            }, 50);
                        }
                    }
                }
            });

            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'FONT') {
                    record.added.push(node);
                }
            });
        }
    });

    targetMap.forEach((record, target) => {
        if (record.removed.length > 0 && record.added.length > 0) {
            const count = Math.max(record.removed.length, record.added.length);
            for (let i = 0; i < count; i++) {
                const textObj = record.removed[i] || record.removed[record.removed.length - 1];
                const fontObj = record.added[i] || record.added[record.added.length - 1];
                
                if (fontObj && !fontObj.hasAttribute('data-echoed')) {
                    fontObj.setAttribute('data-echo-original', textObj.textContent);
                    fontObj.setAttribute('data-echoed', 'true');
                    
                    const block = getBlockContainer(target);
                    if (block && !processedBlocks.has(block)) {
                        pendingBlocks.add(block);
                        hasChanges = true;
                    }
                }
            }
        }
    });

    if (hasChanges && pendingBlocks.size > 0) {
        if (renderTimeout) clearTimeout(renderTimeout);
        
        renderTimeout = setTimeout(() => {
            pendingBlocks.forEach(block => {
                if (processedBlocks.has(block)) return;

                const cleanText = extractOriginalTextDeep(block);
                renderShadowText(block, cleanText);
                processedBlocks.add(block);
            });
            pendingBlocks.clear();
        }, 100);
    }
});

const htmlObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const isTranslated = document.documentElement.classList.contains('translated-ltr') || 
                                 document.documentElement.classList.contains('translated-rtl');
            
            if (!isTranslated) {
                clearShadowTexts();
                pendingBlocks.clear();
            }
        }
    });
});

let isObserverRunning = false;
let isEnabled = true;

export const startObserver = () => {
    if (!isObserverRunning && isEnabled && document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        htmlObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        isObserverRunning = true;
    }
};

export const stopObserver = () => {
    if (isObserverRunning) {
        observer.disconnect();
        htmlObserver.disconnect();
        isObserverRunning = false;
        
        clearShadowTexts();
        pendingBlocks.clear();
    }
};

export const setEnabled = (value) => {
    isEnabled = value;
    if (isEnabled) {
        startObserver();
    } else {
        stopObserver();
    }
};
