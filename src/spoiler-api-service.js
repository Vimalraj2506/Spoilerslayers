/**
 * spoiler-api-service.js - Direct API service for detecting spoilers
 * Provides selective API detection to prevent breaking page structure
 */

// API configuration
const SPOILER_API_URL = "https://spoilerdetector.site/predict";
const API_USERNAME = "admin";
const API_PASSWORD = "password123";

// Cache API results to avoid duplicate requests
const spoilerCheckCache = new Map();

// Blacklisted element selectors that should never be processed
// This prevents critical page elements from being hidden
const BLACKLISTED_SELECTORS = [
  "header",
  "nav",
  ".nav",
  ".navigation",
  ".menu",
  "footer",
  ".footer",
  "button",
  "input",
  "select",
  "textarea",
  ".sidebar",
  "aside",
  ".logo",
  ".branding",
  "form",
  ".form",
  ".toolbar",
  ".controls",
  ".comments-form",
  ".comment-form",
  ".search",
  ".search-form",
  ".pagination",
  ".pager",
  ".breadcrumb",
  ".breadcrumbs",
  ".social",
  ".share",
  "#header",
  "#footer",
  "#nav",
  "#menu",
  "[role=navigation]",
  "[role=banner]",
  "[role=search]",
];

// Small utility function to check if element matches any blacklisted selector
function isBlacklistedElement(element) {
  if (!element || !element.matches) return false;

  try {
    return BLACKLISTED_SELECTORS.some((selector) => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
  } catch (e) {
    return false;
  }
}

// Check if element is or has a parent that's blacklisted
function isOrHasBlacklistedParent(element) {
  if (!element) return false;

  try {
    // Check the element itself
    if (isBlacklistedElement(element)) return true;

    // Check parents up to 5 levels
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      if (isBlacklistedElement(parent)) return true;
      parent = parent.parentElement;
      depth++;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Extract text chunks from an element for API processing
 * @param {HTMLElement} element - Element to extract text from
 * @returns {Array} - Array of text chunks with element references
 */
function extractTextChunks(element) {
  // Skip blacklisted elements
  if (isOrHasBlacklistedParent(element)) {
    return [];
  }

  const textChunks = [];
  let chunkIndex = 0;

  try {
    // Skip elements that might break the page if hidden
    if (
      element.tagName === "BODY" ||
      element.tagName === "HTML" ||
      element.tagName === "MAIN" ||
      element.tagName === "ARTICLE" ||
      element.tagName === "SECTION"
    ) {
      // For these large container elements, we extract from children instead
      // but don't process the container itself
      const children = element.children;
      let extractedFromChildren = [];

      for (let i = 0; i < children.length; i++) {
        const childChunks = extractTextChunks(children[i]);
        extractedFromChildren = extractedFromChildren.concat(childChunks);
      }

      return extractedFromChildren;
    }

    // Get all text nodes in this element
    const textNodes = getAllTextNodes(element);

    textNodes.forEach((node) => {
      // Skip empty nodes
      const text = node && node.nodeValue ? node.nodeValue.trim() : "";
      if (!text || text.length < 10) {
        return;
      }

      // Split into sentences
      const sentences = splitIntoSentences(text);

      sentences.forEach((sentence) => {
        if (sentence.length >= 10) {
          // Try to find the smallest parent element that contains just this text
          // rather than the entire element (which might be too large)
          let targetElement = node.parentElement || element;

          // Don't process elements that would break page structure
          if (isOrHasBlacklistedParent(targetElement)) {
            return;
          }

          // Check if this is a small inline element - preferred for replacement
          const isInlineElement =
            targetElement.tagName === "SPAN" ||
            targetElement.tagName === "A" ||
            targetElement.tagName === "EM" ||
            targetElement.tagName === "STRONG" ||
            targetElement.tagName === "B" ||
            targetElement.tagName === "I";

          // For large elements containing just one text node, use the element
          // For large elements with many children, just skip this altogether
          if (!isInlineElement && targetElement.childNodes.length > 3) {
            // Too risky to replace large elements with many children
            return;
          }

          textChunks.push({
            element: targetElement,
            text: sentence,
            originalIndex: chunkIndex++,
            textNode: node,
          });
        }
      });
    });
  } catch (error) {
    console.error("Error extracting text chunks:", error);
  }

  return textChunks;
}

/**
 * Finds all text nodes within a given element
 * @param {HTMLElement} element - The parent element to search within
 * @returns {Array} Array of text nodes found
 */
function getAllTextNodes(element) {
  if (!element || !element.nodeType) {
    return [];
  }

  const textNodes = [];

  try {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim() !== "") {
        textNodes.push(node);
      }
    }
  } catch (error) {
    console.error("Error getting text nodes:", error);
  }

  return textNodes;
}

/**
 * Splits text into sentences for more accurate spoiler detection
 * @param {string} text - Text to split into sentences
 * @returns {Array} Array of sentences
 */
function splitIntoSentences(text) {
  if (!text) return [];

  try {
    return text
      .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch (error) {
    console.error("Error splitting text into sentences:", error);
    return [text]; // Return original text as fallback
  }
}

/**
 * Check cache for previously detected spoilers
 * @param {string} text - Text to check in cache
 * @returns {boolean|null} - True if spoiler, false if not, null if not cached
 */
function isTextSpoilerFromCache(text) {
  if (!text) return null;

  if (spoilerCheckCache.has(text)) {
    return spoilerCheckCache.get(text);
  }

  return null; // Not in cache
}

/**
 * Main API detection function - analyzes batch of elements for spoilers
 * With selective filtering to prevent breaking page structure
 * @param {Array|NodeList} elements - Elements to check for spoilers
 * @param {Function} hideCallback - Callback for handling detected spoilers
 */
async function detectSpoilersViaAPI(elements, hideCallback) {
  console.log(
    "🔍 API Detection: Starting check for",
    elements.length,
    "elements"
  );

  if (!elements || elements.length === 0 || !hideCallback) {
    console.log("❌ API Detection: No elements to check or missing callback");
    return;
  }

  // Filter out critical page elements that should never be processed
  const safeElementArray = Array.from(elements).filter((element) => {
    // Skip elements that would break page structure
    if (isOrHasBlacklistedParent(element)) {
      return false;
    }

    // Skip certain tags entirely
    if (
      !element.tagName ||
      element.tagName === "HTML" ||
      element.tagName === "BODY" ||
      element.tagName === "HEAD" ||
      element.tagName === "SCRIPT" ||
      element.tagName === "STYLE" ||
      element.tagName === "META" ||
      element.tagName === "LINK" ||
      element.tagName === "BUTTON" ||
      element.tagName === "INPUT" ||
      element.tagName === "SELECT" ||
      element.tagName === "TEXTAREA" ||
      element.tagName === "FORM"
    ) {
      return false;
    }

    return true;
  });

  if (safeElementArray.length === 0) {
    console.log("❌ API Detection: No safe elements to check after filtering");
    return;
  }

  console.log(
    "🔍 API Detection: Processing",
    safeElementArray.length,
    "safe elements"
  );

  // Process elements directly - collect all text chunks from safe elements
  let allChunks = [];
  safeElementArray.forEach((element) => {
    try {
      const chunks = extractTextChunks(element);
      allChunks = allChunks.concat(chunks);
    } catch (error) {
      console.error("Error extracting chunks from element:", error);
    }
  });

  if (allChunks.length === 0) {
    console.log("❌ API Detection: No text chunks found in elements");
    return;
  }

  console.log(
    "🔍 API Detection: Found",
    allChunks.length,
    "text chunks to check"
  );

  // Process in smaller batches to avoid overwhelming the API
  const BATCH_SIZE = 20;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batchChunks = allChunks.slice(i, i + BATCH_SIZE);
    console.log(
      `🔍 API Detection: Processing batch ${
        Math.floor(i / BATCH_SIZE) + 1
      }/${Math.ceil(allChunks.length / BATCH_SIZE)}`
    );

    try {
      // Send to API and process results
      const results = await checkSpoilersViaAPI(batchChunks);

      if (results && results.length > 0) {
        // Get only spoiler results
        const spoilerResults = results.filter((result) => result.isSpoiler);

        if (spoilerResults.length > 0) {
          console.log(
            `✅ API Detection: Found ${spoilerResults.length} spoilers in batch`
          );
          hideCallback(spoilerResults);
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < allChunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error("❌ API Detection: Error processing batch:", error);
    }
  }
}

/**
 * Direct API call to check texts for spoilers
 * @param {Array} textItems - Array of text items to check
 * @returns {Array} - Results with spoiler detection
 */
async function checkSpoilersViaAPI(textItems) {
  // Skip already cached or too short items
  const textsToCheck = textItems.filter(
    (item) =>
      item.text &&
      item.text.trim().length > 10 &&
      !spoilerCheckCache.has(item.text)
  );

  if (textsToCheck.length === 0) {
    console.log(
      "🔍 API Detection: No texts to check (all cached or too short)"
    );
    return [];
  }

  const texts = textsToCheck.map((item) => item.text);
  console.log("🔍 API Detection: Sending", texts.length, "texts to API");

  try {
    // Create Basic Auth header
    const authHeader = "Basic " + btoa(`${API_USERNAME}:${API_PASSWORD}`);

    // Make the API request with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    console.log("🌐 API Detection: Sending request to", SPOILER_API_URL);
    const response = await fetch(SPOILER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ texts }),
      mode: "cors",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("🌐 API Detection: Response status:", response.status);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // Parse the response
    const responseText = await response.text();
    console.log(
      "🌐 API Detection: Raw response:",
      responseText.substring(0, 100) + "..."
    );

    let spoilerResults;
    try {
      spoilerResults = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "❌ API Detection: Error parsing JSON response:",
        parseError
      );
      console.error("Response was:", responseText);
      throw new Error("Invalid JSON response from API");
    }

    if (!Array.isArray(spoilerResults)) {
      console.error(
        "❌ API Detection: Unexpected response format:",
        typeof spoilerResults
      );
      return [];
    }

    console.log("✅ API Detection: Received", spoilerResults.length, "results");

    // Update cache with results
    textsToCheck.forEach((item, index) => {
      if (index < spoilerResults.length) {
        const isSpoiler = spoilerResults[index].spoiler === true;
        spoilerCheckCache.set(item.text, isSpoiler);
      }
    });

    // Map results to original items
    return textsToCheck.map((item, index) => {
      let isSpoiler = false;

      if (index < spoilerResults.length) {
        isSpoiler = spoilerResults[index].spoiler === true;

        if (isSpoiler) {
          console.log(
            "🚨 API Detection: Spoiler detected in:",
            item.text.substring(0, 30) + "..."
          );
        }
      }

      return {
        element: item.element,
        text: item.text,
        isSpoiler: isSpoiler,
        originalIndex: item.originalIndex,
      };
    });
  } catch (error) {
    console.error("❌ API Detection: Error checking spoilers via API:", error);

    // Special handling for different error types
    if (error.name === "AbortError") {
      console.error("❌ API Detection: Request timed out after 10 seconds");
    } else if (error.name === "TypeError") {
      console.error(
        "❌ API Detection: Network error - Check API URL or network connection"
      );

      // Generate mock responses as fallback (randomly mark some as spoilers)
      return textsToCheck.map((item, index) => {
        // Randomly mark ~10% as spoilers for testing
        const mockIsSpoiler = Math.random() < 0.1;

        if (mockIsSpoiler) {
          console.log(
            "🚨 Mock API: Spoiler detected in:",
            item.text.substring(0, 30) + "..."
          );
        }

        // Cache the mock result
        spoilerCheckCache.set(item.text, mockIsSpoiler);

        return {
          element: item.element,
          text: item.text,
          isSpoiler: mockIsSpoiler,
          originalIndex: item.originalIndex,
        };
      });
    }

    // Return non-spoiler results as fallback
    return textsToCheck.map((item) => ({
      element: item.element,
      text: item.text,
      isSpoiler: false,
      originalIndex: item.originalIndex,
    }));
  }
}

// Export functions for use in content script
export {
  detectSpoilersViaAPI,
  checkSpoilersViaAPI,
  isTextSpoilerFromCache,
  extractTextChunks,
};
