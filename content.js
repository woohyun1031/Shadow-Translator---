(function() {
    console.log("Echo-Translate: Deep extraction Observer initialized.");

    const structuralTags = new Set([
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
        'LI', 'TD', 'TH', 'BLOCKQUOTE', 'DD', 'DT', 'FIGCAPTION',
        'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'SECTION', 'ARTICLE', 'BODY',
        // 추가된 구조적 컨테이너 (누락 방지)
        'SUMMARY', 'DETAILS', 'PRE', 'ADDRESS', 'CAPTION', 'FIGURE', 'DIALOG'
    ]);

    function getBlockContainer(node) {
        let current = node;
        const skipElements = new Set(['BUTTON', 'LABEL', 'INPUT', 'FORM', 'SELECT', 'OPTION', 'TEXTAREA']);
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            // 폼(Form) 요소, 드롭다운, 버튼 등 내부에 회색 div를 강제로 넣으면 UI/기능이 깨지므로 건너뜀
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

    const pendingBlocks = new Set();
    const processedBlocks = new WeakSet();

    let renderTimeout = null;

    // 💡 앵커, code 등의 미번역 텍스트까지 완벽하게 원문 순서대로 추출하는 재귀 함수
    function extractOriginalTextDeep(element) {
        let result = '';
        if (!element) return result;

        for (let child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                // 크롬 번역기를 비껴간 일반 텍스트 노드 (code/anchor/기호 등) 순서에 맞게 자연스럽게 병합
                result += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                // 우리가 추가한 회색 박스 영역은 무시 (무한루프 및 중복 추출 방지)
                if (child.classList && child.classList.contains('echo-original-text')) {
                    continue;
                }
                
                // 화면에 보이지 않는 스크립트, 스타일, 템플릿 태그 등은 추출 타겟에서 제외
                const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'OBJECT']);
                if (skipTags.has(child.tagName.toUpperCase())) {
                    continue;
                }

                // 스크린 리더용 숨김 텍스트 및 화면에 비표시되는 요소 무시 (GitHub 네비게이션바 등에서 보이지 않는 텍스트가 번역-추출되는 현상 방지)
                let isHidden = false;
                
                if (child.hasAttribute && child.hasAttribute('aria-hidden') && child.getAttribute('aria-hidden') === 'true') {
                    isHidden = true;
                } else if (child.hasAttribute && child.hasAttribute('hidden')) {
                    isHidden = true;
                } else if (child.classList) {
                    const hiddenClasses = ['sr-only', 'visually-hidden', 'screen-reader-text', 'hide', 'd-none', 'hidden', 'invisible', 'show-on-focus'];
                    for (let cls of hiddenClasses) {
                        if (child.classList.contains(cls)) {
                            isHidden = true;
                            break;
                        }
                    }
                }
                
                // 인라인 스타일로 직접 숨겨진 경우
                if (!isHidden && child.style && (child.style.display === 'none' || child.style.visibility === 'hidden' || child.style.opacity === '0')) {
                    isHidden = true;
                }

                // getComputedStyle로 실제 렌더링 여부 확인 (비용이 들 수 있으므로 마지막 방어선으로 사용)
                if (!isHidden && window.getComputedStyle) {
                    const style = window.getComputedStyle(child);
                    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
                        isHidden = true;
                    }
                }

                if (isHidden) {
                    continue;
                }
                
                // 크롬 번역 폰트를 만나면, 노드 교체 통신망에서 몰래 메모해둔 오리지널 텍스트를 꺼냄
                if (child.tagName === 'FONT' && child.hasAttribute('data-echo-original')) {
                    result += child.getAttribute('data-echo-original');
                } else {
                    // 일반 엘리먼트(span, a, code, strong 등)라면 가장 안쪽까지 깊이 탐색을 이어나감
                    result += extractOriginalTextDeep(child);
                }
            }
        }
        return result;
    }

    const observer = new MutationObserver((mutations) => {
        let hasChanges = false;
        
        // 크롬은 텍스트 노드를 폰트 노드로 분해할 때 동일 타겟(부모) 안에서 처리함
        // 이를 정확하게 매핑(Mapping)하기 위해 이번 이벤트 배치의 타겟별 변화량을 묶어줌
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
                    // 번역 취소(Revert 판단)
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

        // 1:1 교체 매핑 (삭제된 영어 원문을 번역 중인 FONT 태그 안에 몰래 은닉)
        targetMap.forEach((record, target) => {
            if (record.removed.length > 0 && record.added.length > 0) {
                const count = Math.max(record.removed.length, record.added.length);
                for (let i = 0; i < count; i++) {
                    const textObj = record.removed[i] || record.removed[record.removed.length - 1]; // 개수가 틀릴 경우 마지막 데이터 재활용
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

        // 변경사항이 감지되면 일괄 렌더링
        if (hasChanges && pendingBlocks.size > 0) {
            if (renderTimeout) clearTimeout(renderTimeout);
            
            renderTimeout = setTimeout(() => {
                pendingBlocks.forEach(block => {
                    if (processedBlocks.has(block)) return;

                    // 💡 핵심: 블록에서 깊이 우선 탐색으로 전체 DOM을 순회하며 원문과 미번역 요소들을 공간/순서 완벽하게 결합
                    let cleanText = extractOriginalTextDeep(block).trim();

                    if (cleanText) {
                        // 불필요하게 쪼개진 공백 정리
                        cleanText = cleanText.replace(/\s+/g, ' ');

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
                    document.querySelectorAll('.echo-original-text').forEach(el => el.remove());
                    pendingBlocks.clear();
                }
            }
        });
    });

    let isObserverRunning = false;
    let isEnabled = true;

    const startObserver = () => {
        if (!isObserverRunning && isEnabled && document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            htmlObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            isObserverRunning = true;
        }
    };

    const stopObserver = () => {
        if (isObserverRunning) {
            observer.disconnect();
            htmlObserver.disconnect();
            isObserverRunning = false;
            
            document.querySelectorAll('.echo-original-text').forEach(el => el.remove());
            pendingBlocks.clear();
        }
    };

    const initObserver = () => {
        if (document.body) {
            startObserver();
        } else {
            setTimeout(initObserver, 50);
        }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['isEnabled'], (result) => {
            isEnabled = result.isEnabled !== false; 
            initObserver();
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.isEnabled !== undefined) {
                isEnabled = changes.isEnabled.newValue;
                if (isEnabled) {
                    startObserver();
                } else {
                    stopObserver();
                }
            }
        });
    } else {
        initObserver();
    }
})();
