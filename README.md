# Feel-Better Cashflow Dashboard

A personal finance dashboard for tracking income, expenses, cashflow, and quick money notes without turning budgeting into accounting homework.

![Cashflow dashboard screenshot](https://image.thum.io/get/width/1400/crop/900/https://f-finance.base44.app)

## 📖 Overview

Feel-Better Cashflow Dashboard, short form **F-finance**, is built for people who want a fast and forgiving way to understand their money.

The app focuses on:

- simple income and expense tracking
- monthly cashflow projection
- one-time and recurring record management
- quick capture from chat-style messages
- short, kind AI money feedback
- a clean dashboard that is easy to scan

It is not a full accounting system. It is a lightweight personal cashflow tool designed around everyday usage.

## ✨ Features

| Area | What it does |
|---|---|
| Dashboard | Shows this month's income, expense, net cashflow, recurring totals, recent records, and forecast balance. |
| Records | Adds, imports, edits, deletes, and separates monthly and one-time income/expense records. |
| CSV Import | Imports income and expense records from CSV templates. |
| Quick Capture | Converts short money messages into reviewable drafts before saving. |
| Bot Capture | Includes Telegram and Signal-style capture flows for sending money notes from chat. |
| Feel Better Mode | Reviews expected income and expense, then returns a short, humorous, kind money comment. |
| Guest Mode | Lets users try the app before registering, with temporary guest data. |
| Multi-currency UI | Lets users choose a display currency symbol and gives AI advice using the selected currency context. |
| Language | Supports English and Traditional Chinese UI text. |
| Tutorial Tips | Shows guided page tips for first-time users. |
| Money Weather | Uses subtle dashboard weather backgrounds to reflect cashflow mood. |

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React, Vite |
| Styling | Tailwind CSS, custom dashboard CSS |
| Backend | Base44 backend functions |
| Database | Base44 entities |
| AI | Hugging Face compatible inference API |
| Messaging | Telegram bot flow, Signal bridge flow |
| Charts / UI | Custom React components, Lucide icons |
| Testing | Vitest |

## 📁 Project Structure

```text
Feel-Better-cashflow-dashboard/
├── app/
│   ├── base44/
│   │   ├── entities/              # Base44 entity schemas
│   │   └── functions/             # Base44 backend functions
│   ├── src/
│   │   ├── api/                   # Base44 client and finance API wrapper
│   │   ├── components/            # Dashboard, forms, UI components
│   │   ├── lib/                   # Money logic, projections, CSV import, tests
│   │   ├── pages/                 # Auth, onboarding, dashboard pages
│   │   └── main.jsx               # React entry point
│   ├── package.json
│   └── vite.config.js
├── LICENSE
└── README.md
```

## 🚀 Getting Started

This repository contains the source code for a Base44 app.

You can run the React frontend locally for development, but full auth, database, backend functions, bot flows, and deployed app behavior require a configured Base44 project.

### Prerequisites

- Node.js
- npm
- A Base44 project if you want full backend/database functionality
- Optional API credentials for Hugging Face, Telegram, and Signal bridge features

### Installation

```bash
git clone https://github.com/kkkable/Feel-Better-cashflow-dashboard.git
cd Feel-Better-cashflow-dashboard/app
npm install
```

### Running the Frontend

```bash
npm run dev
```

The frontend uses the Base44 SDK client in:

```text
app/src/api/base44Client.js
```

For a real Base44 app, replace the placeholder app ID:

```js
appId: 'YOUR_BASE44_APP_ID'
```

## ⚙️ Configuration

Sensitive values are read from environment variables inside Base44 backend functions. Do not commit real tokens or secrets.

| Variable | Used for | Required |
|---|---|---|
| `HUGGINGFACE_ENABLED` | Enables Hugging Face AI review/parsing when set appropriately. | No |
| `HUGGINGFACE_API_TOKEN` / `HF_TOKEN` | Hugging Face inference access token. | For AI features |
| `HUGGINGFACE_MODEL` | Optional model override. | No |
| `HUGGINGFACE_INFERENCE_URL` | Optional custom inference endpoint. | No |
| `FEEL_BETTER_GUEST_TOKEN_SECRET` | Signs guest AI session tokens. | Recommended |
| `HUGGINGFACE_AUTH_RATE_LIMIT_MAX_REQUESTS` | Optional logged-in AI rate limit override. | No |
| `HUGGINGFACE_GUEST_RATE_LIMIT_MAX_REQUESTS` | Optional guest AI rate limit override. | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token. | For Telegram bot |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook validation secret. | For Telegram bot |
| `TELEGRAM_CHECKIN_SECRET` | Check-in scheduler validation secret. | For Telegram reminders |
| `SIGNAL_BRIDGE_SECRET` | Signal bridge/webhook validation secret. | For Signal bridge |

## 🧪 Testing

The project includes Vitest tests for finance logic, projections, CSV import, tutorial state, money formatting, quick capture parsing, and auth/guest flows.

```bash
cd app
npm test
```

## 📦 Deployment

The app is structured for Base44 deployment:

- `app/base44/entities/` defines the database entities.
- `app/base44/functions/` contains backend functions.
- `app/src/` contains the frontend.

Deployment requires your own Base44 workspace and configured secrets. This public repository does not include private deployment credentials, API keys, IP addresses, or production-only notes.

## 🗺️ Roadmap

Possible future improvements:

- [ ] Improve dashboard chart interactions.
- [ ] Add more CSV validation feedback.
- [ ] Add more bot message examples.
- [ ] Add more automated tests for Base44 function edge cases.
- [ ] Improve mobile layout polish.

## 🤝 Contributing

Contributions are welcome.

Good first areas to review:

- UI polish
- accessibility improvements
- test coverage
- CSV import edge cases
- clearer onboarding copy

Before opening a pull request:

```bash
cd app
npm test
npm run build
```

## 📄 License

This project is licensed under the MIT License.

See [LICENSE](LICENSE) for details.

## 🙋 Author

Created by **Sin Pui Keung**.

GitHub: [@kkkable](https://github.com/kkkable)
