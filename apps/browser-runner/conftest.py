"""Stable crawl caps for tests importing tools.main (env read at import time)."""

import os

os.environ.setdefault('WEB_MAX_CRAWL_PAGES', '50')
os.environ.setdefault('WEB_MAX_CRAWL_DEPTH', '6')
