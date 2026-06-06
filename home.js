import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  get,
  set,
  update,
  push,
  onValue,
  query,
  limitToLast,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const NORMAL_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const username = document.getElementById("username");
const emailText = document.getElementById("emailText");
const logoutBtn = document.getElementById("logoutBtn");
const statusMsg = document.getElementById("statusMsg");
const openProfileBtn = document.getElementById("openProfileBtn");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const playersList = document.getElementById("playersList");
const invitesList = document.getElementById("invitesList");

let currentUser = null;

function setStatus(text, autoClear = true) {
  statusMsg.textContent = text;

  if (autoClear) {
    setTimeout(() => {
      if (statusMsg.textContent === text) {
        statusMsg.textContent = "";
      }
    }, 3200);
  }
}

function getFallbackName(user) {
  return user.displayName || (user.email ? user.email.split("@")[0] : "Sjakkspiller");
}

function getCurrentName() {
  if (!currentUser) return "Sjakkspiller";
  return username.textContent || getFallbackName(currentUser);
}

function makeRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  return code;
}

async function makeUniqueRoomCode() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = makeRoomCode();
    const snap = await get(ref(db, "games/" + code));

    if (!snap.exists()) {
      return code;
    }
  }

  throw new Error("Kunne ikke lage unik romkode. Prøv igjen.");
}

async function ensureUserProfile(user) {
  const userRef = ref(db, "users/" + user.uid);
  const snap = await get(userRef);

  if (!snap.exists()) {
    await set(userRef, {
      uid: user.uid,
      name: getFallbackName(user),
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

function listenToMyProfile(user) {
  onValue(ref(db, "users/" + user.uid), (snap) => {
    const profile = snap.val() || {};

    username.textContent = profile.name || getFallbackName(user);
    emailText.textContent = user.email || "Innlogget";

    document.getElementById("elo").textContent = profile.elo ?? 800;
    document.getElementById("wins").textContent = profile.wins ?? 0;
    document.getElementById("losses").textContent = profile.losses ?? 0;
    document.getElementById("draws").textContent = profile.draws ?? 0;
  }, (error) => {
    setStatus("Firebase-reglene stopper profilen: " + error.code, false);
  });
}

function renderEmptyChat(text) {
  chatWindow.innerHTML = "";

  const empty = document.createElement("div");
  const name = document.createElement("strong");
  const message = document.createElement("span");

  empty.className = "chat-message";
  name.textContent = "Chess Loungen";
  message.textContent = text;

  empty.appendChild(name);
  empty.appendChild(message);
  chatWindow.appendChild(empty);
}

function listenToChat() {
  const chatQuery = query(ref(db, "loungeChat"), limitToLast(40));

  onValue(chatQuery, (snap) => {
    chatWindow.innerHTML = "";

    if (!snap.exists()) {
      renderEmptyChat("Ingen meldinger enda. Start praten 🔥");
      return;
    }

    snap.forEach((child) => {
      const chat = child.val() || {};
      const item = document.createElement("div");
      const name = document.createElement("strong");
      const text = document.createElement("span");

      item.className = "chat-message";
      name.textContent = chat.name || "Sjakkspiller";
      text.textContent = chat.text || "";

      item.appendChild(name);
      item.appendChild(text);
      chatWindow.appendChild(item);
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, (error) => {
    renderEmptyChat("Firebase-reglene stopper chatten: " + error.code);
  });
}

function playerDisplayName(player) {
  return player.name || (player.email ? player.email.split("@")[0] : "Sjakkspiller");
}

function renderPlayerRow(player) {
  if (!player || !player.uid) return;

  const row = document.createElement("div");
  const info = document.createElement("div");
  const name = document.createElement("strong");
  const elo = document.createElement("span");

  row.className = "online-player";
  info.className = "online-player-info";

  name.textContent = playerDisplayName(player);
  elo.textContent = `Elo ${player.elo ?? 800}`;

  info.appendChild(name);
  info.appendChild(elo);
  row.appendChild(info);

  if (currentUser && player.uid !== currentUser.uid) {
    const inviteButton = document.createElement("button");
    inviteButton.type = "button";
    inviteButton.className = "mini-btn accept";
    inviteButton.textContent = "Inviter";
    inviteButton.addEventListener("click", () => sendInviteToPlayer(player, inviteButton));
    row.appendChild(inviteButton);
  } else {
    const you = document.createElement("span");
    you.textContent = "Deg";
    row.appendChild(you);
  }

  playersList.appendChild(row);
}

function listenToPlayers() {
  onValue(ref(db, "users"), (snap) => {
    playersList.innerHTML = "";

    if (!snap.exists()) {
      playersList.innerHTML = "<div class='online-player'><strong>Ingen profiler enda</strong><span></span></div>";
      return;
    }

    const players = [];

    snap.forEach((child) => {
      players.push(child.val());
    });

    players
      .filter((player) => player && player.uid)
      .sort((a, b) => (b.elo || 800) - (a.elo || 800))
      .slice(0, 12)
      .forEach(renderPlayerRow);
  }, (error) => {
    playersList.innerHTML = `<div class='online-player'><strong>Firebase-feil</strong><span>${error.code}</span></div>`;
  });
}

async function sendInviteToPlayer(player, button) {
  if (!currentUser) return;

  if (!player || !player.uid || player.uid === currentUser.uid) {
    setStatus("Du kan ikke invitere deg selv.");
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sender...";

  try {
    const code = await makeUniqueRoomCode();
    const inviterName = getCurrentName();
    const invitedName = playerDisplayName(player);
    const inviterIsWhite = Math.random() < 0.5;

    const whiteUid = inviterIsWhite ? currentUser.uid : player.uid;
    const whiteName = inviterIsWhite ? inviterName : invitedName;
    const blackUid = inviterIsWhite ? player.uid : currentUser.uid;
    const blackName = inviterIsWhite ? invitedName : inviterName;

    await set(ref(db, "games/" + code), {
      code,
      status: "waitingInvite",
      invitationStatus: "pending",
      randomColors: true,
      invitedUid: player.uid,
      inviterUid: currentUser.uid,
      fen: NORMAL_START_FEN,
      turn: "w",
      whiteUid,
      whiteName,
      blackUid,
      blackName,
      createdAt: serverTimestamp(),
      lastMoveAt: serverTimestamp(),
      moves: []
    });

    const inviteRef = push(ref(db, "userInvites/" + player.uid));
    const receiverColor = player.uid === whiteUid ? "white" : "black";
    const senderColor = currentUser.uid === whiteUid ? "white" : "black";

    await set(inviteRef, {
      inviteId: inviteRef.key,
      fromUid: currentUser.uid,
      fromName: inviterName,
      toUid: player.uid,
      toName: invitedName,
      roomCode: code,
      status: "pending",
      colorForReceiver: receiverColor,
      colorForSender: senderColor,
      createdAt: serverTimestamp()
    });

    setStatus(`Invitasjon sendt til ${invitedName}. Fargene ble randomisert.`);
    window.location.href = `./play.html?room=${encodeURIComponent(code)}`;
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    setStatus("Kunne ikke sende invitasjon: " + (error.code || error.message), false);
  }
}

function renderNoInvites() {
  invitesList.innerHTML = "";

  const empty = document.createElement("div");
  const info = document.createElement("div");
  const title = document.createElement("strong");
  const text = document.createElement("span");

  empty.className = "invite-item";
  title.textContent = "Ingen invitasjoner akkurat nå";
  text.textContent = "Invitasjoner dukker opp her når noen utfordrer deg.";

  info.appendChild(title);
  info.appendChild(text);
  empty.appendChild(info);
  invitesList.appendChild(empty);
}

function colorText(color) {
  return color === "white" ? "hvit" : "svart";
}

function renderInvite(invite) {
  const item = document.createElement("div");
  const info = document.createElement("div");
  const title = document.createElement("strong");
  const text = document.createElement("span");
  const actions = document.createElement("div");
  const acceptBtn = document.createElement("button");
  const declineBtn = document.createElement("button");

  item.className = "invite-item";
  actions.className = "invite-actions";

  title.textContent = `${invite.fromName || "En spiller"} utfordrer deg`;
  text.textContent = `Du ble randomisert som ${colorText(invite.colorForReceiver)}. Romkode: ${invite.roomCode}`;

  acceptBtn.type = "button";
  acceptBtn.className = "mini-btn accept";
  acceptBtn.textContent = "Godta";
  acceptBtn.addEventListener("click", () => respondToInvite(invite, "accepted", acceptBtn, declineBtn));

  declineBtn.type = "button";
  declineBtn.className = "mini-btn decline";
  declineBtn.textContent = "Avslå";
  declineBtn.addEventListener("click", () => respondToInvite(invite, "declined", acceptBtn, declineBtn));

  info.appendChild(title);
  info.appendChild(text);
  actions.appendChild(acceptBtn);
  actions.appendChild(declineBtn);
  item.appendChild(info);
  item.appendChild(actions);
  invitesList.appendChild(item);
}

function listenToInvites(user) {
  onValue(ref(db, "userInvites/" + user.uid), (snap) => {
    invitesList.innerHTML = "";

    if (!snap.exists()) {
      renderNoInvites();
      return;
    }

    const invites = [];

    snap.forEach((child) => {
      const invite = child.val() || {};
      invite.inviteId = invite.inviteId || child.key;

      if (invite.status === "pending") {
        invites.push(invite);
      }
    });

    if (invites.length === 0) {
      renderNoInvites();
      return;
    }

    invites.reverse().forEach(renderInvite);
  }, (error) => {
    invitesList.innerHTML = `<div class='invite-item'><div><strong>Firebase-feil</strong><span>${error.code}</span></div></div>`;
  });
}

async function respondToInvite(invite, response, acceptBtn, declineBtn) {
  if (!currentUser || !invite || !invite.inviteId || !invite.roomCode) return;

  acceptBtn.disabled = true;
  declineBtn.disabled = true;

  const inviteRef = ref(db, `userInvites/${currentUser.uid}/${invite.inviteId}`);
  const gameRef = ref(db, "games/" + invite.roomCode);

  try {
    if (response === "accepted") {
      const snap = await get(gameRef);

      if (!snap.exists()) {
        await update(inviteRef, {
          status: "expired",
          respondedAt: serverTimestamp()
        });
        setStatus("Rommet finnes ikke lenger.");
        return;
      }

      const game = snap.val() || {};
      const isPlayer = game.whiteUid === currentUser.uid || game.blackUid === currentUser.uid;

      if (!isPlayer) {
        setStatus("Denne invitasjonen er ikke koblet til brukeren din.", false);
        return;
      }

      await update(gameRef, {
        status: "playing",
        invitationStatus: "accepted",
        acceptedAt: serverTimestamp()
      });

      await update(inviteRef, {
        status: "accepted",
        respondedAt: serverTimestamp()
      });

      window.location.href = `./play.html?room=${encodeURIComponent(invite.roomCode)}`;
      return;
    }

    await update(inviteRef, {
      status: "declined",
      respondedAt: serverTimestamp()
    });

    await update(gameRef, {
      status: "declined",
      invitationStatus: "declined",
      result: `${getCurrentName()} avslo invitasjonen.`,
      declinedAt: serverTimestamp()
    });

    setStatus("Invitasjonen ble avslått.");
  } catch (error) {
    acceptBtn.disabled = false;
    declineBtn.disabled = false;
    setStatus("Kunne ikke svare på invitasjonen: " + (error.code || error.message), false);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  currentUser = user;

  try {
    await ensureUserProfile(user);
  } catch (error) {
    setStatus("Firebase-reglene stopper brukerprofilen: " + error.code, false);
  }

  listenToMyProfile(user);
  listenToChat();
  listenToPlayers();
  listenToInvites(user);
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

document.getElementById("playBtn").addEventListener("click", () => {
  window.location.href = "./play.html";
});

document.getElementById("friendGameCard").addEventListener("click", () => {
  window.location.href = "./play.html";
});

document.getElementById("profileCard").addEventListener("click", () => {
  window.location.href = "./profile.html";
});

openProfileBtn.addEventListener("click", () => {
  window.location.href = "./profile.html";
});

document.getElementById("leaderboardBtn").addEventListener("click", () => {
  setStatus("Rangliste kommer snart 🔥");
});

document.getElementById("leaderboardCard").addEventListener("click", () => {
  setStatus("Rangliste kommer snart 🔥");
});

document.getElementById("trainingCard").addEventListener("click", () => {
  setStatus("Sjakktrening kommer snart 🔥");
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";

  try {
    await push(ref(db, "loungeChat"), {
      uid: currentUser.uid,
      name: username.textContent || getFallbackName(currentUser),
      text: text.slice(0, 220),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    chatInput.value = text;
    setStatus("Kunne ikke sende chatmelding: " + error.code, false);
  }
});

document.querySelectorAll(".menu-card").forEach((card) => {
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      card.click();
    }
  });
});
