FROM python:3.13-alpine

RUN apk update && apk upgrade --no-cache && apk add --no-cache bash gdal netcat-openbsd

WORKDIR /app

COPY requirements.txt .
COPY docker-entrypoint.sh .

RUN pip install --no-cache-dir --upgrade pip && \
	pip install --no-cache-dir -r requirements.txt && \
	chmod +x ./docker-entrypoint.sh

COPY . .

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
