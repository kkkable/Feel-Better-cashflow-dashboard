# Feel-Better Cashflow Dashboard

Feel-Better Cashflow Dashboard is a lightweight personal finance dashboard for people who want to understand their money without turning budgeting into homework.

It focuses on simple income and expense tracking, short cashflow projections, friendly AI money comments, and quick capture from chat-style inputs.

![Cashflow dashboard screenshot](https://image.thum.io/get/width/1400/crop/900/https://f-finance.base44.app)

## What It Does

- Tracks income and expenses with monthly and one-time records.
- Shows this month's income, expense, net cashflow, recurring income, and recurring expense.
- Forecasts cash balance using recurring records plus one-time records in their actual month.
- Separates monthly and non-monthly records for cleaner management.
- Imports records from CSV.
- Reviews quick-capture drafts before saving them.
- Supports Telegram and Signal style money messages.
- Includes a "Feel Better" mode that gives short, kind, humorous money feedback.
- Uses dashboard weather backgrounds as a subtle money-mood signal.
- Supports English and Traditional Chinese UI text.

## Why This Exists

Most finance apps ask users to behave like accountants.

This project takes the opposite direction: make money tracking fast, forgiving, and a little more human. The goal is not to replace full accounting software. The goal is to help normal users record spending quickly, understand cashflow, and feel less stressed when looking at their money.

## Main Screens

**Dashboard**  
Current-month cashflow, recurring totals, recent non-monthly records, category breakdown, and forecast balance.

**Record**  
Add, import, edit, delete, and manage income and expense records.

**Connect Bot**  
Connect Telegram or Signal style capture so users can send messages like `lunch 58`, `salary 30000`, or `I got 450 rebate from credit card`.

**Feel Better**  
Enter income and expense numbers, then get a short AI-style money check that stays kind and direct.

## Tech

- React
- Vite
- Tailwind CSS
- Base44 entities and backend functions
- Hugging Face compatible LLM calls
- Telegram and Signal quick-capture flows

## License

MIT
