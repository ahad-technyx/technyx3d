# Pay10 Chatbot — How It Works (Gemini-backed)

A complete reference for the floating chatbot in the bottom-right of the page.
It calls Google's Gemini API directly from the browser using a key stored in
`localStorage`. Gemini has a generous free tier, so the demo runs at zero cost.

---

## 1. What it does

- Floating gold launcher button in the bottom-right.
- Click → a chat panel pops up with a greeting.
- **First time only** → a small setup card asks for a Google Gemini API key.
  The key is saved to `localStorage` under `pay10-gemini-key`.
- Every message the user sends — typed or via a suggestion chip — is POSTed
  to Gemini's `generateContent` endpoint with the full conversation history
  and a Pay10-grounded system prompt. The reply is rendered as a bot bubble.
- Invalid-key responses clear the saved key and re-show the setup card.

No backend. No proxy. The key never leaves the browser except in the request
to `generativelanguage.googleapis.com`.

---

## 2. Where the code lives

| Concern                | File / Location                                                |
| ---------------------- | -------------------------------------------------------------- |
| HTML markup            | `index.html` — the `<aside id="chatbot">` block                |
| All JS logic           | `index.html` — the inline `<script>` block right after it      |
| Styles                 | `src/style.scss` — the "Chat bot widget" section + `.chatbot__setup` |

`src/main.js` does **not** contain chatbot logic. Everything is inlined so it
runs the moment the parser hits the script — no module/bundler dependency.

---

## 3. Getting a Gemini API key

1. Visit https://aistudio.google.com/apikey (sign in with a Google account).
2. Click **Create API key** → optionally pick a Google Cloud project.
3. Copy the key (starts with `AIza...`).
4. Paste it into the chatbot's setup card.

The free tier covers a few thousand requests per day with `gemini-2.0-flash`,
which is plenty for this demo. No card required.

---

## 4. API configuration

Defined at the top of the inline script:

```js
var STORAGE_KEY = 'pay10-gemini-key';                  // localStorage key
var MODEL       = 'gemini-2.0-flash';                  // free tier, fast
var API_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/'
                  + MODEL + ':generateContent';
var MAX_TOKENS  = 500;                                  // cap reply length
var MAX_HISTORY = 12;                                   // turns kept in context
```

To upgrade quality, swap `MODEL` to `gemini-2.5-flash` or `gemini-2.5-pro`
(still free tier, just slower / more capable).

### Auth + request format

Gemini takes the key as a URL query parameter:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIza...
Content-Type: application/json

{
  "contents": [
    { "role": "user",  "parts": [{ "text": "How do I send money?" }] },
    { "role": "model", "parts": [{ "text": "Tap Send → ..." }] },
    { "role": "user",  "parts": [{ "text": "What about fees?" }] }
  ],
  "systemInstruction": {
    "parts": [{ "text": "<the Pay10 system prompt>" }]
  },
  "generationConfig": {
    "maxOutputTokens": 500,
    "temperature": 0.6
  }
}
```

Notes vs other providers:

- `role` for the assistant is **`model`** (not `assistant`).
- Each turn wraps text in `parts: [{ text }]` (not a plain string).
- The system prompt is its own top-level field `systemInstruction`, separate
  from `contents`.
- Auth is in the URL, not headers.

### Response shape

```json
{
  "candidates": [
    {
      "content": { "parts": [{ "text": "..." }], "role": "model" },
      "finishReason": "STOP"
    }
  ]
}
```

We extract `data.candidates[0].content.parts[0].text`. If Gemini blocks the
prompt for safety reasons, the response will have `promptFeedback.blockReason`
and no text — we surface a friendly "I can't reply to that" message.

---

## 5. The system prompt

Lives in the inline script as `SYSTEM_PROMPT`. It grounds Gemini in Pay10
facts (licensing, currencies, fees, limits, onboarding, Biz product, supported
bill payments, support availability) and asks for concise, friendly answers.

To tweak the bot's tone or facts, edit the array of strings assembled into
`SYSTEM_PROMPT`. No build step needed for the dev server — just refresh.

---

## 6. The flow

1. User clicks the launcher → `data-state="open"`, `greetOnce()` runs.
2. `greetOnce()` posts a welcome bot bubble. If no key is in `localStorage`,
   it appends the `.chatbot__setup` card asking for one.
3. User enters key, hits **Save & start**. Key is stored. The setup card is
   removed and replaced by a "Connected" bot bubble.
4. User types a question (or clicks a chip) → `sendMessage(text)`.
5. `sendMessage`:
   - Renders the user bubble.
   - Renders the 3-dot typing indicator.
   - Disables the input + send button.
   - Calls `callGemini(text)`.
6. `callGemini`:
   - Appends the user turn to `history` (in Gemini's wire format), trims to
     `MAX_HISTORY`.
   - `POST`s to the Gemini endpoint with the key in the query string.
   - On success → appends the model turn to `history`, returns the text.
   - On 400/401/403 with an "API key" message → calls `clearKey()` and
     returns `{ error: 'auth' }`.
   - On 429 → returns a "rate limit hit" message (key preserved).
   - On other failures → returns `{ error: 'api' | 'network', message }`.
7. `sendMessage` removes the typing indicator, re-enables input, renders the
   reply (or the error as a bot bubble), and re-focuses the input.

---

## 7. UI states

- **No key, panel open** → welcome bubble + setup card.
- **Setup card visible** → user pastes key + clicks **Save & start** OR
  presses Enter. Empty submissions are ignored.
- **Key rejected** → key is wiped, an error bubble appears, and the setup
  card re-renders so the user can retry.
- **Rate-limit hit (429)** → an error bubble appears; the key is preserved.
- **Safety block** → a bubble explains the reason and asks the user to
  rephrase; conversation continues normally.
- **Awaiting response** → input + send button are disabled; typing dots show.

---

## 8. Suggestion chips

The five chips in the panel footer (`How do I send money?`, etc.) used to
map to canned topics via `data-question`. Now they simply send their visible
text to Gemini as if the user had typed it:

```js
chip.addEventListener('click', function () {
  sendMessage(chip.textContent.trim());
});
```

The `data-question` attribute is kept for backwards-compat but no longer used
for routing — Gemini generates the response from the system prompt + chip text.

---

## 9. Extending it

### Use a different model

Change `MODEL` in the inline script. Examples:

```js
var MODEL = 'gemini-2.0-flash';   // current default — fast, free
var MODEL = 'gemini-2.5-flash';   // higher quality, still free
var MODEL = 'gemini-2.5-pro';     // strongest reasoning, slower
```

### Tighten or loosen the bot's persona

Edit `SYSTEM_PROMPT`. Add new facts, change tone instructions, add
do/don't rules. The bot follows it on every turn.

### Add a new suggestion chip

Add a button inside `<div class="chatbot__suggestions">`:

```html
<button class="chatbot__chip" data-question="cards">Pay10 cards</button>
```

The chip's text is what's sent to Gemini when clicked.

### Reset the stored key from devtools

```js
localStorage.removeItem('pay10-gemini-key')
```

Then refresh — the setup card will reappear on first message.

---

## 10. Security notes

- **The API key is visible to anyone who can access the user's browser**
  (DevTools → Application → Local Storage). This is fine for a personal demo
  or local dev environment. **Do not ship this pattern to production with a
  shared key** — anyone who views the page source plus your localStorage
  could exfiltrate it and rack up usage on your quota.
- For a public deployment, replace the direct `fetch` with a call to a small
  serverless proxy (Cloudflare Worker / Vercel function) that holds the real
  key server-side. The frontend then doesn't need a key at all.
- Gemini's free tier has per-day quotas; abuse will rate-limit (429) before
  it costs you anything. Still — treat the key as a secret.

---

## 11. Files touched by this feature

| File             | What's there                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `index.html`     | Markup + the inline Gemini-calling script                          |
| `src/style.scss` | "Chat bot widget" section + `.chatbot__setup` card styles          |
| `src/main.js`    | Just a comment pointing here — no chatbot logic in main.js         |
