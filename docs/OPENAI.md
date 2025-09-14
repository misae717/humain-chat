# OpenAI Chat Integration

- API docs (Chat Completions): https://platform.openai.com/docs/api-reference/chat
- Models: https://platform.openai.com/docs/models
- Authentication: Bearer token via `Authorization: Bearer <API_KEY>`
- Endpoint: `POST https://api.openai.com/v1/chat/completions`

Example request body:
```json
{
  "model": "gpt-5-chat",
  "messages": [
    {"role": "system", "content": "You are HUMAIN Chat inside Obsidian."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false,
  "temperature": 0.3
}
```

Notes:
- For development you can use a temporary key. Store it in plugin settings.
- To change model or base URL, use the plugin settings in Obsidian.
- When `gpt-5-chat` is broadly available, set the Model accordingly.
