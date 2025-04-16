/**
 * content.js - With dropdown mode selector and selective spoiler display
 */

// Different texts for different detection methods
const KEYWORD_SPOILER_TEXT = "🛑 SPOILERS AHEAD 🛑";
const API_SPOILER_TEXT = "🛑 SPOILERS AHEAD (AI) 🛑";

// Available detection modes
const DETECTION_MODES = {
  BOTH: "both",
  API_ONLY: "api",
  KEYWORDS_ONLY: "keywords",
};

// Array of color scheme options for the spoiler block elements
const colorOptions = [
  { bgColor: "#d81b60", textColor: "#ffffff" },
  { bgColor: "#8e24aa", textColor: "#ffffff" },
  { bgColor: "#5e35b1", textColor: "#ffffff" },
  { bgColor: "#3949ab", textColor: "#ffffff" },
  { bgColor: "#1e88e5", textColor: "#ffffff" },
  { bgColor: "#00897b", textColor: "#ffffff" },
  { bgColor: "#43a047", textColor: "#ffffff" },
  { bgColor: "#e53935", textColor: "#ffffff" },
  { bgColor: "#f4511e", textColor: "#ffffff" },
  { bgColor: "#6d4c41", textColor: "#ffffff" },
];

// Store original content for elements that are replaced with spoiler blocks
const storedOriginals = {};
let idCounter = 1; // Counter for unique spoiler IDs

// Array to store keywords that the user has chosen to ignore
let ignoredKeywords = [];

// Current detection mode
let currentMode = DETECTION_MODES.BOTH;

// Track elements that have already been processed
const processedElements = new Set();

// API configuration
const SPOILER_API_URL = "https://spoilerdetector.site/predict";
const API_USERNAME = "admin";
const API_PASSWORD = "password123";

// API batch size and limits
const API_MAX_BATCH_SIZE = 20; // Maximum items per API call
const API_MAX_ELEMENTS = 50; // Maximum elements to process in total

// Debug mode to print detailed logs about API usage
const DEBUG_API = true;

/**
 * Checks if page contains media-related content worth scanning
 */
function shouldScanPage() {
  // Get current domain
  const domain = window.location.hostname;
  
  // Whitelist domains that should never be scanned
  const whitelistedDomains = [
    'wikipedia.org',
    'en.wikipedia.org',
    'docs.google.com',
    'github.com',
    'stackoverflow.com',
    'news.com'
  ];
  
  // If domain is in whitelist, skip scanning
  if (whitelistedDomains.some(d => domain.includes(d))) {
    console.log("Whitelisted domain detected, skipping scan:", domain);
    return false;
  }
  
  return true;
}

/**
 * Returns a random color scheme from the available options
 */
function getRandomColorScheme() {
  const randomIndex = Math.floor(Math.random() * colorOptions.length);
  return colorOptions[randomIndex];
}

/**
 * Checks if a text contains any of the specified keywords
 */
function containsKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;

  const lowerText = text.toLowerCase();

  // Filter out ignored keywords
  const activeKeywords = keywords.filter(
    (k) => !ignoredKeywords.includes(k.toLowerCase())
  );

  if (activeKeywords.length === 0) return false;

  // Check for exact matches with word boundaries
  for (const keyword of activeKeywords) {
    try {
      const regex = new RegExp("\\b" + keyword + "\\b", "i");
      if (regex.test(lowerText)) {
        return keyword; // Return the matched keyword
      }
    } catch (e) {
      // Skip invalid regex
      continue;
    }
  }

  return false;
}

/**
 * Hide spoiler content and replace with warning
 * @param {HTMLElement} element - The element to hide
 * @param {string} reason - The reason for hiding (keyword or API)
 * @param {boolean} isFromApi - Whether this was detected by the API
 */
function hideSpoilerContent(element, reason, isFromApi = false) {
  if (!element || !element.textContent || processedElements.has(element)) {
    return;
  }

  // Check if we should hide based on current mode
  if (
    (isFromApi && currentMode === DETECTION_MODES.KEYWORDS_ONLY) ||
    (!isFromApi && currentMode === DETECTION_MODES.API_ONLY)
  ) {
    // Skip if this type of spoiler shouldn't be shown in current mode
    return;
  }

  console.log("Hiding spoiler content:", reason);

  // Mark as processed
  processedElements.add(element);

  // Generate unique ID
  const uniqueId = `spoiler-${idCounter++}`;

  // Store original for later retrieval
  storedOriginals[uniqueId] = {
    originalContent: element.innerHTML,
    reason: reason,
    isFromApi: isFromApi,
  };

  // Get color scheme
  const colorScheme = getRandomColorScheme();

  // Create spoiler warning element
  const spoilerWarning = document.createElement("div");
  spoilerWarning.className = "spoiler-warning";
  spoilerWarning.setAttribute("data-spoiler-id", uniqueId);

  // Use different text based on detection method
  spoilerWarning.textContent = isFromApi
    ? API_SPOILER_TEXT
    : KEYWORD_SPOILER_TEXT;

  // Add data attribute to identify the source
  spoilerWarning.setAttribute("data-source", isFromApi ? "api" : "keyword");

  spoilerWarning.style.backgroundColor = colorScheme.bgColor;
  spoilerWarning.style.color = colorScheme.textColor;
  spoilerWarning.style.padding = "5px 10px";
  spoilerWarning.style.margin = "5px 0";
  spoilerWarning.style.borderRadius = "4px";
  spoilerWarning.style.cursor = "pointer";
  spoilerWarning.style.display = "block";
  spoilerWarning.style.fontFamily = "Arial, sans-serif";
  spoilerWarning.style.fontSize = "14px";
  spoilerWarning.style.textAlign = "center";
  spoilerWarning.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  spoilerWarning.title = "Click to reveal spoiler content";

  // Replace content
  element.innerHTML = "";
  element.appendChild(spoilerWarning);
}

/**
 * Check for spoilers using keywords
 */
function detectKeywordSpoilers(keywords) {
  console.log("Checking for keyword spoilers with:", keywords);

  if (!keywords || keywords.length === 0) return;

  // If we're in API only mode, skip keyword detection
  if (currentMode === DETECTION_MODES.API_ONLY) {
    console.log("Skipping keyword detection in API-only mode");
    return;
  }

  // Filter out short keywords
  const filteredKeywords = keywords.filter((kw) => kw && kw.length >= 3);

  if (filteredKeywords.length === 0) return;

  // Target specific elements that commonly contain spoilers
  const paragraphs = document.querySelectorAll("p");
  const listItems = document.querySelectorAll("li");
  const spans = document.querySelectorAll("span");

  console.log(
    "Checking " +
      paragraphs.length +
      " paragraphs, " +
      listItems.length +
      " list items, and " +
      spans.length +
      " spans"
  );

  // Check paragraphs (most common spoiler containers)
  paragraphs.forEach((paragraph) => {
    if (processedElements.has(paragraph)) return;

    const text = paragraph.textContent;
    if (!text || text.length < 15) return;

    const matchedKeyword = containsKeywords(text, filteredKeywords);
    if (matchedKeyword) {
      hideSpoilerContent(paragraph, "Keyword match: " + matchedKeyword, false);
    }
  });

  // Check list items
  listItems.forEach((item) => {
    if (processedElements.has(item)) return;

    const text = item.textContent;
    if (!text || text.length < 15) return;

    const matchedKeyword = containsKeywords(text, filteredKeywords);
    if (matchedKeyword) {
      hideSpoilerContent(item, "Keyword match: " + matchedKeyword, false);
    }
  });

  // Check spans (only larger ones to avoid breaking UI elements)
  spans.forEach((span) => {
    if (processedElements.has(span)) return;

    const text = span.textContent;
    if (!text || text.length < 30) return; // Higher threshold for spans

    const matchedKeyword = containsKeywords(text, filteredKeywords);
    if (matchedKeyword) {
      hideSpoilerContent(span, "Keyword match: " + matchedKeyword, false);
    }
  });
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text) {
  return text
    .replace(/([.!?])\s*(?=[A-Z])/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 15); // Only keep sentences with reasonable length
}

/**
 * Collect text blocks for API processing from all page elements
 */
function collectTextBlocksForApi() {
  console.log("Collecting text blocks for API processing");

  // If we're in keywords only mode, skip API detection
  if (currentMode === DETECTION_MODES.KEYWORDS_ONLY) {
    console.log("Skipping API detection in keywords-only mode");
    return [];
  }

  const textBlocks = [];

  // Process various element types
  const elementTypes = [
    { selector: "p", minLength: 15 },
    { selector: "li", minLength: 15 },
    { selector: "span", minLength: 30 }, // Higher for spans
    { selector: "div:not(:has(> p))", minLength: 30 }, // Text-only divs
    { selector: "td", minLength: 15 },
    { selector: "h1, h2, h3, h4, h5, h6", minLength: 15 },
  ];

  elementTypes.forEach((type) => {
    try {
      const elements = document.querySelectorAll(type.selector);

      elements.forEach((element) => {
        // Skip processed elements
        if (processedElements.has(element)) return;

        // Get text and check length
        const text = element.textContent?.trim();
        if (!text || text.length < type.minLength) return;

        // For longer texts, split into sentences
        if (text.length > 200) {
          const sentences = splitIntoSentences(text);
          sentences.forEach((sentence) => {
            textBlocks.push({
              element: element,
              text: sentence,
            });
          });
        } else {
          // For shorter texts, use the entire text
          textBlocks.push({
            element: element,
            text: text,
          });
        }
      });
    } catch (error) {
      console.error(`Error processing ${type.selector} elements:`, error);
    }
  });

  console.log(`Collected ${textBlocks.length} text blocks for API processing`);

  if (DEBUG_API && textBlocks.length > 0) {
    // Log sample of collected text blocks
    console.log("Sample text blocks:");
    for (let i = 0; i < Math.min(5, textBlocks.length); i++) {
      console.log(
        `${i + 1}. ${textBlocks[i].text.substring(0, 50)}... (${
          textBlocks[i].element.tagName
        })`
      );
    }
  }

  return textBlocks;
}

/**
 * Process text blocks with API in batches
 */
function processTextBlocksWithApi(textBlocks) {
  if (!textBlocks || textBlocks.length === 0) return;

  // Limit to reasonable number to avoid overwhelming the API
  const limitedBlocks = textBlocks.slice(0, API_MAX_ELEMENTS);

  console.log(
    `Processing ${limitedBlocks.length} text blocks with API in batches of ${API_MAX_BATCH_SIZE}`
  );

  // Process in batches
  for (let i = 0; i < limitedBlocks.length; i += API_MAX_BATCH_SIZE) {
    const batchBlocks = limitedBlocks.slice(i, i + API_MAX_BATCH_SIZE);

    // Stagger batch processing to avoid overwhelming the API
    setTimeout(() => {
      processApiBatch(batchBlocks, i / API_MAX_BATCH_SIZE + 1);
    }, i * 200); // 200ms delay between batches
  }
}

/**
 * Process a single batch with the API
 */
function processApiBatch(textBlocks, batchNumber) {
  if (!textBlocks || textBlocks.length === 0) return;

  console.log(
    `Processing API batch #${batchNumber} with ${textBlocks.length} blocks`
  );

  if (DEBUG_API) {
    console.log("Text being sent to API:");
    textBlocks.forEach((block, index) => {
      console.log(`${index + 1}. "${block.text.substring(0, 50)}..."`);
    });
  }

  // Extract just the texts
  const texts = textBlocks.map((block) => block.text);

  // Create auth header
  const authHeader = "Basic " + btoa(`${API_USERNAME}:${API_PASSWORD}`);

  // Call the API
  fetch(SPOILER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ texts }),
    mode: "cors",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      return response.text();
    })
    .then((responseText) => {
      try {
        if (DEBUG_API) {
          console.log(
            `API response for batch #${batchNumber}:`,
            responseText.substring(0, 100) + "..."
          );
        }
        return JSON.parse(responseText);
      } catch (e) {
        console.error("Error parsing API response:", e);
        console.error("Raw response:", responseText);
        throw new Error("Failed to parse API response");
      }
    })
    .then((results) => {
      if (!Array.isArray(results)) {
        console.error("Invalid API response format:", results);
        return;
      }

      console.log(
        `API batch #${batchNumber} returned ${results.length} results`
      );

      let spoilersFound = 0;

      // Process the results
      results.forEach((result, index) => {
        if (index < textBlocks.length && result.spoiler === true) {
          spoilersFound++;

          const element = textBlocks[index].element;
          const text = textBlocks[index].text.substring(0, 50) + "...";

          if (DEBUG_API) {
            console.log(`API detected spoiler #${spoilersFound} in: "${text}"`);
          }

          // Hide spoiler content
          hideSpoilerContent(element, "API detected spoiler", true);
        }
      });

      console.log(`API batch #${batchNumber} found ${spoilersFound} spoilers`);
    })
    .catch((error) => {
      console.error(`Error in API batch #${batchNumber}:`, error);
    });
}

/**
 * Check for spoilers using the API
 */
function detectApiSpoilers() {
  console.log("Starting API spoiler detection");

  // Collect text blocks from the page
  const textBlocks = collectTextBlocksForApi();

  if (textBlocks.length === 0) {
    console.log("No text blocks found for API detection");
    return;
  }

  // Process text blocks with API
  processTextBlocksWithApi(textBlocks);
}

/**
 * Handle click on spoiler warning to reveal content
 */
function handleSpoilerClick(event) {
  // Find the spoiler warning element that was clicked
  let target = event.target;
  while (target && !target.classList.contains("spoiler-warning")) {
    if (target === document.body) return;
    target = target.parentElement;
  }

  if (!target) return;

  const spoilerId = target.getAttribute("data-spoiler-id");
  if (!spoilerId || !storedOriginals[spoilerId]) return;

  // Get original content
  const originalData = storedOriginals[spoilerId];
  const parentElement = target.parentElement;

  // If it was a keyword match, add to ignored keywords
  const reason = originalData.reason;
  if (reason && reason.startsWith("Keyword match:")) {
    const keyword = reason.substring("Keyword match:".length).trim();
    ignoreKeyword(keyword);
  }

  // Restore original content
  parentElement.innerHTML = originalData.originalContent;

  // Mark as revealed
  parentElement.setAttribute("data-spoiler-revealed", "true");

  // Delete from storage
  delete storedOriginals[spoilerId];

  // Show reset button
  createResetButton();
}

/**
 * Add keyword to ignored list
 */
function ignoreKeyword(keyword) {
  if (!keyword) return;

  const lowerKeyword = keyword.toLowerCase();
  if (ignoredKeywords.includes(lowerKeyword)) return;

  ignoredKeywords.push(lowerKeyword);
  console.log("Added ignored keyword:", lowerKeyword);

  // Save to storage
  chrome.storage.local.set({ ignoredKeywords: ignoredKeywords }, function () {
    console.log("Saved ignored keywords to storage");
  });
}

/**
 * Load ignored keywords from storage
 */
function loadIgnoredKeywords(callback) {
  chrome.storage.local.get("ignoredKeywords", function (result) {
    if (result.ignoredKeywords && Array.isArray(result.ignoredKeywords)) {
      ignoredKeywords = result.ignoredKeywords;
      console.log("Loaded ignored keywords:", ignoredKeywords);
    }

    if (callback && typeof callback === "function") {
      callback();
    }
  });
}

/**
 * Create reset button
 */
function createResetButton() {
  // Remove existing button
  const existingButton = document.getElementById("spoiler-reset-button");
  if (existingButton) {
    existingButton.remove();
  }

  // Create button
  const resetButton = document.createElement("button");
  resetButton.id = "spoiler-reset-button";
  resetButton.textContent = "Reset Spoilers";
  resetButton.onclick = resetAll;

  // Style button
  resetButton.style.position = "fixed";
  resetButton.style.bottom = "20px";
  resetButton.style.right = "20px";
  resetButton.style.zIndex = "999999";
  resetButton.style.backgroundColor = "#f44336";
  resetButton.style.color = "white";
  resetButton.style.border = "none";
  resetButton.style.borderRadius = "4px";
  resetButton.style.padding = "8px 16px";
  resetButton.style.fontSize = "14px";
  resetButton.style.cursor = "pointer";
  resetButton.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";

  // Add to page
  document.body.appendChild(resetButton);
}

/**
 * Create mode dropdown selector
 */
// function createModeDropdown() {
//   // Remove existing dropdown if present
//   const existingDropdown = document.getElementById("spoiler-mode-dropdown");
//   if (existingDropdown) {
//     existingDropdown.remove();
//   }

//   // Create container
//   const dropdownContainer = document.createElement("div");
//   dropdownContainer.id = "spoiler-mode-container";

//   // Style the container
//   dropdownContainer.style.position = "fixed";
//   dropdownContainer.style.bottom = "20px";
//   dropdownContainer.style.right = "160px";
//   dropdownContainer.style.zIndex = "999999";
//   dropdownContainer.style.display = "flex";
//   dropdownContainer.style.flexDirection = "column";
//   dropdownContainer.style.alignItems = "flex-start";

//   // Create label
//   const label = document.createElement("label");
//   label.textContent = "Detection Mode:";
//   label.style.marginBottom = "4px";
//   label.style.fontSize = "12px";
//   label.style.color = "#333";
//   label.style.fontFamily = "Arial, sans-serif";
//   label.htmlFor = "spoiler-mode-dropdown";

//   // Create select dropdown
//   const dropdown = document.createElement("select");
//   dropdown.id = "spoiler-mode-dropdown";

//   // Style the dropdown
//   dropdown.style.padding = "6px 10px";
//   dropdown.style.borderRadius = "4px";
//   dropdown.style.border = "1px solid #ccc";
//   dropdown.style.backgroundColor = "#fff";
//   dropdown.style.color = "#333";
//   dropdown.style.fontSize = "14px";
//   dropdown.style.cursor = "pointer";
//   dropdown.style.width = "140px";

//   // Create options
//   const options = [
//     { value: DETECTION_MODES.BOTH, text: "Both Methods" },
//     { value: DETECTION_MODES.API_ONLY, text: "API Only" },
//     { value: DETECTION_MODES.KEYWORDS_ONLY, text: "Keywords Only" },
//   ];

//   options.forEach((option) => {
//     const optionElement = document.createElement("option");
//     optionElement.value = option.value;
//     optionElement.textContent = option.text;

//     // Set selected based on current mode
//     if (option.value === currentMode) {
//       optionElement.selected = true;
//     }

//     dropdown.appendChild(optionElement);
//   });

//   // Add change event handler
//   dropdown.onchange = function () {
//     changeDetectionMode(dropdown.value);
//   };

//   // Assemble and add to page
//   dropdownContainer.appendChild(label);
//   dropdownContainer.appendChild(dropdown);
//   document.body.appendChild(dropdownContainer);

//   console.log("Mode dropdown created");
// }

/**
 * Create mode dropdown selector with colorful, eye-catching design
 */
function createModeDropdown() {
  // Remove existing dropdown if present
  const existingDropdown = document.getElementById("spoiler-mode-dropdown");
  if (existingDropdown) {
    existingDropdown.remove();
  }

  // Create container
  const dropdownContainer = document.createElement("div");
  dropdownContainer.id = "spoiler-mode-container";

  // Style the container with a colorful background
  dropdownContainer.style.position = "fixed";
  dropdownContainer.style.bottom = "20px";
  dropdownContainer.style.right = "160px";
  dropdownContainer.style.zIndex = "999999";
  dropdownContainer.style.display = "flex";
  dropdownContainer.style.flexDirection = "column";
  dropdownContainer.style.alignItems = "center";
  dropdownContainer.style.padding = "10px";
  dropdownContainer.style.borderRadius = "8px";
  dropdownContainer.style.backgroundColor = "#3949ab"; // Deep blue background
  dropdownContainer.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";

  // Create label
  const label = document.createElement("label");
  label.textContent = "Detection Mode";
  label.style.marginBottom = "6px";
  label.style.fontSize = "14px";
  label.style.fontWeight = "bold";
  label.style.color = "white"; // White text on blue background
  label.style.fontFamily = "Arial, sans-serif";
  label.htmlFor = "spoiler-mode-dropdown";

  // Create select dropdown
  const dropdown = document.createElement("select");
  dropdown.id = "spoiler-mode-dropdown";

  // Style the dropdown to be colorful and eye-catching
  dropdown.style.padding = "8px 12px";
  dropdown.style.borderRadius = "4px";
  dropdown.style.border = "2px solid #ffeb3b"; // Yellow border
  dropdown.style.backgroundColor = "#fff";
  dropdown.style.color = "#333";
  dropdown.style.fontSize = "14px";
  dropdown.style.fontWeight = "bold";
  dropdown.style.cursor = "pointer";
  dropdown.style.width = "150px";
  dropdown.style.appearance = "none"; // Remove default arrow
  dropdown.style.WebkitAppearance = "none";
  dropdown.style.MozAppearance = "none";
  dropdown.style.backgroundImage =
    'url(\'data:image/svg+xml;utf8,<svg fill="%23333" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>\')';
  dropdown.style.backgroundRepeat = "no-repeat";
  dropdown.style.backgroundPosition = "right 8px center";
  dropdown.style.paddingRight = "30px";

  // Create options
  const options = [
    { value: DETECTION_MODES.BOTH, text: "Both Methods", color: "#3949ab" }, // Blue
    { value: DETECTION_MODES.API_ONLY, text: "API Only", color: "#43a047" }, // Green
    {
      value: DETECTION_MODES.KEYWORDS_ONLY,
      text: "Keywords Only",
      color: "#e53935",
    }, // Red
  ];

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    optionElement.style.backgroundColor = option.color;
    optionElement.style.color = "white";
    optionElement.style.fontWeight = "bold";

    // Set selected based on current mode
    if (option.value === currentMode) {
      optionElement.selected = true;
      // Update container background to match the selected option
      dropdownContainer.style.backgroundColor = option.color;
    }

    dropdown.appendChild(optionElement);
  });

  // Add change event handler
  dropdown.onchange = function () {
    // Get the selected option color
    const selectedOption = options.find((opt) => opt.value === dropdown.value);
    if (selectedOption) {
      // Update container background to match the selected option
      dropdownContainer.style.backgroundColor = selectedOption.color;
    }

    changeDetectionMode(dropdown.value);
  };

  // Assemble and add to page
  dropdownContainer.appendChild(label);
  dropdownContainer.appendChild(dropdown);
  document.body.appendChild(dropdownContainer);

  console.log("Colorful mode dropdown created");
}

/**
 * Change the detection mode and update spoiler visibility
 */
function changeDetectionMode(newMode) {
  if (newMode === currentMode) return;

  console.log(`Changing detection mode from ${currentMode} to ${newMode}`);

  // Update current mode
  currentMode = newMode;

  // Save to storage
  chrome.storage.local.set({ detectionMode: newMode }, function () {
    console.log("Saved detection mode:", newMode);
  });

  // Refresh detection without page reload
  updateSpoilerVisibility();
}

/**
 * Update which spoilers are visible based on current mode
 */
function updateSpoilerVisibility() {
  console.log("Updating spoiler visibility for mode:", currentMode);

  // Create an overlay to show the loading state
  showLoadingOverlay();

  // Get all spoiler warnings
  const spoilerWarnings = document.querySelectorAll(".spoiler-warning");

  // For each warning, check if it should be shown in current mode
  spoilerWarnings.forEach((warning) => {
    const spoilerId = warning.getAttribute("data-spoiler-id");
    if (!spoilerId || !storedOriginals[spoilerId]) return;

    const originalData = storedOriginals[spoilerId];
    const isFromApi = originalData.isFromApi;
    const parentElement = warning.parentElement;

    // Should this spoiler be visible in current mode?
    let shouldShow = true;

    if (currentMode === DETECTION_MODES.API_ONLY && !isFromApi) {
      shouldShow = false;
    } else if (currentMode === DETECTION_MODES.KEYWORDS_ONLY && isFromApi) {
      shouldShow = false;
    }

    if (!shouldShow) {
      // Restore original content for this one
      parentElement.innerHTML = originalData.originalContent;
      parentElement.setAttribute("data-spoiler-revealed", "true");
      // Remove from storage
      delete storedOriginals[spoilerId];
    }
  });

  // If we should detect new spoilers, do that with a delay
  setTimeout(() => {
    // Clear all elements that were marked as processed
    processedElements.clear();

    // Re-run detection with current mode
    chrome.runtime.sendMessage({ action: "getKeywords" }, function (response) {
      if (response && response.keywords && response.keywords.length > 0) {
        detectSpoilers(response.keywords);
      }

      // Hide the loading overlay
      hideLoadingOverlay();
    });
  }, 300);
}

/**
 * Show a loading overlay while updating
 */
function showLoadingOverlay() {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById("spoiler-loading-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "spoiler-loading-overlay";

  // Style the overlay
  overlay.style.position = "fixed";
  overlay.style.bottom = "80px";
  overlay.style.right = "30px";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  overlay.style.color = "white";
  overlay.style.padding = "10px 20px";
  overlay.style.borderRadius = "4px";
  overlay.style.zIndex = "999999";
  overlay.style.fontFamily = "Arial, sans-serif";
  overlay.style.fontSize = "14px";

  // Add message
  overlay.textContent = "Updating spoilers...";

  // Add to page
  document.body.appendChild(overlay);
}

/**
 * Hide the loading overlay
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById("spoiler-loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Reset all spoilers and settings
 */
function resetAll() {
  ignoredKeywords = [];
  chrome.storage.local.remove("ignoredKeywords", function () {
    console.log("Cleared ignored keywords");
    window.location.reload();
  });
}

/**
 * Main function to detect spoilers
 */
function detectSpoilers(keywords) {
  console.log("Starting spoiler detection in mode:", currentMode);

  // Skip scanning if no media content found
  if (!shouldScanPage()) {
    console.log("No media content detected - skipping spoiler scan");
    return;
  }

  if (!keywords || keywords.length === 0) {
    console.log("No keywords to check");
    return;
  }

  // Run keyword detection if enabled in current mode
  if (
    currentMode === DETECTION_MODES.BOTH ||
    currentMode === DETECTION_MODES.KEYWORDS_ONLY
  ) {
    detectKeywordSpoilers(keywords);
  }

  // Run API detection if enabled in current mode
  if (
    currentMode === DETECTION_MODES.BOTH ||
    currentMode === DETECTION_MODES.API_ONLY
  ) {
    setTimeout(function () {
      detectApiSpoilers();
    }, 500);
  }
}

/**
 * Initialize the spoiler blocker
 */
function initialize() {
  console.log("Initializing spoiler blocker with dropdown mode selector");

  // Add CSS for spoiler warnings
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .spoiler-warning {
      display: block !important;
      text-align: center !important;
      font-weight: bold !important;
      cursor: pointer !important;
    }
    
    [data-spoiler-revealed="true"] {
      /* Mark elements that have had spoilers revealed */
    }
    
    #spoiler-mode-dropdown option {
      padding: 5px;
    }
  `;
  document.head.appendChild(styleElement);

  // Load detection mode
  chrome.storage.local.get("detectionMode", function (result) {
    if (result.detectionMode) {
      currentMode = result.detectionMode;
    }

    console.log("Using detection mode:", currentMode);

    // Load ignored keywords then get keywords to check
    loadIgnoredKeywords(function () {
      chrome.runtime.sendMessage(
        { action: "getKeywords" },
        function (response) {
          if (response && response.keywords && response.keywords.length > 0) {
            console.log("Received keywords:", response.keywords);
            detectSpoilers(response.keywords);

            // Run a second pass after a delay
            setTimeout(function () {
              detectSpoilers(response.keywords);
            }, 2000);
          } else {
            console.log("No keywords received");
          }
        }
      );
    });
  });

  // Set up click listener for revealing spoilers
  document.addEventListener("click", handleSpoilerClick);

  // Create UI elements
  createModeDropdown();

  if (ignoredKeywords.length > 0) {
    createResetButton();
  }
}

// Run initialization when document is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function (message) {
  if (message.action === "settingsUpdated") {
    window.location.reload();
  } else if (message.action === "resetAll") {
    resetAll();
  }
});