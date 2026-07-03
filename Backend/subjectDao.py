import psycopg2


from dotenv import load_dotenv
import os

load_dotenv()  

def get_connection():
    return psycopg2.connect(
        dbname= os.environ.get("DB_NAME"),
        user = os.environ.get("DB_USER"),
        password = os.environ.get("DB_PASSWORD"),
        host = os.environ.get("HOST"),
        port = os.environ.get("PORT")
    )

if __name__== "__main__":
    try:
        conn = get_connection()
        print("connection successful!")
        conn.close()
    except Exception as e:
        print("connection failed!!!",e)

