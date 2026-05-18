import { startObserver, setEnabled } from './core/observer';
import { setShadowStyle } from './core/renderer';

(function () {
    console.log('Shadow-Translator: Modular entry point initialized.');

    const initObserver = () => {
        if (document.body) {
            startObserver();
        } else {
            setTimeout(initObserver, 50);
        }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['isEnabled', 'shadowStyle'], (result) => {
            const isEnabledValue = result.isEnabled !== false;
            setEnabled(isEnabledValue);
            setShadowStyle(result.shadowStyle);
            initObserver();
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;
            if (changes.isEnabled !== undefined) {
                setEnabled(changes.isEnabled.newValue);
            }
            if (changes.shadowStyle !== undefined) {
                setShadowStyle(changes.shadowStyle.newValue);
            }
        });
    } else {
        initObserver();
    }
})();
