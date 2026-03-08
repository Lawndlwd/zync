FROM python:3.11-slim

WORKDIR /app

# Install system deps for openwakeword
RUN apt-get update && \
    apt-get install -y --no-install-recommends libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Download wake word models at build time so no internet is needed at startup
RUN python -c "import openwakeword; openwakeword.utils.download_models()"

EXPOSE 9000

CMD ["python", "server.py"]
