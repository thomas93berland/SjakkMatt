import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const matchForm = document.querySelector("#matchForm");
const adminMatchesList = document.querySelector("#adminMatchesList");
const refreshBtn = document.querySelector("#refreshBtn");

function formatDate(value) {
  if (!value) return "Tidspunkt kommer";
  const date = value.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("no-NO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

async function ensureSignedIn() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

async function addMatch(event) {
  event.preventDefault();

  const homeTeam = document.querySelector("#homeTeam").value.trim();
  const awayTeam = document.querySelector("#awayTeam").value.trim();
  const startTimeValue = document.querySelector("#startTime").value;

  const oddsHome = Number(document.querySelector("#oddsHome").value);
  const oddsDraw = Number(document.querySelector("#oddsDraw").value);
  const oddsAway = Number(document.querySelector("#oddsAway").value);

  if (!homeTeam || !awayTeam || !startTimeValue) {
    alert("Fyll inn lag og starttid.");
    return;
  }

  await addDoc(collection(db, "matches"), {
    homeTeam,
    awayTeam,
    startTime: Timestamp.fromDate(new Date(startTimeValue)),
    oddsHome,
    oddsDraw,
    oddsAway,
    status: "open",
    result: "",
    paidOut: false,
    createdAt: serverTimestamp()
  });

  matchForm.reset();
  document.querySelector("#oddsHome").value = "2.10";
  document.querySelector("#oddsDraw").value = "3.30";
  document.querySelector("#oddsAway").value = "2.80";

  await loadAdminMatches();
}

async function loadAdminMatches() {
  adminMatchesList.innerHTML = `<p class="empty">Laster kamper...</p>`;

  const q = query(collection(db, "matches"), orderBy("startTime", "asc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    adminMatchesList.innerHTML = `<p class="empty">Ingen kamper lagt inn ennå.</p>`;
    return;
  }

  adminMatchesList.innerHTML = "";

  snap.forEach((docSnap) => {
    const match = { id: docSnap.id, ...docSnap.data() };
    adminMatchesList.appendChild(renderAdminMatchCard(match));
  });
}

function renderAdminMatchCard(match) {
  const card = document.createElement("article");
  card.className = "match-card";

  card.innerHTML = `
    <div class="match-top">
      <div>
        <h3 class="match-title">${match.homeTeam} vs ${match.awayTeam}</h3>
        <p class="match-meta">
          ${formatDate(match.startTime)} · Status: <strong>${match.status}</strong>
          ${match.result ? ` · Resultat: <strong>${match.result}</strong>` : ""}
          ${match.paidOut ? " · Utbetalt" : ""}
        </p>
      </div>
      <span class="status-pill status-${match.status}">${match.status}</span>
    </div>

    <div class="odds-grid">
      <button class="ghost-btn" data-action="open">Åpen</button>
      <button class="ghost-btn" data-action="closed">Stengt</button>
      <button class="ghost-btn" data-action="finished">Ferdig</button>
    </div>

    <div class="odds-grid" style="margin-top: 10px;">
      <button class="odd-btn" data-result="home">
        <span>Vinner</span>
        <strong>${match.homeTeam}</strong>
      </button>

      <button class="odd-btn" data-result="draw">
        <span>Resultat</span>
        <strong>Uavgjort</strong>
      </button>

      <button class="odd-btn" data-result="away">
        <span>Vinner</span>
        <strong>${match.awayTeam}</strong>
      </button>
    </div>

    <button class="primary-btn" data-payout style="margin-top: 12px; width: 100%;" ${match.paidOut ? "disabled" : ""}>
      Betal ut vinnere
    </button>
  `;

  card.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateDoc(doc(db, "matches", match.id), {
        status: button.dataset.action
      });

      await loadAdminMatches();
    });
  });

  card.querySelectorAll("[data-result]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateDoc(doc(db, "matches", match.id), {
        result: button.dataset.result,
        status: "finished"
      });

      await loadAdminMatches();
    });
  });

  card.querySelector("[data-payout]").addEventListener("click", async () => {
    await payOutMatch(match);
    await loadAdminMatches();
  });

  return card;
}

async function payOutMatch(match) {
  if (!match.result) {
    alert("Velg resultat først.");
    return;
  }

  if (match.paidOut) {
    alert("Denne kampen er allerede utbetalt.");
    return;
  }

  const betsQuery = query(
    collection(db, "bets"),
    where("matchId", "==", match.id),
    where("status", "==", "active")
  );

  const betsSnap = await getDocs(betsQuery);

  if (betsSnap.empty) {
    await updateDoc(doc(db, "matches", match.id), {
      paidOut: true,
      status: "paid"
    });
    alert("Ingen aktive bets på denne kampen.");
    return;
  }

  const updates = [];

  betsSnap.forEach((betDoc) => {
    const bet = betDoc.data();
    const won = bet.choice === match.result;

    updates.push(
      updateDoc(doc(db, "bets", betDoc.id), {
        status: won ? "won" : "lost",
        settledAt: serverTimestamp()
      })
    );

    updates.push(
      updateDoc(doc(db, "users", bet.userId), {
        vmCoins: won ? increment(Number(bet.potentialWin || 0)) : increment(0),
        totalWins: won ? increment(1) : increment(0),
        totalLosses: won ? increment(0) : increment(1)
      })
    );
  });

  await Promise.all(updates);

  await updateDoc(doc(db, "matches", match.id), {
    paidOut: true,
    status: "paid"
  });

  alert("Utbetaling fullført!");
}

matchForm.addEventListener("submit", addMatch);
refreshBtn.addEventListener("click", loadAdminMatches);

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadAdminMatches();
});

ensureSignedIn();
