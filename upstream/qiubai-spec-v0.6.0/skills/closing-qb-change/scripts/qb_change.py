"""Inspect, update lifecycle metadata, and archive one qb-spec change."""
import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from contextlib import contextmanager
from pathlib import Path

from change_files import ChangeError, Document, atomic_update, safe


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(root, docs, change_id):
    found = {'specs': [], 'plans': [], 'archive': []}
    for category in found:
        folder = safe(root, docs / category)
        if not folder.exists():
            continue
        # Reject directory links before traversal, including Windows junctions.
        stack = [folder]
        while stack:
            parent = stack.pop()
            for path in parent.iterdir():
                safe(root, path)
                if path.is_dir():
                    stack.append(path)
                elif path.suffix == '.md':
                    raw = path.read_text(encoding='utf-8-sig')
                    head = raw.split('---', 2)[1] if raw.startswith('---') and raw.count('---') >= 2 else ''
                    ids = re.findall(r'^id:[ \t]*[\"\']?([^\r\n\"\']+)[\"\']?[ \t]*$', head, re.M)
                    if change_id in [x.strip() for x in ids]:
                        found[category].append(Document(root, path))
    return found


def locate(root, docs, change_id):
    # A pending transaction is diagnostic only: never guess how to resume it.
    for pending in (docs / 'archive').glob('*/' + change_id + '/.qb-pending.json'):
        safe(root, pending)
        raise ChangeError('Recovery required; preserve sources and archive: ' + str(pending))
    found = inventory(root, docs, change_id)
    if len(found['specs']) > 1 or len(found['plans']) > 1:
        raise ChangeError('Duplicate active change id')
    if found['archive']:
        if found['specs'] or found['plans']:
            raise ChangeError('Active/archive conflict')
        specs = [d for d in found['archive'] if d.path.name == 'spec.md']
        if len(specs) != 1 or len(found['archive']) > 2:
            raise ChangeError('Ambiguous archive')
        folder = specs[0].path.parent
        if any(d.path.parent != folder or d.path.name not in ('spec.md', 'plan.md')
               or d.fields['status'] != 'archived' for d in found['archive']):
            raise ChangeError('Incomplete or incompatible archive')
        if specs[0].fields['tier'] == 'strict' and len(found['archive']) != 2:
            raise ChangeError('Strict archive missing plan')
        return 'already_archived', found['archive']
    if len(found['specs']) != 1:
        raise ChangeError('No unique active spec found')
    docs_found = found['specs'] + found['plans']
    if found['plans'] and any(found['plans'][0].fields[key] != found['specs'][0].fields[key]
                              for key in ('type', 'tier')):
        raise ChangeError('Spec/plan type or tier mismatch')
    if found['specs'][0].fields['tier'] == 'strict' and not found['plans']:
        raise ChangeError('Strict change requires a separate plan')
    return 'active', docs_found


@contextmanager
def lock(root, docs):
    path = safe(root, docs / '.qb-change.lock')
    try:
        stream = path.open('x', encoding='utf-8')
    except FileExistsError:
        raise ChangeError('Operation lock exists; diagnose before retry: ' + str(path))
    try:
        with stream:
            stream.write('qb_change\n')
        yield
    finally:
        path.unlink()


def archive(root, docs, items, change_id, date):
    if any(d.fields['status'] != 'active' for d in items):
        raise ChangeError('Archive requires active spec and any separate plan')
    target = safe(root, docs / 'archive' / date[:4] / change_id)
    if target.exists():
        raise ChangeError('Archive target already exists')
    for d in items:
        d.unchanged()
    payloads = [(d, 'spec.md' if i == 0 else 'plan.md',
                 d.patched(status='archived', updated=date)) for i, d in enumerate(items)]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.mkdir()  # exclusive target creation; never overwrite
    pending = target / '.qb-pending.json'
    journal = {'id': change_id, 'files': [
        {'source': str(d.path.relative_to(root)), 'target': name,
         'source_sha256': digest(d.raw), 'target_sha256': digest(data)}
        for d, name, data in payloads]}
    pending.write_text(json.dumps(journal, indent=2), encoding='utf-8')
    # Copy first. On any failure retain the journal and all remaining sources.
    for d, name, data in payloads:
        with (target / name).open('xb') as stream:
            stream.write(data)
        if (target / name).read_bytes() != data:
            raise ChangeError('Archive verification failed')
    for d, _, _ in payloads:
        d.unchanged()
    for d, _, _ in payloads:
        d.unchanged()
        d.path.unlink()
    pending.unlink()
    return {'status': 'archived', 'path': str(target)}


def execute(args):
    root = Path(args.project_root).resolve(strict=True)
    docs = safe(root, root / args.docs_root)
    if not docs.is_dir():
        raise ChangeError('Document root does not exist')
    if not re.fullmatch(r'QB-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*', args.change_id):
        raise ChangeError('Invalid change id')
    dt.date.fromisoformat(args.date)

    def run():
        state, items = locate(root, docs, args.change_id)
        if args.command == 'inspect' or state == 'already_archived':
            if args.command == 'update' and state == 'already_archived':
                raise ChangeError('Archived metadata is immutable')
            return {'status': state, 'files': [str(d.path) for d in items]}
        if args.command == 'archive':
            if not args.verified:
                raise ChangeError('Agent must confirm acceptance with --verified')
            if any(d.fields['status'] != 'active' for d in items):
                raise ChangeError('Archive requires active documents')
            target = safe(root, docs / 'archive' / args.date[:4] / args.change_id)
            if target.exists():
                raise ChangeError('Archive target exists')
            if args.dry_run:
                return {'status': 'dry_run', 'target': str(target)}
            return archive(root, docs, items, args.change_id, args.date)
        doc = items[0] if args.document == 'spec' else next(
            (d for d in items[1:]), None)
        if doc is None:
            raise ChangeError('No separate plan')
        old = doc.fields['status']
        new = args.status or old
        allowed = {'draft': {'draft', 'approved'}, 'approved': {'approved', 'active'},
                   'active': {'active'}}
        if new not in allowed.get(old, set()):
            raise ChangeError('Unsupported transition; archived only via archive')
        if new != old and not args.authorized:
            raise ChangeError('Agent must confirm existing authorization with --authorized')
        if not args.dry_run:
            atomic_update(doc, doc.patched(status=new, updated=args.date))
        return {'status': 'dry_run' if args.dry_run else 'updated', 'path': str(doc.path)}

    if args.command == 'inspect' or args.dry_run:
        return run()
    with lock(root, docs):
        return run()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['inspect', 'update', 'archive'])
    parser.add_argument('--project-root', required=True)
    parser.add_argument('--docs-root', default='docs/qb-spec')
    parser.add_argument('--change-id', required=True)
    parser.add_argument('--date', default=dt.date.today().isoformat(), help='Project-local YYYY-MM-DD')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--document', choices=['spec', 'plan'], default='spec')
    parser.add_argument('--status', choices=['draft', 'approved', 'active'])
    parser.add_argument('--authorized', action='store_true')
    parser.add_argument('--verified', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(execute(args), ensure_ascii=True))
    except (ChangeError, OSError, ValueError) as error:
        print(json.dumps({'status': 'blocked', 'error': str(error)}, ensure_ascii=True))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
