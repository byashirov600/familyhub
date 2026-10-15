import sqlite3

try:
    conn = sqlite3.connect("familyhub.db")
    print("✅ Подключение к SQLite успешно!")

    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cur.fetchall()
    print(f"📋 Таблицы в БД: {[t[0] for t in tables]}")

    conn.close()
except Exception as e:
    print(f"❌ Ошибка: {e}")