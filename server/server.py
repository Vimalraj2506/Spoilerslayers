import cherrypy
import joblib
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from cherrypy.lib.auth_basic import basic_auth


loaded_model = joblib.load("model.pkl")
loaded_vectorizer = joblib.load("vectorizer.pkl")


AUTH = {"admin": "password123"} 

def validate_credentials(realm, username, password):
    return AUTH.get(username) == password

class SpoilerDetectionAPI:    

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    @cherrypy.tools.auth_basic(realm="spoiler-detection", checkpassword=validate_credentials)
    def predict(self):
        try:
            input_data = cherrypy.request.json
            texts = input_data.get("texts", [])

            if not texts or not isinstance(texts, list):
                return {"error": "Invalid input. Expected {'texts': ['sentence1', 'sentence2']}."}


            text_tfidf = loaded_vectorizer.transform(texts)
            predictions = loaded_model.predict(text_tfidf)

            response = [{"spoiler": bool(pred)} for pred in predictions]
            return response

        except Exception as e:
            cherrypy.response.status = 500
            return {"error": str(e)}

# CherryPy Configuration
if __name__ == "__main__":
    cherrypy.config.update({
        "server.socket_host": "0.0.0.0",
        "server.socket_port": 8080
    })

    cherrypy.quickstart(SpoilerDetectionAPI(), "/", {
        "/": {
            "tools.auth_basic.on": True
        }
    })
    cherrypy.engine.block() 
