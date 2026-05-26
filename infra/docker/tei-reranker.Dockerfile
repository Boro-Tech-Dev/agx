FROM ghcr.io/huggingface/text-embeddings-inference:cpu-1.7
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gosu \
 && rm -rf /var/lib/apt/lists/*
COPY infra/docker/tei-reranker-entrypoint.sh /usr/local/bin/tei-reranker-entrypoint.sh
RUN chmod +x /usr/local/bin/tei-reranker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/tei-reranker-entrypoint.sh"]
