FROM node:20-bookworm-slim

WORKDIR /opt/render/project/src

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python + build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY pyproject.toml uv.lock ./

# Install Node dependencies
RUN npm ci && npm run prisma:generate

# Create virtual environment and install Python dependencies
RUN python3 -m venv "$VIRTUAL_ENV" \
  && pip install --no-cache-dir --upgrade pip uv \
  && uv sync --frozen --no-dev

# Copy application files
COPY src ./src
COPY analytics ./analytics
COPY tools ./tools
COPY scripts ./scripts

ENV APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

# Make start script executable
RUN chmod +x scripts/render-start.sh

CMD ["./scripts/render-start.sh"]