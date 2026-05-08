FROM node:20-bookworm-slim

WORKDIR /opt/render/project/src

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python and build tools so we can run the FastAPI app side-by-side
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci && npm run prisma:generate

# Install Python runtime dependencies into a virtualenv to avoid PEP 668 issues.
RUN python3 -m venv "$VIRTUAL_ENV"
RUN pip install --no-cache-dir \
    "fastapi==0.136.1" \
    "psycopg[binary]==3.3.4" \
    "psycopg-pool==3.3.1" \
    "pydantic-settings==2.14.0" \
    "uvicorn[standard]==0.46.0"

COPY src ./src
COPY analytics ./analytics
COPY tools ./tools
COPY scripts ./scripts

ENV APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

# Ensure the render start script is executable and use it as the container CMD
RUN chmod +x scripts/render-start.sh

CMD ["./scripts/render-start.sh"]
