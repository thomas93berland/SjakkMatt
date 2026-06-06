import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  set,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const msg = document.getElementById("msg");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

let isWorking = false;

function goHome() {
  window.location.href = "./home.html";
}

function setStatus(text) {
  msg.textContent = text;
}

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  registerBtn.disabled = isLoading;
  emailInput.disabled = isLoading;
  passwordInput.disabled = isLoading;
}

function getFriendlyError(error) {
  const messages = {
    "auth/invalid-email": "Ugyldig e-postadresse.",
    "auth/missing-password": "Skriv inn passord.",
    "auth/weak-password": "Passordet må ha minst 6 tegn.",
    "auth/email-already-in-use": "Denne e-posten er allerede registrert.",
    "auth/user-not-found": "Fant ingen bruker med denne e-posten.",
    "auth/wrong-password": "Feil passord.",
    "auth/invalid-credential": "Feil e-post eller passord.",
    "auth/network-request-failed": "Nettverksfeil. Sjekk internett."
  };

  return messages[error.code] || error.code || "Noe gikk galt.";
}

function cleanEmail() {
  return emailInput.value.trim().toLowerCase();
}

function cleanPassword() {
  return passwordInput.value;
}

function validateLoginForm() {
  const email = cleanEmail();
  const password = cleanPassword();

  if (!email || !password) {
    setStatus("❌ Skriv inn e-post og passord.");
    return null;
  }

  return { email, password };
}

async function createUserProfile(user, email) {
  const displayName = email.split("@")[0] || "Sjakkspiller";

  await updateProfile(user, {
    displayName
  });

  await set(ref(db, "users/" + user.uid), {
    uid: user.uid,
    name: displayName,
    email,
    elo: 800,
    wins: 0,
    losses: 0,
    draws: 0,
    bio: "",
    favoriteOpening: "",
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  });
}

onAuthStateChanged(auth, (user) => {
  if (user && !isWorking) {
    setStatus("✅ Du er allerede innlogget. Sender deg videre...");
    setTimeout(goHome, 500);
  }
});

registerBtn.addEventListener("click", async () => {
  const form = validateLoginForm();
  if (!form) return;

  try {
    isWorking = true;
    setLoading(true);
    setStatus("Oppretter bruker...");

    const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
    await createUserProfile(userCredential.user, form.email);

    setStatus("✅ Bruker opprettet! Sender deg videre...");
    setTimeout(goHome, 700);
  } catch (error) {
    setStatus("❌ " + getFriendlyError(error));
    isWorking = false;
    setLoading(false);
  }
});

loginBtn.addEventListener("click", async () => {
  const form = validateLoginForm();
  if (!form) return;

  try {
    isWorking = true;
    setLoading(true);
    setStatus("Logger inn...");

    await signInWithEmailAndPassword(auth, form.email, form.password);

    setStatus("✅ Innlogging vellykket! Sender deg videre...");
    setTimeout(goHome, 700);
  } catch (error) {
    setStatus("❌ " + getFriendlyError(error));
    isWorking = false;
    setLoading(false);
  }
});

[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loginBtn.click();
    }
  });
});
