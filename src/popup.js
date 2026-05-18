import Coloris from '@melloware/coloris';
import '@melloware/coloris/dist/coloris.css';
import { DEFAULT_SHADOW_STYLE, SHADOW_STYLE_RANGES } from './core/defaults';

const FORMATTERS = {
    fontSize: (v) => `${Number(v).toFixed(2)}em`,
    lineHeight: (v) => Number(v).toFixed(1),
    opacity: (v) => Number(v).toFixed(2),
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function mergeStyle(stored) {
    return { ...DEFAULT_SHADOW_STYLE, ...(stored || {}) };
}

function sanitizeStyle(style) {
    const out = { ...style };
    for (const key of Object.keys(SHADOW_STYLE_RANGES)) {
        if (out[key] === undefined) continue;
        const { min, max } = SHADOW_STYLE_RANGES[key];
        out[key] = clamp(Number(out[key]), min, max);
    }
    return out;
}

function init() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const hintMessage = document.getElementById('hintMessage');
    const mainView = document.getElementById('mainView');
    const settingsView = document.getElementById('settingsView');
    const openSettingsBtn = document.getElementById('openSettings');
    const resetBtn = document.getElementById('resetBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');

    const colorInput = document.getElementById('cs-color');
    const rangeInputs = {
        fontSize: document.getElementById('cs-fontSize'),
        lineHeight: document.getElementById('cs-lineHeight'),
        opacity: document.getElementById('cs-opacity'),
    };
    const rangeOutputs = {
        fontSize: document.getElementById('cs-fontSize-out'),
        lineHeight: document.getElementById('cs-lineHeight-out'),
        opacity: document.getElementById('cs-opacity-out'),
    };

    if (
        !mainView ||
        !settingsView ||
        !openSettingsBtn ||
        !colorInput ||
        !rangeInputs.fontSize ||
        !rangeInputs.lineHeight ||
        !rangeInputs.opacity
    ) {
        console.error('[Shadow Translator] popup elements missing — check popup.html ids');
        return;
    }

    function setMainVisible() {
        mainView.style.display = '';
        settingsView.style.display = 'none';
    }

    function setSettingsVisible() {
        mainView.style.display = 'none';
        settingsView.style.display = 'flex';
    }

    // Initial state: settings view hidden, main view visible.
    setMainVisible();

    let originalStyle = null;
    let isPopulating = false;

    try {
        Coloris.init();
        Coloris({
            el: '#cs-color',
            themeMode: 'dark',
            alpha: false,
            format: 'hex',
        });
    } catch (err) {
        console.error('[Shadow Translator] Coloris init failed:', err);
    }

    // --- Enable toggle ---
    chrome.storage.local.get(['isEnabled'], (result) => {
        if (chrome.runtime.lastError) {
            console.error(
                '[Shadow Translator] storage.get isEnabled error:',
                chrome.runtime.lastError
            );
            return;
        }
        toggleSwitch.checked = result.isEnabled !== false;
    });

    toggleSwitch.addEventListener('change', (e) => {
        chrome.storage.local.set({ isEnabled: e.target.checked });
        hintMessage.style.display = 'block';
        hintMessage.innerText = 'Please re-run Google Translate to apply changes.';
    });

    function populateForm(style) {
        isPopulating = true;
        colorInput.value = style.color;
        for (const key of Object.keys(rangeInputs)) {
            rangeInputs[key].value = style[key];
            rangeOutputs[key].textContent = FORMATTERS[key](style[key]);
        }
        // Coloris의 wrapper 색상 미리보기를 동기화하려면 input 이벤트 디스패치가 필요.
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
        isPopulating = false;
    }

    function readForm() {
        return sanitizeStyle({
            color: colorInput.value || DEFAULT_SHADOW_STYLE.color,
            fontSize: parseFloat(rangeInputs.fontSize.value),
            lineHeight: parseFloat(rangeInputs.lineHeight.value),
            opacity: parseFloat(rangeInputs.opacity.value),
        });
    }

    function writeStyle(style) {
        chrome.storage.local.set({ shadowStyle: style });
    }

    colorInput.addEventListener('input', () => {
        if (isPopulating) return;
        writeStyle(readForm());
    });

    for (const key of Object.keys(rangeInputs)) {
        rangeInputs[key].addEventListener('input', (e) => {
            rangeOutputs[key].textContent = FORMATTERS[key](e.target.value);
            if (isPopulating) return;
            writeStyle(readForm());
        });
    }

    openSettingsBtn.addEventListener('click', () => {
        chrome.storage.local.get(['shadowStyle'], (result) => {
            if (chrome.runtime.lastError) {
                console.error(
                    '[Shadow Translator] storage.get shadowStyle error:',
                    chrome.runtime.lastError
                );
            }
            const merged = mergeStyle(result && result.shadowStyle);
            originalStyle = { ...merged };
            populateForm(merged);
            setSettingsVisible();
        });
    });

    cancelBtn.addEventListener('click', () => {
        if (originalStyle) {
            writeStyle(originalStyle);
        }
        originalStyle = null;
        setMainVisible();
    });

    saveBtn.addEventListener('click', () => {
        originalStyle = null;
        setMainVisible();
    });

    resetBtn.addEventListener('click', () => {
        const defaults = { ...DEFAULT_SHADOW_STYLE };
        populateForm(defaults);
        writeStyle(defaults);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
