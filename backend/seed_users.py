#!/usr/bin/env python3
"""
Seed-Script für Graupner Suite Benutzer
Erstellt Admin und Buchhalterin mit korrekten Passwörtern
"""
import os
import sys
from pymongo import MongoClient
import bcrypt

# MongoDB Verbindung
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'graupner_suite')

def create_users():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Lösche alte Benutzer (fresh start)
    db.users.delete_many({})
    print("🗑️  Alte Benutzer gelöscht")
    
    # Admin User
    admin_password = "Graupner!Suite2026"
    admin_hash = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
    
    admin_user = {
        "username": "admin",
        "email": "admin@tischlerei-graupner.de",
        "password": admin_hash,
        "role": "admin",
        "name": "Administrator"
    }
    
    # Buchhalterin User
    buchhalterin_password = "Buch$2026!Grau"
    buchhalterin_hash = bcrypt.hashpw(buchhalterin_password.encode(), bcrypt.gensalt()).decode()
    
    buchhalterin_user = {
        "username": "h.bolanka",
        "email": "h.bolanka@tischlerei-graupner.de",
        "password": buchhalterin_hash,
        "role": "buchhaltung",
        "name": "Heike Bolanka"
    }
    
    # Benutzer einfügen
    db.users.insert_one(admin_user)
    print(f"✅ Admin erstellt: {admin_user['username']}")
    
    db.users.insert_one(buchhalterin_user)
    print(f"✅ Buchhalterin erstellt: {buchhalterin_user['username']}")
    
    # Verifizierung
    count = db.users.count_documents({})
    print(f"\n📊 Gesamt: {count} Benutzer in der Datenbank")
    
    # Zeige alle Benutzer
    print("\n📋 Angelegte Benutzer:")
    for user in db.users.find({}, {"_id": 0, "username": 1, "email": 1, "role": 1}):
        print(f"   • {user['username']} ({user['role']}) - {user['email']}")
    
    client.close()
    print("\n✅ Seed abgeschlossen!")

if __name__ == "__main__":
    try:
        create_users()
    except Exception as e:
        print(f"❌ Fehler: {e}")
        sys.exit(1)
