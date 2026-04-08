document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const hintMessage = document.getElementById('hintMessage');

    // Load initial state from storage, defaults to true
    chrome.storage.local.get(['isEnabled'], (result) => {
        // If isEnabled is undefined, we assume it is true by default
        const isEnabled = result.isEnabled !== false;
        toggleSwitch.checked = isEnabled;
    });

    // Save state on change
    toggleSwitch.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ isEnabled: isEnabled });
        
        // Show hint message when toggled
        hintMessage.style.display = 'block';
        hintMessage.innerText = 'Please re-run Google Translate to apply changes.';
    });
});
