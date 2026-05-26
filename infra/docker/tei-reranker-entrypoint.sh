#!/bin/sh
# Ensure Hugging Face hub cache (/data) is writable by TEI (UID 1000). Docker named
# volumes mount as root:root; privilege drop happens here before text-embeddings-router.
set -eu

TEI_UID=1000
TEI_GID=1000

mkdir -p /data
chown -R "${TEI_UID}:${TEI_GID}" /data

exec gosu "${TEI_UID}:${TEI_GID}" text-embeddings-router "$@"
