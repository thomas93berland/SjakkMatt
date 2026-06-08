import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHVjtKQv1tZ8sV9MKOYSr05Y8rXxv-tLQ",
  authDomain: "berlands-sjakk.firebaseapp.com",
  databaseURL: "https://berlands-sjakk-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "berlands-sjakk",
  storageBucket: "berlands-sjakk.firebasestorage.app",
  messagingSenderId: "884597270594",
  appId: "1:884597270594:web:0284119adb9ceacc7ba5db"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

function injectAdminButton() {
  if (document.getElementById("adminAccessButton")) return;

  const button = document.createElement("button");
  button.id = "adminAccessButton";
  button.type = "button";
  button.innerHTML = '<span class="admin-access-icon">♔</span><span class="admin-access-text">Admin</span>';

  button.addEventListener("click", () => {
    window.location.href = "./admin.html?v=10";
  });

  document.body.appendChild(button);
}

async function isAdmin(user) {
  if (!user) return false;

  try {
    const adminSnap = await get(ref(db, "admins/" + user.uid));
    if (adminSnap.val() === true) return true;
  } catch (error) {
    // Hvis Firebase rules ikke slipper lesing enda, faller vi tilbake til users-profil.
  }

  try {
    const userSnap = await get(ref(db, "users/" + user.uid));
    const profile = userSnap.val() || {};
    return profile.role === "admin" || profile.admin === true;
  } catch (error) {
    return false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const allowed = await isAdmin(user);

  if (allowed) {
    injectAdminButton();
    document.body.classList.add("is-admin-user");
  }
});
