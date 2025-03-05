// Background service worker
// Runs in the background and communicates with content scripts

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
    console.log('Spoiler Blocker extension installed');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getKeywords') {
        // Retrieve keywords from storage and send to content script
        chrome.storage.local.get('keywords', (data) => {
            sendResponse({ keywords: data.keywords || [] });
        });
        return true; // Required for async response
    }
});
