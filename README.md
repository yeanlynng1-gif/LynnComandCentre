# Mystic Blessings Command Centre

A single-file planning and client tracker for Lynn at Mystic Blessings. Open `index.html` in a browser; it needs no build step or external packages.

## What it does

- Tracks enquiries, booking stages, payment verification, appointments, and follow-ups.
- Shows the next client or event task that needs attention.
- Contains the Christmas 2026 event strategy, two-hour run sheet, promotion sequence, and booking checklist.
- Saves event decisions and estimates ticket break-even and a ticket price that includes desired earnings.
- Offers WhatsApp message starters to copy and personalize.
- Exports and imports a JSON backup.

## Data and payments

Records are saved in this browser's local storage. They are not sent to GitHub or a server by this app. Use **Export backup** regularly, especially before clearing browser data or moving to another device.

If you open the app from GitHub Pages, that web address has separate browser storage from the local `index.html` file. Export from the local app and import the backup into the web version if you want to move your records.

The app prepares WhatsApp text; Lynn sends messages and the QR image herself. Mark a booking confirmed only after checking that payment arrived.

Do not commit exported backup JSON files containing client information to this repository.

## Optional hosting

Because the entry file is named `index.html`, the repository can be served as a static site with GitHub Pages from the repository root. No build process is needed.
