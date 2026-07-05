from dbConnection import get_connection


def find_user_by_email(email):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, password_hash, role
        FROM   public.users
        WHERE  email = %s
    """, (email,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return None
    return {
        "id":            str(row[0]),
        "name":          row[1],
        "email":         row[2],
        "password_hash": row[3],
        "role":          row[4]
    }


def create_user(name, email, password_hash, role="student"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO public.users (name, email, password_hash, role)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name, email, role
    """, (name, email, password_hash, role))
    row = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    return {
        "id":    str(row[0]),
        "name":  row[1],
        "email": row[2],
        "role":  row[3]
    }


def find_or_create_google_user(name, email):
    """Used for Google OAuth — finds existing user or creates one without a password."""
    existing = find_user_by_email(email)
    if existing:
        return existing

    conn = get_connection()
    cursor = conn.cursor()
    # password_hash is empty for OAuth users — they never use password login
    cursor.execute("""
        INSERT INTO public.users (name, email, password_hash, role)
        VALUES (%s, %s, %s, 'student')
        RETURNING id, name, email, role
    """, (name, email, ""))
    row = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    return {
        "id":    str(row[0]),
        "name":  row[1],
        "email": row[2],
        "role":  row[3]
    }
