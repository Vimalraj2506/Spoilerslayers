// Background service worker
// Handles background tasks and communication with content scripts

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
    console.log('Spoiler Blocker extension installed successfully.');
  });
  
  // Listen for messages from popup or content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(`Received message: ${JSON.stringify(message)} from`, sender);
  
    if (message.action === 'getKeywords') {
        chrome.storage.local.get('keywords', (data) => {
            if (chrome.runtime.lastError) {
                console.error('Error retrieving keywords:', chrome.runtime.lastError);
                sendResponse({ keywords: [], error: 'Failed to retrieve keywords' });
            } else {
                console.log('Sending keywords:', data.keywords || []);
                sendResponse({ keywords: data.keywords || [] });
            }
        });
        return true; // Required for async response
    }
  
    return false; // Indicates no asynchronous response needed
  });
  