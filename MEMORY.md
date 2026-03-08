# MEMORY

## User profile
- Preferred channel: Telegram DM (`telegram:6996439087`)
- Prefers immediate acknowledgements for long-running tasks.
- Wants assistant to keep persistent memory updated regularly.

## Environment / system state
- Host: `openclaw-nuc` (NixOS)
- OpenClaw exec currently configured for host execution.
- NixOS flake repo path: `/home/clawe/NUC_openclaw`
- NixOS flake output in use: `#nuc`

## Recent completed actions
- Enabled host command execution for OpenClaw.
- Rebuilt NixOS successfully multiple times.
- Added `fastfetch` to system packages and verified it runs.
- Enabled Docker (`virtualisation.docker.enable = true`) and verified Docker works.
- Ran Ubuntu 22.04 container and verified `/etc/os-release`.
- Enabled `sag` plugin; `peekaboo` kept disabled (not available on current x86_64-linux pin).
- Added `alsa-lib` runtime support to fix `sag` shared library issue.

## User intent to remember
- Wants a duo frontdesk/worker behavior on Telegram: assistant keeps chatting while spawning workers for heavy tasks.
- Prefers all actionable work to be executed via sub-agents by default; main assistant should primarily coordinate and reply in chat.
- Wants top-10 Gaussian Splatting paper summaries when asked.
- Wants memory to be maintained and updated over time.
