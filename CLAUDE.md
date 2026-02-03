# CLAUDE.md - Project Initialization Schema

```json
{
  "paths": {
    "project": "PROJECT.org",
    "docs": "docs/",
    "plans": "docs/plans/",
    "tests": "tests/",
    "src": "src/"
  },
  "prerequisites": {
    "plugins": [
      {
        "name": "superpowers-marketplace",
        "marketplace": "MCP",
        "url": "https://github.com/obra/superpowers-marketplace",
        "why": "workflow automation",
        "required": true
      },
      {
        "name": "context7",
        "marketplace": "MCP",
        "url": "https://github.com/upstash/context7",
        "why": "query docs beyond cutoff",
        "required": false
      }
    ]
  },
  "prompt": {
    "states": {
      "brainstorming": {
        "style": "exploratory",
        "tone": "collaborative",
        "preferences": [
          "ask questions one at a time",
          "propose multiple approaches",
          "focus on understanding requirements"
        ]
      },
      "planning": {
        "style": "structured",
        "tone": "technical",
        "preferences": [
          "break down into clear steps",
          "identify dependencies",
          "consider edge cases"
        ]
      },
      "implementation": {
        "style": "concise",
        "tone": "professional",
        "preferences": [
          "avoid over-engineering",
          "follow existing patterns",
          "write minimal necessary code"
        ]
      },
      "debugging": {
        "style": "systematic",
        "tone": "analytical",
        "preferences": [
          "gather evidence first",
          "test hypotheses methodically",
          "verify fixes before claiming success"
        ]
      },
      "review": {
        "style": "thorough",
        "tone": "constructive",
        "preferences": [
          "check against requirements",
          "verify tests pass",
          "ensure code quality"
        ]
      }
    },
    "global": {
      "preferences": [
        "avoid emojis unless requested",
        "use org-mode for all documentation except CLAUDE.md",
        "include file:line references",
        "prefer parallel tool execution"
      ]
    }
  }
}
```
