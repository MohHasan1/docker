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
```

## How does it map to the Travis file?

| Travis | GitHub Actions | What it does |
|---|---|---|
| `services: docker` | nothing needed | Docker is already installed on `ubuntu-latest` |
| `before_install` | step "Build test image" | Builds `react-test` from `client/Dockerfile.dev` |
| `script` | step "Run tests" | Runs `npm test -- --coverage` inside that image |
| `after_success` | step "Build production images" | Builds `client`, `nginx`, `server`, `worker` |
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

It tells the test runner it is running in CI, so it runs once and exits. Without it, Jest can start in watch mode and wait for input forever, and the job hangs.

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
- The workflow only builds the images. It does not push them to Docker Hub. That needs a login step and `docker push`.
