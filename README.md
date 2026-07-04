# 💸 Feel-Better Cashflow Dashboard

A simple personal finance dashboard that makes cashflow tracking faster, clearer, and less stressful.

[![Live App](https://img.shields.io/badge/Live%20App-Open%20Dashboard-brightgreen)](https://feelbetter-cashflow-dashboard.base44.app/)

> Link: https://feelbetter-cashflow-dashboard.base44.app/



![Dashboard screenshot](docs/screenshots/guest_dashboard.png)

> **Feel-Better Cashflow Dashboard** is designed for people who want to understand their money without using a heavy accounting tool.
---

## 📖 Overview

Many finance apps are powerful, but they often ask users to behave like accountants. **Feel-Better Cashflow Dashboard** takes a simpler approach: record money quickly, review the important numbers, and fix details later when needed.

The dashboard focuses on everyday cashflow questions:

- 💰 How much money came in this month?
- 💸 How much went out this month?
- 📊 What is the net cashflow?
- 🔁 Which records are monthly, and which are one-time?
- 🔮 What could the next few months look like?
- ⚡ Can spending be recorded quickly without opening a complex form?

**The goal is to make money review feel lighter, calmer, and easier to continue.**

---

## 🚀 How to Use

Open the live app and try the dashboard in guest mode. You can add income or expense records, choose whether a record is monthly or one-time, and review your cashflow summary on the dashboard.

For **faster input**, you can also use the **Assistant Bot** page to turn short messages into an income/expense records. 

- 📲 **Record your expenses/income at any time.**

A tutorial is available inside the [![Live App](https://img.shields.io/badge/Live%20App-Open%20Dashboard-brightgreen)](https://feelbetter-cashflow-dashboard.base44.app/) to guide new users through the main features.

---

## ✨ Feature Highlights

| Feature | Description | Why It Matters |
|---|---|---|
| 👤 Guest mode | Try the dashboard before creating an account | Low-friction demo experience |
| 🧾 Simple / detailed record modes | Choose between quick input and more controlled entry | Supports both casual and careful tracking |
| 🔁 Monthly & one-time records | Separate recurring records from one-off transactions | Cleaner cashflow planning |
| 🔮 Cashflow projection | Forecast future months using recurring and one-time records | Helps users see upcoming money pressure |
| 🕘 Recent records | Highlights recent non-monthly income and expenses | Avoids overwhelming the dashboard |
| 📥 CSV import | Add many records from a CSV file | Faster migration and bulk testing |
| 🌍 Currency support | Supports HKD, USD, JPY, EUR, GBP, CNY, TWD, SGD, AUD, and CAD | Makes the dashboard more useful for users in different regions |
| 🈯 Traditional Chinese support | Switch between English and Traditional Chinese | More accessible for Hong Kong / Traditional Chinese users |
| 🤖 Chat-style capture | Convert natural money messages into draft records | Faster than manual forms for quick spending notes |
| 🌤️ Money weather | Uses simple visual feedback for cashflow condition | Makes finance review feel less intimidating |

---

## 🌍 Currency Support

Users can choose their preferred currency from the currency dropdown, making the dashboard easier to read in their own money context.

Supported currencies:

| Currency Code | Currency |
|---|---|
| HKD | Hong Kong Dollar |
| USD | US Dollar |
| JPY | Japanese Yen |
| EUR | Euro |
| GBP | British Pound |
| CNY | Chinese Yuan |
| TWD | New Taiwan Dollar |
| SGD | Singapore Dollar |
| AUD | Australian Dollar |
| CAD | Canadian Dollar |

The selected currency is used across the dashboard display and the **Feel Better Mode** advice context.

> Note: The currency selector changes the display currency/context. It does not imply live exchange-rate conversion unless that feature is added separately.

<!-- Optional screenshot: save the image as docs/screenshots/currency-selector.png, then uncomment the line below. -->
<!-- ![Currency selector](docs/screenshots/currency-selector.png) -->

---

## 🖥️ Dashboard

The dashboard gives users a quick view of their current money position.

### Key dashboard metrics

| Metric | Meaning |
|---|---|
| This month income | Total income recorded for the current month |
| This month expense | Total expense recorded for the current month |
| Net cashflow | Income minus expense |
| Savings rate | How much of the income remains after expenses |
| Recurring monthly income | Income that repeats monthly |
| Recurring monthly expense | Expenses that repeat monthly |
| Forecast projection | Future cashflow based on recurring and dated one-time records |
| Recent income / expense | Latest non-monthly records for quick review |
| Category breakdown | Spending/income grouping when enough data exists |

![Dashboard screenshot](docs/screenshots/dashboard-guest.png)

---

## 📝 Record Page

The Record page is where users add, review, edit, and delete money records.

| Function | Supported |
|---|---:|
| Quick income entry | ✅ |
| Quick expense entry | ✅ |
| Recurring monthly checkbox | ✅ |
| CSV import | ✅ |
| Edit records | ✅ |
| Delete records | ✅ |
| Monthly / non-monthly record views | ✅ |
| Pagination for larger lists | ✅ |

> The goal is to keep basic input fast while still allowing users to correct mistakes later.

---

## 🤖 Assistant Bot Page

The Assistant Bot page is built for fast money capture from chat-style messages.

> E.g. Record expense right after finishing your meal, buying stuff

Users can type natural messages such as:

```text
lunch 58
mtr 12 coffee 42
salary 30000
rent 15000 monthly
I get 450 rebate from credit card
Mom gave me 300 as red packet and I bought coffee for 50
```

> Instead of saving immediately, the bot flow turns messages into **draft records** first. Users can review and fix the draft before saving it.

![Connect Bot screenshot](docs/screenshots/connect-bot-guest.png)


| Platform | Supported |
|---|---:|
| Telegram | ✅ |
| Signal | ✅ |

---

## 😊 Feel Better Mode

**Feel Better Mode** is a lightweight AI money check. It gives the user short, kind, and practical feedback based on expected monthly income and expected monthly expense.

| Input | Output |
|---|---|
| Expected monthly income | A short cashflow comment |
| Expected monthly expense | A simple money-health interpretation |
| Selected currency context | Advice written with the matching currency feel |

> The response is intentionally short, direct, and sometimes humorous. It is not meant to be a long finance lecture — it is meant to make money review easier to start.

![Feel Better mode screenshot](docs/screenshots/feel-better-guest.png)

---

## 🧭 User Workflow

```mermaid
flowchart LR
    A[Open dashboard] --> B[Record income or expense]
    B --> C[Review cashflow numbers]
    C --> D[Check forecast]
    D --> E[Fix or update records]
    E --> F[Use bot capture when manual input feels slow]
```

A typical user flow is:

1. Open the app.
2. Record money quickly.
3. Review obvious cashflow numbers.
4. Check the forecast.
5. Fix mistakes later.
6. Use chat-style capture when manual input feels too slow.

---

## 🛠️ Built With

| Category | Technology |
|---|---|
| Frontend | React, Vite |
| Styling | Tailwind CSS, custom dashboard styles |
| Backend | Base44 backend functions |
| Database | Base44 entities |
| AI | Hugging Face compatible inference |
| Bot flows | Telegram and Signal-style capture |
| Language support | English, Traditional Chinese |
