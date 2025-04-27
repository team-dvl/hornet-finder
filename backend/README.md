# hornet-finder-api
API for a hornet detection app.

## Getting Started
This project is a RESTful API built with Django and Django REST Framework. It provides endpoints for managing hornet detection data.

### Prerequisites
- Python 3.9 or higher

OR

- Docker

### Deploy on Local Machine

#### Installation

1. Clone the repository:
```bash
git clone https://github.com/mdevolde/hornet-finder-api.git
cd hornet-finder-api
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

#### Running the Project

1. Apply migrations:
```bash
python manage.py migrate
```

2. Run with gunicorn (for production, if you do this don't do the next step):
```bash
gunicorn hornet_finder_api.wsgi:application --bind 0.0.0.0:8000 --access-logfile -
```

3. Run with Django's development server (for development, if you do this don't do the previous step):
```bash
python manage.py runserver
```

### Deploy on Docker

1. Clone the repository:
```bash
git clone https://github.com/mdevolde/hornet-finder-api.git
cd hornet-finder-api
```

2. Build the Docker image:
```bash
docker build -t hornet-finder-api .
```

3. Run the Docker container:
```bash
docker run -d -p 8000:8000 hornet-finder-api
```

### Accessing the API documentation
The API documentation is available at `/api/docs/` when the server is running.
