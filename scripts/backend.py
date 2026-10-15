"""Use the project's virtualenv consistently from Bun on Windows/macOS/Linux."""
import os
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
python = root / 'backend' / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not python.exists():
    sys.exit('Create the backend environment first: python -m venv backend/.venv')
sys.exit(subprocess.call([str(python), str(root / 'backend/manage.py'), *sys.argv[1:]], cwd=root))
