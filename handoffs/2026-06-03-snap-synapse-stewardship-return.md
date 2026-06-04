---
type: session-handoff
project: skill-a11y-audit
created: 2026-06-03
status: ready-for-execution
target_model: sonnet
scope: stewardship-return
---

# Skill A11y Audit: return stewardship to Snap Synapse LLC

## Why this exists

PAICE Foundation is scoping its portfolio around the Aggregated Intelligence thesis (AI Posture as the unifying score; three measurement arms; substrate moat). Skill A11y Audit is a useful agent skill but is a tactical capability rather than a measurement instrument or arm-specific substrate. It returns to Snap Synapse LLC stewardship while remaining open, free, and actively used in every public web page across the PAICE portfolio.

This is a stewardship change, not a sunset. The repo stays at https://github.com/snapsynapse/skill-a11y-audit, the site stays at https://skilla11y.dev/, the MIT license stays. The "used in every PAICE portfolio public web page" relationship becomes visible.

## Starting state to confirm before editing

The 2026-05-28 portfolio byline sweep moved the surface attribution and the LICENSE to PAICE.work PBC. The canonical display name was locked as "Skill A11y Audit" with domain `skilla11y.dev`; repo dir `skill-a11y-audit` and skill slug `a11y-audit` are technical IDs that stay as-is.

```bash
cd ~/Git/skill-a11y-audit
head -3 LICENSE
cat CNAME
grep -n "PAICE\|paice" README.md docs/index.html package.json 2>/dev/null | head -30
```

## Pre-flight: CNAME bug to fix while we're here

`CNAME` at the repo root currently reads `skilla11y.devskilla11y.dev` (the string is duplicated with no separator and no trailing newline). This is a bug — a CNAME file must contain exactly one hostname plus a trailing newline. Replace the file's contents with exactly:

```
skilla11y.dev
```

(one line, with a trailing newline). Note: GitHub Pages also reads `CNAME` from the publish directory. If GitHub Pages is configured to serve from `docs/`, verify whether `docs/CNAME` also exists; if so, fix it the same way. If only the root `CNAME` is present, leave the docs/ directory alone — the bug fix is at the root.

Use `printf 'skilla11y.dev\n' > CNAME` rather than `echo` so the trailing newline is guaranteed.

## Files to change

### 1. LICENSE

Around line 3:

```
Copyright (c) 2026 PAICE.work PBC
```

Replace with:

```
Copyright (c) 2026 Snap Synapse LLC
```

### 2. package.json — author field

Around the `"author"` key:

```
"author": "PAICE.work PBC <https://paice.work/>",
```

Replace with:

```
"author": "Snap Synapse LLC <https://snapsynapse.com/>",
```

### 3. README.md — Stewardship paragraph

Around line 257:

```
a11y-audit is a [PAICE.work](https://paice.work/) project. PAICE.work PBC is a public benefit corporation building infrastructure for productive collaboration between humans and autonomous agents.
```

Replace with:

```
Skill A11y Audit is an open skill under [Snap Synapse LLC](https://snapsynapse.com/) stewardship, authored by [Sam Rogers](https://www.linkedin.com/in/samrogers). It is used in every public web page across the [PAICE portfolio](https://paice.foundation/) and is MIT-licensed for any use.
```

Note: the new paragraph uses the canonical display name "Skill A11y Audit" rather than the bare "a11y-audit" form, per the 2026-05-28 name lock. The link to paice.foundation surfaces the active dependency.

### 4. docs/index.html — JSON-LD block

Around lines 34, 66, 68-70, 76, 78-79. Replace every PAICE.work PBC organization reference with Snap Synapse LLC:

| Find | Replace with |
|---|---|
| `"article:publisher" content="https://paice.work/"` | `"article:publisher" content="https://snapsynapse.com/"` |
| `"affiliation": { "@type": "Organization", "name": "PAICE.work PBC" }` | `"affiliation": { "@type": "Organization", "name": "Snap Synapse LLC" }` |
| `"name": "PAICE.work PBC"` (inside the `publisher` block) | `"name": "Snap Synapse LLC"` |
| `"isPartOf": { "@type": "CreativeWork", "name": "PAICE.work Open Patterns" }` | `"isPartOf": { "@type": "CreativeWork", "name": "Snap Synapse Open Standards" }` |
| `"copyrightHolder": { "@type": "Organization", "name": "PAICE.work PBC" }` | `"copyrightHolder": { "@type": "Organization", "name": "Snap Synapse LLC" }` |

Also confirm the publisher block's `"url"` field — update from `https://paice.work/` to `https://snapsynapse.com/` if present.

### 5. docs/index.html — visible body prose

Around line 452 (byline) and line 592 (footer). Replace:

```html
By <a href="https://www.linkedin.com/in/samrogers" target="_blank" rel="noopener author">Sam Rogers</a>, <a href="https://paice.work" target="_blank" rel="noopener">PAICE.work PBC</a>
```

with:

```html
By <a href="https://www.linkedin.com/in/samrogers" target="_blank" rel="noopener author">Sam Rogers</a>, <a href="https://snapsynapse.com/" target="_blank" rel="noopener">Snap Synapse LLC</a>
```

And the footer line (around 592):

```html
<p>A <a href="https://paice.work" target="_blank" rel="noopener">PAICE.work PBC</a> project by <a href="https://www.linkedin.com/in/samrogers" target="_blank" rel="noopener author">Sam Rogers</a>.</p>
```

Replace with:

```html
<p>By <a href="https://www.linkedin.com/in/samrogers" target="_blank" rel="noopener author">Sam Rogers</a>, <a href="https://snapsynapse.com/" target="_blank" rel="noopener">Snap Synapse LLC</a>. Used in every public web page across the <a href="https://paice.foundation/" target="_blank" rel="noopener">PAICE portfolio</a>.</p>
```

### 6. .gitignore — add the handoffs directory

Append the following block (do not deduplicate or reorder existing lines):

```
# Handoff documents for AI assistants — not for public repo
handoffs/
```

Place the block at the bottom of `.gitignore`, separated from prior content by one blank line.

If `.gitignore` does not yet exist at the repo root, create it with just that block.

### 7. Other discovery files

Check for `agents.json`, `.well-known/agents.json`, `llms.txt`, `llms-full.txt`. If found, search each for `paice` references and update any organization/publisher fields to Snap Synapse LLC / https://snapsynapse.com/. Use-case mentions of PAICE.work as a consumer remain as-is.

## Validation

After the edits:

```bash
cd ~/Git/skill-a11y-audit
# 1. CNAME contains exactly one line "skilla11y.dev" with trailing newline
cat -A CNAME
# Expected: "skilla11y.dev$" (one line, $ marks the newline).

# 2. No PBC organization claims should remain
grep -rn "PAICE\.work PBC\|paice\.foundation\"\|Copyright.*PAICE" --include="*.md" --include="*.html" --include="*.json" --include="LICENSE*" .
# Expected: zero hits. (Visible "paice.foundation" links in body prose are OK; the regex above only matches the stricter forms.)

# 3. Snap Synapse LLC attribution present
grep -rn "Snap Synapse LLC" --include="*.md" --include="*.html" --include="*.json" --include="LICENSE*" .
# Expected: at least one hit each in LICENSE, package.json, README.md, docs/index.html.

# 4. "Used in every public web page across the PAICE portfolio" callout visible
grep -rn "Used in every.*PAICE\|used in every.*PAICE" --include="*.md" --include="*.html" .
# Expected: at least one hit each in README.md and docs/index.html.

# 5. .gitignore covers handoffs/
grep -n "^handoffs/" .gitignore
# Expected: one hit.

# 6. Working tree clean except expected edits
git status --short
```

If a test command produces an unexpected hit, surface it to Sam before committing.

## Commit

Two commits, separated by concern, in this order:

```bash
# Commit 1: CNAME bug fix (small, self-contained)
git add CNAME
git commit -m "Fix duplicated CNAME content (was \"skilla11y.devskilla11y.dev\")"

# Commit 2: stewardship return
git add LICENSE package.json README.md docs/index.html .gitignore
# Add agents.json / .well-known / llms*.txt only if modified.

git commit -m "$(cat <<'EOF'
Return stewardship to Snap Synapse LLC; surface PAICE portfolio use

PAICE Foundation is scoping its portfolio around the Aggregated
Intelligence thesis. Skill A11y Audit remains open and free, returning
to Snap Synapse LLC stewardship. It continues to be used in every
public web page across the PAICE portfolio; that dependency is now
visible in the README and site footer.

- LICENSE copyright + package.json author: PAICE.work PBC → Snap
  Synapse LLC.
- README + index.html bylines, footer, and JSON-LD organization
  references: PAICE.work PBC → Snap Synapse LLC.
- README and footer use the canonical display name "Skill A11y Audit"
  per the 2026-05-28 name lock.
- "Used in every public web page across the PAICE portfolio" callout
  added so the dependency is legible.
- .gitignore: add handoffs/ (AI-assistant handoff notes are local-only).

Context: see paice-foundation/INTENT.md component registry and the
2026-06-03 portfolio scoping decision.
EOF
)"
```

## Do NOT push yet

Sam wants to review the three repos (hardguard25, ai-tool-watch, skill-a11y-audit) as a set before any push. Leave the commits local. Confirm clean working tree with `git status` and surface the commit hashes + short summary back to Sam.

## Coordinated downstream work (informational, not for this session)

After Sam pushes all three: paice-foundation canon (`INTENT.md`, `ontology.json`, `relationships.yaml`, `repos.yaml`, `portfolio/context.md`, `solutions/index.html`) is updated to remove these three from the active portfolio component list and add them as external dependencies. `~/AGENTS.md` Portfolio URL map moves the three from PAICE Portfolio to Snap Synapse. The display-name triad (Skill A11y Audit / skill-a11y-audit repo / a11y-audit skill slug) is preserved as locked on 2026-05-28. None of that is in scope for this handoff.
