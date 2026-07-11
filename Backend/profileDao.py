from dbConnection import get_connection
import json


def get_profile(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            u.id,
            u.name,
            u.email,
            u.role,
            u.avatar_url,
            u.preferences,
            COUNT(DISTINCT ss.id)                              AS session_count,
            COALESCE(
                ROUND(
                    COUNT(ss.id) FILTER (WHERE ss.end_time IS NOT NULL)::numeric
                    / NULLIF(COUNT(ss.id), 0) * 100
                ), 0
            )                                                  AS focus_rate
        FROM  public.users u
        LEFT  JOIN public.study_sessions ss ON ss.user_id = u.id
        WHERE u.id = %s
        GROUP BY u.id
    """, (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return None

    prefs = row[5] or {}
    if isinstance(prefs, str):
        prefs = json.loads(prefs)

    return {
        "id":           str(row[0]),
        "name":         row[1],
        "email":        row[2],
        "role":         row[3],
        "avatar_url":   row[4] or "",
        "preferences":  prefs,
        "session_count": row[6],
        "focus_rate":    int(row[7])
    }


def update_profile(user_id, name, email):
    conn = get_connection()
    cursor = conn.cursor()
    # Check email not taken by another user
    cursor.execute(
        "SELECT id FROM public.users WHERE email = %s AND id <> %s",
        (email.lower(), user_id)
    )
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise ValueError("Email already in use by another account.")

    cursor.execute("""
        UPDATE public.users
        SET    name  = %s,
               email = %s
        WHERE  id    = %s
    """, (name, email.lower(), user_id))
    conn.commit()
    cursor.close()
    conn.close()


def update_avatar(user_id, avatar_url):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE public.users SET avatar_url = %s WHERE id = %s",
        (avatar_url, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()


def update_preferences(user_id, preferences: dict):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE public.users SET preferences = %s WHERE id = %s",
        (json.dumps(preferences), user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()


def update_password(user_id, new_hash):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE public.users SET password_hash = %s WHERE id = %s",
        (new_hash, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
