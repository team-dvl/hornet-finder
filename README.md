# hornet-finder
A hornet detection app.

## Deployment

### Prerequisites
To deploy this app, you will need to install the following dependencies:
- Docker

### Before launching the app

1. Clone the repository:
```bash
git clone https://github.com/mdevolde/hornet-finder.git
cd hornet-finder
```

2. Create a `backend.env` file at the root of the project with the following content:
```env
DJANGO_SECRET_KEY=your_secret_key_here
HOST=your_host_here
KEYCLOAK_PUBLIC_KEY=your_keycloak_public_key_here
```

### Launching the app
To launch the app, run the following command in the root directory of the project:
```bash
docker-compose up --build
```
The app will be accessible at `http://localhost:8000`.
