FROM node:22-alpine AS web-build
WORKDIR /web
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS api
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY docs/ ./docs/
COPY --from=web-build /web/dist ./frontend/dist
RUN mkdir -p /app/data
WORKDIR /app/backend
ENV RIFT_DB_PATH=/app/data/rift.db
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
