"""Atomic local files and process exclusion (Linux LXC and macOS)."""
import csv
import fcntl
import io
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path


def atomic_write(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='') as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def exclusive_lock(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another ingestion job is running') from None
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def csv_text(rows):
    stream = io.StringIO(newline='')
    csv.writer(stream, lineterminator='\n').writerows(rows)
    return stream.getvalue()


if __name__ == '__main__':
    import subprocess
    import sys
    try:
        with exclusive_lock(sys.argv[1]):
            result = subprocess.run(sys.argv[2:])
        sys.exit(result.returncode)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(75)
