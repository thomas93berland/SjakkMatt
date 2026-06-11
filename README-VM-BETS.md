# VM Bets Lounge

En enkel VM-tippekamp-modul til The Chess Lounge.

## Filer

- `vm-bets.html` — brukersiden der venner tipper på VM-kamper
- `vm-bets.css` — lounge-design
- `vm-bets.js` — betting, saldo og leaderboard
- `vm-admin.html` — adminpanel for kamper/resultater
- `vm-admin.js` — adminlogikk og utbetaling
- `firebase-config.js` — din Firebase-konfig
- `firebase-rules-vm-bets.txt` — forslag til Firestore Rules

## Slik bruker du filene

1. Last filene opp i GitHub-repoet ditt.
2. Lim inn Firebase-konfigen din i `firebase-config.js`.
3. Aktiver Authentication i Firebase.
4. Slå på Anonymous Authentication, eller koble dette til eksisterende login.
5. Opprett Firestore Database.
6. Legg inn reglene fra `firebase-rules-vm-bets.txt`.
7. Åpne `vm-admin.html` for å legge inn kamper.
8. Åpne `vm-bets.html` for å tippe.

## Viktig

Dette bruker kun falsk valuta:

- Ingen ekte penger.
- Ingen kjøp av coins.
- Ingen uttak.
- Ingen premier med økonomisk verdi.
