from dbConnection import get_connection


def get_all_subjects(user_id):
    """Return all subjects for a user, enriched with mastery % and next task."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            s.id,
            s.subject_name,
            s.description,
            s.created_at,
            COALESCE(p.completion_percentage, 0)            AS mastery,
            -- next upcoming task title + due date
            (
                SELECT t.title
                FROM   public.tasks t
                WHERE  t.subject_id = s.id
                  AND  t.status <> 'completed'
                ORDER  BY t.due_date ASC
                LIMIT  1
            ) AS next_task_title,
            (
                SELECT t.due_date
                FROM   public.tasks t
                WHERE  t.subject_id = s.id
                  AND  t.status <> 'completed'
                ORDER  BY t.due_date ASC
                LIMIT  1
            ) AS next_task_due,
            -- total and completed task counts used as "units"
            COUNT(t2.id)                                    AS units_total,
            COUNT(t2.id) FILTER (WHERE t2.status = 'completed') AS units_done
        FROM  public.subjects s
        LEFT  JOIN public.progress p
               ON  p.subject_id = s.id AND p.user_id = s.user_id
        LEFT  JOIN public.tasks t2
               ON  t2.subject_id = s.id
        WHERE  s.user_id = %s
        GROUP  BY s.id, s.subject_name, s.description, s.created_at,
                  p.completion_percentage
        ORDER  BY s.created_at
    """, (user_id,))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    subjects = []
    for row in rows:
        (sid, name, description, created_at, mastery,
         next_title, next_due, units_total, units_done) = row

        # Format next session label
        next_session = ""
        if next_title and next_due:
            next_session = f"{next_title} ({next_due.strftime('%A, %I:%M %p')})"

        subjects.append({
            "id":           str(sid),
            "name":         name,
            "description":  description or "",
            "mastery":      float(mastery),
            "next_session": next_session,
            "units_total":  units_total,
            "units_done":   units_done,
            "created_at":   created_at.isoformat()
        })
    return subjects


def add_subject(user_id, subject_name, description=""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO public.subjects (user_id, subject_name, description)
        VALUES (%s, %s, %s)
        RETURNING id
    """, (user_id, subject_name, description))
    new_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return str(new_id)


def update_subject(subject_id, subject_name, description=""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE public.subjects
        SET    subject_name = %s,
               description  = %s
        WHERE  id = %s
    """, (subject_name, description, subject_id))
    conn.commit()
    cursor.close()
    conn.close()


def delete_subject(subject_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM public.subjects WHERE id = %s", (subject_id,))
    conn.commit()
    cursor.close()
    conn.close()
