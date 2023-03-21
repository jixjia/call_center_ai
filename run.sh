#!/bin/sh
gunicorn wsgi:app -w 2 --threads 2 -b 0.0.0.0:80

# Replace to following syntax if running on Windows
# waitress-serve --listen=0.0.0.0:80 wsgi:app