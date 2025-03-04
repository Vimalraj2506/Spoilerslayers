chrome.runtime.onInstalled.addListener(() => {
  console.log("Spoiler Blocker extension installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getKeywords") {
      chrome.storage.local.get("keywords", (data) => {
          sendResponse({ keywords: data.keywords || [] });
      });
      return true;
  }
});
