# ============================================
# ETAPA 1: "builder" (El taller)
# ============================================
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./

# Aquí ya no compilamos GDAL, todo será rápido
RUN uv sync --frozen --no-cache --no-dev

COPY ./app ./app


# ============================================
# ETAPA 2: "runtime" (La casa final)
# ============================================
FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin appuser && \
    mkdir -p /app && \
    chown -R appuser:appgroup /app

# Solo la librería expat por si las dudas de otras dependencias
RUN apt-get update && \
    apt-get install -y --no-install-recommends libexpat1 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/app /app/app

USER 10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]