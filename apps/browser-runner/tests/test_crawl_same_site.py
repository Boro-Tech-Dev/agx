"""Same-site hostname rules for indexed crawl."""

from tools.crawl_execute import _hostname_same_site


def test_www_apex_equivalent() -> None:
    assert _hostname_same_site('https://example.com/', 'https://www.example.com/foo')
    assert _hostname_same_site('https://www.example.com/', 'https://example.com/bar')


def test_different_hosts() -> None:
    assert not _hostname_same_site('https://a.example.com/', 'https://b.example.com/')


def test_case_insensitive() -> None:
    assert _hostname_same_site('https://EXAMPLE.com/', 'https://example.COM/x')
