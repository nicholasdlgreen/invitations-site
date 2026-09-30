#!/usr/bin/env python3
"""Mirror the site into the local preview directory.

The preview server runs sandboxed: it may only read the temp tree, never the
repo. So the pages it serves have to be copied to it. That copy used to be done
by hand into a session-specific scratchpad, which meant the dev server broke at
the start of every session, pointing at a directory that no longer existed.

This writes to a path derived from the project, not the session, so it survives.
Run it before previewing, and again after editing anything you want to see:

    python3 tools/preview-sync.py

It only copies what a browser asks for, so the 121MB repo becomes a few MB.
"""
import os, shutil, sys, filecmp

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join('/private/tmp/claude-501',
                    '-' + REPO.strip('/').replace('/', '-'),
                    'preview', 'www')

# Everything the browser actually fetches. Not docs, not supabase, not scratch,
# not the 100MB of source images that are never served.
FILE_EXT = {'.html', '.js', '.css', '.json', '.ico', '.svg', '.png', '.jpg',
            '.jpeg', '.webp', '.woff', '.woff2', '.txt', '.xml'}
DIRS = ['img', 'step3', 'papers', 'finishing', 'guides', 'vendor']
SKIP = {'node_modules', '.git', 'docs', 'supabase', 'netlify', 'tools', 'scratch'}


def copy_if_changed(src, dst, stats):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst) and filecmp.cmp(src, dst, shallow=False):
        stats['same'] += 1
        return
    shutil.copy2(src, dst)
    stats['copied'] += 1


def main():
    stats = {'copied': 0, 'same': 0}
    os.makedirs(DEST, exist_ok=True)

    for name in sorted(os.listdir(REPO)):
        src = os.path.join(REPO, name)
        if os.path.isfile(src) and os.path.splitext(name)[1].lower() in FILE_EXT:
            copy_if_changed(src, os.path.join(DEST, name), stats)

    for d in DIRS:
        root = os.path.join(REPO, d)
        if not os.path.isdir(root):
            continue
        for cur, subdirs, files in os.walk(root):
            subdirs[:] = [x for x in subdirs if x not in SKIP and not x.startswith('.')]
            for f in files:
                if os.path.splitext(f)[1].lower() not in FILE_EXT:
                    continue
                src = os.path.join(cur, f)
                copy_if_changed(src, os.path.join(DEST, os.path.relpath(src, REPO)), stats)

    # The server is copied over too, with a note saying what to serve, because
    # it cannot work that out from where it is running.
    here = os.path.dirname(DEST)
    shutil.copy2(os.path.join(REPO, 'tools', 'serve.py'), os.path.join(here, 'serve.py'))
    with open(os.path.join(here, 'site-root.txt'), 'w') as fh:
        fh.write(DEST + '\n')

    print('%s\n  %d copied, %d already current' % (DEST, stats['copied'], stats['same']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
