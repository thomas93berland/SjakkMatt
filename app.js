import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  update,
  get,
  push,
  onValue,
  query,
  limitToLast,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHVjtKQv1tZ8sV9MKOYSr05Y8rXxv-tLQ",
  authDomain: "berlands-sjakk.firebaseapp.com",
  databaseURL: "https://berlands-sjakk-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "berlands-sjakk",
  storageBucket: "berlands-sjakk.firebasestorage.app",
  messagingSenderId: "884597270594",
  appId: "1:884597270594:web:0284119adb9ceacc7ba5db"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const page = document.body.dataset.page || "";

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function setStatus(text) {
  const element = $("statusMsg") || $("msg") || $("status");
  if (element) element.textContent = text;
}

function go(url) {
  window.location.href = url;
}

function fallbackName(user) {
  return user?.displayName || (user?.email ? user.email.split("@")[0] : "Sjakkspiller");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function friendlyError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-email": "Ugyldig e-postadresse.",
    "auth/missing-password": "Skriv inn passord.",
    "auth/weak-password": "Passordet må ha minst 6 tegn.",
    "auth/email-already-in-use": "Denne e-posten er allerede registrert.",
    "auth/user-not-found": "Fant ingen bruker med denne e-posten.",
    "auth/wrong-password": "Feil passord.",
    "auth/invalid-credential": "Feil e-post eller passord.",
    "auth/network-request-failed": "Nettverksfeil. Sjekk internett.",
    "auth/unauthorized-domain": "Domenet er ikke godkjent i Firebase Authentication.",
    "database/permission-denied": "Firebase-reglene blokkerer dette."
  };

  return messages[code] || code || error?.message || "Noe gikk galt.";
}

async function ensureUserProfile(user) {
  const userRef = ref(db, "users/" + user.uid);
  const snap = await get(userRef);

  if (!snap.exists()) {
    await set(userRef, {
      uid: user.uid,
      name: fallbackName(user),
      email: user.email || "",
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

function requireLogin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      go("./index.html");
      return;
    }

    try {
      await ensureUserProfile(user);
    } catch (error) {
      setStatus("Firebase-feil: " + friendlyError(error));
    }

    callback(user);
  });
}

function bindLogout() {
  const logoutBtn = $("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    go("./index.html");
  });
}

function cleanRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

async function makeUniqueRoomCode() {
  for (let i = 0; i < 15; i++) {
    const code = makeRoomCode();
    const snap = await get(ref(db, "games/" + code));

    if (!snap.exists()) return code;
  }

  throw new Error("Kunne ikke lage unik romkode.");
}

function randomColors(uidA, uidB) {
  return Math.random() < 0.5
    ? { whiteUid: uidA, blackUid: uidB }
    : { whiteUid: uidB, blackUid: uidA };
}

/* =====================================================
   LOGIN / REGISTER
   ===================================================== */

if (page === "auth" || page === "login") {
  initAuthPage();
}

function initAuthPage() {
  const loginModeBtn = $("loginModeBtn");
  const registerModeBtn = $("registerModeBtn");
  const switchModeBtn = $("switchModeBtn");
  const switchText = $("switchText");

  const formTitle = $("formTitle");
  const formSubtitle = $("formSubtitle");
  const nameField = $("nameField");

  const authForm = $("authForm");
  const loginBtn = $("loginBtn");
  const registerBtn = $("registerBtn");
  const submitBtn = $("submitBtn");
  const forgotBtn = $("forgotBtn");
  const togglePassword = $("togglePassword");

  const displayNameInput = $("displayName");
  const emailInput = $("email");
  const passwordInput = $("password");
  const rememberMe = $("rememberMe");

  let isRegisterMode = false;
  let isWorking = false;

  function setMode(registerMode) {
    isRegisterMode = registerMode;

    loginModeBtn?.classList.toggle("active", !isRegisterMode);
    registerModeBtn?.classList.toggle("active", isRegisterMode);

    if (nameField) nameField.hidden = !isRegisterMode;

    if (formTitle) formTitle.textContent = isRegisterMode ? "Lag bruker" : "Velkommen tilbake";

    if (formSubtitle) {
      formSubtitle.textContent = isRegisterMode
        ? "Registrer deg og bli med i loungen."
        : "Logg inn og fortsett sjakkreisen din.";
    }

    if (submitBtn) submitBtn.textContent = isRegisterMode ? "Registrer bruker" : "Logg inn";
    if (loginBtn) loginBtn.hidden = isRegisterMode;
    if (registerBtn) registerBtn.hidden = !isRegisterMode;

    if (switchText) {
      switchText.textContent = isRegisterMode ? "Har du allerede bruker?" : "Har du ikke bruker?";
    }

    if (switchModeBtn) switchModeBtn.textContent = isRegisterMode ? "Logg inn" : "Registrer deg";
    if (passwordInput) passwordInput.autocomplete = isRegisterMode ? "new-password" : "current-password";

    setStatus("");
  }

  function setLoading(loading) {
    isWorking = loading;
    [loginBtn, registerBtn, submitBtn, emailInput, passwordInput, displayNameInput].forEach((element) => {
      if (element) element.disabled = loading;
    });
  }

  async function submitAuth(forceRegister = null) {
    if (isWorking) return;

    const registerMode = forceRegister ?? isRegisterMode;
    const email = (emailInput?.value || "").trim().toLowerCase();
    const password = passwordInput?.value || "";
    const displayName = (displayNameInput?.value || "").trim();

    if (!email || !password) {
      setStatus("Skriv inn e-post og passord.");
      return;
    }

    try {
      setLoading(true);

      await setPersistence(
        auth,
        rememberMe?.checked ? browserLocalPersistence : browserSessionPersistence
      );

      if (registerMode) {
        setStatus("Oppretter bruker...");

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const name = displayName || email.split("@")[0] || "Sjakkspiller";

        await updateProfile(user, { displayName: name });

        await set(ref(db, "users/" + user.uid), {
          uid: user.uid,
          name,
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

        setStatus("Bruker opprettet. Sender deg videre...");
      } else {
        setStatus("Logger inn...");
        await signInWithEmailAndPassword(auth, email, password);
        setStatus("Innlogging vellykket. Sender deg videre...");
      }

      setTimeout(() => go("./home.html"), 550);
    } catch (error) {
      setStatus("Feil: " + friendlyError(error));
      setLoading(false);
    }
  }

  onAuthStateChanged(auth, (user) => {
    if (user && !isWorking) {
      setStatus("Du er allerede innlogget. Sender deg videre...");
      setTimeout(() => go("./home.html"), 450);
    }
  });

  loginModeBtn?.addEventListener("click", () => setMode(false));
  registerModeBtn?.addEventListener("click", () => setMode(true));
  switchModeBtn?.addEventListener("click", () => setMode(!isRegisterMode));

  loginBtn?.addEventListener("click", () => submitAuth(false));
  registerBtn?.addEventListener("click", () => submitAuth(true));

  submitBtn?.addEventListener("click", () => submitAuth(isRegisterMode));

  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuth(isRegisterMode);
  });

  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitAuth(isRegisterMode);
      }
    });
  });

  togglePassword?.addEventListener("click", () => {
    if (!passwordInput) return;

    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    togglePassword.textContent = show ? "🙈" : "👁";
  });

  forgotBtn?.addEventListener("click", async () => {
    const email = (emailInput?.value || "").trim().toLowerCase();

    if (!email) {
      setStatus("Skriv inn e-posten din først.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("E-post for passord-reset er sendt.");
    } catch (error) {
      setStatus("Feil: " + friendlyError(error));
    }
  });

  setMode(false);
}

/* =====================================================
   HOME
   ===================================================== */

if (page === "home") {
  requireLogin((user) => {
    bindLogout();
    initHomePage(user);
  });
}

function initHomePage(user) {
  const sideMenu = $("sideMenu");
  const menuToggle = $("menuToggle");

  function openPanel(panelId) {
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelId);
    });

    document.querySelectorAll(".menu-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.panel === panelId);
    });

    sideMenu?.classList.remove("open");
    setStatus("");
  }

  menuToggle?.addEventListener("click", () => {
    sideMenu?.classList.toggle("open");
  });

  document.querySelectorAll("[data-panel]").forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.panel));
  });

  $("quickPlayBtn")?.addEventListener("click", () => go("./play.html"));
  $("openPlayBtn")?.addEventListener("click", () => go("./play.html"));
  $("openProfileBtn")?.addEventListener("click", () => go("./profile.html"));

  onValue(ref(db, "users/" + user.uid), (snap) => {
    const profile = snap.val() || {};
    const name = profile.name || fallbackName(user);

    setText("welcomeName", name);
    setText("profileNameMini", name);
    setText("profileEmailMini", user.email || "Innlogget");
    setText("elo", profile.elo ?? 800);
    setText("wins", profile.wins ?? 0);
    setText("losses", profile.losses ?? 0);
    setText("draws", profile.draws ?? 0);
  }, (error) => {
    setStatus("Kan ikke lese profil: " + friendlyError(error));
  });

  listenPlayers(user);
  listenInvites(user);
  listenChat(user);
}

function listenPlayers(user) {
  const list = $("playersList");
  if (!list) return;

  onValue(ref(db, "users"), (snap) => {
    list.innerHTML = "";

    if (!snap.exists()) {
      list.innerHTML = `<div class="empty-state">Ingen spillere enda.</div>`;
      return;
    }

    const players = [];

    snap.forEach((child) => {
      const player = child.val();
      if (player?.uid && player.uid !== user.uid) players.push(player);
    });

    players.sort((a, b) => (b.elo || 800) - (a.elo || 800));

    if (players.length === 0) {
      list.innerHTML = `<div class="empty-state">Ingen andre spillere registrert enda.</div>`;
      return;
    }

    players.forEach((player) => {
      const row = document.createElement("div");
      row.className = "list-row";

      row.innerHTML = `
        <div>
          <strong>${escapeHtml(player.name || "Sjakkspiller")}</strong>
          <span>Elo ${escapeHtml(player.elo ?? 800)}</span>
        </div>
        <div class="row-actions">
          <button class="small-action" type="button">Inviter</button>
        </div>
      `;

      row.querySelector("button").addEventListener("click", () => sendInvite(user, player));
      list.appendChild(row);
    });
  }, (error) => {
    list.innerHTML = `<div class="empty-state">Kan ikke laste spillere: ${escapeHtml(friendlyError(error))}</div>`;
  });
}

async function sendInvite(user, player) {
  try {
    const roomCode = await makeUniqueRoomCode();
    const colors = randomColors(user.uid, player.uid);

    const myName = fallbackName(user);
    const opponentName = player.name || "Sjakkspiller";

    const whiteName = colors.whiteUid === user.uid ? myName : opponentName;
    const blackName = colors.blackUid === user.uid ? myName : opponentName;

    const inviteRef = push(ref(db, "userInvites/" + player.uid));

    await set(ref(db, "games/" + roomCode), {
      roomCode,
      code: roomCode,
      status: "invited",
      createdBy: user.uid,
      invitedUid: player.uid,
      whiteUid: colors.whiteUid,
      blackUid: colors.blackUid,
      whiteName,
      blackName,
      fen: START_FEN,
      moves: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await set(inviteRef, {
      inviteId: inviteRef.key,
      fromUid: user.uid,
      fromName: myName,
      toUid: player.uid,
      toName: opponentName,
      roomCode,
      status: "pending",
      createdAt: serverTimestamp()
    });

    setStatus("Invitasjon sendt til " + opponentName + ".");
  } catch (error) {
    const text = friendlyError(error);
    if ((error?.code || "").includes("permission")) {
      setStatus("Kunne ikke sende invitasjon: Firebase-reglene må oppdateres. Bruk firebase-rules.json i pakken.");
    } else {
      setStatus("Kunne ikke sende invitasjon: " + text);
    }
  }
}

function listenInvites(user) {
  const list = $("invitesList");
  if (!list) return;

  onValue(ref(db, "userInvites/" + user.uid), (snap) => {
    list.innerHTML = "";

    if (!snap.exists()) {
      list.innerHTML = `<div class="empty-state">Ingen invitasjoner akkurat nå.</div>`;
      return;
    }

    let count = 0;

    snap.forEach((child) => {
      const invite = child.val();
      if (!invite || invite.status !== "pending") return;

      count++;

      const row = document.createElement("div");
      row.className = "list-row";

      row.innerHTML = `
        <div>
          <strong>${escapeHtml(invite.fromName || "Sjakkspiller")}</strong>
          <span>Vil spille mot deg • Rom ${escapeHtml(invite.roomCode || "")}</span>
        </div>
        <div class="row-actions">
          <button class="small-action accept" type="button">Godta</button>
          <button class="small-action decline" type="button">Avslå</button>
        </div>
      `;

      row.querySelector(".accept").addEventListener("click", async () => {
        await update(ref(db, "userInvites/" + user.uid + "/" + child.key), {
          status: "accepted",
          answeredAt: serverTimestamp()
        });

        await update(ref(db, "games/" + invite.roomCode), {
          status: "active",
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        go("./play.html?room=" + encodeURIComponent(invite.roomCode));
      });

      row.querySelector(".decline").addEventListener("click", async () => {
        await update(ref(db, "userInvites/" + user.uid + "/" + child.key), {
          status: "declined",
          answeredAt: serverTimestamp()
        });

        await update(ref(db, "games/" + invite.roomCode), {
          status: "declined",
          updatedAt: serverTimestamp()
        });
      });

      list.appendChild(row);
    });

    if (count === 0) {
      list.innerHTML = `<div class="empty-state">Ingen nye invitasjoner.</div>`;
    }
  }, (error) => {
    list.innerHTML = `<div class="empty-state">Kan ikke laste invitasjoner: ${escapeHtml(friendlyError(error))}</div>`;
  });
}

function listenChat(user) {
  const chatWindow = $("chatWindow");
  const chatForm = $("chatForm");
  const chatInput = $("chatInput");

  if (!chatWindow || !chatForm || !chatInput) return;

  const chatQuery = query(ref(db, "loungeChat"), limitToLast(50));

  onValue(chatQuery, (snap) => {
    chatWindow.innerHTML = "";

    if (!snap.exists()) {
      chatWindow.innerHTML = `<div class="empty-state">Ingen meldinger enda.</div>`;
      return;
    }

    snap.forEach((child) => {
      const msg = child.val() || {};
      const item = document.createElement("div");
      item.className = "chat-message";
      item.innerHTML = `
        <strong>${escapeHtml(msg.name || "Sjakkspiller")}</strong>
        <span>${escapeHtml(msg.text || "")}</span>
      `;
      chatWindow.appendChild(item);
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, (error) => {
    chatWindow.innerHTML = `<div class="empty-state">Kan ikke laste chat: ${escapeHtml(friendlyError(error))}</div>`;
  });

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";

    try {
      await push(ref(db, "loungeChat"), {
        uid: user.uid,
        name: fallbackName(user),
        text: text.slice(0, 220),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      chatInput.value = text;
      setStatus("Kunne ikke sende melding: " + friendlyError(error));
    }
  });
}

/* =====================================================
   PROFILE
   ===================================================== */

if (page === "profile") {
  requireLogin((user) => {
    bindLogout();
    initProfilePage(user);
  });
}

function initProfilePage(user) {
  $("homeBtn")?.addEventListener("click", () => go("./home.html"));
  $("playBtn")?.addEventListener("click", () => go("./play.html"));

  const nameInput = $("nameInput");
  const openingInput = $("openingInput");
  const bioInput = $("bioInput");
  const saveButton = $("saveProfileBtn") || $("saveBtn");

  onValue(ref(db, "users/" + user.uid), (snap) => {
    const profile = snap.val() || {};
    const name = profile.name || fallbackName(user);
    const opening = profile.favoriteOpening || "";
    const bio = profile.bio || "";

    setText("profileName", name);
    setText("profileEmail", user.email || "Innlogget");
    setText("elo", profile.elo ?? 800);
    setText("wins", profile.wins ?? 0);
    setText("losses", profile.losses ?? 0);
    setText("draws", profile.draws ?? 0);
    setText("openingText", opening || "Ikke valgt enda");
    setText("bioText", bio || "Ingen bio enda.");

    if (nameInput && document.activeElement !== nameInput) nameInput.value = name;
    if (openingInput && document.activeElement !== openingInput) openingInput.value = opening;
    if (bioInput && document.activeElement !== bioInput) bioInput.value = bio;
  }, (error) => {
    setStatus("Kan ikke lese profil: " + friendlyError(error));
  });

  saveButton?.addEventListener("click", async () => {
    const name = (nameInput?.value || "").trim().slice(0, 30) || "Sjakkspiller";
    const favoriteOpening = (openingInput?.value || "").trim().slice(0, 50);
    const bio = (bioInput?.value || "").trim().slice(0, 220);

    try {
      saveButton.disabled = true;

      await updateProfile(user, { displayName: name });

      await update(ref(db, "users/" + user.uid), {
        uid: user.uid,
        name,
        email: user.email || "",
        favoriteOpening,
        bio,
        lastSeen: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      setStatus("Profilen er lagret.");
    } catch (error) {
      setStatus("Kunne ikke lagre: " + friendlyError(error));
    } finally {
      saveButton.disabled = false;
    }
  });
}

/* =====================================================
   PLAY
   ===================================================== */

if (page === "play") {
  requireLogin((user) => {
    bindLogout();
    initPlayPage(user);
  });
}

function initPlayPage(user) {
  const ChessCtor = window.Chess;

  if (!ChessCtor) {
    setText("status", "Kunne ikke laste chess.js. Oppdater siden.");
    return;
  }

  const chess = new ChessCtor();

  let currentRoom = null;
  let selectedSquare = null;
  let legalMoves = [];
  let myColor = null;
  let lastFen = "";
  let unsubscribeGame = null;

  const pieceImages = {
    wp: "./pieces/wp.svg",
    wr: "./pieces/wr.svg",
    wn: "./pieces/wn.svg",
    wb: "./pieces/wb.svg",
    wq: "./pieces/wq.svg",
    wk: "./pieces/wk.svg",
    bp: "./pieces/bp.svg",
    br: "./pieces/br.svg",
    bn: "./pieces/bn.svg",
    bb: "./pieces/bb.svg",
    bq: "./pieces/bq.svg",
    bk: "./pieces/bk.svg"
  };

  $("homeBtn")?.addEventListener("click", () => go("./home.html"));

  $("openDrawerBtn")?.addEventListener("click", () => {
    $("playDrawer")?.classList.add("open");
  });

  $("closeDrawerBtn")?.addEventListener("click", () => {
    $("playDrawer")?.classList.remove("open");
  });

  function getSquares() {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
    const squares = [];

    for (const rank of ranks) {
      for (const file of files) {
        squares.push(file + rank);
      }
    }

    return myColor === "black" ? squares.reverse() : squares;
  }

  function renderBoard() {
    const board = $("board");
    if (!board) return;

    board.innerHTML = "";

    getSquares().forEach((squareName) => {
      const square = document.createElement("div");
      square.className = "square";

      const fileIndex = squareName.charCodeAt(0) - 97;
      const rankIndex = Number(squareName[1]) - 1;
      const isLight = (fileIndex + rankIndex) % 2 === 1;

      square.classList.add(isLight ? "light" : "dark");

      if (selectedSquare === squareName) {
        square.classList.add("selected");
      }

      const legalMove = legalMoves.find((move) => move.to === squareName);
      if (legalMove) {
        square.classList.add(legalMove.captured ? "capture" : "legal");
      }

      const piece = chess.get(squareName);

      if (piece) {
        const pieceEl = document.createElement("div");
        pieceEl.className = "piece " + (piece.color === "w" ? "white-piece" : "black-piece");

        const img = document.createElement("img");
        img.className = "piece-img";
        img.src = pieceImages[piece.color + piece.type];
        img.alt = piece.color + piece.type;
        img.draggable = false;

        pieceEl.appendChild(img);
        square.appendChild(pieceEl);
      }

      const coord = document.createElement("span");
      coord.className = "coord";
      coord.textContent = squareName.toUpperCase();
      square.appendChild(coord);

      square.addEventListener("click", () => handleSquareClick(squareName));
      board.appendChild(square);
    });
  }

  function isMyTurn() {
    return (myColor === "white" && chess.turn() === "w") ||
           (myColor === "black" && chess.turn() === "b");
  }

  function updateStatus(game) {
    if (!currentRoom) {
      setText("status", "Lag et rom eller bli med med romkode.");
      return;
    }

    if (game?.status === "waiting") {
      setText("status", "Venter på motstander. Del romkoden.");
      return;
    }

    if (game?.status === "invited") {
      setText("status", "Venter på at invitasjonen blir godtatt.");
      return;
    }

    if (game?.status === "declined") {
      setText("status", "Invitasjonen ble avslått.");
      return;
    }

    if (chess.in_checkmate()) {
      setText("status", "Sjakk matt. Partiet er ferdig.");
      return;
    }

    if (chess.in_draw()) {
      setText("status", "Remis. Partiet er ferdig.");
      return;
    }

    if (!myColor) {
      setText("status", "Du ser på dette partiet.");
      return;
    }

    const turnText = chess.turn() === "w" ? "Hvit" : "Svart";
    const checkText = chess.in_check() ? " — sjakk!" : "";

    setText("status", isMyTurn() ? "Din tur" + checkText : turnText + " sin tur" + checkText);
  }

  function updateMoves(game) {
    const movesEl = $("moves");
    if (!movesEl) return;

    const moves = Array.isArray(game?.moves) ? game.moves : [];

    if (moves.length === 0) {
      movesEl.innerHTML = "<strong>Trekk:</strong><br>Ingen trekk enda.";
      return;
    }

    let html = "<strong>Trekk:</strong><br>";

    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      html += `${moveNumber}. ${escapeHtml(moves[i] || "")}`;
      if (moves[i + 1]) html += ` ${escapeHtml(moves[i + 1])}`;
      html += "<br>";
    }

    movesEl.innerHTML = html;
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  function handleSquareClick(squareName) {
    if (!currentRoom || !myColor) {
      setText("status", "Lag eller bli med i et rom først.");
      return;
    }

    if (!isMyTurn()) {
      setText("status", "Det er ikke din tur akkurat nå.");
      return;
    }

    const piece = chess.get(squareName);

    if (selectedSquare === squareName) {
      selectedSquare = null;
      legalMoves = [];
      renderBoard();
      return;
    }

    if (selectedSquare) {
      const legal = legalMoves.find((move) => move.to === squareName);

      if (legal) {
        makeMove(selectedSquare, squareName);
        return;
      }
    }

    if (!piece) return;

    const ownPiece =
      (myColor === "white" && piece.color === "w") ||
      (myColor === "black" && piece.color === "b");

    if (!ownPiece) {
      setText("status", "Du kan bare flytte dine egne brikker.");
      return;
    }

    selectedSquare = squareName;
    legalMoves = chess.moves({ square: squareName, verbose: true });
    renderBoard();
  }

  async function makeMove(from, to) {
    const beforeFen = chess.fen();
    const move = chess.move({ from, to, promotion: "q" });

    if (!move) {
      chess.load(beforeFen);
      selectedSquare = null;
      legalMoves = [];
      renderBoard();
      return;
    }

    selectedSquare = null;
    legalMoves = [];
    renderBoard();

    try {
      const gameSnap = await get(ref(db, "games/" + currentRoom));
      const game = gameSnap.val() || {};
      const moves = Array.isArray(game.moves) ? game.moves : [];

      await update(ref(db, "games/" + currentRoom), {
        fen: chess.fen(),
        moves: [...moves, move.san],
        status: chess.in_checkmate() || chess.in_draw() ? "finished" : "active",
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      chess.load(beforeFen);
      renderBoard();
      setText("status", "Kunne ikke lagre trekk: " + friendlyError(error));
    }
  }

  function listenToGame(roomCode) {
    if (unsubscribeGame) {
      unsubscribeGame();
      unsubscribeGame = null;
    }

    currentRoom = roomCode;
    setText("roomCode", roomCode);

    unsubscribeGame = onValue(ref(db, "games/" + roomCode), (snap) => {
      if (!snap.exists()) {
        setText("status", "Rommet finnes ikke.");
        return;
      }

      const game = snap.val() || {};

      setText("whitePlayer", game.whiteName || "Venter...");
      setText("blackPlayer", game.blackName || "Venter...");

      if (game.whiteUid === user.uid) myColor = "white";
      else if (game.blackUid === user.uid) myColor = "black";
      else myColor = null;

      const fen = game.fen && game.fen !== "start" ? game.fen : new ChessCtor().fen();

      if (fen !== lastFen) {
        chess.load(fen);
        lastFen = fen;
      }

      updateMoves(game);
      updateStatus(game);
      renderBoard();
    }, (error) => {
      setText("status", "Firebase-feil: " + friendlyError(error));
    });
  }

  async function createRoom() {
    try {
      const roomCode = await makeUniqueRoomCode();
      const fen = new ChessCtor().fen();

      await set(ref(db, "games/" + roomCode), {
        roomCode,
        code: roomCode,
        status: "waiting",
        hostUid: user.uid,
        hostName: fallbackName(user),
        whiteUid: "",
        blackUid: "",
        whiteName: "",
        blackName: "",
        fen,
        moves: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      listenToGame(roomCode);
      $("playDrawer")?.classList.remove("open");
    } catch (error) {
      setText("status", "Kunne ikke lage rom: " + friendlyError(error));
    }
  }

  async function joinRoom(value) {
    const roomCode = cleanRoomCode(value);

    if (roomCode.length !== 5) {
      setText("status", "Skriv en gyldig romkode på 5 tegn.");
      return;
    }

    try {
      const gameRef = ref(db, "games/" + roomCode);
      const snap = await get(gameRef);

      if (!snap.exists()) {
        setText("status", "Fant ikke rommet.");
        return;
      }

      const game = snap.val() || {};

      if (game.status === "waiting" && game.hostUid && game.hostUid !== user.uid) {
        const colors = randomColors(game.hostUid, user.uid);

        await update(gameRef, {
          status: "active",
          whiteUid: colors.whiteUid,
          blackUid: colors.blackUid,
          whiteName: colors.whiteUid === game.hostUid ? game.hostName : fallbackName(user),
          blackName: colors.blackUid === game.hostUid ? game.hostName : fallbackName(user),
          updatedAt: serverTimestamp()
        });
      }

      listenToGame(roomCode);
      $("playDrawer")?.classList.remove("open");
    } catch (error) {
      setText("status", "Kunne ikke bli med: " + friendlyError(error));
    }
  }

  $("createRoomBtn")?.addEventListener("click", createRoom);

  $("joinRoomBtn")?.addEventListener("click", () => {
    joinRoom($("joinCode")?.value);
  });

  $("joinCode")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      joinRoom(event.target.value);
    }
  });

  const urlRoom = cleanRoomCode(new URLSearchParams(window.location.search).get("room"));

  renderBoard();

  if (urlRoom) {
    joinRoom(urlRoom);
  } else {
    setText("status", "Lag et rom eller bli med med romkode.");
  }
}
