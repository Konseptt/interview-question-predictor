# Interview Question Forecaster

Retro-styled interview preparation app built with Next.js.

Paste a job description and generate likely interview questions with:

- answer frameworks
- red flags to avoid
- export and copy actions
- standard and streaming generation modes

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Add your NVIDIA API key to `.env.local`:

```env
NVIDIA_API_KEY=your_key_here
```

## Development

Run the app locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` – start development server
- `npm run lint` – run ESLint
- `npm run build` – build production output
- `npm run start` – run production server

## Security Notes

- API keys are read from environment variables only.
- `.env*` files are git-ignored by default.
- Request size and timeout guards are applied for NVIDIA API calls.
