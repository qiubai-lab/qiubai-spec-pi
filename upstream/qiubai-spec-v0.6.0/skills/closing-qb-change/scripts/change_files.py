"""Conservative UTF-8 frontmatter and path handling; Python 3.9+, stdlib only."""
import datetime as dt
import os
import re
import tempfile
from pathlib import Path


class ChangeError(Exception):
    pass


def safe(root, path):
    path = Path(os.path.abspath(path))
    resolved = path.resolve()
    if resolved != path or root not in resolved.parents:
        raise ChangeError('Path escapes project or traverses a link: ' + str(path))
    return path


class Document:
    def __init__(self, root, path):
        self.path = safe(root, path)
        self.raw = self.path.read_bytes()
        self.text = self.raw.decode('utf-8-sig')
        self.bom = self.raw.startswith(b'\xef\xbb\xbf')
        self.lines = self.text.splitlines(keepends=True)
        if not self.lines or self.lines[0].strip() != '---':
            raise ChangeError('Missing frontmatter: ' + str(path))
        end = next((i for i in range(1, len(self.lines))
                    if self.lines[i].strip() == '---'), None)
        if end is None:
            raise ChangeError('Unclosed frontmatter: ' + str(path))
        self.fields = {}
        self.positions = {}
        for i in range(1, end):
            match = re.match(r'^([A-Za-z_][\w-]*):[ \t]*(.*?)(\r?\n)?$', self.lines[i])
            if not match:
                continue
            key, value = match[1], match[2]
            if key in self.fields:
                raise ChangeError('Duplicate metadata key: ' + key)
            self.fields[key] = value
            self.positions[key] = i
        # Restrict interpreted fields to the documented scalar subset. Unknown
        # metadata and the body are preserved byte-for-byte, never YAML-loaded.
        for key in ('id', 'status', 'created', 'updated', 'type', 'tier'):
            if key not in self.fields:
                raise ChangeError('Missing metadata field: ' + key)
            value = self.fields[key]
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if not re.fullmatch(r'[A-Za-z0-9-]+', value):
                raise ChangeError('Unsupported scalar syntax for ' + key)
            self.fields[key] = value
        if not re.fullmatch(r'QB-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*', self.fields['id']):
            raise ChangeError('Invalid change id')
        if self.fields['status'] not in ('draft', 'approved', 'active', 'archived', 'superseded'):
            raise ChangeError('Unsupported lifecycle state')
        if self.fields['tier'] not in ('quick', 'standard', 'strict') or self.fields['type'] not in ('design', 'feature', 'bugfix'):
            raise ChangeError('Invalid type/tier')
        for key in ('created', 'updated'):
            dt.date.fromisoformat(self.fields[key])

    def patched(self, **fields):
        lines = self.lines[:]
        for key, value in fields.items():
            i = self.positions[key]
            old = lines[i]
            ending = '\r\n' if old.endswith('\r\n') else '\n' if old.endswith('\n') else ''
            lines[i] = key + ': ' + value + ending
        encoded = ''.join(lines).encode('utf-8')
        return (b'\xef\xbb\xbf' if self.bom else b'') + encoded

    def unchanged(self):
        if self.path.read_bytes() != self.raw:
            raise ChangeError('Source changed during operation: ' + str(self.path))


def atomic_update(doc, data):
    doc.unchanged()
    fd, name = tempfile.mkstemp(prefix='.qb-update-', dir=doc.path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        doc.unchanged()
        os.replace(name, doc.path)
    finally:
        if os.path.exists(name):
            os.unlink(name)
