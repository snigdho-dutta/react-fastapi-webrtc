FROM node:20.18-alpine AS frontend-builder
WORKDIR /frontend

COPY client/package.json client/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY client/ ./
RUN npm run build


FROM python:3.12-slim
WORKDIR /server

RUN pip install --no-cache-dir poetry
COPY server/pyproject.toml server/poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-root --no-interaction --no-ansi

COPY server/ .

COPY --from=frontend-builder /frontend/dist /client/dist

CMD ["python", "main.py"]

EXPOSE 10000