# PostGIS Database Service

This directory contains the PostgreSQL database configuration with PostGIS spatial extensions for the Hornet Finder application. PostGIS provides geospatial capabilities essential for location-based data storage and spatial queries.

## Overview

The database service is built on PostgreSQL 17 with PostGIS 3 extensions and provides:

- **Spatial Database**: Geographic and geometric data types for location storage
- **Spatial Indexing**: High-performance spatial queries with GiST indexes
- **Geographic Functions**: Distance calculations, area measurements, and spatial relationships
- **Coordinate System Support**: Multiple spatial reference systems (SRID) with EPSG:4326 (WGS84) as primary

## Architecture

### Components

- **PostgreSQL 17**: Base relational database system
- **PostGIS 3**: Spatial extensions for geographic objects

### Spatial Data Types

The database supports various spatial data types used in the application:

- **Point**: Exact geographic locations (hornets, nests, apiaries)
- **Spatial Reference Systems**: EPSG:4326 (WGS84) for global positioning

## Files Description

### `Dockerfile`
Multi-layer Docker build configuration:
- **Base Image**: PostgreSQL 17 official image
- **PostGIS Installation**: Installs PostGIS 3 packages and scripts
- **Extension Setup**: Configures automatic PostGIS extension loading
- **Script Integration**: Includes initialization and update scripts

### `initdb-postgis.sh`
Database initialization script that runs during first container startup:
- **Template Database**: Creates `template_postgis` for new spatial databases
- **Extension Loading**: Installs core PostGIS extensions automatically
- **Multi-Database Setup**: Configures both template and main application database
- **Extensions Installed**:
  - `postgis`: Core spatial functionality
  - `postgis_topology`: Topology support
  - `fuzzystrmatch`: String matching for geocoding
  - `postgis_tiger_geocoder`: US address geocoding

### `update-postgis.sh`
PostGIS version update utility script:
- **Version Detection**: Automatically detects installed PostGIS version
- **Extension Updates**: Updates PostGIS extensions to latest version
- **Multi-Database Support**: Updates multiple databases simultaneously
- **Safe Upgrades**: Handles extension dependencies and version compatibility

## Database Configuration

### Environment Variables

The service uses the following environment variables (configured in docker-compose.yml):

- `POSTGRES_DB=hornet_finder`: Main application database name
- `POSTGRES_USER=hornet_finder`: Database user for the application
- `POSTGRES_PASSWORD=${DB_PASSWORD}`: Database password from environment file

### Connection Details

- **Host**: `hornet-finder-api-db` (container name)
- **Port**: 5432 (internal Docker network)
- **Database**: `hornet_finder`
- **User**: `hornet_finder`
- **Extensions**: PostGIS enabled by default

## Spatial Data Usage

### Application Integration

The Django backend uses PostGIS through:
- **GeoDjango**: Django's geographic framework
- **Point Fields**: `PointField(geography=True, srid=4326)` for precise location storage
- **Spatial Queries**: Distance-based searches and proximity calculations
- **Coordinate Conversion**: Automatic latitude/longitude to PostGIS Point conversion

### Data Models with Spatial Fields

#### GeolocatedModel (Abstract Base Class)
```python
class GeolocatedModel(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    point = geomodels.PointField(geography=True, srid=4326, null=True, blank=True)
```

#### Spatial-Enabled Models
- **Hornet**: Location tracking with direction and movement data
- **Nest**: Geographic nest positions with address information
- **Apiary**: Beehive locations with infestation level mapping

## Development

### Local Database Access

Connect to the database for development and debugging:

```bash
# Access database container
docker compose exec hornet-finder-api-db psql -U hornet_finder -d hornet_finder

# Verify PostGIS installation
SELECT PostGIS_version();

# List spatial reference systems
SELECT srid, proj4text FROM spatial_ref_sys WHERE srid = 4326;
```

### Common Spatial Queries

Example spatial queries for development:

```sql
-- Find all hornets within 1km of a point
SELECT * FROM hornet_hornet 
WHERE ST_DWithin(point, ST_GeogFromText('POINT(-71.060316 48.432044)'), 1000);

-- Calculate distance between two points
SELECT ST_Distance(
    ST_GeogFromText('POINT(-71.060316 48.432044)'),
    ST_GeogFromText('POINT(-71.087738 48.42868)')
) AS distance_meters;

-- Find nearest nests to a hornet sighting
SELECT n.*, ST_Distance(h.point, n.point) AS distance
FROM hornet_hornet h, hornet_nest n
WHERE h.id = 1
ORDER BY h.point <-> n.point
LIMIT 5;
```

## Backup and Recovery

### Database Backup

```bash
# Full database backup with spatial data
docker compose exec hornet-finder-api-db pg_dump -U hornet_finder -d hornet_finder -f /tmp/backup.sql

# Copy backup from container
docker compose cp hornet-finder-api-db:/tmp/backup.sql ./backup.sql
```

### Restore Operations

```bash
# Restore database
docker compose exec -T hornet-finder-api-db psql -U hornet_finder -d hornet_finder < backup.sql
```

## Troubleshooting

### Common Issues

1. **Extension Loading Failures**
   - Verify PostGIS packages are installed correctly
   - Check PostgreSQL version compatibility with PostGIS
   - Ensure initialization scripts have proper permissions

2. **Spatial Query Performance**
   - Verify spatial indexes exist and are being used

3. **Coordinate System Issues**
   - Verify SRID consistency (4326 for WGS84)
   - Check coordinate order (longitude, latitude for PostGIS)
   - Validate input coordinate ranges

4. **Connection Issues**
   - Verify database service is running: `docker compose ps hornet-finder-api-db`
   - Check network connectivity between services
   - Validate environment variables and credentials

### Log Access

```bash
# View database logs
docker compose logs hornet-finder-api-db

# Follow real-time logs
docker compose logs -f hornet-finder-api-db
```

## Security Considerations

- **Access Control**: Database access restricted to application services only
- **Network Isolation**: Database runs on internal Docker network
- **Credential Management**: Passwords managed through environment variables
- **Backup Security**: Ensure backup files are stored securely
- **Extension Security**: Keep PostGIS extensions updated for security patches

## Version Information

- **PostgreSQL**: 17 (latest stable)
- **PostGIS**: 3.x (latest available for PostgreSQL 17)
