FROM node:20.18-alpine as frontend-builder
WORKDIR /app
COPY ../client/package*.json ./
RUN npm install
COPY ../client .
RUN npm run build

FROM python:3.12-slim as backend-builder
WORKDIR /app
RUN pip install poetry
COPY ../server/pyproject.toml ../server/poetry.lock ./
RUN poetry config virtualenvs.create false
RUN poetry install --no-dev --no-interaction --no-ansi
COPY ../server .
COPY --from=frontend-builder /app/dist /app/dist


FROM python:3.12-slim
WORKDIR /app
COPY --from=backend-builder /app /app
COPY --from=frontend-builder /app/dist /app/dist