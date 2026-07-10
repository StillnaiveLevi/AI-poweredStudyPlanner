from dbConnection import get_connection


def start_session(user_id, task_id=None):
    """Insert a new session with start_time, return session id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO public.study_sessions (user_id, task_id, start_time)
        VALUES (%s, %s, CURRENT_TIMESTAMP)
        RETURNING id, start_time
    """, (user_id, task_id or None))
    row = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": str(row[0]), "start_time": row[1].isoformat()}


def end_session(session_id):
    """Set end_time on an existing session, return duration_minutes."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE public.study_sessions
        SET    end_time = CURRENT_TIMESTAMP
        WHERE  id = %s
        RETURNING duration_minutes, end_time
    """, (session_id,))
    row = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    if not row:
        return None
    return {
        "duration_minutes": row[0],
        "end_time":         row[1].isoformat()
    }


def get_recent_sessions(user_id, limit=10):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            ss.id,
            ss.start_time,
            ss.end_time,
            ss.duration_minutes,
            t.title        AS task_title,
            s.subject_name AS subject
        FROM   public.study_sessions ss
        LEFT   JOIN public.tasks    t ON t.id = ss.task_id
        LEFT   JOIN public.subjects s ON s.id = t.subject_id
        WHERE  ss.user_id = %s
        ORDER  BY ss.start_time DESC
        LIMIT  %s
    """, (user_id, limit))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{
        "id":               str(r[0]),
        "start_time":       r[1].isoformat() if r[1] else None,
        "end_time":         r[2].isoformat() if r[2] else None,
        "duration_minutes": r[3],
        "task_title":       r[4] or "Free Session",
        "subject":          r[5] or "—"
    } for r in rows]
