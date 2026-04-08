import { startObserver, setEnabled } from './core/observer';

(function() {
    console.log("Shadow-Translator: Modular entry point initialized.");

    const initObserver = () => {
        if (document.body) {
            startObserver();
        } else {
            setTimeout(initObserver, 50);
        }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['isEnabled'], (result) => {
            const isEnabledValue = result.isEnabled !== false; 
            setEnabled(isEnabledValue);
            initObserver();
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.isEnabled !== undefined) {
                setEnabled(changes.isEnabled.newValue);
            }
        });
    } else {
        initObserver();
    }
})();
