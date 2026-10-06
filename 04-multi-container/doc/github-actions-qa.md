# GitHub Actions: questions and answers

Review notes for the workflow in `.github/workflows/04-multi-container-ci.yml` (at the repo root), which replaces `.travis.yml`.

## The workflow

```yaml
name: 04-Multi-container CI

on:
  push:
    paths:
      - "04-multi-container/**"
      - ".github/workflows/04-multi-container-ci.yml"
  pull_request:
    paths:
      - "04-multi-container/**"
      - ".github/workflows/04-multi-container-ci.yml"

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: 04-multi-container

    steps:
      - name: Clone repo
        uses: actions/checkout@v4

      - name: Build test image
        run: docker build -t react-test -f ./client/Dockerfile.dev ./client

      - name: Run tests
        run: docker run -e CI=true react-test npm test -- --coverage

      - name: Build production images
        run: |
          docker build -t client ./client
          docker build -t nginx ./nginx
          docker build -t server ./server
          docker build -t worker ./worker

      - name: Log in to Docker Hub
        if: github.event_name == 'push'
        env:
          DOCKER_ID: ${{ secrets.DOCKER_ID }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
        run: echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_ID" --password-stdin

      - name: Push images to Docker Hub
        if: github.event_name == 'push'
        env:
          DOCKER_ID: ${{ secrets.DOCKER_ID }}
        run: |
          for image in client nginx server worker; do
            docker tag "$image" "$DOCKER_ID/$image"
            docker push "$DOCKER_ID/$image"
          done
```

## How does it map to the Travis file?

| Travis | GitHub Actions | What it does |
|---|---|---|
| `services: docker` | nothing needed | Docker is already installed on `ubuntu-latest` |
| `before_install` | step "Build test image" | Builds `react-test` from `client/Dockerfile.dev` |
| `script` | step "Run tests" | Runs `npm test -- --coverage` inside that image |
| `after_success` | step "Build production images" | Builds `client`, `nginx`, `server`, `worker` |
| `after_success` (`docker login`) | step "Log in to Docker Hub" | Logs in with `DOCKER_ID` and `DOCKER_PASSWORD` |
| `after_success` (`docker push`) | step "Push images to Docker Hub" | Pushes the four images as `$DOCKER_ID/<name>` |
| automatic | step "Clone repo" | Gets the code onto the machine |

## Where must the workflow file live?

In `.github/workflows/` at the **root of the repository**.

GitHub ignores workflows anywhere else. A file in `04-multi-container/.github/workflows/` never runs.

## Why can't `.github` live inside `04-multi-container`?

Because the location is fixed by GitHub and no setting changes it.

What matters is where the repository starts, which is the folder containing `.git`. Here that is `E:\Docker`, so the whole folder is one repo and `04-multi-container` is just a subfolder. GitHub does not search subfolders for workflows.

The root workflow points down into the exercise in two places instead:

- `paths: "04-multi-container/**"` makes it run only when that exercise changes.
- `working-directory: 04-multi-container` makes the commands run inside that folder.

Together they make the workflow behave as if it belonged to `04`.

The only way to keep `.github` inside `04-multi-container` is to make that folder its own repository with its own `.git`. For one learning repo holding all the exercises, a single root `.github/workflows/` with one file per exercise is the normal setup.

## Can the root workflow point to a file inside `04-multi-container`?

Not to a workflow file. Reusable workflows must also be in the root `.github/workflows/`.

The **steps** can move, though, as a "composite action". The trigger (`on:`) and the job always stay at the root.

Root workflow, which only clones the repo and calls the action:

```yaml
# .github/workflows/04-multi-container-ci.yml
jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - name: Clone repo
        uses: actions/checkout@v4

      - name: Run the 04 CI steps
        uses: ./04-multi-container/.github/actions/ci
```

The action, which holds the steps:

```yaml
# 04-multi-container/.github/actions/ci/action.yml
name: Multi-container CI steps
runs:
  using: composite
  steps:
    - name: Build test image
      shell: bash
      working-directory: 04-multi-container
      run: docker build -t react-test -f ./client/Dockerfile.dev ./client
    # ...the other steps
```

Extra rules inside a composite action:

- Every `run:` step needs its own `shell:`.
- `defaults` does not apply, so `working-directory` is repeated on each step.
- The clone step must come first in the workflow, or the action file is not on the machine yet.

This project does not use it. It adds a second file and more rules for no real gain when one workflow serves one exercise.

## What does `on:` do?

It says when the workflow runs.

- `push`: on every push, on any branch.
- `pull_request`: when a pull request is opened or updated.
- `paths`: only if the changed files match. Here that means files under `04-multi-container/` or the workflow file itself, so the other exercises in the repo don't trigger it.

## What is a job, and what is a step?

- A **job** (`test-and-build`) is a set of steps that run on one fresh virtual machine. `runs-on: ubuntu-latest` picks the machine.
- A **step** is one action inside the job. Steps run in order, top to bottom.

A step is either:

- `uses:` runs a ready-made action written by someone else, such as `actions/checkout@v4`.
- `run:` runs shell commands you write.

## What does `defaults.run.working-directory` do?

```yaml
defaults:
  run:
    working-directory: 04-multi-container
```

It sets the folder every `run:` command starts in.

Commands normally start at the repo root. The Dockerfiles are one level down, so `./client` would not be found from the root. This setting acts like `cd 04-multi-container` before every `run:` step.

Level by level:

- `defaults`: settings for every step in the job.
- `run`: only for `run:` steps, not `uses:` steps.
- `working-directory`: the starting folder.

Without it, each step would need its own `working-directory:` line.

Travis did not need this because `.travis.yml` assumed the project was the repo root.

## What does `actions/checkout` do? Is it a clone?

Yes, it is basically `git clone`.

Every job starts on an empty machine with none of your code. Checkout downloads the repo so the later steps have files to work with. Without it, `docker build ... ./client` fails because there is no `client` folder.

Two differences from a normal clone:

- **Shallow:** it fetches only the one commit being tested, not the full history. Add `fetch-depth: 0` to get everything.
- **Exact commit:** it checks out the commit that triggered the run, not just the latest on the default branch.

Travis did this automatically. GitHub Actions needs the step written out.

## What is `name:` for?

It is a label shown in the Actions log. It changes nothing about what runs.

- It is free text, so `Clone repo` and `Check out repository` are equally valid.
- Without a name, GitHub shows a default such as "Run actions/checkout@v4".
- A step name labels a step. The check shown on a commit or pull request uses the **job** name (`test-and-build`). Add `name:` under the job to change that.

## If the tests fail, are the production images still built?

No.

When a step fails (exits with a non-zero code), all later steps are skipped and the job is marked failed. `npm test` exits non-zero on a failing test, and `docker run` passes that exit code on.

This is the same as Travis's `after_success`, without a special keyword. Every step behaves as if it had `if: success()`.

To run a step even after a failure, for example to upload logs:

```yaml
- name: Upload logs
  if: always()
  run: ...
```

## Why is `-e CI=true` on the test command?

It tells the test runner it is running in CI, so it runs once and exits. Without it, the job hangs.

The client is a Create React App project, so `npm test` runs `react-scripts test`. That starts Jest in **watch mode** by default: it runs the tests, then waits for a key press or a file change. Nobody is there to press a key in CI, so the step would never finish.

`react-scripts` checks for an environment variable called `CI`. When it is `true`, the tests run once and the command exits with a pass or fail code, which is what marks the step green or red.

The command piece by piece:

```bash
docker run -e CI=true react-test npm test -- --coverage
```

- `-e CI=true`: `-e` sets an environment variable inside the container.
- `react-test`: the image built in the step before.
- `npm test -- --coverage`: the command to run in the container. The `--` passes `--coverage` through to Jest.

GitHub Actions already sets `CI=true` on the runner, but that variable does not pass into a container on its own. The tests run inside the container, so it has to be handed in with `-e`.

## Is Docker already installed on the runner?

Yes, on `ubuntu-latest`. Docker, Docker Compose and Buildx are preinstalled and the daemon is already running, so the workflow can call `docker build` straight after the clone step with no setup step.

This only holds for the Linux runners:

| Runner | Docker |
|---|---|
| `ubuntu-latest` | Installed and running. Builds Linux images. |
| `windows-latest` | Installed, but runs Windows containers, so these Linux images won't build. |
| `macos-latest` | Not installed. |

This is different from a local machine, where Docker Desktop has to be started before any `docker` command works.

## Is `echo` necessary in the `docker login` command?

```bash
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_ID" --password-stdin
```

Not strictly, but something has to feed the password into `docker login`, and `echo` is the simplest way.

`--password-stdin` tells `docker login` to read the password from standard input instead of from the command line. `echo` prints the password, and the shell `|` pipes it into that input.

The alternative without `echo` passes the password as a flag:

```bash
docker login -u "$DOCKER_ID" -p "$DOCKER_PASSWORD"
```

It works, but Docker warns that it is insecure. The password becomes part of the command itself and can show up in the process list or shell history. The piped form is the one Docker recommends for CI.

## Is `echo` safe for a password?

Yes, in this command:

- **The output goes into the pipe, not the log.** `echo` normally prints to the screen, but `|` sends that output straight into `docker login`. Nothing is displayed.
- **The log shows the variable name, not the value.** The step prints the literal text `echo "$DOCKER_PASSWORD" | docker login ...`. The shell fills in the real password only when it runs.
- **CI masks secrets anyway.** If the value did reach the output, GitHub Actions and Travis replace it with `***`.

`echo` is also built into the shell rather than run as a separate program, so the password does not appear in the machine's process list the way it does with `-p`.

It is unsafe without the pipe. A plain `echo "$DOCKER_PASSWORD"` on its own line prints the password to the log, and only the masking protects it.

## Is `env:` needed, or can I just use `$DOCKER_ID`?

`env:` is needed. Without it, `$DOCKER_ID` is empty.

Secrets in GitHub Actions are not environment variables by default. They live in the `secrets` store, and the `env:` block copies one into the shell under a name you choose:

```yaml
env:
  DOCKER_ID: ${{ secrets.DOCKER_ID }}   # makes $DOCKER_ID exist for this step
run: docker push "$DOCKER_ID/client"
```

Travis is different. Variables added in the Travis settings are injected as environment variables automatically, so `$DOCKER_ID` works in `.travis.yml` with no extra lines.

`env:` can be skipped by writing the secret directly in the command:

```yaml
run: echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_ID }}" --password-stdin
```

It works, but GitHub pastes the secret's text into the script before the shell runs it. A password containing `"`, `$` or a backtick can break the command or be run as code. Going through `env:` avoids that, and it is what GitHub recommends.

`env:` can also be declared once at the job level instead of on each step. Every step can then use the variables, but the password is visible to every step, including the test run, rather than only the login step.

## What does the `for` loop in the push step do?

```bash
for image in client nginx server worker; do
  docker tag "$image" "$DOCKER_ID/$image"
  docker push "$DOCKER_ID/$image"
done
```

It runs the same two commands for each of the four images, instead of writing eight lines.

- `for image in client nginx server worker; do`: go through the four names one at a time. On each pass, `$image` holds the current name.
- `docker tag "$image" "$DOCKER_ID/$image"`: give the image a second name that includes the Docker Hub ID.
- `docker push "$DOCKER_ID/$image"`: upload the image under that new name.
- `done`: end of the loop body. Go back for the next name.

With a Docker ID of `mohhasan`, the first pass runs as:

```bash
docker tag client mohhasan/client
docker push mohhasan/client
```

## What does `docker tag` do?

It adds another name to an existing image:

```bash
docker tag <existing name> <new name>
```

Nothing is copied or rebuilt. Both names point at the same image, like two labels on one box.

It is needed because the name decides where a push goes. The build step names the images plainly (`client`, `nginx`, ...), and Docker Hub reads a bare name as an official image, which you cannot push to. The name has to be `<your Docker ID>/<image>` for the push to land in your account.

`.travis.yml` skips the tag step because it builds with the full name from the start (`docker build -t "$DOCKER_ID/client"`). The workflow tags afterwards instead, so the build step still works on pull requests, where the `DOCKER_ID` secret is not available.

## Is the loop GitHub Actions syntax or bash?

Bash. Everything under `run:` is a shell script that GitHub hands to the runner's shell as it is, and on `ubuntu-latest` that shell is bash.

The workflow file mixes two languages:

| Language | Where |
|---|---|
| GitHub Actions (YAML) | Keys such as `name:`, `if:`, `env:`, `run:`, and anything inside `${{ ... }}` |
| Bash | The text under `run:`: the `for` loop, `$image`, `$DOCKER_ID`, the pipe in the login line, the `docker` commands |

So the loop works in any Linux or macOS terminal, and in Git Bash or WSL on Windows. It does not work in PowerShell or cmd, which have their own loop syntax. The PowerShell version:

```powershell
foreach ($image in "client","nginx","server","worker") {
  docker tag $image "$env:DOCKER_ID/$image"
  docker push "$env:DOCKER_ID/$image"
}
```

Travis also runs its commands in bash, which is why the `.travis.yml` lines look so similar.

## What does `|` mean after `run:`?

It lets one `run:` hold several lines of commands.

`|` is YAML syntax: everything indented below is one block of text, with line breaks kept. GitHub runs that text as a shell script, line by line.

```yaml
run: |
  docker build -t client ./client
  docker build -t nginx ./nginx
```

If one command fails, the step stops there and the rest don't run.

`|-` is the same block, minus the final trailing newline. For `run:` it makes no practical difference.

## Can I use a `-` list under `run:` instead?

No. `run:` must be a single piece of text. This is invalid:

```yaml
run:
  - docker build -t client ./client
  - docker build -t nginx ./nginx
```

Travis is different: `script:` and `after_success:` take a list, which is why `.travis.yml` uses `-`.

In GitHub Actions, `-` belongs one level up, in the list of steps. To use that style, give each command its own step:

```yaml
- name: Build client image
  run: docker build -t client ./client

- name: Build nginx image
  run: docker build -t nginx ./nginx
```

| Style | Good | Bad |
|---|---|---|
| One step with `\|` | Short, one logical action | Log shows one step for all four builds |
| One step per command | Log shows exactly which image failed | More lines to read |

## Things to remember about this project

- The test in `client/src/App.test.js` is commented out, so the test step always passes until it is restored.
- The workflow pushes the images to Docker Hub, but only on `push` events, not on pull requests. It needs two repository secrets, `DOCKER_ID` and `DOCKER_PASSWORD`, set under Settings → Secrets and variables → Actions.
- `docker push` takes one image per command, and the image name must start with your Docker Hub ID (`$DOCKER_ID/client`). A bare name like `client` is treated as an official Docker Hub image, which you cannot push to.
