'''
Component:  Contact Center AI Demo 
Purpose:    This is a demo solution showcasing AI applied in contact center solutions with the power of GPT
Author:     Jixin Jia (Gin)
Created:    2022/10/12
Version:    1.4
'''

from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from flask_cors import CORS
from flask_session import Session  # https://pythonhosted.org/Flask-Session
import json
import logging
import openai
import re
from utilities import config


app = Flask(__name__)
app.secret_key = config.APP_SECRET
app.config['JWT_SECRET_KEY'] = config.JWT_SECRET
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_SIZE * 1024*1024
CORS(app)
Session(app)

# set logging level
logging.basicConfig(level=logging.WARNING)

# For generating https scheme when deployed behind reverse proxy
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)


@app.route('/', methods=['GET'])
def callcenter():
    return render_template('call_center_ai.html')


@app.route('/gpt', methods=['POST'])
def gpt():
    try:
        data = request.json
        transcription = data['transcription']
        aoaiKey = data['aoaiKey']
        aoaiEndpoint = data['aoaiEndpoint']
        gptModel = data['gptModel']

        # Call Azure OpenAI text-davinci-003 model
        openai.api_type = 'azure'
        openai.api_version = '2022-12-01'
        openai.api_key = aoaiKey
        openai.api_base =  aoaiEndpoint
        
        lead_prompt = 'Transcription:\n'

        followup_prompt = '''
        From above transcription use concise words to answer the following:
        Q1>. Summarize transcription in two short sentences:
        Q2>. Rate sentiment of the transcription between 0 and 100, answer in number:
        Q3>. Extract key entities from transcription:
        Q4>. Which category best describes the transcription [monologue, enquiry, news, chitchat, complain, complement]:
        '''
        response = openai.Completion.create(engine=gptModel, 
                                            prompt=lead_prompt+transcription+followup_prompt, 
                                            temperature=0, 
                                            max_tokens=2048)
        text = response['choices'][0]['text'].replace('\n', '').replace(' .', '.').strip()

        # regex function to extract all characters after [4].
        def extract_category(pattern, text):
            matches = re.findall(pattern, text)[0]
            return matches[1].replace('.', '').replace('>','').strip()

        pattern1 = r'(Q1|A1)(.*?)(Q2|A2)'
        pattern2 = r'(A2|Q2)(.*?)(A3|Q3)'
        pattern3 = r'(Q3|A3)(.*?)(Q4|A4)'
        pattern4 = r"(Q4|A4)(.*)"

        return json.dumps({
            'status': 'OK', 
            'q1': extract_category(pattern1, text).strip('.'), 
            'q2': extract_category(pattern2, text).replace('.', ''), 
            'q3': extract_category(pattern3, text).strip('.').split(','), 
            'q4': extract_category(pattern4, text).strip('.')
        })
    
    except Exception as e:
        print(e.args)
        return json.dumps({
            'status': 'Error',
            'error': 'OpenAI has failed to respond, check your key, endpoint and deployed model name and try again.'
        })