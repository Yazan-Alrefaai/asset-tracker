# Asset Tracker · متتبع الأصول

A private, offline-first desktop app to track **gold, silver, crypto, currencies, stocks/ETFs** and anything else you own.
Record what you paid, see **live prices**, and see your **profit/loss in US dollars and Syrian pounds**. Arabic and English.

[العربية ↓](#بالعربية)

## Features

- **Every buy and sell**: price paid, fees, gold making charge, date, notes, and where it is kept.
- **Average cost and profit/loss** in USD and SYP. Each purchase stores that day's dollar rate, so profit is honest even when the pound moves.
- **Live prices** with automatic refresh and backup sources. The last prices are saved, so the app still works offline or during power cuts.
- **Built for Syria**:
  - Market USD→SYP rate (buy/sell) and Syrian gold prices per karat from [sp-today.com](https://sp-today.com).
  - New and old Syrian pounds: old amounts are converted automatically (÷100).
  - Gold by gram, ounce or coin, karats 24/22/21/18/14, with making charge.
  - Your dollars are valued at the rate an exchange office would pay you.
- **Personal and business portfolios**, shown separately or together.
- **Dashboard**: total value, allocation, value over time, and all holdings.
- **Your own price** for anything (property, a car, a business share, or the local price of an item).
- **Arabic and English**, right-to-left layout, dark and light themes, and a "hide numbers" button.
- **Backups**: an automatic daily copy, JSON export/import, and CSV export for Excel.

New in 0.2:

- **Price alerts**: get a system notification when gold, the dollar rate, a coin, a stock or your total value goes above or below your price. Alerts can fire once or every time the price crosses.
- **Menu bar prices** (Mac) / **tray** (Windows): e.g. `USD 152.5 · 21K 15,550 · BTC 60.9K` at the top of the screen. You choose what it shows. Closing the window keeps the app running there, so alerts keep working.
- **Zakat calculator**: gold (85 g) or silver (595 g) nisab, optional worn jewelry, debts, and per-asset choices. Results are in USD and SYP, plus zakat in kind for gold. It is a calculator, not a fatwa.
- **Pop-out widgets**: small always-on-top windows for your total value, live prices or one asset. They remember where you put them.

## Price sources (all free, no API key)

| What | Source | Backup |
|---|---|---|
| Gold & silver (world) | gold-api.com | Swissquote |
| USD→SYP market rate, Syrian gold per karat | sp-today.com (public page, every 15 min) | your own rate |
| Crypto | CoinGecko | Binance |
| Stocks & ETFs (SPY, VOO…) | Yahoo Finance | — |
| World currencies | ExchangeRate-API | Frankfurter (ECB) |

The app reads only sp-today's public page, never its private API, and shows the source on screen.
Prices can be delayed or wrong. This app is for tracking only and is not financial advice.

## Install

Download the latest build from **Releases** (or from the latest run of **Actions → Build desktop apps**):

- **Mac**: `Asset Tracker_x.y.z_universal.dmg` works on Apple Silicon and Intel Macs.
  The app is not signed with a paid Apple certificate, so the first time you open it:
  1. Drag the app to Applications and open it. macOS says it cannot verify the developer.
  2. Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.
- **Windows**: run the `.exe` installer.

## Your data stays on your computer

All data is in one SQLite file in your user folder, never in this repository:

- macOS: `~/Library/Application Support/com.assettracker.desktop/asset-tracker.db`
- Windows: `%APPDATA%\com.assettracker.desktop\asset-tracker.db`

A copy is made every day in the `backups` folder next to it, and the last 14 are kept.
Nothing is sent anywhere except the price requests listed above.

## Build from source

You need Node.js 20+ and Rust ([tauri.app prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev     # run the desktop app
npm run dev           # browser demo at http://localhost:1420 (data saved in the browser)
npm test              # unit tests
npm run tauri build   # installers in src-tauri/target/release/bundle
```

The app is **Tauri 2** (small native app), **React + TypeScript**, **Tailwind CSS**, and **SQLite**.
Most of the logic is TypeScript in `src/lib` (calculations, price parsers, database), with unit tests next to it.

## Roadmap

- Real macOS desktop widgets (WidgetKit)
- Price history charts for each asset
- Optional sync between your own computers

## License

MIT. Contributions are welcome.

---

## بالعربية

تطبيق مكتبي خاص يعمل دون إنترنت لمتابعة **الذهب والفضة والعملات الرقمية والعملات والأسهم** وأي شيء تملكه.
سجّل السعر الذي دفعته، وتابع **الأسعار المباشرة**، واعرف **ربحك أو خسارتك بالدولار والليرة السورية**.

### المزايا

- **كل عملية شراء وبيع**: السعر المدفوع، الرسوم، أجور الصياغة، التاريخ، الملاحظات، ومكان الحفظ.
- **متوسط التكلفة والربح/الخسارة** بالدولار والليرة. كل عملية تحفظ سعر الدولار في يومها، فيبقى الربح صحيحاً حتى لو تغيّرت الليرة.
- **أسعار مباشرة** مع مصادر احتياطية. تُحفظ آخر الأسعار ليعمل التطبيق دون إنترنت أو أثناء انقطاع الكهرباء.
- **مصمم لسوريا**:
  - سعر الدولار في السوق (شراء/مبيع) وأسعار الذهب السوري حسب العيار من موقع الليرة اليوم (sp-today.com).
  - الليرة الجديدة والقديمة: تُحوَّل المبالغ القديمة تلقائياً (÷100).
  - الذهب بالغرام أو الأونصة أو بالقطعة، عيار 24/22/21/18/14، مع أجور الصياغة.
- **محفظة شخصية ومحفظة للعمل**، كل واحدة وحدها أو معاً.
- **عربي وإنكليزي**، من اليمين لليسار، وضع داكن وفاتح، وزر لإخفاء الأرقام.
- **نسخ احتياطي**: نسخة تلقائية يومية، وتصدير واستيراد JSON، وتصدير CSV لبرنامج Excel.
- **جديد في 0.2**:
  - **تنبيهات الأسعار**: إشعار عندما يتجاوز الذهب أو سعر الدولار أو عملة رقمية أو سهم أو قيمة أصولك سعراً تختاره.
  - **الأسعار في شريط القوائم** على الماك (وقرب الساعة على ويندوز). عند إغلاق النافذة يبقى التطبيق يعمل هناك لتستمر التنبيهات.
  - **حاسبة الزكاة**: نصاب الذهب (85 غ) أو الفضة (595 غ)، مع خيار الحلي والديون. للتقدير فقط وليست فتوى.
  - **نوافذ صغيرة** تبقى فوق النوافذ: القيمة الإجمالية أو الأسعار المباشرة أو أصل واحد.

### التثبيت على الماك

حمّل ملف `.dmg` من صفحة **Releases**، ثم:

1. اسحب التطبيق إلى مجلد Applications وافتحه. سيقول macOS إنه لا يستطيع التحقق من المطوّر.
2. افتح **إعدادات النظام ← الخصوصية والأمن**، وانزل للأسفل، واضغط **فتح على أي حال**.

### بياناتك على جهازك فقط

كل البيانات في ملف واحد على جهازك، وليست في هذا المستودع. لا يُرسل أي شيء إلى أي مكان عدا طلبات الأسعار.

الأسعار قد تتأخر أو تكون غير دقيقة. هذا التطبيق للمتابعة فقط وليس نصيحة مالية.

رخصة MIT. المساهمات مرحّب بها.
