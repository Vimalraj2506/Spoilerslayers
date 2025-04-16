/**
 * Background service worker for the Spoiler Blocker extension
 * Handles keyword storage and communication with content scripts
 */

console.log("Spoiler Blocker background script started");

// Default settings
const DEFAULT_SETTINGS = {
  useApiDetection: true,
  useKeywordDetection: true,
};

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log(
    "Spoiler Blocker extension installed or updated:",
    details.reason
  );

  // Initialize default settings
  chrome.storage.local.get(
    ["useApiDetection", "useKeywordDetection"],
    (result) => {
      const updates = {};

      if (typeof result.useApiDetection !== "boolean") {
        updates.useApiDetection = DEFAULT_SETTINGS.useApiDetection;
      }

      if (typeof result.useKeywordDetection !== "boolean") {
        updates.useKeywordDetection = DEFAULT_SETTINGS.useKeywordDetection;
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates, () => {
          console.log("Initialized default settings:", updates);
        });
      }
    }
  );
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);

  if (message.action === "getKeywords") {
    // Retrieve keywords from storage and send to content script
    chrome.storage.local.get("keywords", (data) => {
      // Ensure we have at least an empty array if no keywords found
      const keywords = data.keywords || [];
      console.log("Sending keywords to content script:", keywords);
      sendResponse({ keywords: keywords });
    });
    return true; // Required for async response
  }
});

console.log("Spoiler Blocker background script initialized");
