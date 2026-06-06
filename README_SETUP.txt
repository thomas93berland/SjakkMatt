CHESS LOUNGEN - RYDDET FILSTRUKTUR

Last opp filene til GitHub-repoet ditt med samme struktur:

index.html
home.html
play.html
profile.html
firebase-rules.json
css/style.css
js/firebase-config.js
js/auth.js
js/home.js
js/play.js
js/profile.js

VIKTIG:
1. Lim inn innholdet fra firebase-rules.json i Firebase Console:
   Realtime Database -> Rules -> Publish

2. Test med cache-busting etter opplasting:
   https://thomas93berland.github.io/SjakkMatt/index.html?v=20
   https://thomas93berland.github.io/SjakkMatt/home.html?v=20
   https://thomas93berland.github.io/SjakkMatt/play.html?v=20
   https://thomas93berland.github.io/SjakkMatt/profile.html?v=20

NYTT I DENNE VERSJONEN:
- Registrerte spillere får Inviter-knapp på hjemmesiden.
- Mottaker får invitasjon med Godta og Avslå.
- Når invitasjon sendes, randomiseres hvem som blir hvit og svart.
- Når noen blir med via vanlig romkode, randomiseres også hvit/svart.
- Ved godta sendes mottaker direkte til play.html?room=ROMKODE.
- Avslått invitasjon vises for inviteren i spillerommet.

TEST AV INVITASJON:
1. Logg inn med bruker A.
2. Gå til home.html.
3. Trykk Inviter på bruker B.
4. Bruker A sendes til spillerommet og venter.
5. Logg inn med bruker B på en annen enhet eller nettleser.
6. Bruker B ser invitasjon på home.html.
7. Bruker B trykker Godta.
8. Begge spiller med randomisert hvit/svart.

TEST AV VANLIG ROMKODE:
1. Bruker A åpner play.html og trykker Lag nytt rom.
2. Bruker B skriver romkoden og trykker Bli med.
3. Hvit og svart trekkes tilfeldig når bruker B blir med.

Fast spill-side:
- play.html har body class="play-page".
- css/style.css låser play.html til 100dvh og skjuler sidescroll.
- På små skjermer skjules trekklisten mens du spiller, slik at brett og lobby får plass uten at hele siden skroller.
