import os
import re
import uuid
import logging
import json
import ast
import importlib
import random
import time
import base64
from openai import AzureOpenAI
from tenacity import retry, wait_random_exponential, stop_after_attempt
from jinja2 import Template
from typing import Optional, List
from azure.identity import DefaultAzureCredential, ChainedTokenCredential, ManagedIdentityCredential, EnvironmentCredential
from . import timeout_utils as tu
from . import config

# Logging
logging.basicConfig(level=logging.INFO)

class AOAIClient:
    def __init__(self, aoai_endpoint=None, aoai_key=None):
        self.client = AzureOpenAI(
            azure_endpoint = aoai_endpoint, 
            api_key = aoai_key,
            api_version = config.AOAI_API_VERSION
            )

        self.tools = []
        for tool_path in os.listdir('agents'):
            if tool_path.endswith('.json'):
                self.tools.append(json.load(open(os.path.join('agents', tool_path),'r')))
                print(f'[INFO] Loaded agent: {tool_path}')
    

    def preprocess_args(self, args):
        # get rid of newlines, nulls, tabs, etc.
        matches = ['\\n', 'null', '\\n', '\\t', '\\r', '\\f', '\\v', 'nan']
        pattern = '|'.join(map(re.escape, matches))
        args = re.sub(pattern, '', args)

        return ast.literal_eval(args)


    def execute_tools(self, tool_calls, tags):
        results = []
        
        for tool in tool_calls:

            # parse arguments
            func_name = tool['function']['name']
            args = self.preprocess_args(tool['function']['arguments'])

            # add custom tags into argument list
            if isinstance(tags, dict):
                args.update(tags)

            try:
                # dynamically load functions
                module = importlib.import_module(f'utilities.{func_name}')
                
                if hasattr(module, func_name):
                    module_function = getattr(module, func_name)
                    outputs = module_function(**args)
                else:
                    raise Exception(f'{func_name} cannot be loaded or is not callable')
                    
            except Exception as e:
                print(f"Agent '{func_name}' not callable. ({str(e.args)})", 'red')
                outputs = {'value': [], 'status': str(e.args)}

            # schema: tool_outputs
            results.append({
                    'guid': str(uuid.uuid4()), 
                    'seed': random.randint(1,5),
                    'status': outputs['status'],
                    'function_name': func_name, 
                    'counts': len(outputs['value']) if 'value' in outputs.keys() else 0, 
                    'outputs': outputs
                    })

        return results


    def prepare_messages(self, query, system_prompts, chat_history, model):
        messages = []
        
        # If o1-preview/o1/o3-mini/o3, ignore system prompts (2024/10/23)
        if model not in ('o1-preview', 'o1','o3-mini','o3'):
            messages.append({'role':'system', 'content': system_prompts})
        
        if chat_history:
            messages = messages + chat_history[-config.HISTORY_LIMIT:]

        if query:
            messages.append({'role':'user', 'content': query[:config.CHAR_LIMIT]})
        
        return messages
    

    def load_template(self, template_name):
        try:
            # load prompt variation from json
            with open(os.path.join(config.PROMPT_FOLDER, template_name+'.json')) as f:
                prompt_variation = json.load(f)
            
            # get prompt whose has key 'active'
            for prompt in prompt_variation:
                if prompt.get('active'):
                    prompt_version = template_name+'_'+str(prompt['version'])+'.jinja2'
                    break

            with open(os.path.join(config.PROMPT_FOLDER, prompt_version), 'r') as f:
                template = Template(f.read(), trim_blocks=True, lstrip_blocks=True)
            
            return template
        
        except  Exception as e:
            logging.error(f'Error loading prompt template {template_name}: {e.args}')
            return None
  

    
    ''' AOAI ChatCompletions API (v1)
    '''

    def get_aoai_response(self, response, debug=False):
        output = response.choices[0].message.content
    
        metadata = {
            'finish_reason': response.choices[0].finish_reason,
            'request_type': response.object,
            'model': response.model,
            'prompt_token': response.usage.prompt_tokens,
            'completion_token': response.usage.completion_tokens,
            'total_tokens': response.usage.total_tokens,
            'role': response.choices[0].message.role,
            'tool_calls': response.choices[0].message.tool_calls
        }
        
        if debug:
            print(metadata)
        
        return output, metadata


    def chat_stream(self, model, query, system_prompts, chat_history=[]):     
        try:
            response = self.client.chat.completions.create(
                model = model, 
                messages = self.prepare_messages(query, system_prompts, chat_history, model),
                response_format={ "type": "text" },
                stream = True
            )
            
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                # if chunk['choices'] and chunk['choices'][0]['delta'].get('content') is not None:
                #     yield chunk['choices'][0]['delta']['content']
        
        except Exception as e:
            print('[Stream ERROR]', str(e))
            yield f'[Stream Error] {str(e)}'


    @tu.timeout(config.TIME_OUT)
    def chat(self, model, query, system_prompts, chat_history=[], response_format="text"):
        job_id = str(uuid.uuid4())
        
        try:
            t0 = time.time()
            if model in ('o1-preview','o1','o3-mini','o3'):
                raw = self.client.chat.completions.create(
                    model = model, 
                    response_format={ "type": response_format },
                    messages = self.prepare_messages(query, None, chat_history, model)
                )
                
            else:
                raw = self.client.chat.completions.create(
                    model = model, 
                    tools = self.tools,
                    tool_choice = "auto",
                    response_format={ "type": response_format },
                    messages = self.prepare_messages(query, system_prompts, chat_history, model)
                )

            t1 = time.time()
                        
            output, metadata = self.get_aoai_response(raw)
            logging.info(f'[{job_id}] [Time elapsed: {t1-t0:.3f} sec] {metadata}')
            
            return output, metadata
    
        except Exception as e:
            logging.error(f'[{job_id}] {e.args}')
            return e.args[0], None
    

    ''' AOAI Responses API (v2) 
        - get_aoai_response: get a response from AOAI API
        - get_aoai_text: get the message text from the response object
        - convert_to_base64: convert a file to base64 string. Necessary for Image and File input.
    '''

    def get_aoai_text(self, res: dict) -> str:
        '''
            Input 
                response: AOAI Responses API response object converted to Python dict
            Output
                str, message text extracted from the response object
        '''
        return res['output'][0]['content'][0]['text']


    def convert_to_base64(self, file_path: str) -> str:
        '''
            Input 
                file_path: str, path to the file to be converted to base64 string
            Output
                str, base64 string of the file
        '''
        with open(file_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    

    def make_response(self,
                      model: str, 
                      developer_messages: str, 
                      user_message: str, 
                      prev_res_id: str = None,
                      schema: Optional[object] = None,
                      text_contents: Optional[str] = '', 
                      image_strings: Optional[List[str]] = None) -> dict:
        '''
            Input 
                model: str -> name of the deployment ('gpt-4o-mini', 'gpt-4o', 'o1', 'o3-mini' etc.)
                system_prompts: str -> system prompts
                query: str -> user query
                text_contents: str -> text string providing added contextaual information to user's query (optional)
                image_strings: list -> list of base64 encoded images (optional)
            Output
                dict, AOAI response object converted to Python dict.
        '''
        res = {}
        input = [{
                "role": "developer", "content": developer_messages
                },{
                "role": "user",
                "content": [
                    { "type": "input_text", "text": user_message }
                ]}
                ]
        
        # add text contents to input
        if text_contents:
            input[1]['content'][0]['text'] = user_message + '\n\n' + text_contents
            
        # add images to input
        if image_strings:
            for i in image_strings:
                input[1]['content'].append({
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{i}",
                    "detail": "high"
                })

        # make response
        try:
            res = self.client.responses.create(
                model=model,
                previous_response_id=prev_res_id,
                input=input,
                text=schema,
            ).dict()

        except Exception as e:
            res['error'] = e.message
        
        return res 


if __name__ == '__main__':
    
    import random

    aoai = AOAIClient()

    query_bank = [
        "Tell me what I'm looking at?"
    ]
    query = random.choice(query_bank)
    system_prompts = aoai.load_template('instructions').render(LANGUAGE='Chinese')
    print(system_prompts)
    output, metadata = aoai.chat(model='gpt-4o-mini', 
                        system_prompts=system_prompts, 
                        query=query, 
                        chat_history=[])
    
    print(output)
    print(metadata)