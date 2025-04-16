# Spoiler Blocker Chrome Extension

Spoiler Blocker is a Chrome extension designed to automatically detect and hide potential spoiler content across websites. It combines machine learning and keyword-based filtering to provide a customizable, real-time spoiler blocking experience.

## Features

- **AI-Powered Spoiler Detection**  
  Utilizes a Support Vector Machine (SVM) model trained with TF-IDF features to classify spoiler content in natural language text.

- **Keyword-Based Filtering**  
  Allows users to define custom keywords (e.g., character names, episode titles) to block content manually.

- **Real-Time Page Scanning**  
  Analyzes page elements such as paragraphs, spans, and list items, and replaces identified spoilers with alert boxes.

- **Firebase Integration**  
  - User authentication (sign-up, login, logout)
  - Keyword management linked to individual user profiles
  - Cloud Firestore used for storing user preferences and keywords

- **Custom UI and Behavior**  
  - User-selectable detection mode (API-only, keywords-only, or both)
  - Spoiler content is hidden until the user clicks to reveal
  - Ignored keywords are remembered and stored in local storage

- **CORS-Compliant Server with Authentication**  
  A secure Flask-based API (served with CherryPy and SSL certificates on Linode) processes content requests from the extension using HTTP Basic Authentication.

## System Architecture

1. **Chrome Extension Frontend**  
   - Written in JavaScript
   - Handles real-time DOM analysis, spoiler hiding logic, and UI interactions

2. **Machine Learning Model**  
   - Trained in Python using Scikit-learn
   - Features extracted using `TfidfVectorizer`
   - Classifier: Support Vector Machine (SVM) with linear kernel

3. **Backend API**  
   - Built with Python and CherryPy
   - Accepts POST requests with text content and returns spoiler predictions
   - Authenticated using Basic Auth headers

4. **Database Layer**  
   - Firebase Firestore for user keyword storage
   - Firebase Authentication for secure access and session management

5. **Hosting**  
   - Model and API are hosted on Linode with SSL certificate configuration
   - Chrome extension interacts with this API for AI-based classification

## Installation

1. Clone or download the repository.
2. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer Mode"
   - Click "Load unpacked"
   - Select the project `dist/` directory
3. Use the popup to log in or register.
4. Add keywords or enable AI detection.

## Dataset

- A custom movie spoiler dataset was created with two columns:
  - `text`: The sentence or comment
  - `label`: 1 if it contains a spoiler, 0 otherwise
- The dataset was cleaned with basic preprocessing (symbol removal, lowercasing).
- Used for both training the model and evaluating its performance.

## Dependencies

### Frontend (JavaScript)
- Firebase SDK
- Chrome Extensions API
- Webpack and Babel for bundling

### Backend (Python)
- Scikit-learn
- Pandas
- Joblib
- CherryPy
- SSL certificates (Let's Encrypt)
- Docker (for containerization and deployment)

## License

This project is for academic and demonstration purposes only.

