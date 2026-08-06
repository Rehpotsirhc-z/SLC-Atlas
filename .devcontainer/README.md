<!--
SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>

SPDX-License-Identifier: CC0-1.0
-->

# Dev Container

A standard [Dev Container](https://containers.dev/), driven entirely from the
CLI. There is no Dockerfile: `devcontainer.json` declares a base image plus
[Features](https://containers.dev/features), and `post-create.sh` installs
everything else. `post-start.sh` runs on every container start. The first
`devcontainer up` downloads the base image and Features, so it is slower than
subsequent runs.

## Prerequisites

- Docker
- The Dev Container CLI. On Arch: `paru -S devcontainer-cli` (provides the
  `devcontainer` binary). Elsewhere: `npm install -g @devcontainers/cli`.

## Start and enter

```bash
devcontainer up --workspace-folder .         # build + start; runs post-create on first create
devcontainer exec --workspace-folder . bash  # shell inside the container
```

`up` is idempotent: re-running it reuses the existing container. Dependency
installation (Python venv + an editable install of `pyproject.toml` with the
`pipeline` and `dev` extras, which also puts the `atlas` command on `PATH`;
`web/node_modules`)
happens once via `post-create.sh`. The Python venv is on `PATH` in every `exec`
session, so `python`/`fastapi` resolve without activating anything.

`.venv` and `web/node_modules` live in named Docker volumes rather than the
workspace bind mount: they survive container rebuilds and stay off the host
filesystem (faster I/O, no cross-OS `node_modules` breakage). The volumes are
named after the workspace folder—`<folder>-venv` and `<folder>-node-modules`—so
copying `.devcontainer/` into another project needs no edits. Docker creates
these volumes as `root`, so `post-create.sh` chowns them to the container user
before installing. To force a clean reinstall, remove the volumes with the
container down: `docker volume rm <folder>-venv <folder>-node-modules`.
