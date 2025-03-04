// Content script - runs on web pages

// Function to block spoilers with more advanced text processing
function blockSpoilers(keywords) {
  if (!keywords || keywords.length === 0) return;
  
  // Convert keywords to lowercase for case-insensitive matching
  const lowercaseKeywords = keywords.map(keyword => keyword.toLowerCase());
  
  // Get all text nodes in the document
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  
  // Check each text node for keywords
  textNodes.forEach(textNode => {
    const parent = textNode.parentNode;
    
    // Skip if parent is already a script, style, or is hidden
    if (
      parent.nodeName === 'SCRIPT' ||
      parent.nodeName === 'STYLE' ||
      parent.nodeName === 'NOSCRIPT' ||
      getComputedStyle(parent).display === 'none'
    ) {
      return;
    }
    
    const text = textNode.nodeValue;
    const lowerText = text.toLowerCase();
    
    // Enhanced keyword matching with different variations
    let containsSpoiler = false;
    let matchedKeyword = '';
    
    // Check each keyword
    for (const keyword of lowercaseKeywords) {
      // Check exact match
      if (lowerText.includes(keyword)) {
        containsSpoiler = true;
        matchedKeyword = keyword;
        break;
      }
      
      // Check for plurals (simple s/es ending)
      if (lowerText.includes(keyword + 's') || lowerText.includes(keyword + 'es')) {
        containsSpoiler = true;
        matchedKeyword = keyword;
        break;
      }
      
      // Check for word boundaries to avoid partial matches
      // For example, if keyword is "die", don't match "diet"
      const regex = new RegExp('\\b' + keyword + '\\b', 'i');
      if (regex.test(text)) {
        containsSpoiler = true;
        matchedKeyword = keyword;
        break;
      }
    }
    
    if (containsSpoiler) {
      // Create spoiler blocking element
      const spoilerElement = document.createElement('span');
      spoilerElement.className = 'spoiler-blocked';
      spoilerElement.style.backgroundColor = '#222';
      spoilerElement.style.color = '#222';
      spoilerElement.style.padding = '2px 4px';
      spoilerElement.style.borderRadius = '3px';
      spoilerElement.style.cursor = 'pointer';
      spoilerElement.textContent = text;
      spoilerElement.dataset.spoilerKeyword = matchedKeyword;
      spoilerElement.title = 'Click to reveal spoiler';
      
      // Add click handler to reveal text
      spoilerElement.addEventListener('click', function() {
        this.style.backgroundColor = 'transparent';
        this.style.color = 'inherit';
      });
      
      // Replace the text node with our spoiler element
      parent.replaceChild(spoilerElement, textNode);
    }
  });
}

// Function to initialize the content script
function initialize() {
  // Get keywords from storage
  chrome.runtime.sendMessage({ action: 'getKeywords' }, (response) => {
    if (response && response.keywords) {
      blockSpoilers(response.keywords);
    }
  });
  
  // Also set up a mutation observer to catch dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    chrome.runtime.sendMessage({ action: 'getKeywords' }, (response) => {
      if (response && response.keywords) {
        blockSpoilers(response.keywords);
      }
    });
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// Run our initialization
initialize();
