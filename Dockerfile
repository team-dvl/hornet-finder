FROM python:3.13-alpine

RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
	pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

RUN python manage.py collectstatic --noinput

CMD ["gunicorn", "hornet_finder_api.wsgi:application", "--bind", "0.0.0.0:8000", "--access-logfile",  "-"]