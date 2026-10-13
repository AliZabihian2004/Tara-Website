FROM python:3.12-slim

WORKDIR /srv
COPY requirements.txt .
# Optional PyPI mirror, for networks where files.pythonhosted.org is unreachable
ARG PIP_INDEX_URL=
ARG PIP_TRUSTED_HOST=
RUN PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.org/simple}" PIP_TRUSTED_HOST="$PIP_TRUSTED_HOST" pip install --no-cache-dir -r requirements.txt
COPY schema.sql .
COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
