import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHVjtKQv1tZ8sV9MKOYSr05Y8rXxv-tLQ",
  authDomain: "berlands-sjakk.firebaseapp.com",
  databaseURL: "https://berlands-sjakk-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "berlands-sjakk",
  storageBucket: "berlands-sjakk.firebasestorage.app",
  messagingSenderId: "884597270594",
  appId: "1:884597270594:web:0284119adb9ceacc7ba5db"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
