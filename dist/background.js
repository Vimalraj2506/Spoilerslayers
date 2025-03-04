// Content script - runs on web pages

// Function to block spoilers
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
    
    // Check if any keyword is in the text
    const containsSpoiler = lowercaseKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
    
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