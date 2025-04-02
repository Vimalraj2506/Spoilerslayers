import pandas as pd
import re
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import joblib

# Load dataset
filepath = r"C:\Users\solli\Desktop\spoiler-blocker-extension\movie-spoiler-dataset.csv"
df = pd.read_csv(filepath)

# Ensure required columns exist
if "text" not in df.columns or "label" not in df.columns:
    raise ValueError("CSV file must contain 'text' and 'label' columns.")

# Clean text function
def clean_text(text):
    text = str(text).lower()
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    return text

# Apply cleaning
df["cleaned_text"] = df["text"].apply(clean_text)

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(df["cleaned_text"], df["label"], test_size=0.1, random_state=42)

# TF-IDF Vectorization
vectorizer = TfidfVectorizer()
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# Train Logistic Regression model
clf = LogisticRegression()
clf.fit(X_train_tfidf, y_train)

# Save model and vectorizer
joblib.dump(clf, "model_logreg.pkl")
joblib.dump(vectorizer, "vectorizer.pkl")

# Evaluate
y_pred = clf.predict(X_test_tfidf)
print("=== Logistic Regression Report ===")
print(classification_report(y_test, y_pred))
