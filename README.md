# HUMAIN Chat (Obsidian Plugin)

A persistent, aesthetic chat sidebar prepared for agentic workflows.

## Install

```
npm install
```

## Dev (watch)
```
npm run dev
```

## Build
```
npm run build
```

## Manual load into Obsidian
Copy `main.js`, `manifest.json`, and `styles.css` to your vault:
```
<Vault>/.obsidian/plugins/humain-chat/
```
Then reload plugins in Obsidian and enable "HUMAIN Chat".

## OpenAI integration

- Endpoint: `POST /v1/chat/completions`
- Docs (Chat Completions API): https://platform.openai.com/docs/api-reference/chat
- Models (see availability): https://platform.openai.com/docs/models
- Authentication: Bearer API key (`Authorization: Bearer <key>`)

Settings → HUMAIN Chat:
- API key (temporary dev OK)
- Model (e.g. `gpt-4o-mini`; use `gpt-5-chat` when generally available)
- Optional base URL for compatible gateways

