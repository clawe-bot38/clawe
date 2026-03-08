# Runpod Pod Setup Skill

Use this skill when a user wants an end-to-end Runpod setup: **API key + target GPU → running pod → repo checkout → smoke test logs**.

## Inputs required from user (checklist)
- Runpod API key (prefer temporary/rotated key).
- Region preference (or “any”).
- Target GPU(s), in priority order (e.g., `A100 80GB`, fallback `A100 40GB`, `L40S`).
- Max hourly budget (USD/hr) and max total burn limit.
- Container image (or base template) and disk size.
- Exposed ports needed (e.g., 22/8888/3000).
- Repo URL + branch/commit.
- Smoke test command(s) and expected pass signal.
- Optional: env vars/secrets needed by repo.

If key details are missing, ask before provisioning.

## Guardrails (always apply)
1. **Key safety**
   - Never print full API key in logs/messages.
   - Store key only in process env (`RUNPOD_API_KEY`) for current session.
   - Mask key in outputs (`rp_...abcd`).
2. **Cost/supply control**
   - Respect user max $/hr; do not launch above cap.
   - Use GPU fallback list in order.
   - Stop after bounded retries (default: 3 attempts per GPU class).
3. **Reliability**
   - Treat stock errors/timeouts as normal; retry with backoff (e.g., 15s, 45s, 90s).
   - If region constrained and unavailable, ask before widening to “any region”.
4. **Post-run hygiene**
   - Recommend key rotation after setup success.
   - Recommend auto-stop/idle policy if available.

## Procedure

### 1) Validate inputs
Confirm: budget cap, GPU fallback order, region policy, image/template, repo ref, smoke command.

### 2) Export API key safely
```bash
export RUNPOD_API_KEY='<USER_KEY>'
```
Do not echo this value.

### 3) Discover/choose supply
- Query available instances (via Runpod API/CLI).
- Filter by:
  - allowed region(s)
  - GPU in priority list
  - `$/hr <= user cap`
  - required VRAM/features
- Choose cheapest/closest match meeting constraints.

If none available: retry with backoff, then move to next GPU fallback. If exhausted, report “no capacity under constraints” and suggest relaxed options.

### 4) Create pod
Create pod with selected GPU/image/disk/ports/env.
Capture:
- pod ID
- host/region
- hourly rate
- status transitions

### 5) Wait for readiness
Poll until pod is `RUNNING` and endpoints are assigned, with timeout (e.g., 10–15 min).
If timeout/failure:
- retry pod create (bounded)
- or fallback GPU tier

### 6) Connect and bootstrap
Using SSH or exposed endpoint:
- clone repo at specified branch/commit
- install deps
- run smoke command(s)
- collect logs and exit code

### 7) Verify and report
Success criteria:
- pod running
- endpoint reachable
- smoke test exit code 0 (or user-defined pass condition)

If smoke test fails, include actionable error excerpt and next fixes.

## Retry/Fallback policy (default)
- Per GPU tier: up to 3 create attempts.
- Backoff: 15s → 45s → 90s.
- Then move to next GPU tier.
- Stop immediately if budget cap would be exceeded.

## Expected output back to user
Return a concise provisioning report with:
- **Pod ID**
- **GPU type + region/host**
- **Hourly cost** and projected 24h cost
- **Endpoints** (SSH/HTTP/Jupyter etc.)
- **Repo ref deployed** (URL + commit SHA)
- **Smoke test command + exit code**
- **Last 50–100 lines of relevant logs**
- **Any follow-ups** (rotate key, tighten firewall, auto-stop)

## Minimal report template
```md
Runpod Setup Report
- Pod: <pod_id>
- GPU: <gpu_type>
- Region: <region>
- Cost: $<hourly>/hr (~$<daily>/24h)
- Status: RUNNING
- Endpoints:
  - SSH: <endpoint>
  - HTTP: <endpoint>
- Repo: <url> @ <commit>
- Smoke Test: `<command>`
- Result: PASS/FAIL (exit <code>)
- Logs (tail):
  <key log lines>
- Notes: <key rotation, stop policy, next steps>
```
