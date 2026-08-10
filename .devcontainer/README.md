<!--
SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>

SPDX-License-Identifier: CC0-1.0
-->

# Develop in a container
The dev container gives you Python 3.12, Node.js, MAFFT, nginx, and all project
dependencies without installing them on your machine. You need Docker and the
[Dev Container CLI](https://containers.dev/). Install the CLI with
`npm install -g @devcontainers/cli` if your package manager does not provide it.

From the repository root, start the container and open a shell:

```bash
./enter-dev.sh
```

The first start downloads the base image and installs dependencies, so it takes
longer than later starts. Once inside, launch both development servers:

```bash
./dev-zellij.sh
```

Open the Vite frontend at <http://localhost:3000>. It uses the FastAPI server at
<http://localhost:8000>. The container also serves the latest production-style
static export at <http://localhost>.

## After changing the frontend
Vite updates <http://localhost:3000> as you edit files under `web/src/`, so
normal frontend work does not require a build or restart.

However, the static preview at <http://localhost> uses the compiled frontend in
`web/dist`, not the source files. You need to rebuild and export after changing
the frontend:

```bash
# Run this in the container
npm --prefix web run build
atlas export /srv/www
```

Reload <http://localhost> when both commands finish. Restarting the container
also runs the export, but it doesn't build the frontend first, so build
`web/dist` before restarting when you want the preview to include frontend
changes.

## Direct CLI use
You can manage the container without the helper scripts:

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

The Python environment is already on `PATH` in container shells. Dependencies
are kept in Docker volumes named `<folder>-venv` and `<folder>-node-modules`, so
they survive a rebuild and do not create host-specific files in the checkout.

To reinstall dependencies after changing the setup, run:

```bash
.devcontainer/post-create.sh
```

To start clean, stop the container and remove those two named volumes before
running `devcontainer up` again.
