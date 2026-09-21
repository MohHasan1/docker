# Docker Practice

A collection of hands-on Docker exercises covering image builds, development containers, Docker Compose, multi-container applications, and small services written in several languages.

## Projects

| Directory | Description |
| --- | --- |
| `03-workflow` | React development and production Docker workflow, including a Compose test service. |
| `04-multu-container` | Multi-container React, Node.js, PostgreSQL, and Redis practice project. |
| `05-docker-review` | Small Node.js, Python, and Spring Boot examples for reviewing container basics. |
| `06-simple-microservices` | Node.js, Python, Spring Boot, and React microservice examples. |

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- Docker Compose v2 (`docker compose`)

## Run an example

Each exercise is independent. Change to the exercise directory before running its commands.

### React development workflow

```bash
cd 03-workflow
docker compose up --build
```

Open <http://localhost:3000>. Stop the containers with:

```bash
docker compose down
```

### Node.js microservices

The Compose file uses an external network, so create it once before starting the services:

```bash
docker network create service-network
cd 06-simple-microservices/node
docker compose up --build
```

Service A is available at <http://localhost:3000> and service B at <http://localhost:4000>.

## Useful commands

```bash
# List running containers
docker ps

# Rebuild and start a Compose project
docker compose up --build

# Follow Compose logs
docker compose logs -f

# Stop and remove Compose containers and networks
docker compose down
```

## Notes

- Dependencies and generated build output are intentionally excluded from Git; install or build them locally as needed.
- Some directories are learning exercises and may be works in progress.
- Do not commit passwords or other secrets. Put local values in an ignored `.env` file and provide safe examples in `.env.example`.

