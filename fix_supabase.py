import asyncio
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")

def fix():
    print("--- Mise à jour du schéma Supabase ---")
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # SQL pour ajouter les colonnes manquantes
        sql = """
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
        ADD COLUMN IF NOT EXISTS knowledge_folder_id TEXT,
        ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
        """
        
        cur.execute(sql)
        conn.commit()
        print("SUCCÈS : Les colonnes ont été ajoutées à la table 'projects'.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERREUR : {e}")

if __name__ == "__main__":
    fix()
