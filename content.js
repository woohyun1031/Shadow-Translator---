(function() {
    console.log("Shadow Translator: DOM MutationObserver initialized.");

    // WeakMap을 사용하여 DOM 엘리먼트(target)가 화면에서 영구 삭제되면 
    // 보관 중이던 큐(Queue) 메모리도 브라우저가 자동으로 청소(Garbage Collection)하게 만듭니다. (메모리 릭 원천 차단)
    const textQueueByTarget = new WeakMap();

    const observer = new MutationObserver((mutations) => {
        // 1Pass: 사라진 텍스트 노드 수집
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const rawText = node.textContent;
                        // 빈 문자열이 아니고 의미있는 텍스트일 때만 큐에 저장하지만, 원본 띄어쓰기를 보존
                        if (rawText.trim().length > 0) {
                            let queue = textQueueByTarget.get(mutation.target);
                            if (!queue) {
                                queue = [];
                                textQueueByTarget.set(mutation.target, queue);
                            }
                            // 공백이 잘려나가지 않도록 rawText 통째로 저장 
                            queue.push(rawText);
                        }
                    }
                });
            }
        });

        // 2Pass: 새로 추가된 번역 폰트 노드 찾기 및 대체
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // 번역기가 삽입하는 FONT 태그인지 확인 및 무한루프 방지(data-echoed 플래그)
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'FONT' && !node.hasAttribute('data-echoed')) {
                        
                        let queue = textQueueByTarget.get(mutation.target);
                        let origText = queue && queue.length ? queue.shift() : null;

                        if (origText) {
                            // 크롬 번역기는 FONT 하위에 또 FONT를 두기도 하므로 가장 깊은 텍스트를 찾음
                            let targetFont = node;
                            while(targetFont.children && targetFont.children.length > 0 && targetFont.children[0].tagName === 'FONT') {
                                targetFont = targetFont.children[0];
                            }
                            
                            // 번역문 안에 불필요한 줄바꿈이 들어가지 않도록 트림 처리
                            const transText = targetFont.textContent.trim();
                            
                            // 원문이 가지고 있던 앞/뒤 공백 분리 (다음 요소와 글자가 달라붙지 않게 하기 위해)
                            const leadingSpace = origText.match(/^\s*/)[0];
                            const trailingSpace = origText.match(/\s*$/)[0];
                            const cleanOrigText = origText.trim();
                            
                            // XSS 방지를 위해 innerHTML 대신 TextNode와 Element를 직접 생성
                            targetFont.textContent = ''; // 기존 텍스트 지우기
                            
                            // 1. 앞 공백 + 원문
                            targetFont.appendChild(document.createTextNode(leadingSpace + cleanOrigText));
                            
                            // 2. 강제 줄바꿈
                            targetFont.appendChild(document.createElement('br'));
                            
                            // 3. 번역문 (스타일 처리)
                            const transSpan = document.createElement('span');
                            transSpan.textContent = transText;
                            transSpan.style.color = '#787878'; 
                            transSpan.style.fontSize = '0.9em';
                            targetFont.appendChild(transSpan);
                            
                            // 3.5. 번역문 뒤에도 줄바꿈 추가 (다음 원본 텍스트가 번역문 옆에 바로 붙는 현상 방지)
                            targetFont.appendChild(document.createElement('br'));
                            
                            // 4. 뒷 공백 (원래 가지고 있던 간격 복구)
                            if (trailingSpace) {
                                targetFont.appendChild(document.createTextNode(trailingSpace));
                            }
                            
                            // 다시 감지되지 않도록 마킹
                            node.setAttribute('data-echoed', 'true');
                            targetFont.setAttribute('data-echoed', 'true');
                        }
                    }
                });
            }
        });
    });

    // Body가 만들어질 때까지 대기 후 감시 시작
    let isObserverRunning = false;
    let isEnabled = true;

    const startObserver = () => {
        if (!isObserverRunning && isEnabled && document.body) {
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
            isObserverRunning = true;
            console.log("Shadow Translator: Observer started.");
        }
    };

    const stopObserver = () => {
        if (isObserverRunning) {
            observer.disconnect();
            isObserverRunning = false;
            console.log("Shadow Translator: Observer stopped.");
        }
    };

    const initObserver = () => {
        if (document.body) {
            startObserver();
        } else {
            setTimeout(initObserver, 50);
        }
    };

    // 저장소에서 설정 값 불러오기 및 리스너 등록
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['isEnabled'], (result) => {
            isEnabled = result.isEnabled !== false; // 값이 없을 땐 기본으로 true 지정
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
        // 크롬 확장 프로그램 환경이 아닐 경우 (예외 처리)
        initObserver();
    }
})();
