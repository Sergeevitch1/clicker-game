// ===== GAME STATE =====
let gameData = {
    balance: 0,
    totalEarned: 0,
    energy: 100,
    maxEnergy: 100,
    clickPower: 1,
    autoClick: 0,
    energyRegen: 1,
    jackpotLevel: 0,
    combo: 0,
    comboMultiplier: 1.0,
    lastComboReset: 0,
    lastClickTime: 0,
    clickCooldownActive: false,
    activeEffects: {
        auto: { active: false, endTime: 0, power: 0 },
        multi: { active: false, endTime: 0 }
    },
    upgrades: {
        click: { level: 1, cost: 100 },
        auto: { level: 1, cost: 500 },
        energy: { level: 1, cost: 200 },
        multi: { level: 1, cost: 5000 },
        regen: { level: 1, cost: 1000 },
        jackpot: { level: 0, cost: 10000 }
    }
};

// ===== FIREBASE SYNC =====
function loadFromFirebase() {
    const userRef = db.ref('users/' + userId);
    
    userRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // Safe merge with validation
            gameData.balance = Math.max(0, Number(data.balance) || 0);
            gameData.totalEarned = Math.max(0, Number(data.totalEarned) || 0);
            gameData.energy = Math.max(0, Number(data.energy) || 100);
            gameData.maxEnergy = Math.max(100, Number(data.maxEnergy) || 100);
            gameData.clickPower = Math.max(1, Number(data.clickPower) || 1);
            gameData.autoClick = Math.max(0, Number(data.autoClick) || 0);
            gameData.energyRegen = Math.max(1, Number(data.energyRegen) || 1);
            gameData.jackpotLevel = Math.max(0, Number(data.jackpotLevel) || 0);
            gameData.combo = 0;
            gameData.comboMultiplier = 1.0;
            gameData.lastComboReset = 0;
            gameData.lastClickTime = 0;
            gameData.clickCooldownActive = false;
            
            // Load active effects
            if (data.activeEffects) {
                gameData.activeEffects = { ...gameData.activeEffects, ...data.activeEffects };
            }
            
            // Load upgrades
            if (data.upgrades) {
                Object.keys(gameData.upgrades).forEach(key => {
                    if (data.upgrades[key]) {
                        gameData.upgrades[key] = { ...gameData.upgrades[key], ...data.upgrades[key] };
                    }
                });
            }
            
            // Restore active effects
            restoreActiveEffects();
        }
        
        updateUI();
        document.getElementById('loading').style.display = 'none';
        
    }).catch((err) => {
        console.error('Firebase load error:', err);
        document.getElementById('loading').innerHTML = `
            <div style="color:red;padding:20px;text-align:center">
                ❌ Ошибка!<br>
                <button onclick="location.reload()" style="margin-top:10px;padding:10px 20px;cursor:pointer;background:#00d4ff;color:#000;border:none;border-radius:8px;font-weight:bold">
                    Обновить
                </button>
            </div>
        `;
    });

    // Real-time listener
    userRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            gameData.balance = Math.max(0, Number(data.balance) || 0);
            gameData.energy = Math.max(0, Number(data.energy) || 100);
            gameData.maxEnergy = Math.max(100, Number(data.maxEnergy) || 100);
            gameData.clickPower = Math.max(1, Number(data.clickPower) || 1);
            gameData.autoClick = Math.max(0, Number(data.autoClick) || 0);
            gameData.energyRegen = Math.max(1, Number(data.energyRegen) || 1);
            
            if (data.activeEffects) {
                gameData.activeEffects = { ...gameData.activeEffects, ...data.activeEffects };
            }
            
            if (data.upgrades) {
                Object.keys(gameData.upgrades).forEach(key => {
                    if (data.upgrades[key]) {
                        gameData.upgrades[key] = { ...gameData.upgrades[key], ...data.upgrades[key] };
                    }
                });
            }
            
            updateUI();
        }
    });
}

function saveToFirebase() {
    db.ref('users/' + userId).set({
        balance: Math.max(0, gameData.balance),
        totalEarned: Math.max(0, gameData.totalEarned),
        energy: Math.max(0, gameData.energy),
        maxEnergy: gameData.maxEnergy,
        clickPower: gameData.clickPower,
        autoClick: gameData.autoClick,
        energyRegen: gameData.energyRegen,
        jackpotLevel: gameData.jackpotLevel,
        activeEffects: gameData.activeEffects,
        upgrades: gameData.upgrades
    }).catch(console.error);
}

function updateBalance(amount) {
    const final = Math.floor(amount * getActiveMultiplier());
    gameData.balance += final;
    gameData.totalEarned += final;
    gameData.balance = Math.max(0, gameData.balance);
    
    // Update max energy based on balance
    const newMaxEnergy = GAME_CONFIG.ENERGY_BASE + Math.floor(gameData.balance / GAME_CONFIG.ENERGY_PER_BALANCE) + 
                         (gameData.upgrades.energy.level - 1) * GAME_CONFIG.POWER_GROWTH.energy;
    gameData.maxEnergy = Math.max(100, newMaxEnergy);
    
    db.ref('users/' + userId + '/balance').set(gameData.balance);
    db.ref('users/' + userId + '/totalEarned').set(gameData.totalEarned);
    db.ref('users/' + userId + '/maxEnergy').set(gameData.maxEnergy);
    
    return final;
}

function getActiveMultiplier() {
    let mult = gameData.comboMultiplier;
    if (gameData.activeEffects.multi.active && Date.now() < gameData.activeEffects.multi.endTime) {
        mult *= GAME_CONFIG.MULTI_VALUE;
    }
    return mult;
}

// ===== ACTIVE EFFECTS =====
function restoreActiveEffects() {
    const now = Date.now();
    
    // Auto click
    if (gameData.activeEffects.auto.active && now < gameData.activeEffects.auto.endTime) {
        gameData.autoClick = gameData.activeEffects.auto.power;
        startAutoTimer();
    } else {
        gameData.activeEffects.auto.active = false;
        gameData.autoClick = 0;
    }
    
    // Multiplier
    if (gameData.activeEffects.multi.active && now < gameData.activeEffects.multi.endTime) {
        startMultiTimer();
    } else {
        gameData.activeEffects.multi.active = false;
    }
}

function startAutoTimer() {
    const timer = setInterval(() => {
        const remaining = gameData.activeEffects.auto.endTime - Date.now();
        
        if (remaining <= 0) {
            clearInterval(timer);
            gameData.activeEffects.auto.active = false;
            gameData.autoClick = 0;
            saveToFirebase();
            showNotification('⏰ Авто-клик истёк!');
        }
        
        updateAutoTimerUI(remaining);
    }, 100);
}

function startMultiTimer() {
    const timer = setInterval(() => {
        const remaining = gameData.activeEffects.multi.endTime - Date.now();
        
        if (remaining <= 0) {
            clearInterval(timer);
            gameData.activeEffects.multi.active = false;
            saveToFirebase();
            showNotification('⏰ Мульти x2 истёк!');
        }
        
        updateMultiTimerUI(remaining);
    }, 100);
}

function updateAutoTimerUI(ms) {
    const seconds = Math.ceil(ms / 1000);
    const bar = document.getElementById('autoTimer');
    const text = document.getElementById('autoText');
    
    if (bar && text) {
        const percent = (ms / GAME_CONFIG.AUTO_DURATION) * 100;
        bar.style.width = percent + '%';
        text.textContent = seconds + ' сек';
    }
}

function updateMultiTimerUI(ms) {
    const minutes = Math.ceil(ms / 60000);
    const seconds = Math.ceil((ms % 60000) / 1000);
    const bar = document.getElementById('multiTimer');
    const text = document.getElementById('multiText');
    
    if (bar && text) {
        const percent = (ms / GAME_CONFIG.MULTI_DURATION) * 100;
        bar.style.width = percent + '%';
        text.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }
}

// ===== COMBO SYSTEM =====
function updateCombo() {
    const now = Date.now();
    
    if (now - gameData.lastComboReset > GAME_CONFIG.COMBO_DURATION) {
        gameData.combo = 0;
        gameData.comboMultiplier = 1.0;
    }
    
    gameData.lastComboReset = now;
    gameData.combo = Math.min(gameData.combo + 1, 100);
    
    // Calculate multiplier (max 2.0)
    gameData.comboMultiplier = Math.min(1.0 + (gameData.combo * GAME_CONFIG.COMBO_INCREMENT), GAME_CONFIG.COMBO_MAX_MULTIPLIER);
    
    // Update UI
    const comboText = document.getElementById('comboText');
    const comboValue = document.getElementById('comboValue');
    const comboFill = document.getElementById('comboFill');
    const comboTimer = document.getElementById('comboTimer');
    
    if (comboText && comboValue && comboFill) {
        comboValue.textContent = gameData.comboMultiplier.toFixed(1);
        comboFill.style.width = Math.min((gameData.comboMultiplier - 1) / (GAME_CONFIG.COMBO_MAX_MULTIPLIER - 1) * 100, 100) + '%';
        
        if (gameData.combo > 5) {
            comboText.classList.add('active');
            document.getElementById('clickButton').classList.add('combo');
            setTimeout(() => {
                document.getElementById('clickButton').classList.remove('combo');
            }, 300);
        }
    }
    
    if (comboTimer) {
        const timeLeft = Math.max(0, GAME_CONFIG.COMBO_DURATION - (now - gameData.lastComboReset));
        comboTimer.textContent = (timeLeft / 1000).toFixed(1) + ' сек';
    }
}

// ===== UPGRADES =====
function buyUpgrade(type) {
    const upg = gameData.upgrades[type];
    const config = GAME_CONFIG.PRICES[type];
    
    if (!upg || gameData.balance < upg.cost) {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        showNotification('❌ Недостаточно $!', 'error');
        return;
    }
    
    // Check cooldown for click power
    if (type === 'click' && gameData.clickCooldownActive) {
        showNotification('⏳ Подожди 5 сек!', 'error');
        return;
    }
    
    // Deduct money FIRST
    gameData.balance -= upg.cost;
    
    if (type === 'click') {
        // Start cooldown
        gameData.clickCooldownActive = true;
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.click);
        gameData.clickPower += GAME_CONFIG.POWER_GROWTH.click;
        
        // Visual cooldown
        const cooldownBar = document.getElementById('clickCooldown');
        if (cooldownBar) {
            cooldownBar.classList.add('active');
            setTimeout(() => {
                cooldownBar.classList.remove('active');
                gameData.clickCooldownActive = false;
            }, GAME_CONFIG.CLICK_COOLDOWN);
        }
        
        showNotification(`⚡ +1$ за клик!`);
        
    } else if (type === 'auto') {
        // Temporary auto-click (1 minute)
        const now = Date.now();
        gameData.activeEffects.auto.active = true;
        gameData.activeEffects.auto.endTime = now + GAME_CONFIG.AUTO_DURATION;
        gameData.activeEffects.auto.power = gameData.autoClick + GAME_CONFIG.POWER_GROWTH.auto * upg.level;
        gameData.autoClick = gameData.activeEffects.auto.power;
        
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.auto);
        
        startAutoTimer();
        showNotification(`🤖 Авто-клик на 1 мин!`);
        
    } else if (type === 'energy') {
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.energy);
        gameData.maxEnergy += GAME_CONFIG.POWER_GROWTH.energy;
        gameData.energy = gameData.maxEnergy;
        showNotification(`🔋 +100 макс энергии!`);
        
    } else if (type === 'multi') {
        // Temporary multiplier (5 minutes)
        const now = Date.now();
        gameData.activeEffects.multi.active = true;
        gameData.activeEffects.multi.endTime = now + GAME_CONFIG.MULTI_DURATION;
        
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.multi);
        
        startMultiTimer();
        showNotification(`💎 МУЛЬТИ x2 на 5 мин!`);
        
    } else if (type === 'regen') {
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.regen);
        gameData.energyRegen += GAME_CONFIG.POWER_GROWTH.regen;
        showNotification(`⚡ Реген +1/сек!`);
        
    } else if (type === 'jackpot') {
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.jackpot);
        gameData.jackpotLevel = upg.level;
        showNotification(`🎰 Шанс джекпота увеличен!`);
    }
    
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    updateUI();
    saveToFirebase();
}

function showNotification(text, type = '') {
    const n = document.getElementById('notification');
    n.textContent = text;
    n.className = 'notification show ' + type;
    setTimeout(() => n.classList.remove('show'), 2000);
}

// ===== UI UPDATE =====
function updateUI() {
    // Balance
    document.getElementById('balance').textContent = '$' + Math.floor(gameData.balance).toLocaleString();
    
    // Energy
    document.getElementById('energyText').textContent = `${Math.floor(gameData.energy)} / ${gameData.maxEnergy}`;
    document.getElementById('energyFill').style.width = `${(gameData.energy / gameData.maxEnergy) * 100}%`;
    document.getElementById('energyRegen').textContent = `+${gameData.energyRegen}/сек`;
    
    // Stats
    const mult = getActiveMultiplier();
    document.getElementById('perClick').textContent = '$' + (gameData.clickPower * mult).toLocaleString();
    document.getElementById('perSecond').textContent = '$' + (gameData.autoClick * mult).toLocaleString();
    document.getElementById('totalEarned').textContent = '$' + Math.floor(gameData.totalEarned).toLocaleString();
    
    // Upgrades
    ['click', 'energy', 'regen', 'jackpot'].forEach(t => {
        const c = document.getElementById(`cost${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const l = document.getElementById(`level${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (c && gameData.upgrades[t]?.cost) c.textContent = '$' + gameData.upgrades[t].cost.toLocaleString();
        if (l && gameData.upgrades[t]?.level) l.textContent = gameData.upgrades[t].level;
    });
    
    // Auto & Multi
    if (gameData.upgrades.auto?.cost) document.getElementById('costAuto').textContent = '$' + gameData.upgrades.auto.cost.toLocaleString();
    if (gameData.upgrades.multi?.cost) document.getElementById('costMulti').textContent = '$' + gameData.upgrades.multi.cost.toLocaleString();
    
    // Bonuses
    document.getElementById('clickBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.click}$ за клик`;
    document.getElementById('autoBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.auto * gameData.upgrades.auto.level}$/сек`;
    document.getElementById('energyBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.energy} макс`;
    document.getElementById('regenBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.regen}/сек`;
    document.getElementById('jackpotBonus').textContent = `${(GAME_CONFIG.JACKPOT_BASE_CHANCE + gameData.jackpotLevel * GAME_CONFIG.JACKPOT_CHANCE_PER_LEVEL) * 100}% шанс x10`;
    
    checkShop();
}

function checkShop() {
    ['click', 'auto', 'energy', 'multi', 'regen', 'jackpot'].forEach(t => {
        const item = document.getElementById(`boost${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const upg = gameData.upgrades[t];
        if (item && upg) {
            item.classList.toggle('disabled', gameData.balance < upg.cost);
            if (t === 'click' && gameData.clickCooldownActive) {
                item.classList.add('on-cooldown');
            } else {
                item.classList.remove('on-cooldown');
            }
        }
    });
}

// ===== CLICK HANDLER =====
document.getElementById('clickButton').addEventListener('click', function(e) {
    const energyCost = 1;
    
    if (gameData.energy >= energyCost) {
        // Spend energy
        gameData.energy -= energyCost;
        db.ref('users/' + userId + '/energy').set(Math.max(0, gameData.energy));
        
        // Update combo
        updateCombo();
        
        // Calculate earnings
        let amount = gameData.clickPower * gameData.comboMultiplier;
        
        // Jackpot check
        const jackpotChance = GAME_CONFIG.JACKPOT_BASE_CHANCE + (gameData.jackpotLevel * GAME_CONFIG.JACKPOT_CHANCE_PER_LEVEL);
        if (Math.random() < jackpotChance) {
            amount *= GAME_CONFIG.JACKPOT_MULTIPLIER;
            showNotification('🎰 ДЖЕКПОТ x10!', 'jackpot');
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        }
        
        const earned = updateBalance(amount);
        
        // Visual effects
        const rect = this.getBoundingClientRect();
        const x = e.clientX || (rect.left + rect.width / 2);
        const y = e.clientY || (rect.top + rect.height / 2);
        showFloat(x, y, `+$${earned}`, jackpotChance > 0 && Math.random() < jackpotChance);
        
        if (tg.HapticFeedback && !jackpotChance) {
            tg.HapticFeedback.impactOccurred('light');
        }
        
        updateUI();
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        showNotification('⚡ Нет энергии!', 'error');
    }
});

function showFloat(x, y, text, isJackpot = false) {
    const el = document.createElement('div');
    el.className = 'float-number' + (isJackpot ? ' jackpot' : '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// ===== AUTO CLICK =====
setInterval(() => {
    if (gameData.autoClick > 0) {
        updateBalance(gameData.autoClick);
        updateUI();
    }
}, 1000);

// ===== ENERGY REGEN =====
setInterval(() => {
    if (gameData.energy < gameData.maxEnergy) {
        gameData.energy = Math.min(gameData.energy + gameData.energyRegen, gameData.maxEnergy);
        db.ref('users/' + userId + '/energy').set(gameData.energy);
        updateUI();
    }
}, 1000);

// ===== COMBO TIMER UPDATE =====
setInterval(() => {
    if (gameData.combo > 0) {
        const comboTimer = document.getElementById('comboTimer');
        if (comboTimer) {
            const timeLeft = Math.max(0, GAME_CONFIG.COMBO_DURATION - (Date.now() - gameData.lastComboReset));
            comboTimer.textContent = (timeLeft / 1000).toFixed(1) + ' сек';
            
            if (timeLeft <= 0) {
                gameData.combo = 0;
                gameData.comboMultiplier = 1.0;
                document.getElementById('comboText').classList.remove('active');
            }
        }
    }
}, 100);

// ===== START =====
loadFromFirebase();
