"""HTTP(S) URL validation and SSRF guards before outbound fetches or browser navigation."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

from fastapi import HTTPException


def normalize_http_url(url: str) -> str:
    u = url.strip()
    if not u:
        raise HTTPException(status_code=400, detail='url is required')
    parsed = urlparse(u)
    if parsed.scheme.lower() not in ('http', 'https'):
        raise HTTPException(status_code=400, detail='only http and https URLs are allowed')
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail='URL must include a host')
    # Fragment ignored for navigation identity
    return urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc,
            parsed.path or '/',
            parsed.params,
            parsed.query,
            '',
        )
    )


def _blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.version == 4:
        if ip in ipaddress.ip_network('0.0.0.0/8'):
            return True
        if ip in ipaddress.ip_network('127.0.0.0/8'):
            return True
        if ip in ipaddress.ip_network('10.0.0.0/8'):
            return True
        if ip in ipaddress.ip_network('172.16.0.0/12'):
            return True
        if ip in ipaddress.ip_network('192.168.0.0/16'):
            return True
        if ip in ipaddress.ip_network('169.254.0.0/16'):
            return True
        if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            return True
        return False
    # IPv6
    if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        return True
    if ip.is_unspecified:
        return True
    v4 = getattr(ip, 'ipv4_mapped', None)
    if v4 is not None:
        return _blocked_ip(v4)
    return False


def assert_safe_host(hostname: str) -> None:
    """Resolve hostname and ensure no address is in a blocked range."""
    host = hostname.strip().lower().removeprefix('[').removesuffix(']')
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail=f'dns resolution failed: {e}') from e
    seen: set[str] = set()
    for info in infos:
        addr = info[4][0]
        if addr in seen:
            continue
        seen.add(addr)
        ip = ipaddress.ip_address(addr)
        if _blocked_ip(ip):
            raise HTTPException(status_code=400, detail='target host resolves to a blocked network address')


def validate_public_http_url(url: str) -> str:
    """Normalize URL, enforce scheme/host, run DNS SSRF checks."""
    normalized = normalize_http_url(url)
    parsed = urlparse(normalized)
    assert parsed.hostname
    assert_safe_host(parsed.hostname)
    return normalized


def strip_fragment(url: str) -> str:
    p = urlparse(url)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, p.query, ''))
