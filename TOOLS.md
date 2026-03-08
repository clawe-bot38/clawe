# Tool Usage

## Available
- **Web Search** (oracle) — current events, prices, lookups
- **Summarize** — URLs, PDFs, YouTube videos
- **File System** — read/write in ~/.openclaw/workspace/
- **Cron** — schedule one-time or recurring tasks

## Principles
- Use the simplest tool that works
- Chain tools when needed (search → summarize)
- Never expose API keys in responses
- Confirm before writing outside the workspace

<!-- BEGIN NIX-REPORT -->

## Nix-managed tools

### Built-in toolchain
- nodejs_22
- pnpm_10
- git
- curl
- jq
- python3
- ffmpeg
- sox
- ripgrep
- go
- uv
- openai-whisper
- spotify-player
- openhue-cli
- wacli
- ordercli
- blucli
- eightctl
- mcporter
- qmd
- nano-pdf
- bird
- camsnap
- gogcli
- goplaces
- imsg
- peekaboo
- poltergeist
- sag
- sonoscli
- summarize

## Nix-managed plugin report

Plugins enabled per instance (last-wins on name collisions):

### Instance: default
- goplaces — goplaces (github:openclaw/nix-steipete-tools?dir=tools/goplaces&rev=c110209720cbc6c87fccb6c1e1c2b79b1d719245&narHash=sha256-1Vo7rcLGdKaqj39J3HhBKh8IbljSjgCUhinCFJbDPl8=)
- summarize — summarize (github:openclaw/nix-steipete-tools?dir=tools/summarize&rev=c110209720cbc6c87fccb6c1e1c2b79b1d719245&narHash=sha256-1Vo7rcLGdKaqj39J3HhBKh8IbljSjgCUhinCFJbDPl8=)

Tools: batteries-included toolchain + plugin-provided CLIs.

<!-- END NIX-REPORT -->