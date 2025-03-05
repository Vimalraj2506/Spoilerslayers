// Content script for spoiler blocking - word-level precision

// Default replacement options
const replacementOptions = [
    { type: 'text', value: '[SPOILER BLOCKED]' },
    { type: 'text', value: '[CONTENT HIDDEN]' },
    { type: 'text', value: '[NO SPOILERS HERE!]' },
    { type: 'emoji', value: '🙈 🙉 🙊' },
    { type: 'emoji', value: '⚠️ SPOILER ALERT ⚠️' },
    { type: 'emoji', value: '🛑 STOP! SPOILERS AHEAD 🛑' }
  ];
  
  // Function to get a random replacement
  function getRandomReplacement() {
    const randomIndex = Math.floor(Math.random() * replacementOptions.length);
    return replacementOptions[randomIndex];
  }
  
  // Spoiler blocking function
  function blockSpoilers(keywords) {
    console.log("Blocking spoilers for keywords:", keywords);
    if (!keywords || keywords.length === 0) return;
    
    // Skip very short keywords to avoid false positives
    const filteredKeywords = keywords.filter(kw => kw.length >= 3);
    const lowercaseKeywords = filteredKeywords.map(kw => kw.toLowerCase());
    
    if (lowercaseKeywords.length === 0) return;
    
    // Find paragraphs and sentences that might contain spoilers
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, li');
    
    textElements.forEach(element => {
      // Skip elements that shouldn't be processed
      if (element.classList.contains('spoiler-processed') || 
          element.tagName === 'SCRIPT' || 
          element.tagName === 'STYLE' || 
          element.tagName === 'NOSCRIPT' ||
          getComputedStyle(element).display === 'none') {
        return;
      }
      
      // Check if the element contains any of our keywords
      const text = element.textContent;
      if (!text || text.trim() === '') return;
      
      const lowerText = text.toLowerCase();
      let hasSpoiler = false;
      
      for (const keyword of lowercaseKeywords) {
        if (lowerText.includes(keyword)) {
          hasSpoiler = true;
          break;
        }
      }
      
      if (hasSpoiler) {
        // Instead of replacing the entire element, we'll surround the keywords
        let html = element.innerHTML;
        
        // Mark element as processed
        element.classList.add('spoiler-processed');
        
        for (const keyword of lowercaseKeywords) {
          // Create a case-insensitive regex to find the keyword
          const regex = new RegExp('\\b(' + keyword + '[s|es]?)\\b', 'gi');
          
          // Replace each instance of the keyword with a spoiler span
          html = html.replace(regex, function(match) {
            const replacement = getRandomReplacement();
            const backgroundColor = replacement.type === 'text' ? '#222' : '#f8d7da';
            const textColor = replacement.type === 'text' ? '#fff' : '#721c24';
            
            return `<span class="spoiler-text" 
                         style="background-color: ${backgroundColor}; 
                                color: ${textColor}; 
                                padding: 2px 4px; 
                                border-radius: 3px; 
                                cursor: pointer;"
                         title="Click to reveal spoiler"
                         data-original="${match}"
                         onclick="this.outerHTML=this.getAttribute('data-original')">
                      ${replacement.value}
                    </span>`;
          });
        }
        
        // Update the element's HTML
        element.innerHTML = html;
      }
    });
  }
  
  // Function to initialize the content script
  function initialize() {
    console.log("Initializing Spoiler Blocker - Word Level");
    
    // Get keywords from storage
    chrome.runtime.sendMessage({ action: 'getKeywords' }, (response) => {
      console.log("Received keywords response:", response);
      if (response && response.keywords) {
        blockSpoilers(response.keywords);
      } else {
        console.log("No keywords found in response");
      }
    });
    
    // Set up a mutation observer for dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          chrome.runtime.sendMessage({ action: 'getKeywords' }, (response) => {
            if (response && response.keywords) {
              blockSpoilers(response.keywords);
            }
          });
          break;  // Only need to process once per batch of mutations
        }
      }
    });
    
    // Start observing with appropriate configuration
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }
  
  // Add event listener for inline onclick handlers (for security reasons)
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('spoiler-text')) {
      const original = e.target.getAttribute('data-original');
      if (original) {
        e.target.outerHTML = original;
      }
    }
  });
  
  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }