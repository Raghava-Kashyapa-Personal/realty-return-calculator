// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCkXAyeDMosS8YlSfjKPEmWqbkXn0jBoPE",
  authDomain: "equity-qualitas.firebaseapp.com",
  databaseURL: "https://equity-qualitas-default-rtdb.firebaseio.com",
  projectId: "equity-qualitas",
  storageBucket: "equity-qualitas.firebasestorage.app",
  messagingSenderId: "898965383489",
  appId: "1:898965383489:web:779c0e6547ef20c23e19c0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const database = getDatabase(app);

export { app, db, database };