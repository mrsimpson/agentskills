# Source Specifiers

A source specifier tells the installer where to fetch a skill from. They appear as values in the `agentskills` field of `package.json`.

Installation is powered by [Pacote](https://github.com/npm/pacote) — the same library npm uses — so specifier syntax follows npm conventions.

## GitHub Shorthand

```
github:<user>/<repo>/<path/to/skill>
github:<user>/<repo>/<path/to/skill>#<ref>
```

The path after the repo is the subdirectory containing `SKILL.md`.

```json
"git-workflow": "github:anthropics/agent-skills/skills/git-workflow"
"pinned-skill": "github:anthropics/agent-skills/skills/git-workflow#v1.2.0"
```

## Git URL

```
git+https://<host>/<repo>.git#<ref>
git+https://<host>/<repo>.git#<ref>::path:<subdir>
```

```json
"shared-skill": "git+https://github.com/myorg/skills.git#v2.1.0"
"skill-in-subdir": "git+https://github.com/myorg/skills.git#main::path:skills/my-skill"
```

The `#<ref>::path:<subdir>` suffix follows the [npm/pacote](https://github.com/npm/npm-package-arg) standard for git subdirectory specifications.

## Local Path

```
file:<relative-or-absolute-path>
```

```json
"custom-skill": "file:./team-skills/custom-workflow"
```

Useful for skills that live in the same repository as your project.

## Tarball URL

```
https://<url>.tgz
```

```json
"external-skill": "https://example.com/releases/my-skill-1.0.0.tgz"
```

## npm Package

```
<package-name>
<package-name>@<version>
@<scope>/<package-name>
```

```json
"published-skill": "@myorg/my-skill@^1.0.0"
```

::: tip npm package support
Skills published as npm packages must include a `SKILL.md` at the package root. This format follows the same versioning conventions as regular npm dependencies.
:::

## Summary Table

| Format | Example |
|---|---|
| GitHub shorthand | `github:user/repo/path/to/skill` |
| GitHub shorthand + ref | `github:user/repo/path/to/skill#v1.0.0` |
| GitHub with path attr | `github:user/repo#v1.0.0::path:skills/my-skill` |
| Git URL | `git+https://github.com/org/repo.git#v1.0.0` |
| Git URL + path | `git+https://github.com/org/repo.git#v1.0.0::path:skills/skill` |
| Local path | `file:./skills/custom-skill` |
| Tarball URL | `https://example.com/skill.tgz` |
| npm package | `@org/my-skill` or `my-skill@1.2.0` |
