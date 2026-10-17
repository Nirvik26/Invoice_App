"""
Run both Django backend and Next.js frontend concurrently.
Handles streaming logs with colored prefixes and clean process tree termination on exit.
"""

import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

# Enable ANSI colors on Windows terminals
if os.name == "nt":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass

# Terminal styling
CYAN = "\033[96m"
MAGENTA = "\033[95m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

PREFIX_BACKEND = f"{CYAN}[backend]{RESET} "
PREFIX_FRONTEND = f"{MAGENTA}[frontend]{RESET} "
PREFIX_SYS = f"{YELLOW}[system]{RESET} "

root = Path(__file__).resolve().parent.parent

# Resolve backend Python
backend_venv_python = (
    root / "backend" / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)
manage_py = root / "backend" / "manage.py"

# Resolve frontend runner (bun preferred, npm fallback)
bun_path = shutil.which("bun")
npm_path = shutil.which("npm.cmd" if os.name == "nt" else "npm")


def print_banner():
    print(f"\n{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}  Billora Development Environment{RESET}")
    print(f"{'=' * 60}")
    print(f"  {CYAN}Backend :{RESET}  http://127.0.0.1:8000  (Django)")
    print(f"  {MAGENTA}Frontend:{RESET}  http://localhost:3000  (Next.js)")
    print(f"{'=' * 60}")
    print(f"  Press {BOLD}Ctrl+C{RESET} to stop both servers.\n")


def stream_output(pipe, prefix, stop_event):
    try:
        for line in iter(pipe.readline, ""):
            if stop_event.is_set() and not line:
                break
            if line:
                print(f"{prefix}{line}", end="", flush=True)
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def terminate_process(proc):
    if proc is None or proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            # taskkill /F /T kills the entire process tree on Windows
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        pass


def main():
    if not backend_venv_python.exists():
        print(
            f"{PREFIX_SYS}{RED}Error: Backend virtualenv not found at {backend_venv_python}{RESET}\n"
            f"Please initialize it first:\n"
            f"  python -m venv backend/.venv\n"
            f"  backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt"
        )
        sys.exit(1)

    if bun_path:
        frontend_cmd = [bun_path, "run", "dev"]
    elif npm_path:
        frontend_cmd = [npm_path, "run", "dev"]
    else:
        print(f"{PREFIX_SYS}{RED}Error: Neither 'bun' nor 'npm' was found in PATH.{RESET}")
        sys.exit(1)

    backend_cmd = [str(backend_venv_python), str(manage_py), "runserver", "127.0.0.1:8000"]

    print_banner()

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["FORCE_COLOR"] = "1"

    stop_event = threading.Event()
    procs = []

    try:
        # Start Backend
        backend_proc = subprocess.Popen(
            backend_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(root),
            env=env,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace",
        )
        procs.append(backend_proc)

        # Start Frontend
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(root),
            env=env,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace",
        )
        procs.append(frontend_proc)

        # Start log reader threads
        t_backend = threading.Thread(
            target=stream_output,
            args=(backend_proc.stdout, PREFIX_BACKEND, stop_event),
            daemon=True,
        )
        t_frontend = threading.Thread(
            target=stream_output,
            args=(frontend_proc.stdout, PREFIX_FRONTEND, stop_event),
            daemon=True,
        )
        t_backend.start()
        t_frontend.start()

        # Monitor processes
        while True:
            time.sleep(0.5)
            # Check if any process terminated prematurely
            if backend_proc.poll() is not None:
                code = backend_proc.poll()
                print(f"\n{PREFIX_SYS}{YELLOW}Backend process exited with code {code}. Stopping frontend...{RESET}")
                break
            if frontend_proc.poll() is not None:
                code = frontend_proc.poll()
                print(f"\n{PREFIX_SYS}{YELLOW}Frontend process exited with code {code}. Stopping backend...{RESET}")
                break

    except KeyboardInterrupt:
        print(f"\n{PREFIX_SYS}Shutting down servers...")
    finally:
        stop_event.set()
        for p in procs:
            terminate_process(p)
        print(f"{PREFIX_SYS}{GREEN}All servers stopped cleanly.{RESET}")


if __name__ == "__main__":
    main()
