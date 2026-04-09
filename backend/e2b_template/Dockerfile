FROM ubuntu:24.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Update system and install essential tools + system dependencies for Python packages
RUN apt-get update && apt-get install -y \
    python3.12 \
    python3.12-dev \
    python3-pip \
    python3-venv \
    curl \
    git \
    wget \
    jq \
    unzip \
    vim \
    nano \
    build-essential \
    # Dependencies for OpenCV & Image processing
    libgl1 \
    libglib2.0-0 \
    # Dependencies for Tesseract OCR
    tesseract-ocr \
    libtesseract-dev \
    # Dependencies for Reporting/PDF
    wkhtmltopdf \
    libfreetype6-dev \
    liblcms2-dev \
    libwebp-dev \
    # Dependencies for Geopandas/GIS
    libgdal-dev \
    libproj-dev \
    # Dependencies for Browsers/Playwright (Common dependencies)
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

# Fix python symlink
RUN ln -sf /usr/bin/python3.12 /usr/bin/python3 && ln -sf /usr/bin/python3.12 /usr/bin/python

# Install Node.js (20.x) - useful for some web tools
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Setup workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace
ENV WORKSPACE_DIR=/workspace

# Copy requirement file
COPY requirements-sandbox.txt /tmp/requirements-sandbox.txt

# Optimized install and cleanup
RUN for i in 1 2 3 4 5; do \
      python3 -m pip install --no-cache-dir --break-system-packages --default-timeout=1000 --retries=10 -r /tmp/requirements-sandbox.txt && break || \
      if [ $i -eq 5 ]; then exit 1; else echo "Retrying requirements..."; sleep 3; fi; \
    done && \
    playwright install chromium && \
    pip cache purge && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /root/.cache /tmp/*.txt

# E2B initialization will handle the IPython kernel setup automatically.


