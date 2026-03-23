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
    clickCooldownActive: false,
    clickCooldownEnd: 0,
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
            gameData.clickCooldownActive = false;
            gameData.clickCooldownEnd = 0;
            
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
            
            restoreActiveEffects();
        }
        
        updateUI();
        document.getElementById('loading').style.display = 'none';
        
    }).catch((err) => {
        console.error('Firebase error:', err);
        showNotification('❌ Ошибка загрузки!', 'error');
    });

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
    
    const newMaxEnergy = GAME_CONFIG.ENERGY_BASE + 
                         Math.floor(gameData.balance / GAME_CONFIG.ENERGY_PER_BALANCE) + 
                         (gameData.upgrades.energy.level - 1) * GAME_CONFIG.ENERGY_PER_UPGRADE;
    gameData.maxEnergy = Math.max(100, newMaxEnergy);
    
    db.ref('users/' + userId + '/balance').set(gameData.balance);
    db.ref('users/' + userId + '/totalEarned').set(gameData.totalEarned);
    db.ref('users/' + userId + '/maxEnergy').set(gameData.maxEnergy);
    
    showBalanceChange(final);
    return final;
}

function getActiveMultiplier() {
    let mult = gameData.comboMultiplier;
    if (gameData.activeEffects.multi.active && Date.now() < gameData.activeEffects.multi.endTime) {
        mult *= GAME_CONFIG.MULTI_VALUE;
    }
    return mult;
}

function showBalanceChange(amount) {
    const changeEl = document.getElementById('balanceChange');
    if (changeEl) {
        changeEl.textContent = `+$${amount.toLocaleString()}`;
        changeEl.classList.add('show');
        setTimeout(() => changeEl.classList.remove('show'), 1000);
    }
}

// ===== ACTIVE EFFECTS =====
function restoreActiveEffects() {
    const now = Date.now();
    
    if (gameData.activeEffects.auto.active && now < gameData.activeEffects.auto.endTime) {
        gameData.autoClick = gameData.activeEffects.auto.power;
        startAutoTimer();
    } else {
        gameData.activeEffects.auto.active = false;
        gameData.autoClick = 0;
    }
    
    if (gameData.activeEffects.multi.active && now < gameData.activeEffects.multi.endTime) {
        startMultiTimer();
    } else {
        gameData.activeEffects.multi.active = false;
    }
}

function startAutoTimer() {
    const updateTimer = () => {
        const remaining = gameData.activeEffects.auto.endTime - Date.now();
        
        if (remaining <= 0) {
            gameData.activeEffects.auto.active = false;
            gameData.autoClick = 0;
            saveToFirebase();
            showNotification('⏰ Авто-клик истёк!', 'error');
            updateUI();
            return;
        }
        
        updateAutoTimerUI(remaining);
        requestAnimationFrame(updateTimer);
    };
    requestAnimationFrame(updateTimer);
}

function startMultiTimer() {
    const updateTimer = () => {
        const remaining = gameData.activeEffects.multi.endTime - Date.now();
        
        if (remaining <= 0) {
            gameData.activeEffects.multi.active = false;
            saveToFirebase();
            showNotification('⏰ Мульти x2 истёк!', 'error');
            updateUI();
            return;
        }
        
        updateMultiTimerUI(remaining);
        requestAnimationFrame(updateTimer);
    };
    requestAnimationFrame(updateTimer);
}

function updateAutoTimerUI(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const text = document.getElementById('autoTimer');
    const progress = document.getElementById('autoProgress');
    
    if (text) {
        text.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (progress) {
        const percent = (ms / GAME_CONFIG.AUTO_DURATION) * 100;
        progress.style.width = percent + '%';
        progress.classList.add('active');
    }
}

function updateMultiTimerUI(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const text = document.getElementById('multiTimer');
    const progress = document.getElementById('multiProgress');
    
    if (text) {
        text.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (progress) {
        const percent = (ms / GAME_CONFIG.MULTI_DURATION) * 100;
        progress.style.width = percent + '%';
        progress.classList.add('active');
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
    gameData.comboMultiplier = Math.min(1.0 + (gameData.combo * GAME_CONFIG.COMBO_INCREMENT), GAME_CONFIG.COMBO_MAX_MULTIPLIER);
    
    const comboText = document.getElementById('comboText');
    const comboValue = document.getElementById('comboValue');
    const comboFill = document.getElementById('comboFill');
    const comboTimer = document.getElementById('comboTimer');
    
    if (comboValue) comboValue.textContent = gameData.comboMultiplier.toFixed(1);
    if (comboFill) {
        const percent = ((gameData.comboMultiplier - 1) / (GAME_CONFIG.COMBO_MAX_MULTIPLIER - 1)) * 100;
        comboFill.style.width = Math.min(percent, 100) + '%';
    }
    
    if (gameData.combo > 5 && comboText) {
        comboText.classList.add('active');
        document.getElementById('clickButton').classList.add('combo');
        setTimeout(() => {
            document.getElementById('clickButton').classList.remove('combo');
        }, 300);
    }
    
    if (comboTimer) {
        const timeLeft = Math.max(0, GAME_CONFIG.COMBO_DURATION - (now - gameData.lastComboReset));
        comboTimer.textContent = (timeLeft / 1000).toFixed(1) + ' сек';
    }
}

// ===== UPGRADES =====
function buyUpgrade(type) {
    const upg = gameData.upgrades[type];
    
    if (!upg || gameData.balance < upg.cost) {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        showNotification('❌ Недостаточно $!', 'error');
        return;
    }
    
    if (type === 'click' && gameData.clickCooldownActive) {
        showNotification('⏳ Подожди 5 сек!', 'error');
        return;
    }
    
    gameData.balance -= upg.cost;
    
    if (type === 'click') {
        gameData.clickCooldownActive = true;
        gameData.clickCooldownEnd = Date.now() + GAME_CONFIG.CLICK_COOLDOWN;
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.click);
        gameData.clickPower += GAME_CONFIG.POWER_GROWTH.click;
        
        const cooldownText = document.getElementById('clickCooldownText');
        if (cooldownText) {
            cooldownText.textContent = '⏳ 5 сек...';
            setTimeout(() => {
                cooldownText.textContent = '';
                gameData.clickCooldownActive = false;
            }, GAME_CONFIG.CLICK_COOLDOWN);
        }
        
        showNotification(`⚡ +${GAME_CONFIG.POWER_GROWTH.click}$ за клик!`);
        
    } else if (type === 'auto') {
        const now = Date.now();
        gameData.activeEffects.auto.active = true;
        gameData.activeEffects.auto.endTime = now + GAME_CONFIG.AUTO_DURATION;
        gameData.activeEffects.auto.power = gameData.autoClick + (GAME_CONFIG.POWER_GROWTH.auto * upg.level);
        gameData.autoClick = gameData.activeEffects.auto.power;
        
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.auto);
        
        startAutoTimer();
        showNotification(`🤖 Авто-клик на 1 мин!`);
        
    } else if (type === 'energy') {
        upg.level++;
        upg.cost = Math.floor(upg.cost * GAME_CONFIG.PRICE_GROWTH.energy);
        gameData.energy += GAME_CONFIG.ENERGY_PER_UPGRADE; // 🔥 ДОБАВЛЯЕТСЯ, НЕ ЗАПОЛНЯЕТ!
        gameData.maxEnergy += GAME_CONFIG.ENERGY_PER_UPGRADE;
        showNotification(`🔋 +${GAME_CONFIG.ENERGY_PER_UPGRADE} энергии!`);
        
    } else if (type === 'multi') {
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
        showNotification(`⚡ Реген +${GAME_CONFIG.POWER_GROWTH.regen}/сек!`);
        
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
    setTimeout(() => n.classList.remove('show'), 2500);
}

function showJackpotCelebration(amount) {
    const celebration = document.getElementById('jackpotCelebration');
    const amountEl = document.getElementById('jackpotAmount');
    
    if (celebration && amountEl) {
        amountEl.textContent = `+$${amount.toLocaleString()}`;
        celebration.classList.add('show');
        
        // Create particles
        for (let i = 0; i < 20; i++) {
            createParticle();
        }
        
        setTimeout(() => {
            celebration.classList.remove('show');
        }, 2000);
    }
}

function createParticle() {
    const particle = document.createElement('div');
    particle.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${['#ffd700', '#ffed4e', '#ffaa00', '#00d4ff', '#00ff88'][Math.floor(Math.random() * 5)]};
        border-radius: 50%;
        left: ${Math.random() * 100}vw;
        top: ${Math.random() * 100}vh;
        pointer-events: none;
        z-index: 3000;
        animation: particleFly 2s ease-out forwards;
    `;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 2000);
}

// Add particle animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes particleFly {
        0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
        }
        100% {
            transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) scale(0);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ===== UI UPDATE =====
function updateUI() {
    document.getElementById('balance').textContent = '$' + Math.floor(gameData.balance).toLocaleString();
    
    document.getElementById('energyText').textContent = `${Math.floor(gameData.energy)} / ${gameData.maxEnergy}`;
    const energyPercent = (gameData.energy / gameData.maxEnergy) * 100;
    document.getElementById('energyFill').style.width = energyPercent + '%';
    document.getElementById('energyRegen').textContent = `+${gameData.energyRegen}/сек`;
    
    const mult = getActiveMultiplier();
    document.getElementById('perClick').textContent = '$' + (gameData.clickPower * mult).toLocaleString();
    document.getElementById('perSecond').textContent = '$' + (gameData.autoClick * mult).toLocaleString();
    document.getElementById('totalEarned').textContent = '$' + Math.floor(gameData.totalEarned).toLocaleString();
    
    ['click', 'energy', 'regen', 'jackpot'].forEach(t => {
        const c = document.getElementById(`cost${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const l = document.getElementById(`level${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (c && gameData.upgrades[t]?.cost) c.textContent = '$' + gameData.upgrades[t].cost.toLocaleString();
        if (l && gameData.upgrades[t]?.level !== undefined) l.textContent = gameData.upgrades[t].level;
    });
    
    if (gameData.upgrades.auto?.cost) {
        document.getElementById('costAuto').textContent = '$' + gameData.upgrades.auto.cost.toLocaleString();
    }
    if (gameData.upgrades.multi?.cost) {
        document.getElementById('costMulti').textContent = '$' + gameData.upgrades.multi.cost.toLocaleString();
    }
    
    document.getElementById('clickBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.click}$ за клик`;
    document.getElementById('autoBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.auto * gameData.upgrades.auto.level}$/сек`;
    document.getElementById('regenBonus').textContent = `+${GAME_CONFIG.POWER_GROWTH.regen}/сек`;
    
    const jackpotChance = (GAME_CONFIG.JACKPOT_BASE_CHANCE + gameData.jackpotLevel * GAME_CONFIG.JACKPOT_CHANCE_PER_LEVEL) * 100;
    document.getElementById('jackpotBonus').textContent = `${jackpotChance.toFixed(0)}% шанс x10`;
    
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
        gameData.energy -= energyCost;
        db.ref('users/' + userId + '/energy').set(Math.max(0, gameData.energy));
        
        updateCombo();
        
        let amount = gameData.clickPower * gameData.comboMultiplier;
        
        const jackpotChance = GAME_CONFIG.JACKPOT_BASE_CHANCE + (gameData.jackpotLevel * GAME_CONFIG.JACKPOT_CHANCE_PER_LEVEL);
        const isJackpot = Math.random() < jackpotChance;
        
        if (isJackpot) {
            amount *= GAME_CONFIG.JACKPOT_MULTIPLIER;
            const earned = updateBalance(amount);
            showJackpotCelebration(earned);
            showNotification(`🎰 ДЖЕКПОТ! +$${earned.toLocaleString()}!`, 'jackpot');
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else {
            const earned = updateBalance(amount);
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }
        
        const rect = this.getBoundingClientRect();
        const x = e.clientX || (rect.left + rect.width / 2);
        const y = e.clientY || (rect.top + rect.height / 2);
        showFloat(x, y, isJackpot);
        
        updateUI();
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        showNotification('⚡ Нет энергии!', 'error');
    }
});

function showFloat(x, y, isJackpot) {
    const el = document.createElement('div');
    el.className = 'float-number' + (isJackpot ? ' jackpot' : '');
    el.textContent = isJackpot ? '🎰 x10!' : '+$';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ===== LOOPS =====
setInterval(() => {
    if (gameData.autoClick > 0) {
        updateBalance(gameData.autoClick);
        updateUI();
    }
}, 1000);

setInterval(() => {
    if (gameData.energy < gameData.maxEnergy) {
        gameData.energy = Math.min(gameData.energy + gameData.energyRegen, gameData.maxEnergy);
        db.ref('users/' + userId + '/energy').set(gameData.energy);
        updateUI();
    }
}, 1000);

setInterval(() => {
    if (gameData.combo > 0) {
        const timeLeft = Math.max(0, GAME_CONFIG.COMBO_DURATION - (Date.now() - gameData.lastComboReset));
        const comboTimer = document.getElementById('comboTimer');
        if (comboTimer) {
            comboTimer.textContent = (timeLeft / 1000).toFixed(1) + ' сек';
        }
        
        if (timeLeft <= 0) {
            gameData.combo = 0;
            gameData.comboMultiplier = 1.0;
            document.getElementById('comboText')?.classList.remove('active');
        }
    }
}, 100);

// ===== START =====
loadFromFirebase();

// Add CSS for progress bars
const progressStyle = document.createElement('style');
progressStyle.textContent = `
    #autoProgress.active, #multiProgress.active {
        animation: progressAnimation linear forwards;
    }
    #autoProgress.active::after {
        animation-duration: ${GAME_CONFIG.AUTO_DURATION}ms;
    }
    #multiProgress.active::after {
        animation-duration: ${GAME_CONFIG.MULTI_DURATION}ms;
    }
`;
document.head.appendChild(progressStyle);
