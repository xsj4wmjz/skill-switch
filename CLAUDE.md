# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project Overview

**SkillSwitch** is a cross-platform Tauri 2 desktop application for managing AI coding assistant "Skills" across **Claude Code**, **Codex CLI**, **Gemini CLI**, **Cursor**, and **Windsurf**. It provides a unified interface to install, create, discover, backup, and sync skill/slash-command files across global and project-level scopes.

### Core Features

- **Library Management**: Browse, create, edit, delete skills and slash commands stored in a local library
- **Multi-App Installation**: Install skills as symlinks into multiple AI CLI app directories simultaneously (e.g., `~/.claude/skills/`, `~/.codex/commands/`)
- **Discovery**: Browse curated marketplace feeds, search the skills.sh registry, and explore third-party GitHub repos (anthropics/skills, openai/skills, ComposioHQ/awesome-claude-skills)
- **Git Backup**: Automatic backup sync to a user-configured Git remote repository — every mutation (create, update, delete, import) triggers `git add → commit → push`
- **Project Profiles**: Define project profiles with attached skills; apply them to project directories via symlinks; capture changes back into the library
- **External App Scanning**: Detect skills/commands already present in AI app directories (managed or unmanaged)
- **Self-Update**: Built-in app update checking and installation via Tauri updater plugin
- **Import/Export**: Import from folders, ZIP files, GitHub repos, or skills.sh registry; export to ZIP

### Supported AI Apps

| App | App ID | Accent Color | CLI Directory |
|---|---|---|---|
| Claude Code | `claude` | `#2563eb` (blue) | `.claude/` |
| Codex CLI | `codex` | `#7c3aed` (violet) | `.codex/` |
| Gemini CLI | `gemini` | — | `.gemini/` |
| Cursor | `cursor` | `#0891b2` (cyan) | `.cursor/` |
| Windsurf | `windsurf` | — | `.windsurf/` |

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript 5 + Vite 6 |
| Backend | Rust (Tauri 2) |
| Styling | CSS Modules + CSS Custom Properties (design tokens) |
| Package Manager | pnpm 9 (Node 20) |
| IPC | Tauri `invoke` → Rust-style `Result<T>` |
| State Management | React Context (no Redux/Zustand) |
| Routing | None — `PageId` union type in `App.tsx` |
| Git Operations | Shell out to `git` CLI (no git2 crate) |
| Serialization | `serde` + `serde_json` with `camelCase` renaming |

---

## Development Commands

```bash
# Install dependencies (requires pnpm 9, Node 20)
pnpm install

# Start full app with Tauri window (frontend + Rust backend)
pnpm tauri dev

# Start Vite dev server only (frontend-only, no backend)
pnpm dev

# Type check (TypeScript, no build)
pnpm exec tsc --noEmit

# Lint
pnpm lint

# Format check
pnpm format:check

# Production build
pnpm tauri build

# Rust backend checks (run in src-tauri/)
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings
cd src-tauri && cargo fmt -- --check
```

**No test suite is currently configured.**

---

## Architecture

### Frontend-Backend Communication (IPC)

All frontend-backend communication uses Tauri IPC:

```
React Component → Context method → Service wrapper (src/services/*.ts) → tauriInvoke() → Rust #[tauri::command] → Business logic (store.rs, repo_sources.rs, etc.)
```

- **Core IPC wrapper**: `src/services/tauri.ts` wraps Tauri's `invoke()` and returns a Rust-style `Result<T>`: `{ ok: true, value: T }` or `{ ok: false, error: string }`
- **Service layer**: Each domain has a 1:1 mapping — one file in `src/services/` per module in the Rust backend
- **Command pattern**: All mutating commands use `run_blocking_command` to offload blocking I/O to a thread pool; read-only commands are synchronous

### Type System (Dual Mirror)

TypeScript types in `src/types/index.ts` **mirror** Rust domain types in `src-tauri/src/domain.rs`. Both use `camelCase` naming:

- Rust: `#[serde(rename_all = "camelCase")]` on structs, `#[serde(rename_all = "kebab-case")]` on most enums
- TypeScript: All types match the serialized JSON shape exactly

**When adding new types, always update BOTH files to keep them synchronized.**

Key domain enums:

| Rust Enum | Values | Serialization |
|---|---|---|
| `ResourceKind` | `Skill`, `SlashCommand`, `Prompt`, `Agents` | kebab-case |
| `ResourceScope` | `Global`, `Project` | lowercase |
| `ResourceOrigin` | `Private`, `Vendor`, `ForkedVendor` | kebab-case |
| `SourceStatus` | `Current`, `UpstreamAvailable`, `MergeApplying`, `MergeBlocked`, `LocalOnly` | kebab-case |
| `InstallStatus` | `NotInstalled`, `InSync`, `Stale`, `Diverged`, `Missing` | kebab-case |
| `ProvenanceKind` | `Manual`, `FileImport`, `ExternalApp`, `Marketplace`, `RepoSource` | kebab-case |

### State Management

React Context providers manage all state, nested in this order (outer → inner):

```
AppProvider → SettingsProvider → ToastProvider → [BackupGate] → SourceProvider → SkillProvider → SlashCommandProvider → ProjectProvider → UpdaterProvider
```

| Context | File | Key State & Methods |
|---|---|---|
| `AppContext` | `src/context/AppContext.tsx` | `APP_LIST` constant (3 apps: claude, codex, cursor), `AppId` type. Pass-through, no mutable state |
| `SettingsContext` | `src/context/SettingsContext.tsx` | `AppSettings` (theme, locale, auto-check, backup source, third-party repos). `updateSettings(partial)`. Theme sync with Tauri window. Backup source cache in `localStorage` |
| `SourceContext` | `src/context/SourceContext.tsx` | Source/marketplace/registry state, `allRemoteSkills`, per-repo fetch states. `refresh()`, `loadMoreMarket()`, `searchMarket()`, `searchRegistry()` (debounced 300ms) |
| `SkillContext` | `src/context/SkillContext.tsx` | `skills[]`, `externalSkills[]`, CRUD: `create()`, `update()`, `remove()`, `syncFromSource()`. Loads managed + scans external on mount |
| `SlashCommandContext` | `src/context/SlashCommandContext.tsx` | `commands[]`, `externalCommands[]`, mirrors SkillContext for slash commands |
| `ProjectContext` | `src/context/ProjectContext.tsx` | `projects[]`, CRUD: `create()`, `update()`, `remove()` |
| `UpdaterContext` | `src/context/UpdaterContext.tsx` | `currentVersion`, `updateInfo`, `isChecking`, `isDownloading`, `downloadProgress`. `checkForUpdates(silent?)`, `downloadUpdate()`. Auto-check 3s after mount |

Each context loads data on mount and provides async methods that wrap the service layer.

### Page Navigation

**No router is used.** `App.tsx` manages page state via a `PageId` union type:

```typescript
type PageId = "my-library" | "my-commands" | "repo-browse" | "create" | "settings"
type LibraryTab = "self-created" | "external"
```

Navigation helpers: `navigateToRepo(repoId)`, `navigateToLibraryTab(tab)`, `navigateToExternalApp(appId)`

**BackupGate**: A wrapper component that shows `BackupSetupModal` if no backup source is configured, blocking access to the main app until the user connects a Git repo.

### Page Components

| Page | File | Purpose |
|---|---|---|
| My Library | `src/pages/MyLibraryPage.tsx` | Manage self-created & external skills with tab switching |
| My Commands | `src/pages/MySlashCommandsPage.tsx` | Manage slash commands |
| Repo Browse | `src/pages/RepoBrowsePage.tsx` | Browse/discover skills from repos, marketplace, registry |
| Discover | `src/pages/DiscoverPage.tsx` | Discovery page with local, registry, and repo tabs |
| Create | `src/pages/CreatePage.tsx` | Skill/slash-command creation and editing form |
| Settings | `src/pages/SettingsPage.tsx` | App settings, backup source configuration, third-party repos |

### Backend Structure

```
src-tauri/src/
├── main.rs         # Entry point — delegates to skill_switch_lib::run()
├── lib.rs          # App setup, registers ~80 Tauri commands, startup logic (theme, backup sync)
├── commands.rs     # Tauri command handlers (thin IPC boundary layer, ~80 commands)
├── domain.rs       # Domain types with Serde serialization (~1000 lines, 20+ structs, 10+ enums)
├── store.rs        # Core business logic: CRUD, file I/O, symlinks, install, backup (~5800 lines)
├── git.rs          # Git operations via CLI: clone, pull, push, status, merge, branch (~270 lines)
├── legacy.rs       # One-time migration from v1 (skills.json) to v2 (library.json) (~100 lines)
├── marketplace.rs  # Marketplace feed loading + GitHub-based skill import (~240 lines)
├── registry.rs     # Skills.sh registry search + GitHub-based installation (~200 lines)
├── repo_sources.rs # Third-party repo source sync and skill discovery (~300 lines)
└── updater.rs      # App self-update via tauri-plugin-updater (~100 lines)
```

### Service Files (Frontend)

| Service | File | Backend Module | Key Commands |
|---|---|---|---|
| Core IPC | `src/services/tauri.ts` | — | `tauriInvoke<T>(cmd, args?)` → `Result<T>` |
| Skills | `src/services/skill.ts` | `store.rs` | 20+ commands: list, get, create, update, delete, search, install/uninstall (global + project), import (folder/dialog/zip), export, symlink ops, external scan |
| Slash Commands | `src/services/slashCommand.ts` | `store.rs` | Mirrors skill.ts for slash commands |
| Settings | `src/services/settings.ts` | `store.rs` | `settingsGet`, `settingsSet`, `DEFAULT_THIRD_PARTY_REPOS` |
| Projects | `src/services/project.ts` | `store.rs` | list, create, update, delete |
| Backup Source | `src/services/backupSource.ts` | `store.rs` | status, connect, pull, push, bootstrap, import from repo source |
| Library Repo | `src/services/repo.ts` | `store.rs` | preflight, connect, status, pull, push, sync |
| Repo Sources | `src/services/repoSource.ts` | `repo_sources.rs` | sync, delete, list-skills |
| GitHub | `src/services/github.ts` | Pure frontend | REST API client, auto-detects repo layout, parses frontmatter, 10-min cache |
| Marketplace | `src/services/marketplace.ts` | `marketplace.rs` | loadFeed, importFromMarket |
| Registry | `src/services/registry.ts` | `registry.rs` | search, fetchContent, install |
| Resources | `src/services/resource.ts` | `store.rs` | resourceList, checkSourceUpdates, checkInstallUpdates, applySourceUpdate, applyInstallRefresh |
| Updater | `src/services/updater.ts` | `updater.rs` | checkAppUpdate, downloadAndInstallUpdate, getCurrentVersion |

---

## Key Domain Concepts

### Resource Model

The central entity is `Resource`, which can be a skill, slash command, prompt, or agents file:

```rust
struct Resource {
    id: String,              // UUID v4
    slug: String,            // URL-safe identifier (slugify())
    title: String,
    kind: ResourceKind,      // Skill | SlashCommand | Prompt | Agents
    scope: ResourceScope,    // Global | Project
    origin: ResourceOrigin,  // Private | Vendor | ForkedVendor
    source_status: SourceStatus,
    content: String,         // SKILL.md / COMMAND.md content
    revision: String,        // SHA256 hash of content (compute_revision())
    upstream_revision: Option<String>,
    provenance: ProvenanceKind,  // Manual | FileImport | ExternalApp | Marketplace | RepoSource
}
```

### Symlink-Based Installation

Skills live in `{app_data}/skill-sources/{slug}/` with a `SKILL.md` file. Installation creates **symlinks** from CLI app directories to SkillSwitch source directories:

```
~/.claude/skills/my-skill  →  {app_data}/skill-sources/my-skill/
~/.codex/commands/my-cmd   →  {app_data}/command-sources/my-cmd/
```

Cross-platform:
- Unix: `std::os::unix::fs::symlink`
- Windows: `std::os::windows::fs::symlink_dir` (requires Developer Mode)

### Revision Tracking

Content is hashed with SHA256 via `compute_revision()`. `InstallRecord` tracks the revision at install time:

| Status | Meaning |
|---|---|
| `InSync` | Source and installed revision match |
| `Stale` | Source changed since install |
| `Diverged` | Both source and installed file diverged |
| `Missing` | Source or installed file is gone |
| `NotInstalled` | No install record |

### Persistence

Two JSON files:
1. **`library.json`** (in `.skill-switch/` inside repo root): `RepoLibrary` — all resources and project profiles (synced to backup)
2. **`local-state.json`** (in app data dir): `LocalState` — machine-specific bindings, install records, migration flags (not synced)

### Git Backup Sync

Every mutation automatically pushes to the configured Git backup source:

```
sync_after_mutation() → git add -A → git commit -m "{message}" → git push
```

- Push failures are **non-fatal** — the mutation still succeeds, backup sync status becomes "pending"
- On app startup, `backup_source_startup_sync` does a fetch/pull
- The backup uses a persistent clone directory for push/pull operations
- Git identity is auto-configured: `user.name=SkillSwitch`, `user.email=skill-switch@localhost`

### Skill Installation Paths

| Scope | App | Path |
|---|---|---|
| Global | Claude | `~/.claude/skills/{slug}` |
| Global | Codex | `~/.codex/skills/{slug}` |
| Global | Cursor | `~/.cursor/skills/{slug}` |
| Project | Claude | `{project}/.claude/skills/{slug}` |
| Project | Codex | `{project}/.codex/skills/{slug}` |

The backend handles path resolution and file operations. Frontend only specifies `skillId`, `projectPath`, and `apps` list.

### Import System

| Import Method | Backend Function | Provenance |
|---|---|---|
| Folder | `import_skill_from_folder` | `FileImport` |
| ZIP | `import_skill_from_zip` | `FileImport` |
| Dialog (Tauri) | `import_skill_from_dialog` | `FileImport` |
| Marketplace | `marketplace::import_skill_from_market` | `Marketplace` |
| Repo Source | `import_skill_from_repo_source` | `RepoSource` |
| Registry | `registry::install_registry_skill` | (external) |

All folder/ZIP imports validate SKILL.md exists, parse frontmatter, copy to `skill-sources/{slug}/`, create resource in library, set provenance, and sync backup.

### Third-Party Default Repos

- `anthropics/skills` — Anthropic official skills
- `ComposioHQ/awesome-claude-skills` — Community curated skills
- `openai/skills` — OpenAI official skills

---

## Key Patterns

### Adding a New Backend Command

1. Add domain types in `src-tauri/src/domain.rs` with `#[serde(rename_all = "camelCase")]`
2. Add corresponding TypeScript types in `src/types/index.ts`
3. Implement the command in `src-tauri/src/commands.rs` with `#[tauri::command]`
4. Register it in `src-tauri/src/lib.rs` in the `invoke_handler!` macro
5. Create a wrapper function in `src/services/<domain>.ts`
6. Use it from the appropriate React context

### Adding a New Page

1. Create component in `src/pages/`
2. Add the page ID to `PageId` type in `App.tsx`
3. Add a case in the `renderPage` switch
4. Add navigation item in `AppShell.tsx`

### Adding a New AI App

1. Add the app to `APP_LIST` in `src/context/AppContext.tsx` (id, name, accent color)
2. Add CLI directory alias in `store.rs` → `app_cli_dir_aliases()`
3. Add skills directory mapping in `registry.rs` → `get_app_skills_dir()`
4. Update install path routing in `store.rs` as needed

### Frontmatter Parsing

Multiple modules parse YAML frontmatter from `SKILL.md`/`COMMAND.md`:
- `store::parse_skill_front_matter` — name, description, tags, directories
- `repo_sources::parse_front_matter` — name, description, tags
- `registry::parse_frontmatter_name` — name only

All follow the `---\n...\n---\n` convention.

### Error Handling (Rust)

All Rust functions return `Result<T, String>`. No custom error types. Errors are composed with:
- `map_err(|e| e.to_string())`
- `format!("...: {}", e)`

The `String` error type propagates naturally through the Tauri IPC layer to the frontend.

### Async Pattern (Rust)

Mutating commands use `run_blocking_command`:

```rust
async fn run_blocking_command<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| error.to_string())?
}
```

Read-only commands are synchronous.

---

## Runtime Behavior

- **Startup migration**: `migrate_copied_skills_to_symlinks` runs automatically to convert any previously copied skill directories into symlinks
- **Legacy migration**: If `skills.json` (v1) exists, it's auto-migrated to `library.json` (v2) on first run
- **Backup startup sync**: If a backup source is configured, `backup_source_startup_sync` fetches/pulls on launch
- **Theme sync**: `SettingsContext` listens to Tauri window theme changes and applies `data-theme` attribute
- **Auto-update check**: `UpdaterContext` checks for updates 3s after mount if `settings.autoCheckAppUpdates` is true

---

## CI/CD

| Workflow | Trigger | What It Does |
|---|---|---|
| `ci.yml` | Push/PR to main/develop | TypeScript type check (`tsc --noEmit`) + Rust clippy (`cargo clippy -- -D warnings`) |
| `pr-check.yml` | PR open/sync | TypeScript types + Rust format check (`cargo fmt --check`) + `console.log`/`debugger` warning in source |
| `release.yml` | Git tag (`v*.*.*`) | Build macOS (arm64 + x86_64), Linux, Windows; create GitHub draft release; publish |

---

## UI Design System

### Design Tokens (`src/styles/variables.css`)

- **Colors (OKLCH)**: `--canvas`, `--canvas-secondary`, `--surface`, `--ink`, `--ink-secondary`, `--accent`, `--accent-subtle`, `--success`, `--danger`, `--warning`, `--divider`
- **Typography**: `--font-display` (Manrope, 700 weight), `--font-body` (Manrope), `--font-mono` (IBM Plex Mono)
- **Type Scale**: `--text-xs` (11px) → `--text-2xl` (clamp 2rem–2.7rem)
- **Spacing**: `--space-0` through `--space-16` (0 to 4rem, 4px base unit)
- **Radius**: `--radius-xs` (2px) through `--radius-full` (9999px)
- **Shadows**: 5 levels (`--shadow-xs` through `--shadow-xl`) with light/dark variants
- **Animations**: `fadeIn`, `slideUp`, `slideIn`, `scaleIn`, `shimmer` keyframes
- **Transitions**: `--duration-instant` (50ms) → `--duration-slow` (320ms) with `--ease-out-expo`, `--ease-out-quart`
- **App brand colors**: `--app-claude: #2563eb`, `--app-codex: #7c3aed`, `--app-cursor: #0891b2`
- **Layout**: `--sidebar-width: 224px`, `--detail-min-width: 320px`

Light/dark themes via `prefers-color-scheme` and `[data-theme="dark"]`.

**Always use CSS custom properties — never hardcode colors, spacing, or typography values.**

### Design Principles

1. **Editorial Restraint**: Less is more — every element must earn its place. No decorative flourishes
2. **Typographic Hierarchy**: Use weight, size, and spacing — not color — to create hierarchy
3. **Warm Minimalism**: Neutral palette with intentional warmth. The amber/blue accent should feel refined, not playful
4. **Functional Density**: Information-rich but not cluttered. Optimize for scanning and quick comprehension
5. **Native Feel**: Behave like a native desktop app, not a web page. Monospace display font, system dark mode, keyboard-first, instant interactions
6. **Content as Interface**: Use color blocks and spacing to separate regions instead of heavy dividers
7. **Progressive Disclosure**: Primary info (name, badge) prominent; secondary info (source, metadata) subtle
8. **Consistent Patterns**: Same card style across all pages

### Category Color Palette

| Category | Background | Text Color |
|---|---|---|
| Git & CI/CD | `rgba(99, 102, 241, 0.10)` | `#6366f1` |
| 调试 (Debug) | `rgba(249, 115, 22, 0.10)` | `#f97316` |
| 安全 (Security) | `rgba(239, 68, 68, 0.10)` | `#ef4444` |
| 数据库 (Database) | `rgba(34, 197, 94, 0.10)` | `#22c55e` |
| AI / LLM | `rgba(139, 92, 246, 0.10)` | `#8b5cf6` |

### Icon Color Generation

Colors are derived from item name: `palettes[name.charCodeAt(0) % palettes.length]` using 8 preset palettes (indigo, green, red, cyan, orange, pink, violet, sky).

### Styling Rules

- **CSS Modules** for all component styling (`.module.css` files)
- Use `composes` for shared styles when beneficial
- No inline styles; no Tailwind; no CSS-in-JS
- Animations should be fast (120–200ms), functional, not theatrical
- No loading spinners — use skeletons or nothing for local data
- Empty states: simple message + optional action, no illustrations
- Card component: soft container, subtle border + shadow (14px radius), icon container (42x42px, 12px radius), semantic badge, floating action button (32px circular)
- Sidebar: 224px width, section titles in caps/tracking-wide/muted, active item with accent bg

### What to Avoid in UI

- No playful elements (confetti, celebrations, emoji in UI, illustration-style empty states)
- No dark patterns (automatic data collection, upsell prompts, forced onboarding)
- No web conventions that clash with native (hamburger menus, "click here" links, toast for routine actions)
- No visual noise (badges for everything, colored status indicators unless critical, gradient backgrounds)
- No slow animations (500ms+), bounce effects, gradient animations, particle effects

---

## Important Constraints

- **No test suite** — be extra careful with type safety and manual verification
- **Type sync is manual** — `src/types/index.ts` and `src-tauri/src/domain.rs` must be kept in sync by the developer
- **Backup sync is automatic** — every mutation triggers a git push; don't break this flow
- **Symlinks are critical** — installation/uninstallation must maintain symlink integrity
- **Cross-platform** — code must work on macOS, Linux, and Windows (especially symlink creation)
- **No router** — page state is managed via `PageId` in `App.tsx`
- **Error handling in Rust** — all functions return `Result<T, String>`, no custom error types
- **Git operations** — shell out to `git` CLI, not git2 crate; ensure `git` is available
- **Frontmatter convention** — SKILL.md uses YAML frontmatter (`---` delimited) for metadata
- **No console.log/debugger** — CI warns on these in source files; remove before committing
