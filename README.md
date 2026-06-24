# 🚀 LinkedIn Auto-Posting AI Agent

A completely free, lightweight, open-source tool that automates authentic, viral-worthy LinkedIn posts about AI and tech.

## Features
- **Scrapes 6 sources:** GitHub, Hacker News, Reddit, arXiv, Hugging Face, RSS
- **Viral Engine:** Uses proven hook templates, 1-3-1 formatting, and dwell-time optimization
- **Anti-Slop:** Specifically prompted LLM (Gemini) that refuses to say "In today's rapidly evolving landscape..."
- **Algorithm Optimized:** 2-comment workaround for links, afternoon scheduling, niche authority tracking.
- **100% Free Stack:** SQLite local DB, Gemini free tier, Unsplash free tier. No cloud costs.

## Setup

1. **Clone the repo**
2. **Install dependencies:** `npm install`
3. **Configure Environment:**
   Copy `.env.example` to `.env` and fill out the keys.
   - You need a free Gemini API key: https://aistudio.google.com/
   - You need a free Reddit Script App: https://www.reddit.com/prefs/apps
4. **LinkedIn OAuth Setup:**
   Run `npm run setup` and follow the localhost instructions to get your tokens.
5. **Test the Pipeline:**
   Run `npm run dry-run` to see what it generates without posting.

## Commands

- `npm start` - Starts the background cron scheduler
- `npm run post` - Triggers an immediate post right now
- `npm run dry-run` - Runs the pipeline and prints the post to console without publishing
- `npm run setup` - Starts the LinkedIn OAuth helper server

## License
MIT
