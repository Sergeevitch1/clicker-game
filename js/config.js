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
tg.ready();

// Get user ID
const userId = tg.initDataUnsafe?.user?.id || 'guest_' + Math.random().toString(36).substr(2, 9);

// ===== GAME CONSTANTS =====
const GAME_CONFIG = {
    // Combo
    COMBO_DURATION: 10000, // 10 seconds
    COMBO_MAX_MULTIPLIER: 2.0,
    COMBO_INCREMENT: 0.05, // +0.05 per click
    
    // Click Power Cooldown
    CLICK_COOLDOWN: 5000, // 5 seconds
    
    // Auto Click (temporary)
    AUTO_DURATION: 60000, // 1 minute
    AUTO_BASE_POWER: 5,
    
    // Multiplier x2 (temporary)
    MULTI_DURATION: 300000, // 5 minutes
    MULTI_VALUE: 2,
    
    // Energy
    ENERGY_BASE: 100,
    ENERGY_PER_BALANCE: 100, // 1 energy per $100
    ENERGY_REGEN_BASE: 1,
    
    // Jackpot
    JACKPOT_MULTIPLIER: 10,
    JACKPOT_BASE_CHANCE: 0.05, // 5%
    JACKPOT_CHANCE_PER_LEVEL: 0.05, // +5% per level
    
    // Prices (base)
    PRICES: {
        click: 100,
        auto: 500,
        energy: 200,
        multi: 5000,
        regen: 1000,
        jackpot: 10000
    },
    
    // Price multipliers
    PRICE_GROWTH: {
        click: 2.5,
        auto: 2.0,
        energy: 2.5,
        multi: 3.0,
        regen: 3.0,
        jackpot: 3.0
    },
    
    // Power growth
    POWER_GROWTH: {
        click: 1,
        auto: 5,
        energy: 100,
        regen: 1
    }
};
