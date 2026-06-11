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
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const START_COINS = 10000;

let currentUser = null;
let currentProfile = null;
let selectedMatch = null;
let selectedChoice = "home";

const matchesList = document.querySelector("#matchesList");
const leaderboardEl = document.querySelector("#leaderboard");
const coinBalanceEl = document.querySelector("#coinBalance");
const refreshBtn = document.querySelector("#refreshBtn");

const betDialog = document.querySelector("#betDialog");
const dialogMatchTitle = document.querySelector("#dialogMatchTitle");
const betChoice = document.querySelector("#betChoice");
const betStake = document.querySelector("#betStake");
const potentialWin = document.querySelector("#potentialWin");
const confirmBetBtn = document.querySelector("#confirmBetBtn");

function formatCoins(value) {
  return new Intl.NumberFormat("no-NO").format(Math.round(Number(value || 0)));
}

function formatDate(value) {
  if (!value) return "Tidspunkt kommer";
  const date = value.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("no-NO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function choiceLabel(choice, match) {
  if (choice === "home") return match.homeTeam;
  if (choice === "draw") return "Uavgjort";
  return match.awayTeam;
}

function choiceOdds(choice, match) {
  if (choice === "home") return Number(match.oddsHome);
  if (choice === "draw") return Number(match.oddsDraw);
  return Number(match.oddsAway);
}

function isBettingOpen(match) {
  return match.status === "open";
}

async function ensureSignedIn() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const profile = {
      username: "Lounge spiller",
      vmCoins: START_COINS,
      totalWins: 0,
      totalLosses: 0,
      createdAt: serverTimestamp()
    };

    await setDoc(userRef, profile);
    return profile;
  }

  return snap.data();
}

async function loadAppData() {
  await Promise.all([
    loadMatches(),
    loadLeaderboard(),
    loadCurrentProfile()
  ]);
}

async function loadCurrentProfile() {
  if (!currentUser) return;

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  currentProfile = snap.data();

  coinBalanceEl.textContent = formatCoins(currentProfile?.vmCoins ?? START_COINS);
}

async function loadMatches() {
  matchesList.innerHTML = `<p class="empty">Laster kamper...</p>`;

  const q = query(collection(db, "matches"), orderBy("startTime", "asc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    matchesList.innerHTML = `
      <p class="empty">
        Ingen kamper lagt inn ennå. Bruk <strong>vm-admin.html</strong> for å legge inn VM-kamper.
      </p>
    `;
    return;
  }

  matchesList.innerHTML = "";

  snap.forEach((docSnap) => {
    const match = { id: docSnap.id, ...docSnap.data() };
    matchesList.appendChild(renderMatchCard(match));
  });
}

function renderMatchCard(match) {
  const card = document.createElement("article");
  card.className = "match-card";

  const locked = !isBettingOpen(match);

  card.innerHTML = `
    <div class="match-top">
      <div>
        <h3 class="match-title">${match.homeTeam} vs ${match.awayTeam}</h3>
        <p class="match-meta">${formatDate(match.startTime)}</p>
      </div>
      <span class="status-pill status-${match.status}">${match.status}</span>
    </div>

    <div class="odds-grid">
      <button class="odd-btn" data-choice="home" ${locked ? "disabled" : ""}>
        <span>1 — ${match.homeTeam}</span>
        <strong>${Number(match.oddsHome).toFixed(2)}</strong>
      </button>

      <button class="odd-btn" data-choice="draw" ${locked ? "disabled" : ""}>
        <span>X — Uavgjort</span>
        <strong>${Number(match.oddsDraw).toFixed(2)}</strong>
      </button>

      <button class="odd-btn" data-choice="away" ${locked ? "disabled" : ""}>
        <span>2 — ${match.awayTeam}</span>
        <strong>${Number(match.oddsAway).toFixed(2)}</strong>
      </button>
    </div>
  `;

  card.querySelectorAll(".odd-btn").forEach((button) => {
    button.addEventListener("click", () => {
      openBetDialog(match, button.dataset.choice);
    });
  });

  return card;
}

function openBetDialog(match, choice) {
  selectedMatch = match;
  selectedChoice = choice;

  dialogMatchTitle.textContent = `${match.homeTeam} vs ${match.awayTeam}`;
  betChoice.value = choice;
  betStake.value = 100;
  updatePayoutPreview();

  betDialog.showModal();
}

function updatePayoutPreview() {
  if (!selectedMatch) return;

  const stake = Number(betStake.value || 0);
  const odds = choiceOdds(betChoice.value, selectedMatch);
  potentialWin.textContent = formatCoins(stake * odds);
}

async function placeBet(event) {
  event.preventDefault();

  if (!currentUser || !selectedMatch) return;

  await loadCurrentProfile();

  const stake = Number(betStake.value || 0);
  const choice = betChoice.value;
  const odds = choiceOdds(choice, selectedMatch);

  if (!Number.isFinite(stake) || stake < 10) {
    alert("Minste innsats er 10 VM Coins.");
    return;
  }

  if (stake > Number(currentProfile.vmCoins || 0)) {
    alert("Du har ikke nok VM Coins.");
    return;
  }

  const matchSnap = await getDoc(doc(db, "matches", selectedMatch.id));
  const freshMatch = matchSnap.data();

  if (!freshMatch || freshMatch.status !== "open") {
    alert("Betting er stengt for denne kampen.");
    await loadMatches();
    return;
  }

  const existingBetQuery = query(
    collection(db, "bets"),
    where("userId", "==", currentUser.uid),
    where("matchId", "==", selectedMatch.id)
  );

  const existingBetSnap = await getDocs(existingBetQuery);

  if (!existingBetSnap.empty) {
    alert("Du har allerede lagt inn bet på denne kampen.");
    return;
  }

  await addDoc(collection(db, "bets"), {
    userId: currentUser.uid,
    username: currentProfile.username || "Lounge spiller",
    matchId: selectedMatch.id,
    matchTitle: `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}`,
    choice,
    choiceLabel: choiceLabel(choice, selectedMatch),
    stake,
    odds,
    potentialWin: Math.round(stake * odds),
    status: "active",
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, "users", currentUser.uid), {
    vmCoins: increment(-stake)
  });

  betDialog.close();
  await loadAppData();

  alert("Bet lagt inn!");
}

async function loadLeaderboard() {
  leaderboardEl.innerHTML = `<li class="empty">Laster ranking...</li>`;

  const q = query(collection(db, "users"), orderBy("vmCoins", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    leaderboardEl.innerHTML = `<li class="empty">Ingen spillere ennå.</li>`;
    return;
  }

  leaderboardEl.innerHTML = "";

  let rank = 1;

  snap.forEach((docSnap) => {
    const user = docSnap.data();

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="rank">#${rank}</span>
      <span>${user.username || "Lounge spiller"}</span>
      <span class="coins">${formatCoins(user.vmCoins)} coins</span>
    `;

    leaderboardEl.appendChild(li);
    rank++;
  });
}

betChoice.addEventListener("change", updatePayoutPreview);
betStake.addEventListener("input", updatePayoutPreview);
confirmBetBtn.addEventListener("click", placeBet);
refreshBtn.addEventListener("click", loadAppData);

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  currentUser = user;
  currentProfile = await ensureUserProfile(user);
  await loadAppData();
});

ensureSignedIn();
