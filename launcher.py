import http.server
import socketserver
import json
import os
import sys
import socket
import threading
import time
import queue

PORT = 4360

# Thread-safe list of active SSE client queues
clients_lock = threading.Lock()
sse_clients = []

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

class GEOHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/events':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()
            
            q = queue.Queue()
            with clients_lock:
                sse_clients.append(q)
            
            try:
                while True:
                    try:
                        # Block and wait for a new message
                        data = q.get(timeout=1.0)
                        self.wfile.write(f"data: {data}\n\n".encode('utf-8'))
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive heartbeat
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (ConnectionError, BrokenPipeError, socket.error):
                pass
            finally:
                with clients_lock:
                    if q in sse_clients:
                        sse_clients.remove(q)
                return
        else:
            # Serve local visualizer files
            # Set directory to script root to avoid relative path issues
            os.chdir(os.path.dirname(os.path.abspath(__file__)))
            super().do_GET()

    def do_POST(self):
        if self.path == '/update':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse incoming JSON payload
                payload = json.loads(post_data.decode('utf-8'))
                
                # Check data format
                if "data" not in payload:
                    raise ValueError("Missing 'data' field in request body.")
                
                # Forward payload to all active browser/webview clients via SSE
                json_str = json.dumps(payload)
                with clients_lock:
                    for q in sse_clients:
                        q.put(json_str)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success", 
                    "message": f"Successfully pushed to {len(sse_clients)} active client(s)"
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def start_server(port):
    handler = GEOHTTPRequestHandler
    # Serve files from directory of launcher.py
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    server = ThreadingHTTPServer(('127.0.0.1', port), handler)
    print(f"[*] GEO Server started on http://127.0.0.1:{port}")
    server.serve_forever()

if __name__ == '__main__':
    # Start HTTP + SSE server in background thread
    server_thread = threading.Thread(target=start_server, args=(PORT,))
    server_thread.daemon = True
    server_thread.start()
    
    # Wait half a second for server to initialize
    time.sleep(0.5)

    # Check for pywebview dependency
    try:
        import webview
        WEBVIEW_AVAILABLE = True
    except ImportError:
        WEBVIEW_AVAILABLE = False

    if WEBVIEW_AVAILABLE:
        print("[*] Launching GEO in native Desktop Application mode...")
        try:
            webview.create_window(
                title='GEO // 3D wireframe visualizer',
                url=f'http://127.0.0.1:{PORT}/index.html',
                width=1250,
                height=850,
                background_color='#08090c'
            )
            webview.start()
        except Exception as e:
            print(f"[!] Error starting webview GUI: {e}")
            print(f"[!] Falling back to running server. Open http://127.0.0.1:{PORT} in your web browser.")
            # Keep main thread alive
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
    else:
        print("[!] pywebview not found. Running in Web Server Mode.")
        print(f"[*] Open http://127.0.0.1:{PORT}/index.html in your browser to visualize.")
        print("[*] Install pywebview with 'pip install pywebview' for standalone desktop mode.")
        print("[*] Press Ctrl+C to terminate...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[*] Shutting down...")
            sys.exit(0)
