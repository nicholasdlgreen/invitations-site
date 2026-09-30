#!/usr/bin/env python3
"""Serve the site from the repo for local preview.

This used to live in the session scratchpad, which is wiped between sessions —
so the dev server broke at the start of every new one, pointing at a file that
no longer existed. It lives in the repo now.

Serves the working tree as-is, so what you see is the file you just edited.
Pretty URLs resolve the way Netlify does: /wedding-invitations -> that .html.
"""
import http.server, os, socketserver, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8081'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def translate_path(self, path):
        local = super().translate_path(path)
        # /slug with no extension is /slug.html on Netlify, and every product
        # page is reached that way.
        if not os.path.exists(local) and not os.path.splitext(local)[1]:
            html = local.rstrip('/') + '.html'
            if os.path.isfile(html):
                return html
        return local

    def end_headers(self):
        # Never serve a stale page while someone is editing it.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quiet for 200s, loud for anything else, so a 404 is visible.
        if args and str(args[1]).startswith('2'):
            return
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), Handler) as httpd:
        print('serving %s on http://localhost:%d' % (ROOT, PORT), flush=True)
        httpd.serve_forever()
