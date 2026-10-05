# Multi-Container Fibonacci Calculator

This exercise runs a small Fibonacci calculator as six containers with Docker Compose. It is deliberately over-engineered so that each part of a typical web stack gets its own container:

- **nginx** is the single entry point and routes requests by path.
- **client** is a React app served by the Create React App dev server.
- **api** is an Express server that stores and returns data.
- **worker** is a Node.js process that calculates Fibonacci values in the background.
- **redis** holds the calculated values and passes messages from the API to the worker.
- **postgres** keeps a permanent list of every index that was submitted.

## System design

```text
                      Browser
                         |
                         |  http://localhost:3050
                         v
              +---------------------+
              |        nginx        |   only container with a published port
              |   3050 -> 80        |   (3050 on the host, 80 inside)
              +---------------------+
                |        |        |
           /    |    /ws |        | /api/*   ("/api" is removed first)
                v        v        v
      +------------------+      +------------------+
      |      client      |      |       api        |
      |  React dev server|      |     Express      |
      |    port 3000     |      |    port 5000     |
      +------------------+      +------------------+
                                   |            |
                 seen indexes      |            |  values + "insert" messages
                                   v            v
                        +------------+      +------------+
                        |  postgres  |      |   redis    |
                        | port 5432  |      | port 6379  |
                        +------------+      +------------+
                                                 ^   |
                                 calculated      |   |  "insert" message
                                 value           |   v
                                            +------------+
                                            |   worker   |
                                            |  fib(n)    |
                                            +------------+
```

All six containers share the default Compose network, so they reach each other by service name (`client`, `api`, `redis`, `postgres`). Only nginx is reachable from the host.

### Routing

| Path | Goes to | Purpose |
| --- | --- | --- |
| `/` | `client:3000` | The React app and its static files |
| `/ws` | `client:3000` | WebSocket used by the dev server for hot reload |
| `/api/*` | `api:5000` | The Express API, with the `/api` prefix removed |

The rewrite rule in `nginx/default.conf` turns `/api/values/all` into `/values/all` before passing it on, so the Express routes do not need an `/api` prefix.

### What happens when you submit an index

1. The browser sends `POST /api/values` with the index.
2. The API rejects indexes above 40 with status `422`, because the recursive calculation gets too slow.
3. The API writes the index to Redis with the placeholder value `Nothing yet!`.
4. The API publishes the index on the Redis `insert` channel.
5. The API inserts the index into the Postgres `values` table and replies straight away.
6. The worker receives the `insert` message, calculates the value, and overwrites the placeholder in Redis.
7. The React page asks the API for fresh data every 2 seconds, so the placeholder turns into the real value without a refresh.

The API never waits for the worker. That is why the page has to poll: nothing pushes the finished value to the browser.

### API endpoints

| Method | Through nginx | Returns |
| --- | --- | --- |
| `GET` | `/api/values/all` | Every submitted index, from Postgres |
| `GET` | `/api/values/current` | Each index and its calculated value, from Redis |
| `POST` | `/api/values` | `{ "working": true }` after queuing the index |

## Project layout

| Path | Contents |
| --- | --- |
| `docker-compose.yml` | The six services and how they connect |
| `nginx/` | `default.conf` routing rules and the nginx image |
| `client/` | React app (`src/Fib.js` is the home page) |
| `server/` | Express API, built as the `api` service |
| `worker/` | Fibonacci worker |

The Compose service is called `api` rather than `server` because `server` is a keyword in nginx configuration, and using it as a name there is confusing.

## Run it

All commands are run from this directory.

```powershell
cd 04-multi-container
docker compose up --build
```

Open <http://localhost:3050>.

The first start can log connection errors from `api` while Postgres is still starting. Stop with `Ctrl+C` and run the command again if the page loads but values fail.

## Commands

### Start and stop

```powershell
# Build the images and start everything in the foreground
docker compose up --build

# Same, but in the background
docker compose up -d --build

# Stop and remove the containers and the network
docker compose down

# Also remove the volumes (deletes the Postgres data and the node_modules volumes)
docker compose down -v
```

### Check what is running

```powershell
# Containers in this project and their state
docker compose ps

# Logs from every service, followed live
docker compose logs -f

# Logs from one service
docker compose logs -f nginx
docker compose logs --tail 20 worker
```

### Rebuild or restart one service

```powershell
# Rebuild and recreate only nginx after changing default.conf or its Dockerfile
docker compose up -d --build nginx

# Restart a service without rebuilding
docker compose restart api

# Remove one service together with its anonymous volumes, then start it fresh
docker compose rm -sfv worker
docker compose up -d worker
```

### Look inside a container

```powershell
# Which config files did nginx actually load?
docker compose exec nginx ls /etc/nginx/conf.d
docker compose exec nginx cat /etc/nginx/conf.d/default.conf

# Check the nginx configuration for syntax errors
docker compose exec nginx nginx -t

# Open a shell in a container
docker compose exec client sh
```

### Inspect the data

```powershell
# Calculated values in Redis
docker compose exec redis redis-cli hgetall values

# Submitted indexes in Postgres
docker compose exec postgres psql -U postgres -c "SELECT * FROM values;"
```

### Call the API through nginx

```powershell
curl.exe http://localhost:3050/api/values/all
curl.exe http://localhost:3050/api/values/current
Invoke-RestMethod -Method Post -Uri http://localhost:3050/api/values -ContentType "application/json" -Body '{"index": 7}'
```

### Build a single image by hand

```powershell
cd client
docker build -f Dockerfile.dev -t 04-client-dev .
docker run -p 3000:3000 04-client-dev
```

The `server` and `worker` images build the same way, but they need Redis and Postgres to do anything useful, so run them through Compose.

## Client environment variables

The `client` service sets two variables that only matter for the React dev server:

```yaml
environment:
  - WATCHPACK_POLLING=true
  - WDS_SOCKET_PORT=0
```

### `WATCHPACK_POLLING=true`

The dev server normally waits for the operating system to tell it that a file changed. With Docker Desktop on Windows, the source code lives on a Windows drive and is mounted into a Linux container, and those change notifications do not cross that boundary. The container sees the new file contents, but the dev server is never told, so it does not recompile.

This variable makes the dev server check the files itself on a timer. It costs a little CPU and makes hot reload work with a bind mount on Windows.

### `WDS_SOCKET_PORT=0`

The page keeps a WebSocket open to the dev server so it can be told to reload. The dev server listens on port 3000 inside the container, but the browser reaches the app through nginx on port 3050.

Setting the socket port to `0` tells the page to use whatever port it was loaded from. The connection then goes to `ws://localhost:3050/ws`, which the `/ws` block in `nginx/default.conf` forwards to the client with the WebSocket upgrade headers.

Both variables are for development only. A production build is static files with no dev server, so neither applies.

## Problems hit while building this

### nginx showed "Welcome to nginx!" instead of the app

The nginx image loads every file in `/etc/nginx/conf.d/`. The Dockerfile copied the config to a folder with a different name:

```dockerfile
# Wrong: nginx never reads this folder
COPY ./default.conf ./etc/nginx/config.d/default.conf

# Right
COPY ./default.conf /etc/nginx/conf.d/default.conf
```

Two things were off in the wrong line:

- **Folder name.** It said `config.d`, but the folder is `conf.d`. This was the actual cause. Docker created the new folder without complaint, the build passed, and nginx kept using its stock `default.conf`, which serves the welcome page.
- **Relative destination.** `./etc/...` is relative to the image's working directory. It happened to resolve to `/etc/...` because the nginx image's working directory is `/`, but an absolute path says what is meant and keeps working if a `WORKDIR` is added later.

How to confirm which config is live:

```powershell
docker compose exec nginx cat /etc/nginx/conf.d/default.conf
```

After fixing a Dockerfile, rebuild. `docker compose up` on its own reuses the old image.

```powershell
docker compose up -d --build nginx
```

### `/api` requests failed after the config loaded

The upstream block was named `server` while `proxy_pass` pointed at `http://api`. With no upstream called `api`, nginx treats `api` as a plain hostname on port 80, where nothing is listening. The upstream name and the `proxy_pass` name must match:

```nginx
upstream api {
    server api:5000;
}

location /api {
    rewrite /api/(.*) /$1 break;
    proxy_pass http://api;
}
```

### Worker crashed with `MODULE_NOT_FOUND`, then `nodemon: not found`

Two mistakes in `docker-compose.yml` caused the first error:

- The worker's build context was `./client`, so the image had the client's packages.
- The volume was written as `/app/node_module`. Without the `s`, the bind mount `./worker:/app` hid the packages installed in the image.

Fixing the file was not enough. Compose keeps anonymous volumes when it recreates a container, so the worker still got the old `node_modules` volume full of React packages, and `nodemon` was missing. Removing the service with its volumes cleared it:

```powershell
docker compose rm -sfv worker
docker compose up -d worker
```

### Saving a file did not reload the page

See [Client environment variables](#client-environment-variables). The bind mount was correct, but file change notifications do not reach the container on Windows.

The `api` and `worker` services use nodemon, which has the same limitation. Changing their `dev` script to `nodemon -L` (legacy polling) is the usual fix. It has not been applied here, so restart those services after editing their code:

```powershell
docker compose restart api worker
```

### New values did not appear until a refresh

The page loaded the lists once and never asked again, while the worker finished its calculation later. `client/src/Fib.js` now re-fetches right after a submit and then every 2 seconds.

## Notes

- This is a development setup. Every image is built from a `Dockerfile.dev` and runs a dev server or nodemon.
- The Postgres password in `docker-compose.yml` is a throwaway value for local use. Do not reuse it anywhere real.
- Postgres data lives in an anonymous volume. It survives `docker compose down` but is deleted by `docker compose down -v`.
