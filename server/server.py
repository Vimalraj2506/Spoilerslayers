import cherrypy
import joblib
import json
import base64


loaded_model = joblib.load("model_svc.pkl")
loaded_vectorizer = joblib.load("vectorizer.pkl")
print("loaded model_svc.pkl")
print("loaded vectorizer")

# Auth setup
AUTH = {"admin": "password123"}

class SpoilerAPI:
    @cherrypy.expose
    def index(self):
        return "Spoiler API is running"
    
    @cherrypy.expose
    # @cherrypy.tools.json_()
    @cherrypy.tools.json_out()
    def predict(self, **kwargs):
        # Always add CORS headers
        cherrypy.response.headers['Access-Control-Allow-Origin'] = '*'
        cherrypy.response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        cherrypy.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        
        # Handle OPTIONS requests
        if cherrypy.request.method == 'OPTIONS':
            return {}
        
        if cherrypy.request.method == 'POST':
            # Check authentication
            auth = cherrypy.request.headers.get('Authorization', '')
            if not auth.startswith('Basic '):
                cherrypy.response.status = 401
                return {"error": "Authentication required"}
            
            try:
                encoded = auth[6:]
                decoded = base64.b64decode(encoded).decode('utf-8')
                username, password = decoded.split(':', 1)
                if AUTH.get(username) != password:
                    cherrypy.response.status = 401
                    return {"error": "Invalid credentials"}
            except:
                cherrypy.response.status = 401
                return {"error": "Invalid authentication format"}
            
            
            try:
                body = cherrypy.request.body.read().decode('utf-8')
                data = json.loads(body)
                texts = data.get('texts', [])
                
                if not texts or not isinstance(texts, list):
                    return {"error": "Invalid input. Expected {'texts': ['sentence1', 'sentence2']}."}
                
                text_tfidf = loaded_vectorizer.transform(texts)
                predictions = loaded_model.predict(text_tfidf)
                
                return [{"spoiler": bool(pred)} for pred in predictions]
            except Exception as e:
                cherrypy.response.status = 500
                return {"error": str(e)}
        
        # For other methods
        cherrypy.response.status = 405
        return {"error": "Method not allowed"}

# Configure and start the server
if __name__ == '__main__':
    cherrypy.config.update({
        'server.socket_host': '0.0.0.0',
        'server.socket_port': 443,
        'tools.response_headers.on': True,
        'tools.response_headers.headers': [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ],
        'server.ssl_module': 'builtin',
        'server.ssl_certificate': '/home/spoilerdetector.site_1/fullchain.pem',
        'server.ssl_private_key': '/home/spoilerdetector.site_1/privkey.pem',
        'server.http_version': '1.1',
    })
    # conf = {
    # '/': {
    # 'tools.auth_basic.on': False,
    # # 'tools.auth_basic.realm': 'spoiler-detection',
    # # 'tools.auth_basic.checkpassword': validate_credentials,
    # 'tools.response_headers.on': True,
    # }
    # }
    cherrypy.quickstart(SpoilerAPI())