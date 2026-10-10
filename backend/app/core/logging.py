import json
import sys


def get_logger(name: str):
    def emit(level: str, msg: str, fields: dict) -> None:
        record = {"level": level, "logger": name, "msg": msg}
        record.update(fields)
        sys.stdout.write(json.dumps(record) + "\n")
        sys.stdout.flush()

    class _Logger:
        def _p(self, level: str, msg, args, fields):
            if args:
                try:
                    msg = str(msg) % args
                except Exception:
                    msg = str(msg)
            else:
                msg = str(msg)
            emit(level, msg, fields or {})

        def info(self, msg, *args, **fields):
            self._p("info", msg, args, fields)

        def warning(self, msg, *args, **fields):
            self._p("warning", msg, args, fields)

        def error(self, msg, *args, **fields):
            self._p("error", msg, args, fields)

    return _Logger()
