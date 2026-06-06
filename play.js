import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  set,
  get,
  update,
  onValue,
  off,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const roomCodeEl = document.getElementById("roomCode");
const whitePlayerEl = document.getElementById("whitePlayer");
const blackPlayerEl = document.getElementById("blackPlayer");
const movesEl = document.getElementById("moves");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const joinCodeInput = document.getElementById("joinCode");
const logoutBtn = document.getElementById("logoutBtn");
const homeBtn = document.getElementById("homeBtn");

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = (urlParams.get("room") || "")
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, "")
  .slice(0, 5);

let user = null;
let activeRoom = null;
let activeRoomRef = null;
let activeGameData = null;
let playerColor = null;
let selectedSquare = null;
let legalTargets = [];

function pieceSvg(body) {
  return `
    <svg class="piece-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      ${body}
    </svg>
  `;
}

function getPieceSvg(piece) {
  const base = `
    <ellipse class="piece-shadow" cx="50" cy="88" rx="32" ry="7"></ellipse>
    <path class="piece-fill" d="M25 82 C31 75 69 75 75 82 L72 90 L28 90 Z"></path>
    <path class="piece-line" d="M31 82 H69"></path>
  `;

  const pieces = {
    p: `
      <circle class="piece-fill" cx="50" cy="28" r="13"></circle>
      <path class="piece-fill" d="M42 43 H58 C58 52 63 60 66 73 H34 C37 60 42 52 42 43 Z"></path>
      <path class="piece-line" d="M40 72 H60"></path>
      ${base}
    `,

    n: `
      <path class="piece-fill" d="M34 75 C36 63 39 53 45 45 C38 38 39 26 47 17 C54 25 65 30 69 40 C73 51 65 62 56 67 L65 75 Z"></path>
      <path class="piece-detail" d="M51 35 C56 37 60 40 62 45"></path>
      <circle class="piece-dot" cx="55" cy="36" r="2.4"></circle>
      <path class="piece-line" d="M43 63 C49 68 56 70 63 70"></path>
      ${base}
    `,

    b: `
      <path class="piece-fill" d="M50 14 C66 27 69 43 57 55 C64 61 66 68 66 75 H34 C34 68 36 61 43 55 C31 43 34 27 50 14 Z"></path>
      <path class="piece-detail" d="M56 27 L43 48"></path>
      <circle class="piece-dot" cx="50" cy="20" r="2.8"></circle>
      ${base}
    `,

    r: `
      <path class="piece-fill" d="M32 18 H42 V27 H47 V18 H53 V27 H58 V18 H68 V38 H32 Z"></path>
      <path class="piece-fill" d="M38 38 H62 L66 75 H34 Z"></path>
      <path class="piece-line" d="M34 39 H66"></path>
      <path class="piece-line" d="M38 70 H62"></path>
      ${base}
    `,

    q: `
      <circle class="piece-fill" cx="30" cy="23" r="6"></circle>
      <circle class="piece-fill" cx="50" cy="15" r="7"></circle>
      <circle class="piece-fill" cx="70" cy="23" r="6"></circle>
      <path class="piece-fill" d="M26 32 L39 38 L50 24 L61 38 L74 32 L66 58 H34 Z"></path>
      <path class="piece-fill" d="M39 58 H61 C65 64 66 69 66 75 H34 C34 69 35 64 39 58 Z"></path>
      <path class="piece-line" d="M34 58 H66"></path>
      ${base}
    `,

    k: `
      <path class="piece-detail" d="M50 10 V28"></path>
      <path class="piece-detail" d="M41 18 H59"></path>
      <path class="piece-fill" d="M39 31 C39 24 61 24 61 31 C61 39 55 42 55 50 C64 55 67 65 67 75 H33 C33 65 36 55 45 50 C45 42 39 39 39 31 Z"></path>
      <path class="piece-line" d="M39 73 H61"></path>
      ${base}
    `
  };

  return pieceSvg(pieces[piece.type] || "");
}

function showStatus(text) {
  statusEl.textContent = text;
}

function getPlayerName() {
  if (!user) return "Ukjent spiller";
  return user.displayName || user.email || "Sjakkspiller";
}

function makeRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  return code;
}

function getChess() {
  if (!window.Chess) {
    showStatus("Chess.js lastet ikke. Sjekk internett eller oppdater siden.");
    return null;
  }

  const chess = new window.Chess();

  if (activeGameData && activeGameData.fen) {
    const loaded = chess.load(activeGameData.fen);

    if (!loaded) {
      showStatus("Ugyldig sjakkstilling. Lag et nytt rom.");
    }
  }

  return chess;
}

function squareColor(squareName) {
  const file = squareName.charCodeAt(0) - 97;
  const rank = Number(squareName[1]);
  return (file + rank) % 2 === 0 ? "light" : "dark";
}

function renderBoard() {
  const chess = getChess();
  if (!chess) return;

  boardEl.innerHTML = "";

  const filesWhite = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranksWhite = [8, 7, 6, 5, 4, 3, 2, 1];

  const filesBlack = ["h", "g", "f", "e", "d", "c", "b", "a"];
  const ranksBlack = [1, 2, 3, 4, 5, 6, 7, 8];

  const files = playerColor === "black" ? filesBlack : filesWhite;
  const ranks = playerColor === "black" ? ranksBlack : ranksWhite;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const squareName = files[f] + ranks[r];
      const piece = chess.get(squareName);

      const square = document.createElement("div");
      square.className = "square " + squareColor(squareName);

      if (selectedSquare === squareName) {
        square.classList.add("selected");
      }

      const legalMove = legalTargets.find((move) => move.to === squareName);

      if (legalMove) {
        if (piece) {
          square.classList.add("capture");
        } else {
          square.classList.add("legal");
        }
      }

      if (piece) {
        const pieceSpan = document.createElement("span");
        pieceSpan.className = `piece ${piece.color === "w" ? "white-piece" : "black-piece"}`;
        pieceSpan.innerHTML = getPieceSvg(piece);
        square.appendChild(pieceSpan);
      }

      const coord = document.createElement("span");
      coord.className = "coord";
      coord.textContent = squareName.toUpperCase();
      square.appendChild(coord);

      square.addEventListener("click", () => handleSquareClick(squareName));

      boardEl.appendChild(square);
    }
  }
}

function renderMoves() {
  if (!activeGameData || !Array.isArray(activeGameData.moves) || activeGameData.moves.length === 0) {
    movesEl.innerHTML = "<strong>Trekk:</strong><br>Ingen trekk enda.";
    return;
  }

  movesEl.innerHTML =
    "<strong>Trekk:</strong><br>" +
    activeGameData.moves.map((move, index) => `${index + 1}. ${move}`).join("<br>");
}

function updateGameText() {
  if (!activeGameData) {
    whitePlayerEl.textContent = "Venter...";
    blackPlayerEl.textContent = "Venter...";
    roomCodeEl.textContent = activeRoom || "------";
    renderMoves();
    return;
  }

  if (activeGameData.status === "waiting" && activeGameData.creatorName && !activeGameData.whiteUid && !activeGameData.blackUid) {
    whitePlayerEl.textContent = "Trekkes når spiller 2 blir med";
    blackPlayerEl.textContent = "Trekkes når spiller 2 blir med";
  } else {
    whitePlayerEl.textContent = activeGameData.whiteName || "Hvit";
    blackPlayerEl.textContent = activeGameData.blackName || "Venter på svart...";
  }

  roomCodeEl.textContent = activeRoom || "------";

  const chess = getChess();
  if (!chess) return;

  if (activeGameData.status === "waiting") {
    if (activeGameData.creatorName && !activeGameData.whiteUid && !activeGameData.blackUid) {
      showStatus("Rommet er klart. Del romkoden med vennen din. Hvit/svart trekkes tilfeldig når vennen blir med.");
    } else {
      showStatus("Rommet er klart. Del romkoden med vennen din.");
    }
  } else if (activeGameData.status === "waitingInvite") {
    const text = activeGameData.inviterUid === user.uid
      ? "Invitasjon sendt. Venter på at motstanderen godtar eller avslår."
      : "Du har en ventende invitasjon. Gå til hjemmesiden for å godta eller avslå.";
    showStatus(text);
  } else if (activeGameData.status === "declined") {
    showStatus(activeGameData.result || "Invitasjonen ble avslått.");
  } else if (activeGameData.status === "finished") {
    showStatus(activeGameData.result || "Partiet er ferdig.");
  } else {
    const turnText = chess.turn() === "w" ? "Hvit sin tur" : "Svart sin tur";
    const yourColorText = playerColor ? `Du spiller ${playerColor === "white" ? "hvit" : "svart"}.` : "Du ser på.";
    const checkText = activeGameData.result === "Sjakk!" ? "Sjakk! " : "";
    showStatus(`${checkText}${turnText}. ${yourColorText}`);
  }

  renderMoves();
}

function isMyTurn(chess) {
  if (!playerColor) return false;
  if (!activeGameData || activeGameData.status !== "playing") return false;

  if (playerColor === "white" && chess.turn() === "w") return true;
  if (playerColor === "black" && chess.turn() === "b") return true;

  return false;
}

function handleSquareClick(squareName) {
  if (!activeGameData || !activeRoom) {
    showStatus("Lag eller bli med i et rom først.");
    return;
  }

  const chess = getChess();
  if (!chess) return;

  if (!isMyTurn(chess)) {
    if (activeGameData.status === "waiting") {
      showStatus("Venter på at en venn blir med før partiet starter. Fargene trekkes tilfeldig.");
    } else {
      showStatus("Det er ikke din tur akkurat nå.");
    }
    return;
  }

  const piece = chess.get(squareName);
  const myPieceColor = playerColor === "white" ? "w" : "b";

  if (!selectedSquare) {
    if (!piece) return;

    if (piece.color !== myPieceColor) {
      showStatus("Du kan bare flytte dine egne brikker.");
      return;
    }

    selectedSquare = squareName;
    legalTargets = chess.moves({
      square: squareName,
      verbose: true
    });

    renderBoard();
    return;
  }

  if (selectedSquare === squareName) {
    selectedSquare = null;
    legalTargets = [];
    renderBoard();
    return;
  }

  const move = chess.move({
    from: selectedSquare,
    to: squareName,
    promotion: "q"
  });

  if (!move) {
    if (piece && piece.color === myPieceColor) {
      selectedSquare = squareName;
      legalTargets = chess.moves({
        square: squareName,
        verbose: true
      });
      renderBoard();
      return;
    }

    showStatus("Ulovlig trekk.");
    selectedSquare = null;
    legalTargets = [];
    renderBoard();
    return;
  }

  selectedSquare = null;
  legalTargets = [];

  saveMove(chess, move);
}

async function saveMove(chess, move) {
  let status = "playing";
  let result = "";

  if (chess.in_checkmate()) {
    status = "finished";
    const winner = move.color === "w" ? "Hvit" : "Svart";
    result = `Sjakk matt! ${winner} vant.`;
  } else if (chess.in_draw()) {
    status = "finished";
    result = "Partiet endte med remis.";
  } else if (chess.in_check()) {
    result = "Sjakk!";
  }

  const oldMoves = activeGameData.moves || [];
  const newMoves = [...oldMoves, move.san];

  try {
    await update(ref(db, "games/" + activeRoom), {
      fen: chess.fen(),
      turn: chess.turn(),
      status,
      result,
      moves: newMoves,
      lastMoveAt: serverTimestamp()
    });
  } catch (error) {
    showStatus("Kunne ikke lagre trekket. Sjekk Firebase Rules: " + error.code);
  }
}

async function makeUniqueRoomCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeRoomCode();
    const snap = await get(ref(db, "games/" + code));

    if (!snap.exists()) {
      return code;
    }
  }

  throw new Error("Kunne ikke lage unik romkode. Prøv igjen.");
}

async function createRoom() {
  if (!user) {
    showStatus("Du må være innlogget først.");
    return;
  }

  if (!window.Chess) {
    showStatus("Chess.js lastet ikke. Prøv å oppdatere siden.");
    return;
  }

  try {
    createRoomBtn.disabled = true;
    showStatus("Lager rom...");

    const code = await makeUniqueRoomCode();
    const chess = new window.Chess();

    await set(ref(db, "games/" + code), {
      code,
      status: "waiting",
      fen: chess.fen(),
      turn: "w",
      creatorUid: user.uid,
      creatorName: getPlayerName(),
      randomColors: true,
      whiteUid: "",
      whiteName: "",
      blackUid: "",
      blackName: "",
      createdAt: serverTimestamp(),
      lastMoveAt: serverTimestamp(),
      moves: []
    });

    enterRoom(code);
  } catch (error) {
    showStatus("Kunne ikke lage rom. Sjekk Firebase Rules: " + (error.code || error.message));
  } finally {
    createRoomBtn.disabled = false;
  }
}


async function assignRandomColorsAndJoin(roomRef, code, game) {
  const creatorUid = game.creatorUid;
  const creatorName = game.creatorName || "Sjakkspiller";

  if (!creatorUid) {
    return false;
  }

  if (creatorUid === user.uid) {
    enterRoom(code);
    return true;
  }

  const creatorIsWhite = Math.random() < 0.5;

  await update(roomRef, {
    whiteUid: creatorIsWhite ? creatorUid : user.uid,
    whiteName: creatorIsWhite ? creatorName : getPlayerName(),
    blackUid: creatorIsWhite ? user.uid : creatorUid,
    blackName: creatorIsWhite ? getPlayerName() : creatorName,
    status: "playing",
    joinedAt: serverTimestamp()
  });

  enterRoom(code);
  return true;
}

async function joinRoom() {
  if (!user) {
    showStatus("Du må være innlogget først.");
    return;
  }

  const code = joinCodeInput.value.trim().toUpperCase();

  if (!code) {
    showStatus("Skriv inn romkode først.");
    return;
  }

  try {
    joinRoomBtn.disabled = true;
    showStatus("Kobler til rom...");

    const roomRef = ref(db, "games/" + code);
    const snap = await get(roomRef);

    if (!snap.exists()) {
      showStatus("Fant ikke rommet. Sjekk romkoden.");
      return;
    }

    const game = snap.val();

    if (game.whiteUid === user.uid || game.blackUid === user.uid || game.creatorUid === user.uid) {
      enterRoom(code);
      return;
    }

    if (game.status === "waiting" && !game.whiteUid && !game.blackUid && game.creatorUid) {
      await assignRandomColorsAndJoin(roomRef, code, game);
      return;
    }

    if (game.status === "waitingInvite") {
      showStatus("Dette rommet er en privat invitasjon.");
      return;
    }

    if (game.status === "declined") {
      showStatus(game.result || "Invitasjonen ble avslått.");
      return;
    }

    if (game.blackUid) {
      showStatus("Rommet er allerede fullt.");
      return;
    }

    await update(roomRef, {
      blackUid: user.uid,
      blackName: getPlayerName(),
      status: "playing",
      joinedAt: serverTimestamp()
    });

    enterRoom(code);
  } catch (error) {
    showStatus("Kunne ikke bli med. Sjekk Firebase Rules: " + (error.code || error.message));
  } finally {
    joinRoomBtn.disabled = false;
  }
}

function enterRoom(code) {
  if (activeRoomRef) {
    off(activeRoomRef);
  }

  activeRoom = code;
  activeRoomRef = ref(db, "games/" + code);

  selectedSquare = null;
  legalTargets = [];
  roomCodeEl.textContent = code;

  onValue(activeRoomRef, (snap) => {
    if (!snap.exists()) {
      showStatus("Rommet finnes ikke lenger.");
      return;
    }

    activeGameData = snap.val();

    if (activeGameData.whiteUid === user.uid) {
      playerColor = "white";
    } else if (activeGameData.blackUid === user.uid) {
      playerColor = "black";
    } else {
      playerColor = null;
    }

    updateGameText();
    renderBoard();
  }, (error) => {
    showStatus("Firebase-feil i rommet: " + error.code);
  });
}

async function openRoomFromUrl(code) {
  if (!code) return;

  try {
    showStatus("Åpner rom " + code + "...");
    joinCodeInput.value = code;

    const roomRef = ref(db, "games/" + code);
    const snap = await get(roomRef);

    if (!snap.exists()) {
      showStatus("Fant ikke rommet fra lenken.");
      renderBoard();
      return;
    }

    const game = snap.val() || {};

    if (game.whiteUid === user.uid || game.blackUid === user.uid || game.creatorUid === user.uid) {
      enterRoom(code);
      return;
    }

    if (game.status === "waiting" && !game.whiteUid && !game.blackUid && game.creatorUid) {
      await assignRandomColorsAndJoin(roomRef, code, game);
      return;
    }

    if (game.status === "waiting" && game.whiteUid && !game.blackUid) {
      await update(roomRef, {
        blackUid: user.uid,
        blackName: getPlayerName(),
        status: "playing",
        joinedAt: serverTimestamp()
      });

      enterRoom(code);
      return;
    }

    if (game.status === "waitingInvite") {
      showStatus("Dette rommet er en privat invitasjon for en annen bruker.");
      renderBoard();
      return;
    }

    showStatus("Du er ikke deltaker i dette rommet.");
    renderBoard();
  } catch (error) {
    showStatus("Kunne ikke åpne rommet: " + (error.code || error.message));
    renderBoard();
  }
}

onAuthStateChanged(auth, (currentUser) => {
  if (!currentUser) {
    window.location.href = "./index.html";
    return;
  }

  user = currentUser;

  if (roomFromUrl) {
    openRoomFromUrl(roomFromUrl);
    return;
  }

  showStatus("Innlogget. Lag et rom eller bli med i et rom.");
  renderBoard();
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);

joinCodeInput.addEventListener("input", () => {
  joinCodeInput.value = joinCodeInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
});

joinCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinRoomBtn.click();
  }
});

homeBtn.addEventListener("click", () => {
  window.location.href = "./home.html";
});

logoutBtn.addEventListener("click", async () => {
  if (activeRoomRef) {
    off(activeRoomRef);
  }

  await signOut(auth);
  window.location.href = "./index.html";
});
