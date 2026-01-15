import sqlite3
import os
import json
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "history.db")
HISTORY_DIR = os.path.join(BASE_DIR, "history_images")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(HISTORY_DIR, exist_ok=True)
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS history
                 (id TEXT PRIMARY KEY, date TEXT, duration REAL, image_path TEXT, detections TEXT)''')
    conn.commit()
    conn.close()

def fetch_all_history(limit=50):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM history ORDER BY date DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return rows

def fetch_history_item(item_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM history WHERE id = ?", (item_id,))
    row = c.fetchone()
    conn.close()
    return row

def delete_history_item_db(item_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM history WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

def clear_history_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM history")
    conn.commit()
    conn.close()

def insert_history_item(id, date, duration, image_path, detections):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("INSERT INTO history (id, date, duration, image_path, detections) VALUES (?, ?, ?, ?, ?)",
              (id, date, duration, image_path, json.dumps(detections)))
    conn.commit()
    conn.close()
