from dbConnection import get_connection


def get_all_tasks(user_id, subject_id=None, priority=None, sort_by="due_date"):
    conn = get_connection()
    cursor = conn.cursor()

    where = ["s.user_id = %s", "t.status <> 'completed'"]
    params = [user_id]

    if subject_id:
        where.append("t.subject_id = %s")
        params.append(subject_id)
    if priority:
        where.append("t.priority = %s")
        params.append(priority)

    order = "t.due_date ASC"
    if sort_by == "priority":
        order = "CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC"

    cursor.execute(f"""
        SELECT t.id, t.title, t.description, t.due_date, t.priority,
               t.status, t.estimated_minutes, t.created_at,
               s.id AS subject_id, s.subject_name
        FROM   public.tasks t
        JOIN   public.subjects s ON s.id = t.subject_id
        WHERE  {" AND ".join(where)}
        ORDER  BY {order}
    """, params)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_all_tasks_including_completed(user_id):
    """Used for Kanban — returns all statuses."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.id, t.title, t.description, t.due_date, t.priority,
               t.status, t.estimated_minutes, t.created_at,
               s.id AS subject_id, s.subject_name
        FROM   public.tasks t
        JOIN   public.subjects s ON s.id = t.subject_id
        WHERE  s.user_id = %s
        ORDER  BY t.due_date ASC
    """, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_tasks_by_subject_counts(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.id, s.subject_name,
               COUNT(t.id) FILTER (WHERE t.status <> 'completed') AS pending_count
        FROM   public.subjects s
        LEFT   JOIN public.tasks t ON t.subject_id = s.id
        WHERE  s.user_id = %s
        GROUP  BY s.id, s.subject_name
        ORDER  BY s.subject_name
    """, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"id": str(r[0]), "name": r[1], "count": r[2]} for r in rows]


def get_deadline_heatmap(user_id):
    """Returns task counts per day for the next 7 days."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DATE(t.due_date) AS day, COUNT(*) AS cnt
        FROM   public.tasks t
        JOIN   public.subjects s ON s.id = t.subject_id
        WHERE  s.user_id = %s
          AND  t.due_date >= CURRENT_DATE
          AND  t.due_date <  CURRENT_DATE + INTERVAL '7 days'
          AND  t.status   <> 'completed'
        GROUP  BY day
        ORDER  BY day
    """, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"date": str(r[0]), "count": r[1]} for r in rows]


def add_task(subject_id, title, description, due_date, priority, status, estimated_minutes):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO public.tasks
               (subject_id, title, description, due_date, priority, status, estimated_minutes)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (subject_id, title, description, due_date, priority, status, estimated_minutes))
    new_id = str(cursor.fetchone()[0])
    conn.commit()
    cursor.close()
    conn.close()
    return new_id


def update_task(task_id, title, description, due_date, priority, status, estimated_minutes):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE public.tasks
        SET    title=%s, description=%s, due_date=%s,
               priority=%s, status=%s, estimated_minutes=%s
        WHERE  id=%s
    """, (title, description, due_date, priority, status, estimated_minutes, task_id))
    conn.commit()
    cursor.close()
    conn.close()


def update_task_status(task_id, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE public.tasks SET status=%s WHERE id=%s", (status, task_id))
    conn.commit()
    cursor.close()
    conn.close()


def delete_task(task_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM public.tasks WHERE id=%s", (task_id,))
    conn.commit()
    cursor.close()
    conn.close()


def _row_to_dict(r):
    return {
        "id":                str(r[0]),
        "title":             r[1],
        "description":       r[2] or "",
        "due_date":          r[3].isoformat() if r[3] else None,
        "priority":          r[4],
        "status":            r[5],
        "estimated_minutes": r[6],
        "created_at":        r[7].isoformat() if r[7] else None,
        "subject_id":        str(r[8]),
        "subject":           r[9]
    }
