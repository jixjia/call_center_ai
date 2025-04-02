import os, uuid
from dotenv import load_dotenv
load_dotenv('.env')

# App settings
APP_SECRET = str(uuid.uuid4())
JWT_SECRET = str(uuid.uuid4())
SESSION_TIMEOUT = 60 # minutes
MAX_CONTENT_LENGTH = 200 * 1024 * 1024 #MB

# Azure OpenAI settings
AOAI_API_VERSION = os.environ.get('AOAI_API_VERSION')
CHAR_LIMIT = 300        # single query character cut off
HISTORY_LIMIT = 20      # rounds of conversation to memorize
TIME_OUT = 30           # throw timeout error after X seconds
MAX_RETRY = 2           # max retry before raising exception
PROMPT_FOLDER = 'prompts'
AGENTS_FOLDER = 'agents'
UPLOAD_FOLDER = 'files'