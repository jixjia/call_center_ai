'''
Component:  Contact Center AI Demo 
Purpose:    This is a demo solution showcasing AI applied in contact center solutions with the power of GPT
Author:     Jixin Jia (Gin)
Created:    2022/10/12
Version:    2.0
History:    1.0 2022/10/12 original creation
            1.1 2023/01/10 added support for Azure OpenAI Service
            1.2 2023/04/11 upgraded Speech Swagger JS SDK
            2.0 2025/03/31 upgraded to Azure OpenAI 1.69.x. Overhauled to leverage Responses API (March 2025)
'''

from flask import Flask, render_template, request, redirect, url_for, jsonify, Response, session, send_from_directory
from flask_session import Session
from flask_cors import CORS
from functools import wraps
import json
import logging
from datetime import datetime, timedelta
from utilities import timeout_utils as tu
from utilities import aoai_utils as au
from utilities import config


# instantiate flask app
app = Flask(__name__)
app.secret_key = config.APP_SECRET
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH *1024*1024
app.config['SESSION_PERMANENT'] = True
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=config.SESSION_TIMEOUT)
CORS(app)
Session(app)

# set logging level
logging.basicConfig(level=logging.WARNING)

# Needed for url_for("foo", _external=True) to automatically
# generate http scheme when this sample is running on localhost,
# and to generate https scheme when it is deployed behind reversed proxy.
# Ref: https://flask.palletsprojects.com/en/2.2.x/deploying/proxy_fix/
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/jp', methods=['GET'])
def jp():
    return render_template('jp.html')

@app.route('/gpt', methods=['POST'])
def gpt():
    try:
        data = request.json
        transcription = data['transcription']
        aoaiKey = data['aoaiKey']
        aoaiEndpoint = data['aoaiEndpoint']
        model = data['aoaiModel']
        language = data['lang']
        
        # Instantiate the Azure OpenAI client
        gpt = au.AOAIClient(aoai_endpoint=aoaiEndpoint, aoai_key=aoaiKey)

        developer_messages = gpt.load_template('instruction').render(LANGUAGE=language)

        schema={
                "format": {
                    "type": "json_schema",
                    "name": "conversation_analysis",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "q1": {"type": "string"},
                            "q2": {"type": "integer"},
                            "q3": {"type": "string"},
                            "q4": {"type": "string"},
                            "q5": {"type": "string"},
                            "q6": {"type": "string"},
                            "q7": {"type": "string"},
                            "q8": {"type": "string"}
                        },
                        "required": ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"],
                        "additionalProperties": False
                    },
                    "strict": True
                }
            }

        res = gpt.make_response(model, developer_messages, transcription, None, schema)
        outputs = json.loads(gpt.get_aoai_text(res))
        outputs['status'] = 'ok'

        return outputs
        
    except Exception as e:
        print(e.args)
        return json.dumps({
            'status': 'Error',
            'error': 'OpenAI has failed to respond, check your key, endpoint and deployed name and try again.'
        })