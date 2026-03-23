// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyAhsAZIQPeudjXsO275v9wf1BuVM0x8B1g",
    authDomain: "clicker-game-22323.firebaseapp.com",
    databaseURL: "https://clicker-game-22323-default-rtdb.firebaseio.com",
    projectId: "кликер-игра-22323",
    storageBucket: "clicker-game-22323.firebasestorage.app",
    messagingSenderId: "851035040900",
    appId: "1:851035040900:web:2cea7586861cb4deee26d1",
    measurementId: "G-D71LKP8962"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Get user ID
const userId = tg.initDataUnsafe?.user?.id || 'guest';
