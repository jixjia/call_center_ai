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
        openai.api_version = '2023-06-01-preview'
        openai.api_key = aoaiKey
        openai.api_base =  aoaiEndpoint
        

        system_message = '''
        You are an expert at analyzing conversation transcripts. 
        Please analyze the transcribed texts provided by user, and work out the following:

        Q1>. Summarize transcription in two short sentences:
        Q2>. Rate sentiment of the transcription between 0 and 100, answer in number:
        Q3>. Extract key entities from transcription:
        Q4>. Which category best describes the transcription [monologue, enquiry, news, chitchat, complain, complement, other]:

        Plase be concise with your answers and adhere to the following JSON format:
        {{"q1": "", "q2": "", "q3": "", "q4":""}}
        '''

        # truncate inputs to the word limit
        transcription = transcription[:2000]

        # create user / system messages
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Please help me analyze my transcribed texts and answer the four questions:\n {transcription}"}
        ]

        response = openai.ChatCompletion.create(
                                        engine=gptModel,
                                        messages=messages, 
                                        temperature=0,
                                        n=1)
        text = response['choices'][0]['message']['content']

        # extract fields from GPT answer
        results = json.loads(text)

        q1 = results['q1'] if 'q1' in results else 'N/A'
        q2 = results['q2'] if 'q2' in results else 'N/A'
        q3 = results['q3'].split(',') if 'q3' in results else []
        q4 = results['q4'] if 'q4' in results else 'N/A'


        print('q1: ', q1)
        print('q2: ', q2)
        print('q3: ', q3)
        print('q4: ', q4)

        return json.dumps({
            'status': 'OK', 
            'q1': q1, 
            'q2': q2, 
            'q3': q3, 
            'q4': q4
        })
        
    except Exception as e:
        print(e.args)
        return json.dumps({
            'status': 'Error',
            'error': 'OpenAI has failed to respond, check your key, endpoint and deployed name and try again.'
        })