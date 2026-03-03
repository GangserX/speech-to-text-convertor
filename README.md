# Voice Scribe

A real-time speech-to-text transcription app powered by Groq's Whisper models. Record audio from your microphone and get instant transcriptions — right in the browser.

Built with **Angular 21** and **Tailwind CSS**. No backend required.

## Features

- **Two transcription modes:**
  - **Turbo** — Uses `whisper-large-v3-turbo` for fast, near-instant transcription
  - **Complex** — Uses `whisper-large-v3` for higher accuracy on longer speech
- **One-tap recording** — Click to record, click to stop and transcribe
- **Copy to clipboard** — Quickly copy the transcript text
- **Responsive UI** — Clean, modern design with Tailwind CSS
- **No backend** — All API calls happen directly from the browser via Groq's REST API

## Tech Stack

- Angular 21 (standalone components, signals)
- Tailwind CSS 4
- Groq API (Whisper Large V3 / V3 Turbo)

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Clone the repository:
   ```bash
   git clone https://github.com/GangserX/speech-to-text-convertor.git
   cd speech-to-text-convertor
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Set your Groq API keys in `.env.local`:
   ```
   GROQ_API_KEY_TURBO=your_turbo_key_here
   GROQ_API_KEY_COMPLEX=your_complex_key_here
   ```

4. Update `angular.json` with your keys in the `define` section.

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This is a fully static app — deploy the `dist/` folder to any static hosting:

- **Cloudflare Pages** (recommended — unlimited free bandwidth)
- **Vercel**
- **Netlify**
- **GitHub Pages**

Build for production:
```bash
npm run build
```

Output will be in the `dist/` directory.

## License

MIT
