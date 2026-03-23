// ===== GAME DATA =====
let gameData = {
    balance: 0,
    energy: 1000,
    maxEnergy: 1000,
    clickPower: 1,
    autoClick: 0,
    totalClicks: 0,
    energyRegen: 1,
    multiplier: 1,
    jackpotLevel: 0,
    combo: 0,
    lastComboReset: Date.now(),
    upgrades: {
        click: { level: 1, cost: 50, power: 1 },
        auto: { level: 0, cost: 200, power: 2, purchased: false },
        energy: { level: 1, cost: 100, power: 500 },
        multi: { level: 0, cost: 1000, power: 2 },
        regen: { level: 1, cost: 300, power: 1 },
        jackpot: { level: 0, cost: 2000, power: 0.05 }
    }
};

// ===== FIREBASE SYNC =====
function loadFromFirebase() {
    const userRef = db.ref('users/' + userId);
    
    userRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // 🔥 БЕЗОПАСНОЕ СЛИЯНИЕ С ЗАЩИТОЙ ОТ МИНУСА
            gameData.balance = Math.max(0, Number(data.balance) || 0);
            gameData.energy = Math.max(0, Number(data.energy) || 1000);
            gameData.maxEnergy = Math.max(1000, Number(data.maxEnergy) || 1000);
            gameData.clickPower = Math.max(1, Number(data.clickPower) || 1);
            gameData.autoClick = Math.max(0, Number(data.autoClick) || 0);
            gameData.totalClicks = Math.max(0, Number(data.totalClicks) || 0);
            gameData.energyRegen = Math.max(1, Number(data.energyRegen) || 1);
            gameData.multiplier = Math.max(1, Number(data.multiplier) || 1);
            gameData.jackpotLevel = Math.max(0, Number(data.jackpotLevel) || 0);
            gameData.combo = 0;
            gameData.lastComboReset = Date.now();
            
            // Merge upgrades safely
            if (data.upgrades) {
                Object.keys(gameData.upgrades).forEach(key => {
                    if (data.upgrades[key]) {
                        gameData.upgrades[key] = {
                            ...gameData.upgrades[key],
                            ...data.upgrades[key]
                        };
                    }
                });
            }
            
            // Check if auto purchased
            if (gameData.upgrades.auto?.purchased) {
                const autoBtn = document.getElementById('boostAuto');
                const autoText = document.getElementById('autoText');
                if (autoBtn) autoBtn.classList.add('purchased');
                if (autoText) autoText.textContent = 'КУПЛЕНО';
                showMulti();
            }
        }
        
        updateUI();
        document.getElementById('loading').style.display = 'none';
        
    }).catch((err) => {
        console.error('Firebase load error:', err);
        document.getElementById('loading').innerHTML = `
            <div style="color:red;padding:20px;text-align:center">
                ❌ Ошибка загрузки!<br>
                <button onclick="location.reload()" style="margin-top:10px;padding:10px 20px;cursor:pointer;background:#8a2be2;color:white;border:none;border-radius:8px">
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
            gameData.energy = Math.max(0, Number(data.energy) || 1000);
            gameData.maxEnergy = Math.max(1000, Number(data.maxEnergy) || 1000);
            gameData.clickPower = Math.max(1, Number(data.clickPower) || 1);
            gameData.autoClick = Math.max(0, Number(data.autoClick) || 0);
            gameData.totalClicks = Math.max(0, Number(data.totalClicks) || 0);
            gameData.energyRegen = Math.max(1, Number(data.energyRegen) || 1);
            gameData.multiplier = Math.max(1, Number(data.multiplier) || 1);
            
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
        energy: Math.max(0, gameData.energy),
        maxEnergy: gameData.maxEnergy,
        clickPower: gameData.clickPower,
        autoClick: gameData.autoClick,
        totalClicks: gameData.totalClicks,
        energyRegen: gameData.energyRegen,
        multiplier: gameData.multiplier,
        jackpotLevel: gameData.jackpotLevel,
        upgrades: gameData.upgrades
    }).catch(console.error);
}

function updateBalance(amount) {
    const final = Math.floor(amount * gameData.multiplier);
    const newBalance = gameData.balance + final;
    gameData.balance = Math.max(0, newBalance); // 🔥 ЗАЩИТА ОТ МИНУСА
    db.ref('users/' + userId + '/balance').set(gameData.balance);
    return final;
}

// ===== COMBO SYSTEM =====
function updateCombo() {
    const now = Date.now();
    if (now - gameData.lastComboReset > 3000) {
        gameData.combo = 0;
    }
    gameData.lastComboReset = now;
    gameData.combo = Math.min(gameData.combo + 1, 50);
    
    const mult = 1 + (gameData.combo * 0.1);
    document.getElementById('comboValue').textContent = mult.toFixed(1);
    document.getElementById('comboFill').style.width = Math.min((gameData.combo * 2), 100) + '%';
    
    if (gameData.combo > 5) {
        document.getElementById('comboText').classList.add('active');
        document.getElementById('clickButton').classList.add('combo');
        setTimeout(() => {
            document.getElementById('clickButton').classList.remove('combo');
            document.getElementById('comboText').classList.remove('active');
        }, 300);
    }
}

function showMulti() {
    document.getElementById('boostMulti').style.display = 'block';
}

// ===== UPGRADES =====
function buyUpgrade(type) {
    const upg = gameData.upgrades[type];
    
    // 🔥 ПРОВЕРКА: хватает ли денег
    if (!upg || gameData.balance < upg.cost) {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        showNotification('❌ Недостаточно монет!');
        return;
    }
    
    // 🔥 СПИСЫВАЕМ монеты ПЕРЕД покупкой
    gameData.balance -= upg.cost;
    upg.level++;
    upg.cost = Math.floor(upg.cost * 1.3);
    
    if (type === 'click') { 
        gameData.clickPower += upg.power; 
        showNotification(`⚡ +${upg.power} к клику!`); 
    }
    else if (type === 'auto') {
        if (!upg.purchased) {
            gameData.autoClick += upg.power;
            upg.purchased = true;
            const autoBtn = document.getElementById('boostAuto');
            const autoText = document.getElementById('autoText');
            if (autoBtn) autoBtn.classList.add('purchased');
            if (autoText) autoText.textContent = 'КУПЛЕНО';
            showNotification('🤖 Авто-клик ВКЛ!');
            showMulti();
        } else {
            gameData.autoClick += upg.power;
            showNotification(`🤖 +${upg.power}/сек!`);
        }
    }
    else if (type === 'energy') { 
        gameData.maxEnergy += upg.power; 
        gameData.energy = gameData.maxEnergy; 
        showNotification(`🔋 +${upg.power} энергии!`); 
    }
    else if (type === 'multi') { 
        gameData.multiplier += 1; 
        showNotification(`💎 МУЛЬТИ x${gameData.multiplier}!`); 
    }
    else if (type === 'regen') { 
        gameData.energyRegen += upg.power; 
        showNotification(`⚡ Реген +${upg.power}/сек!`); 
    }
    else if (type === 'jackpot') { 
        gameData.jackpotLevel++; 
        showNotification('🎰 Джекпот улучшен!'); 
    }
    
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    updateUI();
    saveToFirebase();
}

function showNotification(text) {
    const n = document.getElementById('notification');
    n.textContent = text;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 2000);
}

// ===== UI UPDATE =====
function updateUI() {
    document.getElementById('balance').textContent = Math.floor(gameData.balance).toLocaleString();
    document.getElementById('energyText').textContent = `${Math.floor(gameData.energy)} / ${gameData.maxEnergy}`;
    document.getElementById('energyFill').style.width = `${(gameData.energy / gameData.maxEnergy) * 100}%`;
    document.getElementById('perClick').textContent = (gameData.clickPower * gameData.multiplier).toLocaleString();
    document.getElementById('perSecond').textContent = (gameData.autoClick * gameData.multiplier).toLocaleString();
    document.getElementById('totalClicks').textContent = gameData.totalClicks.toLocaleString();
    
    ['click','energy','regen','jackpot'].forEach(t => {
        const c = document.getElementById(`cost${t.charAt(0).toUpperCase()+t.slice(1)}`);
        const l = document.getElementById(`level${t.charAt(0).toUpperCase()+t.slice(1)}`);
        if (c && gameData.upgrades[t]?.cost) c.textContent = gameData.upgrades[t].cost.toLocaleString();
        if (l && gameData.upgrades[t]?.level) l.textContent = gameData.upgrades[t].level;
    });
    if (gameData.upgrades.multi?.cost) document.getElementById('costMulti').textContent = gameData.upgrades.multi.cost.toLocaleString();
    if (gameData.upgrades.multi?.level) document.getElementById('levelMulti').textContent = gameData.upgrades.multi.level;
    
    checkShop();
}

function checkShop() {
    ['click','auto','energy','multi','regen','jackpot'].forEach(t => {
        const item = document.getElementById(`boost${t.charAt(0).toUpperCase()+t.slice(1)}`);
        const upg = gameData.upgrades[t];
        if (item && upg && !upg.purchased) {
            item.classList.toggle('disabled', gameData.balance < upg.cost);
        }
    });
}

// ===== CLICK HANDLER =====
document.getElementById('clickButton').addEventListener('click', function(e) {
    const energyCost = Math.min(gameData.clickPower, gameData.energy);
    
    if (energyCost > 0) {
        // 🔥 ТРАТИМ ЭНЕРГИЮ
        gameData.energy -= energyCost;
        db.ref('users/' + userId + '/energy').set(Math.max(0, gameData.energy));
        
        updateCombo();
        const comboMult = 1 + (gameData.combo * 0.1);
        let amount = gameData.clickPower * comboMult;
        
        // JACKPOT
        if (gameData.jackpotLevel > 0 && Math.random() < gameData.jackpotLevel * 0.05) {
            amount *= 10;
            showNotification('🎰 ДЖЕКПОТ x10!');
        }
        
        const earned = updateBalance(amount);
        gameData.totalClicks++;
        db.ref('users/' + userId + '/totalClicks').set(gameData.totalClicks);
        
        const rect = this.getBoundingClientRect();
        const x = e.clientX || (rect.left + rect.width/2);
        const y = e.clientY || (rect.top + rect.height/2);
        showFloat(x, y, `+${earned}`);
        
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
        updateUI();
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        showNotification('⚡ Нет энергии!');
    }
});

function showFloat(x, y, text) {
    const el = document.createElement('div');
    el.className = 'float-number';
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

// ===== START =====
loadFromFirebase();
