import argparse
import tempfile
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import qb_change as q
from change_files import ChangeError

ID = 'QB-20260907-fixture'


class Operations(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='qb 中文 ')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.docs = self.root / 'docs/qb-spec'
        (self.docs / 'specs').mkdir(parents=True)
        self.source = self.write('specs', 'arbitrary.md')

    def write(self, category, name, tier='standard', status='active'):
        p = self.docs / category / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(('---\r\nid: ' + ID + '\r\ntype: design\r\ntier: ' + tier +
                       '\r\nstatus: ' + status + '\r\ncreated: 2026-09-07\r\nupdated: 2026-09-07\r\n'
                       'supersedes: []\r\ncustom: keep me\r\n---\r\n正文\r\nstatus: active\r\n').encode('utf-8'))
        return p

    def run_op(self, command='archive', **kwargs):
        values = dict(project_root=str(self.root), docs_root='docs/qb-spec', change_id=ID,
                      date='2026-09-07', command=command, verified=True, authorized=False,
                      dry_run=False, document='spec', status=None)
        values.update(kwargs)
        return q.execute(argparse.Namespace(**values))

    def test_combined_and_idempotence(self):
        before = self.source.read_bytes()
        result = self.run_op()
        target = Path(result['path'])
        self.assertFalse(self.source.exists())
        self.assertFalse((target / 'plan.md').exists())
        self.assertEqual((target / 'spec.md').read_bytes(),
                         before.replace(b'status: active', b'status: archived', 1))
        self.assertEqual(self.run_op()['status'], 'already_archived')

    def test_split(self):
        plan = self.write('plans', 'different-name.md')
        result = self.run_op()
        self.assertTrue((Path(result['path']) / 'plan.md').exists())
        self.assertFalse(plan.exists())

    def test_dry_run_no_writes(self):
        before = self.source.read_bytes()
        self.assertEqual(self.run_op(dry_run=True)['status'], 'dry_run')
        self.assertEqual(before, self.source.read_bytes())
        self.assertFalse((self.docs / 'archive').exists())
        self.assertFalse((self.docs / '.qb-change.lock').exists())

    def test_duplicate_and_conflict(self):
        duplicate = self.write('specs', 'duplicate.md')
        with self.assertRaises(ChangeError):
            self.run_op()
        duplicate.unlink()
        (self.docs / 'archive/2026' / ID).mkdir(parents=True)
        with self.assertRaises(ChangeError):
            self.run_op()
        self.assertTrue(self.source.exists())

    def test_strict_missing_plan(self):
        self.write('specs', 'arbitrary.md', tier='strict')
        with self.assertRaises(ChangeError):
            self.run_op()

    def test_strict_pair_and_mismatch(self):
        self.write('specs', 'arbitrary.md', tier='strict')
        self.write('plans', 'plan.md')
        with self.assertRaises(ChangeError):
            self.run_op()
        self.write('plans', 'plan.md', tier='strict')
        self.assertEqual(self.run_op()['status'], 'archived')

    def test_cli_failure_exit(self):
        result = subprocess.run([sys.executable, '-B', str(Path(q.__file__)), 'archive',
                                 '--project-root', str(self.root), '--change-id', ID],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('blocked', result.stdout)
        self.assertTrue(self.source.exists())

    def test_changed_source_is_not_deleted(self):
        from change_files import Document
        original = Document.unchanged
        calls = []

        def changed(doc):
            calls.append(1)
            if len(calls) == 2:
                doc.path.write_bytes(doc.raw + b'new edit')
            original(doc)

        with patch.object(Document, 'unchanged', changed):
            with self.assertRaises(ChangeError):
                self.run_op()
        self.assertTrue(self.source.read_bytes().endswith(b'new edit'))

    def test_authorization_and_metadata(self):
        self.write('specs', 'arbitrary.md', status='draft')
        with self.assertRaises(ChangeError):
            self.run_op('update', status='approved')
        self.run_op('update', status='approved', authorized=True)
        self.run_op('update', status='active', authorized=True)
        with self.assertRaises(ChangeError):
            self.run_op('update', status='draft')
        with self.assertRaises(ChangeError):
            self.run_op(verified=False)

    def test_path_escape_and_lock(self):
        with self.assertRaises(ChangeError):
            self.run_op(docs_root='../outside')
        (self.docs / '.qb-change.lock').write_text('existing')
        with self.assertRaises(ChangeError):
            self.run_op()
        self.assertTrue(self.source.exists())

    def test_duplicate_frontmatter(self):
        self.source.write_bytes(self.source.read_bytes().replace(b'type: design', b'type: design\r\nstatus: active'))
        with self.assertRaises(ChangeError):
            self.run_op()

    def test_interrupted_delete_keeps_all_content(self):
        plan = self.write('plans', 'plan.md')
        original = Path.unlink

        def fail(path, *args, **kwargs):
            if path == plan:
                raise OSError('simulated interruption')
            return original(path, *args, **kwargs)

        with patch.object(Path, 'unlink', fail):
            with self.assertRaises(OSError):
                self.run_op()
        target = self.docs / 'archive/2026' / ID
        self.assertTrue((target / 'spec.md').exists())
        self.assertTrue((target / 'plan.md').exists())
        self.assertTrue((target / '.qb-pending.json').exists())
        self.assertTrue(plan.exists())
        with self.assertRaisesRegex(ChangeError, 'Recovery required'):
            self.run_op()

    def test_copy_failure_keeps_sources(self):
        original = Path.open

        def fail(path, *args, **kwargs):
            if path.name == 'spec.md' and args and args[0] == 'xb':
                raise OSError('simulated write failure')
            return original(path, *args, **kwargs)

        with patch.object(Path, 'open', fail):
            with self.assertRaises(OSError):
                self.run_op()
        self.assertTrue(self.source.exists())
        with self.assertRaises(ChangeError):
            self.run_op()

    def test_symlink_rejected(self):
        alias = self.docs / 'specs/alias.md'
        try:
            alias.symlink_to(self.source)
        except OSError:
            self.skipTest('OS does not permit symlinks')
        with self.assertRaises(ChangeError):
            self.run_op()


if __name__ == '__main__':
    unittest.main()
