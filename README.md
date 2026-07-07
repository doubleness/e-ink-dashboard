# E-ink Dashboard

Small Bun server that downloads the SHMU ALADIN meteogram, processes it for e-ink, and serves it as a JPEG.

## Local Development

```sh
bun install
bun run start
```

Open:

```text
http://localhost:3000/api/aladin
```

## Docker Image On GitHub

This repo includes a GitHub Actions workflow that builds and publishes a multi-platform Docker image to GitHub Container Registry:

```text
ghcr.io/YOUR_GITHUB_USERNAME/e-ink-dashboard:latest
```

The image is built for:

```text
linux/amd64
linux/arm64
```

`linux/arm64` is the one most likely needed for a 64-bit Raspberry Pi OS.

After pushing this repo to GitHub, make sure the default branch is `main`. On every push to `main`, GitHub Actions will publish the `latest` image.

## Docker Compose

Use this on the Raspberry Pi or in OpenMediaVault Compose. Replace `YOUR_GITHUB_USERNAME` with your GitHub username or organization.

```yaml
services:
  e-ink-dashboard:
    image: ghcr.io/YOUR_GITHUB_USERNAME/e-ink-dashboard:latest
    container_name: e-ink-dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
```

Then access:

```text
http://RASPBERRY_PI_IP:3000/api/aladin
```

There is also a copy of this compose example in `docker-compose.example.yml`.
