"""HTTP(S) URL validation and SSRF guards (aligned with browser-runner)."""

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
    return urlunparse(
        (parsed.scheme.lower(), parsed.netloc, parsed.path or '/', parsed.params, parsed.query, '')
    )


def _blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.version == 4:
        nets = (
            '0.0.0.0/8',
            '127.0.0.0/8',
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
            '169.254.0.0/16',
        )
        for n in nets:
            if ip in ipaddress.ip_network(n):
                return True
        return bool(ip.is_multicast or ip.is_reserved or ip.is_unspecified)
    if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        return True
    if ip.is_unspecified:
        return True
    v4 = getattr(ip, 'ipv4_mapped', None)
    if v4 is not None:
        return _blocked_ip(v4)
    return False


def assert_safe_host(hostname: str) -> None:
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
        if _blocked_ip(ipaddress.ip_address(addr)):
            raise HTTPException(status_code=400, detail='target host resolves to a blocked network address')


def validate_public_http_url(url: str) -> str:
    normalized = normalize_http_url(url)
    parsed = urlparse(normalized)
    assert parsed.hostname
    assert_safe_host(parsed.hostname)
    return normalized
