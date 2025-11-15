"""Main runner that runs the FastAPI app from `api.py`.

Run `python3 backend/main.py` to start the server (this will run
`uvicorn` programmatically).
"""
import os
import sys

# Ensure backend directory is on sys.path so local modules import reliably
sys.path.insert(0, os.path.dirname(__file__))

from api import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)