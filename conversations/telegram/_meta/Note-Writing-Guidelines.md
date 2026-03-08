# Telegram Archive — Note Writing Guidelines

Tags: #archive #telegram #obsidian #guidelines

## 1) Folder convention
- Daily logs: `conversations/telegram/YYYY/MM/YYYY-MM-DD-log.md`
- Session bundles (optional): `conversations/telegram/YYYY-MM-DD-topic/`
- Meta docs/templates: `conversations/telegram/_meta/`

## 2) Required note header
Use this at the top of each log note:

```md
# Telegram Log — YYYY-MM-DD <topic>

Tags: #archive #telegram #chatlog #date/YYYY-MM-DD
```

## 3) Standard sections (in order)
1. `## Session Summary`
2. `## Message Log`
3. `## Extracted Items`
   - `### Decisions`
   - `### Actions`
   - `### Follow-ups`
   - `### Risks`
4. `## Links`

## 4) Message log format
Keep near-verbatim and timestamped:

```md
- **[HH:MM] User:** ...
- **[HH:MM] Assistant:** ...
```

Rules:
- Preserve original meaning and intent.
- Do not rewrite sensitive values (mask if needed).
- Keep chronological order.

## 5) Tag system
### Global tags
- `#archive` `#telegram` `#chatlog`

### Date tags
- `#date/YYYY-MM-DD` (required for daily logs)

### Semantic tags
- `#decision` `#action` `#followup` `#risk`
- Optional context tags: `#security` `#git` `#obsidian` `#vault` `#infra`

### Inline tagging pattern
```md
- [ ] Rotate exposed key. #followup #security
```

## 6) Linking rules (Obsidian)
- Link to root control notes when referenced: `[[MEMORY]] [[USER]] [[Home]]`
- Link to related sessions from each log note.
- Link bundles from archive index.

Example:
```md
## Links
- [[conversations/telegram/Index|Archive Index]]
- [[conversations/telegram/2026/03/08-github-obsidian-setup/00-Index|Setup Bundle]]
```

## 7) Naming standards
- Use ISO dates in filenames: `YYYY-MM-DD`.
- Use kebab-case for topics: `github-obsidian-setup`.
- Keep titles human-readable; filenames machine-sortable.

## 8) Quality checklist (before save)
- [ ] Correct date tag present
- [ ] Message log in time order
- [ ] Decisions/actions/followups/risks extracted
- [ ] Relevant links added
- [ ] Sensitive info masked if needed

## 9) Sensitive data policy
- Never store passwords/tokens/private keys in notes.
- If mentioned in conversation, log as: `[REDACTED_SECRET]`.
- Add a follow-up action for rotation if exposure happened.

## 10) Minimum daily output
For each active day, create at least:
- one daily log note,
- one backlink from `conversations/telegram/Index.md`.

## 11) Color system (inside notes)
Use Obsidian callouts to create consistent visual color coding.

### Standard color mapping
- Decisions → `[!tip]` (green)
- Actions → `[!todo]` (blue)
- Follow-ups → `[!warning]` (yellow)
- Risks → `[!danger]` (red)
- Context/summary → `[!info]` (neutral/blue)

### Example block
```md
> [!info] Session Summary
> Topic: GitHub + Obsidian archive setup

> [!tip] Decisions
> - Markdown-only repo scope. #decision

> [!todo] Actions
> - [x] Replaced symlinks with regular files. #action

> [!warning] Follow-ups
> - [ ] Rewrite history to purge earlier sensitive traces. #followup

> [!danger] Risks
> - Key was briefly committed in early history. #risk #security
```

## 12) Graph color groups (Obsidian Graph View)
In Graph View → **Groups**, add these queries/colors:
- `tag:#decision` → green
- `tag:#action` → blue
- `tag:#followup` → yellow
- `tag:#risk` → red
- `path:"conversations/telegram/"` → purple (archive scope)

## 13) Rule-change synchronization policy (important)
When guidelines change, perform a **retrofit pass** across existing archive notes.

Required steps:
1. Update all affected notes to the new standard.
2. Add missing tags/sections/callouts.
3. Re-check links and index references.
4. Commit with a message prefixed by `Archive sync:`.

Example commit message:
- `Archive sync: apply callout color standard to existing Telegram notes`
