# 04 — Risks and Follow-ups

## Risks Identified
- A private key file was briefly committed before removal.

## Recommended Follow-ups
1. Rotate any key that was ever committed.
2. Optionally rewrite git history to purge earlier sensitive traces and large/noisy commits.
3. Keep repo scope strictly Markdown-only moving forward.
4. Continue documenting major operations in conversation log folders like this one.
