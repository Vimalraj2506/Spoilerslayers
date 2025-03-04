import { userManager, spoilerDatabase } from './spoiler-database-integration';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Initialize UI elements
  const authSection = document.getElementById('authSection');
  const loggedInSection = document.getElementById('loggedInSection');
  const keywordsSection = document.getElementById('keywordsSection');
  const mediaSection = document.getElementById('mediaSection');
  const statusText = document.getElementById('status');
  
  // Auth elements
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const signUpButton = document.getElementById('signUp');
  const loginButton = document.getElementById('login');
  const logoutButton = document.getElementById('logout');
  
  // Keyword elements
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordButton = document.getElementById('addKeyword');
  const keywordsList = document.getElementById('keywordsList');
  
  // Media search elements
  const mediaSearchInput = document.getElementById('mediaSearch');
  const searchResultsList = document.getElementById('searchResults');
  const popularMediaList = document.getElementById('popularMedia');
  const activeFiltersList = document.getElementById('activeFiltersList');
  
  // Tab navigation
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + 'Tab') {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Sign up
  signUpButton.addEventListener('click', async function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
      statusText.textContent = 'Please enter both email and password';
      statusText.className = 'status-error';
      return;
    }
    
    const result = await userManager.signUp(email, password);
    if (result.success) {
      statusText.textContent = 'Signed up and logged in!';
      statusText.className = '';
    } else {
      statusText.textContent = result.error;
      statusText.className = 'status-error';
    }
  });
  
  // Login
  loginButton.addEventListener('click', async function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
      statusText.textContent = 'Please enter both email and password';
      statusText.className = 'status-error';
      return;
    }
    
    const result = await userManager.signIn(email, password);
    if (result.success) {
      statusText.textContent = 'Logged in!';
      statusText.className = '';
    } else {
      statusText.textContent = result.error;
      statusText.className = 'status-error';
    }
  });
  
  // Logout
  logoutButton.addEventListener('click', async function() {
    const result = await userManager.signOut();
    if (!result.success) {
      console.error('Error signing out:', result.error);
      statusText.textContent = 'Error signing out: ' + result.error;
      statusText.className = 'status-error';
    }
  });
  
  // Add global keyword
  addKeywordButton.addEventListener('click', async function() {
    const keyword = keywordInput.value.trim();
    
    if (!keyword) return;
    
    const result = await spoilerDatabase.addGlobalKeyword(keyword);
    if (result.success) {
      keywordInput.value = '';
      await refreshKeywordsList();
      statusText.textContent = `Added "${keyword}" to global keywords`;
      statusText.className = '';
    } else {
      statusText.textContent = result.error;
      statusText.className = 'status-error';
    }
  });
  
  // Allow pressing Enter to add keyword
  keywordInput.addEventListener('keypress', async function(e) {
    if (e.key === 'Enter') {
      const keyword = keywordInput.value.trim();
      
      if (!keyword) return;
      
      const result = await spoilerDatabase.addGlobalKeyword(keyword);
      if (result.success) {
        keywordInput.value = '';
        await refreshKeywordsList();
        statusText.textContent = `Added "${keyword}" to global keywords`;
        statusText.className = '';
      } else {
        statusText.textContent = result.error;
        statusText.className = 'status-error';
      }
    }
  });
  
  // Media search
  mediaSearchInput.addEventListener('input', debounce(async function() {
    const query = mediaSearchInput.value.trim();
    
    if (query.length < 2) {
      searchResultsList.innerHTML = '';
      return;
    }
    
    const results = await spoilerDatabase.searchMedia(query);
    displaySearchResults(results);
  }, 300));
  
  // Media search on Enter
  mediaSearchInput.addEventListener('keypress', async function(e) {
    if (e.key === 'Enter') {
      const query = mediaSearchInput.value.trim();
      
      if (query.length < 2) return;
      
      const results = await spoilerDatabase.searchMedia(query);
      displaySearchResults(results);
    }
  });
  
  // Display search results
  function displaySearchResults(results) {
    searchResultsList.innerHTML = '';
    
    if (results.length === 0) {
      searchResultsList.innerHTML = '<div class="no-results">No results found</div>';
      return;
    }
    
    for (const media of results) {
      const mediaItem = createMediaItem(media);
      searchResultsList.appendChild(mediaItem);
    }
  }
  
  // Display popular media
  async function displayPopularMedia() {
    try {
      const results = await spoilerDatabase.getPopularMedia();
      popularMediaList.innerHTML = '';
      
      if (results.length === 0) {
        popularMediaList.innerHTML = '<div class="no-results">No popular media found</div>';
        return;
      }
      
      for (const media of results) {
        const mediaItem = createMediaItem(media);
        popularMediaList.appendChild(mediaItem);
      }
    } catch (error) {
      console.error('Error displaying popular media:', error);
    }
  }
  
  // Create media item element
  function createMediaItem(media) {
    const mediaItem = document.createElement('div');
    mediaItem.className = 'media-item';
    mediaItem.dataset.id = media.id;
    
    const title = document.createElement('div');
    title.className = 'media-title';
    title.textContent = media.title;
    
    const type = document.createElement('span');
    type.className = 'media-type';
    type.textContent = media.mediaType === 'movie' ? '🎬 Movie' : '📺 TV Show';
    
    const details = document.createElement('div');
    details.className = 'media-details';
    
    // Release date
    if (media.releaseDate) {
      const date = new Date(media.releaseDate.seconds * 1000);
      const releaseYear = document.createElement('span');
      releaseYear.className = 'release-year';
      releaseYear.textContent = date.getFullYear();
      details.appendChild(releaseYear);
    }
    
    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-filter';
    toggleButton.dataset.id = media.id;
    
    // Check if this media is in the user's blocked list
    const userPreferences = userManager.userPreferences;
    const isBlocked = userPreferences && 
                     userPreferences.preferences && 
                     userPreferences.preferences.hideMediaIds && 
                     userPreferences.preferences.hideMediaIds.includes(media.id);
    
    toggleButton.classList.toggle('active', isBlocked);
    toggleButton.textContent = isBlocked ? 'Blocking' : 'Block Spoilers';
    
    toggleButton.addEventListener('click', async function() {
      const mediaId = this.dataset.id;
      const isActive = this.classList.contains('active');
      
      const result = await spoilerDatabase.toggleMediaFilter(mediaId, !isActive);
      
      if (result.success) {
        this.classList.toggle('active');
        this.textContent = this.classList.contains('active') ? 'Blocking' : 'Block Spoilers';
        
        // Refresh active filters display
        await refreshActiveFiltersList();
      } else {
        statusText.textContent = result.error;
        statusText.className = 'status-error';
      }
    });
    
    // Keywords button
    const keywordsButton = document.createElement('button');
    keywordsButton.className = 'view-keywords';
    keywordsButton.dataset.id = media.id;
    keywordsButton.textContent = 'View Keywords';
    
    keywordsButton.addEventListener('click', async function() {
      const mediaId = this.dataset.id;
      const mediaItem = document.querySelector(`.media-item[data-id="${mediaId}"]`);
      
      // Check if keywords are already shown
      const existingKeywords = mediaItem.querySelector('.media-keywords');
      if (existingKeywords) {
        existingKeywords.remove();
        return;
      }
      
      // Fetch media details
      const media = await spoilerDatabase.getMediaById(mediaId);
      if (!media) return;
      
      // Create keywords list
      const keywordsList = document.createElement('div');
      keywordsList.className = 'media-keywords';
      
      if (media.keywords && media.keywords.length > 0) {
        for (const keyword of media.keywords) {
          const keywordItem = document.createElement('div');
          keywordItem.className = 'keyword-chip';
          keywordItem.textContent = keyword.text;
          
          // Add button to add to global keywords
          const addButton = document.createElement('span');
          addButton.className = 'add-to-global';
          addButton.textContent = '+';
          addButton.title = 'Add to global keywords';
          
          addButton.addEventListener('click', async function(e) {
            e.stopPropagation();
            const result = await spoilerDatabase.addGlobalKeyword(keyword.text);
            if (result.success) {
              await refreshKeywordsList();
              statusText.textContent = `Added "${keyword.text}" to global keywords`;
              statusText.className = '';
            } else {
              statusText.textContent = result.error;
              statusText.className = 'status-error';
            }
          });
          
          keywordItem.appendChild(addButton);
          keywordsList.appendChild(keywordItem);
        }
      } else {
        const noKeywords = document.createElement('div');
        noKeywords.className = 'no-keywords';
        noKeywords.textContent = 'No keywords available';
        keywordsList.appendChild(noKeywords);
      }
      
      // Add custom keyword input
      const customKeywordContainer = document.createElement('div');
      customKeywordContainer.className = 'custom-keyword-container';
      
      const customKeywordInput = document.createElement('input');
      customKeywordInput.type = 'text';
      customKeywordInput.placeholder = 'Add custom keyword';
      
      const addCustomKeywordButton = document.createElement('button');
      addCustomKeywordButton.textContent = 'Add';
      
      addCustomKeywordButton.addEventListener('click', async function() {
        const keyword = customKeywordInput.value.trim();
        if (!keyword) return;
        
        const result = await spoilerDatabase.addUserKeyword(mediaId, keyword);
        if (result.success) {
          customKeywordInput.value = '';
          
          // Add to the list
          const keywordItem = document.createElement('div');
          keywordItem.className = 'keyword-chip custom';
          keywordItem.textContent = keyword;
          keywordsList.appendChild(keywordItem);
          
          statusText.textContent = `Added "${keyword}" to custom keywords`;
          statusText.className = '';
        } else {
          statusText.textContent = result.error;
          statusText.className = 'status-error';
        }
      });
      
      customKeywordContainer.appendChild(customKeywordInput);
      customKeywordContainer.appendChild(addCustomKeywordButton);
      keywordsList.appendChild(customKeywordContainer);
      
      mediaItem.appendChild(keywordsList);
    });
    
    // Assemble the media item
    title.appendChild(type);
    mediaItem.appendChild(title);
    mediaItem.appendChild(details);
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'media-buttons';
    buttonsContainer.appendChild(toggleButton);
    buttonsContainer.appendChild(keywordsButton);
    mediaItem.appendChild(buttonsContainer);
    
    return mediaItem;
  }
  
  // Refresh keywords list
  async function refreshKeywordsList() {
    if (!userManager.isLoggedIn()) return;
    
    try {
      // Re-fetch user preferences
      const userPreferences = await userManager.loadUserPreferences();
      if (!userPreferences) return;
      
      const globalKeywords = userPreferences.preferences.globalKeywords || [];
      
      keywordsList.innerHTML = '';
      
      if (globalKeywords.length === 0) {
        keywordsList.innerHTML = '<div class="no-keywords">No global keywords added yet</div>';
        return;
      }
      
      globalKeywords.forEach(keyword => {
        const keywordItem = document.createElement('div');
        keywordItem.className = 'keyword-item';
        
        const keywordText = document.createElement('span');
        keywordText.textContent = keyword;
        
        const removeButton = document.createElement('span');
        removeButton.className = 'remove-keyword';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', async () => {
          const result = await spoilerDatabase.removeGlobalKeyword(keyword);
          if (result.success) {
            await refreshKeywordsList();
          } else {
            statusText.textContent = result.error;
            statusText.className = 'status-error';
          }
        });
        
        keywordItem.appendChild(keywordText);
        keywordItem.appendChild(removeButton);
        keywordsList.appendChild(keywordItem);
      });
    } catch (error) {
      console.error('Error refreshing keywords list:', error);
    }
  }
  
  // Refresh active filters list
  async function refreshActiveFiltersList() {
    if (!userManager.isLoggedIn()) return;
    
    try {
      // Re-fetch user preferences
      const userPreferences = await userManager.loadUserPreferences();
      if (!userPreferences) return;
      
      const activeFilters = userPreferences.activeFilters || [];
      
      activeFiltersList.innerHTML = '';
      
      if (activeFilters.length === 0) {
        const noFilters = document.createElement('div');
        noFilters.className = 'no-filters';
        noFilters.textContent = 'No active filters';
        activeFiltersList.appendChild(noFilters);
        return;
      }
      
      activeFilters.forEach(filter => {
        const filterItem = document.createElement('div');
        filterItem.className = 'filter-item';
        filterItem.textContent = filter;
        activeFiltersList.appendChild(filterItem);
      });
    } catch (error) {
      console.error('Error refreshing active filters list:', error);
    }
  }
  
  // Update UI based on auth state
  userManager.addAuthStateListener(async (user) => {
    if (user) {
      // User is signed in
      authSection.style.display = 'none';
      loggedInSection.style.display = 'block';
      
      await refreshKeywordsList();
      await refreshActiveFiltersList();
      await displayPopularMedia();
      
      statusText.textContent = `Logged in as ${user.email