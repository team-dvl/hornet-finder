# Hornet Finder API

A RESTful API built with Django and Django REST Framework for managing hornet detection data, including hornets, nests, and apiaries with geospatial capabilities.

## Features

- **Hornet Tracking**: Record hornet sightings with location, direction, duration, and color markings
- **Nest Management**: Track hornet nests with location, status, and destruction records
- **Apiary Monitoring**: Monitor beehive infestation levels with geospatial data
- **Geospatial Support**: PostGIS integration for location-based queries and analysis
- **JWT Authentication**: Secure API access with JSON Web Token authentication
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **RESTful Design**: Full CRUD operations with standard HTTP methods

## Technology Stack

- **Framework**: Django 5.2+ with Django REST Framework
- **Database**: PostgreSQL with PostGIS extension
- **Authentication**: JWT Bearer token authentication with Keycloak integration
- **Documentation**: drf-spectacular (OpenAPI 3.1.1)
- **Server**: Gunicorn WSGI server
- **Python**: 3.9+

## API Endpoints

### Core Resources

- `GET|POST /api/hornets/` - List all hornets or create a new hornet sighting
- `GET|PUT|PATCH|DELETE /api/hornets/{id}/` - Retrieve, update, or delete a specific hornet
- `GET|POST /api/nests/` - List all nests or create a new nest record
- `GET|PUT|PATCH|DELETE /api/nests/{id}/` - Retrieve, update, or delete a specific nest
- `GET|POST /api/apiaries/` - List all apiaries or create a new apiary record
- `GET|PUT|PATCH|DELETE /api/apiaries/{id}/` - Retrieve, update, or delete a specific apiary

### Documentation

- `GET /api/docs/` - Interactive Swagger UI documentation (development only)
- `GET /api/schema/` - OpenAPI schema (development only)

## Data Models

### Hornet
- Location (latitude, longitude, PostGIS point)
- Direction of flight
- Duration of observation
- Color markings (up to 2 colors)
- Creation timestamp and author
- Optional link to related nest

### Nest
- Location (latitude, longitude, PostGIS point)
- Public/private place indicator
- Address information
- Destruction status and timestamp
- Creation timestamp and author
- Comments

### Apiary
- Location (latitude, longitude, PostGIS point)
- Infestation level (Light, Medium, High)
- Creation timestamp and author
- Comments

## Environment Variables

The application requires several environment variables to be configured. These are typically set in the Docker Compose configuration:

- `DJANGO_SECRET_KEY` - Django secret key for cryptographic signing
- `DEBUG` - Enable/disable debug mode (default: False)
- `DATABASE_*` - PostgreSQL database connection settings
- `KEYCLOAK_*` - Keycloak authentication server configuration

Refer to the main project's [docker-compose.yml](../docker-compose.yml) file for the complete list of required environment variables.

## Development

Use the Docker Compose configuration in the project root for deployment (the backend must be linked with another services like Keycloak and PostgreSQL).

## Authentication

The API uses JWT Bearer token authentication integrated with Keycloak. To access protected endpoints:

1. Obtain a JWT token from the Keycloak authentication server
2. Include the token in the Authorization header: `Authorization: Bearer <token>`
3. For API documentation access, use the "Authorize" button in Swagger UI

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
