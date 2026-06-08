THE CHESS LOUNGE - PLAY DEBUG V12

Denne pakken er laget fordi diagnose viser at lokale filer lastes,
men spillbrettet blir stående som brun flate.

Endringer:
- play.html viser et boot-brett umiddelbart før hovedappen starter
- play.html viser JavaScript/Firebase-feil direkte nederst på skjermen
- app-v12.js markerer at appen faktisk startet
- app-v12.js har auth-watchdog hvis Firebase/innlogging henger
- pieces.css har liten sikkerhetsregel

Last opp/erstatt:
play.html
app-v12.js
pieces.css

Test:
https://thomas93berland.github.io/SjakkMatt/play.html?v=debug12

Hva vi forventer:
1. Du skal se sjakkbrettet med ruter og brikker med én gang.
2. Hvis hovedappen feiler, kommer feilen nederst på skjermen.
3. Send skjermbilde av feilen hvis den vises.
