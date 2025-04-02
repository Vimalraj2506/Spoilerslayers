import pandas as pd
import re
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.metrics import classification_report
import joblib

# Load data
filepath = r"C:\Users\solli\Desktop\spoiler-blocker-extension\movie-spoiler-dataset.csv"
df = pd.read_csv(filepath)

if "text" not in df.columns or "label" not in df.columns:
    raise ValueError("CSV file must contain 'text' and 'label' columns.")

# Clean text
def clean_text(text):
    text = str(text).lower()
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    return text

df["cleaned_text"] = df["text"].apply(clean_text)

# Split data
X_train, X_test, y_train, y_test = train_test_split(df["cleaned_text"], df["label"], test_size=0.1, random_state=42)

# Vectorize
vectorizer = TfidfVectorizer()
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# Train SVM
svc_model = SVC(kernel="linear", probability=True)
svc_model.fit(X_train_tfidf, y_train)

# Save model and vectorizer
joblib.dump(svc_model, "model_svc.pkl")
joblib.dump(vectorizer, "vectorizer.pkl")

# Evaluate
y_pred = svc_model.predict(X_test_tfidf)
print(classification_report(y_test, y_pred))
