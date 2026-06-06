import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  get,
  set,
  update,
  onValue,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const nameInput = document.getElementById("nameInput");
const openingInput = document.getElementById("openingInput");
const bioInput = document.getElementById("bioInput");
const openingText = document.getElementById("openingText");
const bioText = document.getElementById("bioText");
const statusMsg = document.getElementById("statusMsg");
const saveBtn = document.getElementById("saveBtn");

let currentUser = null;

function setStatus(text, autoClear = true) {
  statusMsg.textContent = text;

  if (autoClear) {
    setTimeout(() => {
      if (statusMsg.textContent === text) {
        statusMsg.textContent = "";
      }
    }, 2600);
  }
}

function fallbackName(user) {
  return user.displayName || (user.email ? user.email.split("@")[0] : "Sjakkspiller");
}

function fillProfile(user, profile) {
  const name = profile.name || fallbackName(user);
  const opening = profile.favoriteOpening || "";
  const bio = profile.bio || "";

  profileName.textContent = name;
  profileEmail.textContent = user.email || "Innlogget";
  nameInput.value = name;
  openingInput.value = opening;
  bioInput.value = bio;

  openingText.textContent = opening || "Ikke valgt enda";
  bioText.textContent = bio || "Ingen bio enda.";

  document.getElementById("elo").textContent = profile.elo ?? 800;
  document.getElementById("wins").textContent = profile.wins ?? 0;
  document.getElementById("losses").textContent = profile.losses ?? 0;
  document.getElementById("draws").textContent = profile.draws ?? 0;
}

async function ensureProfile(user) {
  const userRef = ref(db, "users/" + user.uid);
  const snap = await get(userRef);

  if (!snap.exists()) {
    await set(userRef, {
      uid: user.uid,
      email: user.email || "",
      name: fallbackName(user),
      elo: 800,
      wins: 0,
      losses: 0,
      draws: 0,
      bio: "",
      favoriteOpening: "",
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
    return;
  }

  await update(userRef, {
    email: user.email || "",
    lastSeen: serverTimestamp()
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  currentUser = user;
  const userRef = ref(db, "users/" + user.uid);

  try {
    await ensureProfile(user);
  } catch (error) {
    setStatus("❌ Firebase-reglene stopper profilen: " + error.code, false);
    fillProfile(user, {});
  }

  onValue(userRef, (snap) => {
    fillProfile(user, snap.val() || {});
  }, (error) => {
    setStatus("❌ Kan ikke lese profil: " + error.code, false);
  });
});

saveBtn.addEventListener("click", async () => {
  if (!currentUser) return;

  const name = nameInput.value.trim().slice(0, 30) || "Sjakkspiller";
  const favoriteOpening = openingInput.value.trim().slice(0, 50);
  const bio = bioInput.value.trim().slice(0, 220);

  try {
    saveBtn.disabled = true;
    setStatus("Lagrer profil...", false);

    await updateProfile(currentUser, { displayName: name });

    await update(ref(db, "users/" + currentUser.uid), {
      uid: currentUser.uid,
      name,
      email: currentUser.email || "",
      favoriteOpening,
      bio,
      lastUpdated: serverTimestamp(),
      lastSeen: serverTimestamp()
    });

    setStatus("✅ Profilen er lagret.");
  } catch (error) {
    setStatus("❌ Kunne ikke lagre profilen: " + error.code, false);
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById("homeBtn").addEventListener("click", () => {
  window.location.href = "./home.html";
});

document.getElementById("playBtn").addEventListener("click", () => {
  window.location.href = "./play.html";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});
