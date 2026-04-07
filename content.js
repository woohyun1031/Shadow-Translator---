(function() {
    console.log("Echo-Translate: Block-level Observer initialized.");

    // 블록 부모 탐색용 구조 태그 목록 (텍스트를 보존/표시할 단위)
    // 버튼, 폼 요소 등은 UI를 깨지 않기 위해 제외하거나 텍스트 추출을 생략합니다.
    const structuralTags = new Set([
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
        'LI', 'TD', 'TH', 'BLOCKQUOTE', 'DD', 'DT', 'FIGCAPTION',
        'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'SECTION', 'ARTICLE', 'BODY'
    ]);

    // 가장 가까운 레이아웃 블록 부모를 찾는 함수
    function getBlockContainer(node) {
        let current = node;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            // 버튼, 폼 태그 등 상호작용 요소는 내부 텍스트 복제를 건너뛰기 위해 null 반환
            // (즉, 버튼 텍스트는 원문이 별도로 아래에 달리지 않고, 단순히 번역만 처리됨)
            if (current.tagName === 'BUTTON' || current.tagName === 'LABEL' || current.tagName === 'INPUT' || current.tagName === 'FORM') {
                return null; 
            }
            if (structuralTags.has(current.tagName.toUpperCase())) {
                return current;
            }
            current = current.parentNode;
        }
        // 기본 폴백 (document가 아닌 가장 최상단 요소)
        return node.ownerDocument ? node.ownerDocument.body : null;
    }

    // 각 블록별로 삭제된(원문) 텍스트 조각들을 순서대로 저장하는 Map
    const originalTextChunks = new Map();
    // 번역기가 삽입을 완료한 블록들 (하단 회색 텍스트 렌더링 대기열)
    const pendingBlocks = new Set();
    // 이미 회색 텍스트가 추가되어 처리 완료된 블록들 (블록 당 원문은 1개만 생성)
    const processedBlocks = new WeakSet();

    let renderTimeout = null;

    const observer = new MutationObserver((mutations) => {
        let hasChanges = false;

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                
                // 1Pass: 사라지는 원본 텍스트 노드 수집 및 번역 취소/복구 감지
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const rawText = node.textContent;
                        // 띄어쓰기만 있는 경우가 아닌, 유의미한 텍스트일 때만
                        if (rawText.trim().length > 0) {
                            const block = getBlockContainer(mutation.target);
                            if (block && !processedBlocks.has(block)) {
                                if (!originalTextChunks.has(block)) {
                                    originalTextChunks.set(block, []);
                                }
                                originalTextChunks.get(block).push(rawText);
                            }
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // 1-5Pass: 한국어 -> 영어 원본으로 번역이 '취소'될 때의 정리 작업
                        // 크롬이 삽입했던 FONT 태그가 제거된다면 번역이 해제되었다는 뜻입니다.
                        if (node.tagName === 'FONT' || (node.querySelector && node.querySelector('font'))) {
                            const block = getBlockContainer(mutation.target);
                            if (block) {
                                // 크롬의 배치 작업이 끝나도록 살짝 대기 후 해당 블록 안에 폰트가 전멸했는지 확인
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

                // 2Pass: 크롬 번역기가 삽입한 FONT 태그 발견 시 해당 블록을 렌더링 대기열에 추가
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'FONT' && !node.hasAttribute('data-echoed')) {
                        const block = getBlockContainer(mutation.target);
                        if (block && !processedBlocks.has(block)) {
                            // 크롬 번역의 기본 HTML 교체는 그대로 두되, 우리 로직용 마킹만 함
                            node.setAttribute('data-echoed', 'true');
                            
                            // 이 블록은 번역이 이뤄지고 있으니, 나중에 원문을 하단에 추가하라고 마킹
                            pendingBlocks.add(block);
                            hasChanges = true;
                        }
                    }
                });
            }
        });

        // 변경사항이 감지되면 약간의 지연 후(Debounce) 일괄 렌더링 실행
        if (hasChanges && pendingBlocks.size > 0) {
            if (renderTimeout) clearTimeout(renderTimeout);
            
            renderTimeout = setTimeout(() => {
                pendingBlocks.forEach(block => {
                    if (processedBlocks.has(block)) return;

                    const chunks = originalTextChunks.get(block);
                    if (chunks && chunks.length > 0) {
                        // 조각난 텍스트들의 양쪽 공백을 없애고 띄어쓰기 한 칸으로 깔끔하게 이어붙임
                        const cleanText = chunks.map(c => c.trim()).filter(Boolean).join(' ');

                        if (cleanText) {
                            // 회색 원문 텍스트 컨테이너 생성
                            const grayTextDiv = document.createElement('div');
                            grayTextDiv.className = 'echo-original-text';
                            grayTextDiv.style.color = '#787878';
                            grayTextDiv.style.fontSize = '0.9em'; // 번역문보다 살짝 작게
                            grayTextDiv.style.marginTop = '6px';
                            grayTextDiv.style.textAlign = 'left';
                            grayTextDiv.style.lineHeight = '1.4';
                            grayTextDiv.style.whiteSpace = 'pre-wrap';
                            grayTextDiv.style.opacity = '0.8';
                            grayTextDiv.textContent = cleanText;
                            
                            // 💡 원문 영역이 또다시 번역기루프에 들어가지 않도록 방지
                            grayTextDiv.setAttribute('translate', 'no');
                            grayTextDiv.className += ' notranslate';

                            // 블록의 맨 마지막에 원문 추가
                            block.appendChild(grayTextDiv);
                        }
                    }
                    
                    // 메모리 정리 및 중복 방지
                    processedBlocks.add(block);
                    originalTextChunks.delete(block);
                });
                
                pendingBlocks.clear();
            }, 100); // 100ms 대기: 크롬 번역기의 한 문단 텍스트 교체 배치(Batch) 작업이 다 끝나기를 기다림
        }
    });

    // Body가 만들어질 때까지 대기 후 감시 시작
    let isObserverRunning = false;
    let isEnabled = true;

    // 🌐 전역 HTML 모니터링 (크롬 번역 상태 감지)
    // 크롬은 페이지 전체를 번역할 때 html 태그에 class="translated-ltr" 등을 달고, 취소하면 지웁니다.
    const htmlObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const isTranslated = document.documentElement.classList.contains('translated-ltr') || 
                                     document.documentElement.classList.contains('translated-rtl');
                
                // 번역이 완전히 풀려서 원본으로 돌아간 경우, 잔여 회색 텍스트를 일괄 삭제합니다.
                if (!isTranslated) {
                    document.querySelectorAll('.echo-original-text').forEach(el => el.remove());
                    originalTextChunks.clear();
                    pendingBlocks.clear();
                }
            }
        });
    });

    const startObserver = () => {
        if (!isObserverRunning && isEnabled && document.body) {
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
            htmlObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
            });
            isObserverRunning = true;
            console.log("Echo-Translate: Observer started.");
        }
    };

    const stopObserver = () => {
        if (isObserverRunning) {
            observer.disconnect();
            htmlObserver.disconnect();
            isObserverRunning = false;
            
            // 확장을 끄면 화면에 남아있는 회색 원문 박스도 모두 청소
            document.querySelectorAll('.echo-original-text').forEach(el => el.remove());
            originalTextChunks.clear();
            pendingBlocks.clear();
            
            console.log("Echo-Translate: Observer stopped.");
        }
    };

    const initObserver = () => {
        if (document.body) {
            startObserver();
        } else {
            setTimeout(initObserver, 50);
        }
    };

    // 저장소 설정 값 불러오기 및 리스너 등록
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
