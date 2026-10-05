# Docker Practice

A collection of hands-on Docker exercises covering image builds, development containers, Docker Compose, multi-container applications, and small services written in several languages.

## Projects

| Directory | Description |
| --- | --- |
| `03-workflow` | React development and production Docker workflow, including a Compose test service. |
| [`04-multi-container`](04-multi-container/README.md) | Fibonacci calculator split across nginx, React, Express, a worker, Redis, and PostgreSQL with Docker Compose. |
| `05-docker-review` | Small Node.js, Python, and Spring Boot examples for reviewing container basics. |
| `06-simple-microservices` | Node.js, Python, Spring Boot, and React microservice examples. |
| [`07-k8s-hello-world`](07-k8s-hello-world/README.md) | Spring Boot app deployed to Kubernetes with a ConfigMap and a NodePort Service. |
| [`08-k8s-microservices`](08-k8s-microservices/README.md) | Two services communicating inside a Kubernetes cluster. |

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

### Multi-container Fibonacci calculator

```bash
cd 04-multi-container
docker compose up --build
```

Open <http://localhost:3050>. nginx is the only published port; it routes `/` to the React client and `/api` to the Express API. The [exercise README](04-multi-container/README.md) has the system design diagram, every command, and the problems hit along the way.

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

