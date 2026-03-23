from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from aiogram.utils.keyboard import ReplyKeyboardBuilder
import asyncio
import json
import os
from datetime import datetime, timedelta

# ===== НАСТРОЙКИ =====
BOT_TOKEN = "8658961433:AAH7Eg5UU1C6gzAjXaov1_Eq4U5PERo6API"
GAME_URL = "https://sergeevitch1.github.io/clicker-game/"
DB_FILE = "users.json"
BONUS_AMOUNT = 500
BONUS_COOLDOWN_HOURS = 1  # Час вместо дня!
# =====================

# Инициализация
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# ===== БАЗА ДАННЫХ =====
def load_users():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def get_user(user_id):
    users = load_users()
    user_id = str(user_id)
    if user_id not in users:
        users[user_id] = {
            "balance": 0,
            "clicks": 0,
            "invites": 0,
            "last_bonus": None,
            "settings": {
                "notifications": True,
                "language": "ru",
                "sound": True,
                "vibration": True,
                "theme": "dark"
            }
        }
        save_users(users)
    else:
        # 🔥 ИСПРАВЛЕНИЕ: Создаём settings, если нет (для старых пользователей)
        if "settings" not in users[user_id]:
            users[user_id]["settings"] = {
                "notifications": True,
                "language": "ru",
                "sound": True,
                "vibration": True,
                "theme": "dark"
            }
            save_users(users)
    
    return users[user_id]

def add_balance(user_id, amount):
    users = load_users()
    users[str(user_id)]["balance"] += amount
    users[str(user_id)]["clicks"] += 1
    save_users(users)
    return users[str(user_id)]["balance"]

def update_user_setting(user_id, setting, value):
    users = load_users()
    users[str(user_id)]["settings"][setting] = value
    save_users(users)

# ===== КЛАВИАТУРЫ =====
def get_main_keyboard():
    builder = ReplyKeyboardBuilder()
    builder.button(text="🎮 Играть", web_app=WebAppInfo(url=GAME_URL))
    builder.button(text="📊 Топ игроков")
    builder.button(text="👥 Пригласить друга")
    builder.button(text="🎁 Бонус каждый час")
    builder.button(text="⚙️ Настройки")
    builder.button(text="❓ Помощь")
    builder.adjust(1, 2, 2)
    return builder.as_markup(resize_keyboard=True)

def get_settings_keyboard():
    builder = ReplyKeyboardBuilder()
    builder.button(text="🔔 Уведомления: ВКЛ")
    builder.button(text="🔊 Звук: ВКЛ")
    builder.button(text="📳 Вибрация: ВКЛ")
    builder.button(text="🎨 Тема: Тёмная")
    builder.button(text="🌐 Язык: Русский")
    builder.button(text="🔙 Назад")
    builder.adjust(2, 2, 1, 1)
    return builder.as_markup(resize_keyboard=True)

# ===== ОБРАБОТЧИКИ =====
@dp.message(Command("start", "menu", "game"))
async def cmd_start(message: types.Message):
    user = get_user(message.from_user.id)
    await message.answer(
        f"👋 <b>Привет, {message.from_user.first_name}!</b>\n\n"
        f"🎮 <b>Clicker Game</b> - зарабатывай монеты кликами!\n\n"
        f"💰 Твой баланс: <b>{user['balance']:,}</b> монет\n"
        f"👆 Кликов сделано: <b>{user['clicks']}</b>\n"
        f"👥 Приглашено друзей: <b>{user['invites']}</b>\n\n"
        f"Жми <b>🎮 Играть</b> и начинай зарабатывать!",
        reply_markup=get_main_keyboard(),
        parse_mode="HTML"
    )

@dp.message(F.text == "🎮 Играть")
async def play_game(message: types.Message):
    user = get_user(message.from_user.id)
    await message.answer(
        "🎮 Запускаю игру...\n\n"
        f"💰 Твой баланс: <b>{user['balance']:,}</b> монет",
        reply_markup=get_main_keyboard()
    )

@dp.message(F.text == "📊 Топ игроков")
async def leaderboard(message: types.Message):
    users = load_users()
    sorted_users = sorted(users.items(), key=lambda x: x[1]["balance"], reverse=True)[:10]
    
    text = "🏆 <b>Топ-10 игроков:</b>\n\n"
    for i, (uid, data) in enumerate(sorted_users, 1):
        emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"{i}."
        text += f"{emoji} <b>{data['balance']:,}</b> монет\n"
    
    current = get_user(message.from_user.id)
    rank = len([u for u in users.values() if u["balance"] > current["balance"]]) + 1
    text += f"\n📍 <b>Твоё место:</b> #{rank} ({current['balance']:,} монет)"
    
    await message.answer(text, parse_mode="HTML", reply_markup=get_main_keyboard())

@dp.message(F.text == "👥 Пригласить друга")
async def invite_friend(message: types.Message):
    invite_link = f"https://t.me/{(await bot.get_me()).username}?start=ref{message.from_user.id}"
    await message.answer(
        f"👥 <b>Пригласи друзей и получи бонусы!</b>\n\n"
        f"🔗 <b>Твоя ссылка:</b>\n"
        f"<code>{invite_link}</code>\n\n"
        f"💰 +1000 монет за каждого друга!\n"
        f"🎁 Друг получит +500 монет!\n\n"
        f"Просто скопируй ссылку и отправь друзьям!",
        parse_mode="HTML",
        reply_markup=get_main_keyboard()
    )

@dp.message(F.text == "🎁 Бонус каждый час")
async def daily_bonus(message: types.Message):
    user = get_user(message.from_user.id)
    now = datetime.now()
    
    # Проверяем последний бонус
    if user.get("last_bonus"):
        last_bonus = datetime.fromisoformat(user["last_bonus"])
        time_diff = now - last_bonus
        hours_left = BONUS_COOLDOWN_HOURS - (time_diff.total_seconds() / 3600)
        
        if hours_left > 0:
            hours = int(hours_left)
            minutes = int((hours_left - hours) * 60)
            await message.answer(
                f"⏰ <b>Бонус доступен через:</b>\n\n"
                f"<b>{hours}ч {minutes}мин</b>\n\n"
                f"Следующий бонус: <b>+{BONUS_AMOUNT} монет</b>",
                parse_mode="HTML",
                reply_markup=get_main_keyboard()
            )
            return
    
    # Выдаем бонус
    new_balance = add_balance(message.from_user.id, BONUS_AMOUNT)
    users = load_users()
    users[str(message.from_user.id)]["last_bonus"] = now.isoformat()
    save_users(users)
    
    await message.answer(
        f"🎁 <b>Бонус получен!</b>\n\n"
        f"✅ +{BONUS_AMOUNT} монет начислено!\n"
        f"💰 Новый баланс: <b>{new_balance:,}</b>\n\n"
        f"Следующий бонус через <b>{BONUS_COOLDOWN_HOURS} час</b>!",
        parse_mode="HTML",
        reply_markup=get_main_keyboard()
    )

@dp.message(F.text == "⚙️ Настройки")
async def settings(message: types.Message):
    user = get_user(message.from_user.id)
    settings = user.get("settings", {})
    
    notif = "ВКЛ" if settings.get("notifications", True) else "ВЫКЛ"
    sound = "ВКЛ" if settings.get("sound", True) else "ВЫКЛ"
    vibr = "ВКЛ" if settings.get("vibration", True) else "ВЫКЛ"
    theme = "Тёмная" if settings.get("theme", "dark") == "dark" else "Светлая"
    lang = "Русский" if settings.get("language", "ru") == "ru" else "English"
    
    await message.answer(
        f"⚙️ <b>Настройки:</b>\n\n"
        f"🔔 Уведомления: {notif}\n"
        f"🔊 Звук: {sound}\n"
        f"📳 Вибрация: {vibr}\n"
        f"🎨 Тема: {theme}\n"
        f"🌐 Язык: {lang}\n\n"
        f"Нажми на кнопку, чтобы изменить:",
        parse_mode="HTML",
        reply_markup=get_settings_keyboard()
    )

@dp.message(F.text == "🔙 Назад")
async def settings_back(message: types.Message):
    await cmd_start(message)

@dp.message(F.text == "❓ Помощь")
async def help_cmd(message: types.Message):
    await message.answer(
        "❓ <b>Помощь:</b>\n\n"
        "🎮 <b>Как играть:</b>\n"
        "1. Жми 🎮 Играть\n"
        "2. Кликай по монете\n"
        "3. Покупай улучшения\n"
        "4. Приглашай друзей\n\n"
        "💡 <b>Советы:</b>\n"
        "- Заходи каждый час за бонусом ⏰\n"
        "- Копи монеты на улучшения\n"
        "- Приглашай друзей для бонусов\n\n"
        "📞 <b>Поддержка:</b> @your_username",
        parse_mode="HTML",
        reply_markup=get_main_keyboard()
    )

# ===== ОБРАБОТЧИКИ НАСТРОЕК =====
@dp.message(F.text.startswith("🔔 Уведомления"))
async def toggle_notifications(message: types.Message):
    user = get_user(message.from_user.id)
    current = user["settings"].get("notifications", True)
    new_value = not current
    update_user_setting(message.from_user.id, "notifications", new_value)
    await message.answer(f"🔔 Уведомления: {'ВКЛ' if new_value else 'ВЫКЛ'}")
    await settings(message)

@dp.message(F.text.startswith("🔊 Звук"))
async def toggle_sound(message: types.Message):
    user = get_user(message.from_user.id)
    current = user["settings"].get("sound", True)
    new_value = not current
    update_user_setting(message.from_user.id, "sound", new_value)
    await message.answer(f"🔊 Звук: {'ВКЛ' if new_value else 'ВЫКЛ'}")
    await settings(message)

@dp.message(F.text.startswith("📳 Вибрация"))
async def toggle_vibration(message: types.Message):
    user = get_user(message.from_user.id)
    current = user["settings"].get("vibration", True)
    new_value = not current
    update_user_setting(message.from_user.id, "vibration", new_value)
    await message.answer(f"📳 Вибрация: {'ВКЛ' if new_value else 'ВЫКЛ'}")
    await settings(message)

@dp.message(F.text.startswith("🎨 Тема"))
async def toggle_theme(message: types.Message):
    user = get_user(message.from_user.id)
    current = user["settings"].get("theme", "dark")
    new_value = "light" if current == "dark" else "dark"
    update_user_setting(message.from_user.id, "theme", new_value)
    await message.answer(f"🎨 Тема: {'Тёмная' if new_value == 'dark' else 'Светлая'}")
    await settings(message)

@dp.message(F.text.startswith("🌐 Язык"))
async def toggle_language(message: types.Message):
    user = get_user(message.from_user.id)
    current = user["settings"].get("language", "ru")
    new_value = "en" if current == "ru" else "ru"
    update_user_setting(message.from_user.id, "language", new_value)
    await message.answer(f"🌐 Язык: {'English' if new_value == 'en' else 'Русский'}")
    await settings(message)

# ===== ЗАПУСК =====
async def main():
    print("🤖 Бот запущен...")
    print(f"⏰ Бонус: каждые {BONUS_COOLDOWN_HOURS} час(а/ов)")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())