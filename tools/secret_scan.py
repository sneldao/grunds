#!/usr/bin/env python3
"""Fallback secret scanner for pre-commit when gitleaks is unavailable.

Scans staged files for common credential patterns. Exits non-zero on any hit.
Not as thorough as gitleaks — install it: brew install gitleaks
"""

import re
import sys

PATTERNS = [
    (r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----", "private key"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key"),
    (r"(?i)sk-(ant-)?[a-zA-Z0-9_-]{20,}", "OpenAI/Anthropic API key"),
    (r"(?i)github_pat_[a-zA-Z0-9_]{20,}", "GitHub PAT"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub token"),
    (r"(?i)xox[baprs]-[a-zA-Z0-9-]{10,}", "Slack token"),
    (r"(?i)(api[_-]?key|secret|password|token)\s*[=:]\s*['\"][A-Za-z0-9+/=_-]{16,}['\"]", "hardcoded credential"),
    (r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.", "JWT"),
]


def main(paths):
    hits = 0
    for path in paths:
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                for lineno, line in enumerate(f, 1):
                    if "gitleaks:allow" in line or "secret-scan:allow" in line:
                        continue
                    for pattern, label in PATTERNS:
                        if re.search(pattern, line):
                            print(f"{path}:{lineno}: {label}")
                            hits += 1
        except OSError:
            continue
    if hits:
        print(f"\n{hits} probable secret(s) found.")
        return 1
    print("fallback secret scan: clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
