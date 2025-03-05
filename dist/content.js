/**
 * content.js - Main content script for the Spoiler Blocker Chrome extension
 * This script scans web pages for keywords that might indicate spoilers
 * and blocks/hides those elements until the user explicitly chooses to reveal them.
 */

// Text to show in place of blocked spoiler content
const spoilerText = "🛑 STOP! SPOILERS AHEAD 🛑";

// Array of color scheme options for the spoiler block elements
// Each option has a background color and text color for visual variety
const colorOptions = [
  { bgColor: "#d81b60", textColor: "#ffffff" }, // Bright pink
  { bgColor: "#8e24aa", textColor: "#ffffff" }, // Purple
  { bgColor: "#5e35b1", textColor: "#ffffff" }, // Deep purple
  { bgColor: "#3949ab", textColor: "#ffffff" }, // Indigo
  { bgColor: "#1e88e5", textColor: "#ffffff" }, // Blue
  { bgColor: "#00897b", textColor: "#ffffff" }, // Teal
  { bgColor: "#43a047", textColor: "#ffffff" }, // Green
  { bgColor: "#e53935", textColor: "#ffffff" }, // Red
  { bgColor: "#f4511e", textColor: "#ffffff" }, // Deep orange
  { bgColor: "#6d4c41", textColor: "#ffffff" }, // Brown
];

// WeakSet to track elements that have already been processed to avoid duplicates
const processedElements = new WeakSet();

// Store original HTML content for elements that are replaced with spoiler blocks
// This allows for revealing original content when the user clicks on a blocked spoiler
const storedOriginals = {};
let idCounter = 1; // Counter to generate unique IDs for spoiler elements

// Array to store keywords that the user has chosen to ignore
let ignoredKeywords = [];

// Flag to track whether the initial page scan is complete
let initialProcessingComplete = false;

// Flag to track if this is a fresh page load (needed for keyword state management)
let isNewPageLoad = true;

/**
 * Returns a random color scheme from the available options
 * @returns {Object} Object containing bgColor and textColor properties
 */
function getRandomColorScheme() {
  const randomIndex = Math.floor(Math.random() * colorOptions.length);
  return colorOptions[randomIndex];
}

/**
 * Creates a replacement element that will be shown instead of the spoiler content
 * @param {HTMLElement} originalElement - The original element containing the spoiler
 * @param {string} matchedKeyword - The keyword that triggered the spoiler block
 * @returns {HTMLElement} A new span element styled as a spoiler block
 */
function createReplacementElement(originalElement, matchedKeyword) {
  const colorScheme = getRandomColorScheme();

  // Create a new span element to replace the original content
  const replacementElement = document.createElement("span");
  replacementElement.className = "spoiler-element-blocked";

  // Apply the random color scheme
  replacementElement.style.backgroundColor = colorScheme.bgColor;
  replacementElement.style.color = colorScheme.textColor;

  // Style the replacement element to stand out visually
  replacementElement.style.padding = "2px 8px";
  replacementElement.style.borderRadius = "3px";
  replacementElement.style.cursor = "pointer";
  replacementElement.style.margin = "2px 0";
  replacementElement.style.display = "inline-block";
  replacementElement.style.position = "relative";
  replacementElement.style.zIndex = "1";

  // Generate a unique ID for this spoiler block
  const uniqueId = `spoiler-${idCounter++}`;

  // Store the original HTML for later retrieval when user clicks to reveal
  storedOriginals[uniqueId] = {
    html: originalElement.outerHTML,
    keyword: matchedKeyword,
  };

  // Set the content and tooltip for the replacement element
  replacementElement.textContent = spoilerText;
  replacementElement.title = matchedKeyword
    ? `Click to reveal spoiler (matched: ${matchedKeyword})`
    : "Click to reveal spoiler";
  replacementElement.setAttribute("data-spoiler-id", uniqueId);

  return replacementElement;
}

/**
 * Finds all text nodes within a given element
 * @param {HTMLElement} element - The parent element to search within
 * @returns {Array} Array of text nodes found
 */
function getAllTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue.trim() !== "") {
      textNodes.push(node);
    }
  }

  return textNodes;
}

/**
 * Checks if a text contains any of the specified keywords
 * Uses both exact and fuzzy matching (if Fuse.js is available)
 * @param {string} text - The text to check for keywords
 * @param {Array} keywords - Array of keywords to search for
 * @returns {string|boolean} The matched keyword if found, false otherwise
 */
function containsKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;

  const lowerText = text.toLowerCase();

  // Filter out keywords that the user has chosen to ignore
  const activeKeywords = keywords.filter(
    (k) => !ignoredKeywords.includes(k.toLowerCase())
  );

  if (activeKeywords.length === 0) return false;

  // First try exact matching with word boundaries
  for (const keyword of activeKeywords) {
    const regex = new RegExp("\\b" + keyword + "\\b", "i");
    if (regex.test(lowerText)) {
      return keyword; // Return the matched keyword
    }
  }

  // If Fuse.js is available, try fuzzy matching for better results
  if (typeof Fuse !== "undefined") {
    try {
      const options = {
        includeScore: true,
        threshold: 0.3,
        distance: 100,
        minMatchCharLength: 3,
      };

      const fuse = new Fuse([text], options);

      for (const keyword of activeKeywords) {
        if (keyword.length < 3) continue; // Skip very short keywords

        const results = fuse.search(keyword);
        if (results.length > 0 && results[0].score < 0.6) {
          return keyword;
        }
      }
    } catch (e) {
      console.error("Fuse.js error:", e);
    }
  }

  return false;
}

/**
 * Checks if an element is or contains a form element
 * Form elements should be skipped to avoid breaking functionality
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} True if the element is or contains a form element
 */
function isOrContainsFormElement(element) {
  const formElements = [
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "BUTTON",
    "FORM",
  ];

  if (formElements.includes(element.tagName)) {
    return true;
  }

  // Check if any parent is a form element
  let parent = element.parentElement;
  while (parent) {
    if (formElements.includes(parent.tagName)) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

/**
 * Finds the smallest parent element containing a keyword
 * This helps block specific text rather than entire sections
 * @param {HTMLElement} element - The element to check
 * @param {Array} keywords - Array of keywords to search for
 * @returns {Object|null} Object with element and keyword, or null if no match
 */
function findSmallestParentWithKeywords(element, keywords) {
  // Skip elements already processed or marked to avoid processing
  if (
    processedElements.has(element) ||
    element.classList.contains("spoiler-processed") ||
    element.classList.contains("spoiler-element-blocked") ||
    element.classList.contains("spoiler-revealed") ||
    element.hasAttribute("data-no-process")
  ) {
    return null;
  }

  // Skip form elements to avoid breaking functionality
  if (isOrContainsFormElement(element)) {
    return null;
  }

  // Skip empty elements
  if (!element.textContent || element.textContent.trim() === "") {
    return null;
  }

  // Check if this element contains any keywords
  const matchedKeyword = containsKeywords(element.textContent, keywords);
  if (!matchedKeyword) return null;

  // Prefer small inline elements for better granularity
  if (
    ["SPAN", "A", "EM", "STRONG", "B", "I", "MARK", "CODE"].includes(
      element.tagName
    )
  ) {
    return { element, keyword: matchedKeyword };
  }

  // Recursively check children for better targeting
  for (const child of element.children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const result = findSmallestParentWithKeywords(child, keywords);
      if (result) return result;
    }
  }

  // Use this element if it's not too wide (avoid blocking entire page width)
  if (element.offsetWidth < window.innerWidth * 0.7) {
    return { element, keyword: matchedKeyword };
  }

  return null;
}

/**
 * Main function to scan the page and block elements containing spoilers
 * @param {Array} keywords - Array of keywords to detect as spoilers
 */
function blockSpoilers(keywords) {
  console.log("Blocking spoilers for keywords:", keywords);
  if (!keywords || keywords.length === 0) return;

  if (ignoredKeywords.length > 0) {
    console.log("Ignoring keywords:", ignoredKeywords);
  }

  // Filter out very short keywords to avoid false positives
  const filteredKeywords = keywords.filter((kw) => kw.length >= 3);

  if (filteredKeywords.length === 0) return;

  // Get all elements in the body that might contain text
  const textContainers = document.querySelectorAll("body *");

  textContainers.forEach((container) => {
    // Skip elements that shouldn't be processed
    if (
      processedElements.has(container) ||
      container.classList.contains("spoiler-processed") ||
      container.classList.contains("spoiler-element-blocked") ||
      container.classList.contains("spoiler-revealed") ||
      container.hasAttribute("data-no-process") ||
      container.tagName === "SCRIPT" ||
      container.tagName === "STYLE" ||
      container.tagName === "NOSCRIPT" ||
      container.tagName === "INPUT" ||
      container.tagName === "TEXTAREA" ||
      container.tagName === "SELECT" ||
      container.tagName === "OPTION" ||
      container.tagName === "SVG" ||
      container.tagName === "BUTTON" ||
      getComputedStyle(container).display === "none"
    ) {
      return;
    }

    // Find the smallest element containing a keyword
    const result = findSmallestParentWithKeywords(container, filteredKeywords);

    if (result) {
      const { element, keyword } = result;
      processedElements.add(element);
      element.classList.add("spoiler-processed");

      // Create and insert the replacement element
      const replacementElement = createReplacementElement(element, keyword);

      if (element.parentNode) {
        element.parentNode.replaceChild(replacementElement, element);
      }
    }
  });

  if (!initialProcessingComplete) {
    initialProcessingComplete = true;
    console.log("Initial spoiler processing complete");
  }
}

// Flag to temporarily disable the observer during DOM operations
let observerDisabled = false;

// Global observer reference
let globalObserver = null;

/**
 * Adds a keyword to the ignored list
 * @param {string} keyword - The keyword to ignore
 */
function ignoreKeyword(keyword) {
  if (keyword && typeof keyword === "string") {
    const lowerKeyword = keyword.toLowerCase();
    if (!ignoredKeywords.includes(lowerKeyword)) {
      ignoredKeywords.push(lowerKeyword);

      console.log("Updated ignored keywords:", ignoredKeywords);

      // Save ignored keywords to chrome storage
      try {
        chrome.storage.local.set(
          { ignoredKeywords: ignoredKeywords },
          function () {
            console.log("Ignored keywords saved to storage");
          }
        );
      } catch (e) {
        console.error("Error saving ignored keywords:", e);
      }
    }
  }
}

/**
 * Loads previously ignored keywords from storage
 * @param {Function} callback - Function to call after loading
 */
function loadIgnoredKeywords(callback) {
  try {
    chrome.storage.local.get("ignoredKeywords", function (result) {
      if (result.ignoredKeywords && Array.isArray(result.ignoredKeywords)) {
        if (isNewPageLoad) {
          // Clear ignored keywords on new page load
          ignoredKeywords = [];
          console.log("New page detected - resetting ignored keywords");

          chrome.storage.local.remove("ignoredKeywords", function () {
            console.log(
              "Cleared ignored keywords from storage on new page load"
            );
            if (callback && typeof callback === "function") {
              callback();
            }
          });
          return;
        } else {
          ignoredKeywords = result.ignoredKeywords;
          console.log("Loaded ignored keywords from storage:", ignoredKeywords);
        }
      }
      if (callback && typeof callback === "function") {
        callback();
      }
    });
  } catch (e) {
    console.error("Error loading ignored keywords:", e);
    if (callback && typeof callback === "function") {
      callback();
    }
  }
}

/**
 * Resets all spoiler blocks and ignored keywords
 * Reloads the page to apply changes
 */
function resetAll() {
  ignoredKeywords = [];

  try {
    chrome.storage.local.remove("ignoredKeywords", function () {
      console.log("Ignored keywords cleared from storage");

      window.location.reload();
    });
  } catch (e) {
    console.error("Error clearing ignored keywords:", e);

    window.location.reload();
  }
}

/**
 * Initializes the spoiler blocker functionality
 * Sets up styles, listeners, and starts the first scan
 */
function initialize() {
  console.log("Initializing Spoiler Blocker - Improved Initial Loading");

  // Add CSS styles if not already present
  if (!document.getElementById("spoiler-blocker-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "spoiler-blocker-styles";
    styleElement.textContent = `
        .spoiler-element-blocked {
          display: inline-block !important;
          position: relative !important;
          z-index: 1 !important;
          margin: 2px 0 !important;
          line-height: normal !important;
          vertical-align: baseline !important;
          overflow: visible !important;
        }
        
        .spoiler-revealed, [data-no-process], [data-no-process] * {
          /* Special marker to prevent processing */
        }
        
        #spoiler-reset-button {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
          z-index: 9999;
          display: none;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        
        #spoiler-reset-button:hover {
          background-color: #d32f2f;
        }
      `;
    document.head.appendChild(styleElement);
  }

  // After 2 seconds, no longer treat as a new page load
  setTimeout(() => {
    isNewPageLoad = false;
  }, 2000);

  // Load ignored keywords and then get the current keywords to block
  loadIgnoredKeywords(function () {
    chrome.runtime.sendMessage({ action: "getKeywords" }, (response) => {
      console.log("Received keywords response:", response);
      if (response && response.keywords) {
        blockSpoilers(response.keywords);

        // Schedule additional scans to catch dynamically loaded content
        scheduleAdditionalProcessing(response.keywords);
      } else {
        console.log("No keywords found in response");
      }
    });
  });

  // Clean up existing observer if it exists
  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }

  // Create a new MutationObserver to watch for DOM changes
  globalObserver = new MutationObserver((mutations) => {
    if (observerDisabled) return;

    let hasNewNodes = false;

    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        hasNewNodes = true;
      }
    });

    // If new nodes were added, scan again
    if (hasNewNodes) {
      chrome.runtime.sendMessage({ action: "getKeywords" }, (response) => {
        if (response && response.keywords) {
          blockSpoilers(response.keywords);
        }
      });
    }
  });

  // Start observing the entire body for changes
  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Set up click handler for revealing spoilers
  document.removeEventListener("click", handleSpoilerClick);
  document.addEventListener("click", handleSpoilerClick);

  // Show reset button if there are ignored keywords
  if (ignoredKeywords.length > 0) {
    createResetButton();
  }
}

/**
 * Schedules additional processing passes after initial load
 * Helps catch elements that might have been missed or loaded later
 * @param {Array} keywords - Keywords to detect as spoilers
 */
function scheduleAdditionalProcessing(keywords) {
  const processingSchedule = [500, 1000, 2000, 3000, 5000];

  processingSchedule.forEach((delay) => {
    setTimeout(() => {
      console.log(`Running additional processing pass after ${delay}ms`);
      blockSpoilers(keywords);
    }, delay);
  });
}

/**
 * Creates a reset button to allow users to restore all hidden content
 */
function createResetButton() {
  if (document.getElementById("spoiler-reset-button")) {
    document.getElementById("spoiler-reset-button").style.display = "block";
    return;
  }

  // Create the reset button
  const resetButton = document.createElement("button");
  resetButton.id = "spoiler-reset-button";
  resetButton.textContent = "Reset All Spoilers";
  resetButton.addEventListener("click", resetAll);

  document.body.appendChild(resetButton);

  // Show the button after a short delay
  setTimeout(() => {
    resetButton.style.display = "block";
  }, 1000);
}

/**
 * Handles clicks on spoiler block elements
 * Reveals the original content when clicked
 * @param {Event} event - The click event
 */
function handleSpoilerClick(event) {
  if (event.target.classList.contains("spoiler-element-blocked")) {
    event.preventDefault();
    event.stopPropagation();

    const spoilerId = event.target.getAttribute("data-spoiler-id");
    if (spoilerId && spoilerId in storedOriginals) {
      const originalData = storedOriginals[spoilerId];
      const originalHTML = originalData.html;
      const matchedKeyword = originalData.keyword;

      // Add the keyword to ignored list so it's not blocked again
      if (matchedKeyword) {
        ignoreKeyword(matchedKeyword);
      }

      const parent = event.target.parentNode;

      if (parent) {
        // Temporarily disable the observer to avoid infinite loops
        observerDisabled = true;
        if (globalObserver) {
          globalObserver.disconnect();
        }

        // Create a container to parse the original HTML
        const tempContainer = document.createElement("div");
        tempContainer.innerHTML = originalHTML;

        const originalElement = tempContainer.firstChild;

        // Mark the element to prevent re-processing
        originalElement.setAttribute("data-no-process", "true");
        originalElement.classList.add("spoiler-revealed");

        // Replace the spoiler block with the original content
        parent.replaceChild(originalElement, event.target);

        // Mark all children to prevent re-processing
        originalElement.querySelectorAll("*").forEach((el) => {
          el.setAttribute("data-no-process", "true");
          el.classList.add("spoiler-revealed");
        });

        // Re-enable the observer after a short delay
        setTimeout(() => {
          observerDisabled = false;
          if (globalObserver) {
            globalObserver.observe(document.body, {
              childList: true,
              subtree: true,
            });
          }

          // Show the reset button since we've revealed content
          createResetButton();
        }, 100);

        // Clean up the stored original content
        delete storedOriginals[spoilerId];
      }
    }
  }
}

/**
 * Checks if Fuse.js is available for fuzzy matching
 */
function checkFuse() {
  if (typeof Fuse === "undefined") {
    console.log("Fuse.js not detected. Using exact matching only.");
  } else {
    console.log("Fuse.js detected. Using fuzzy matching.");
  }
}

/**
 * Sets up listeners for page navigation events
 * Resets state when navigating to new pages
 */
function setupNavigationListener() {
  window.addEventListener("beforeunload", function () {
    isNewPageLoad = true;
  });

  window.addEventListener("popstate", function () {
    console.log("Navigation detected - resetting state");
    isNewPageLoad = true;
    resetAll();
  });
}

/**
 * Ensures robust initialization with fallbacks
 * Sets up navigation listeners and performs initial scan
 */
function ensureRobustInitialization() {
  setupNavigationListener();
  checkFuse();
  initialize();

  // Fallback initialization if the main one fails
  setTimeout(() => {
    if (!initialProcessingComplete) {
      console.log("Fallback initialization triggered");
      chrome.runtime.sendMessage({ action: "getKeywords" }, (response) => {
        if (response && response.keywords) {
          blockSpoilers(response.keywords);
        }
      });
    }
  }, 1500);
}

// Run initialization with appropriate timing based on document state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureRobustInitialization);
} else {
  ensureRobustInitialization();
}
