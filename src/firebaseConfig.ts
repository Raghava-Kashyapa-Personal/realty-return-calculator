// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCpn7HGEITSRMFtoH08qgk74mrx9qivQaQ",
  authDomain: "newproj-e3530.firebaseapp.com",
  projectId: "newproj-e3530",
  storageBucket: "newproj-e3530.firebasestorage.app",
  messagingSenderId: "710119677915",
  appId: "1:710119677915:web:0a6ef5f44ce1884d8351fe",
  measurementId: "G-X6Z2L8RZT6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const database = getDatabase(app);

export { app, db, database };