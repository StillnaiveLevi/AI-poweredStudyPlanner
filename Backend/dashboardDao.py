from dbConnection import get_connection


def get_weekly_focus(user_id):
    """Sessions completed this week vs planned (tasks scheduled this week)."""
    conn = get_connection()
    cursor = conn.cursor()

    # Sessions completed this week
    cursor.execute("""
        SELECT
            COUNT(*)                                        AS sessions_completed,
            COALESCE(SUM(duration_minutes), 0)              AS total_minutes
        FROM public.study_sessions
        WHERE user_id = %s
          AND start_time >= date_trunc('week', CURRENT_TIMESTAMP)
          AND end_time IS NOT NULL
    """, (user_id,))
    row = cursor.fetchone()
    sessions_completed = row[0]
    total_minutes      = float(row[1])

    # Tasks planned this week (used as "planned sessions" count)
    cursor.execute("""
        SELECT COUNT(*)
        FROM public.tasks t
        JOIN public.subjects s ON s.id = t.subject_id
        WHERE s.user_id = %s
          AND t.due_date >= date_trunc('week', CURRENT_TIMESTAMP)
          AND t.due_date <  date_trunc('week', CURRENT_TIMESTAMP) + INTERVAL '7 days'
    """, (user_id,))
    sessions_planned = cursor.fetchone()[0] or 1  # avoid div/0

    # Streak: consecutive days with at least one completed session
    cursor.execute("""
        SELECT DISTINCT DATE(start_time AT TIME ZONE 'UTC') AS study_date
        FROM   public.study_sessions
        WHERE  user_id = %s AND end_time IS NOT NULL
        ORDER  BY study_date DESC
    """, (user_id,))
    dates  = [r[0] for r in cursor.fetchall()]
    streak = 0
    from datetime import date, timedelta
    check = date.today()
    for d in dates:
        if d == check:
            streak += 1
            check  -= timedelta(days=1)
        else:
            break

    cursor.close()
    conn.close()

    pct = min(round((sessions_completed / sessions_planned) * 100), 100)
    return {
        "sessions_completed": sessions_completed,
        "sessions_planned":   sessions_planned,
        "percent":            pct,
        "hours":              round(total_minutes / 60, 1),
        "streak_days":        streak
    }


def get_weekly_schedule(user_id, week_offset=0):
    """Tasks due in the requested week (0=current, -1=prev, 1=next)."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.priority,
            t.status,
            t.estimated_minutes,
            s.subject_name
        FROM  public.tasks t
        JOIN  public.subjects s ON s.id = t.subject_id
        WHERE s.user_id = %s
          AND t.due_date >= date_trunc('week', CURRENT_TIMESTAMP)
                          + (%s * INTERVAL '7 days')
          AND t.due_date <  date_trunc('week', CURRENT_TIMESTAMP)
                          + ((%s + 1) * INTERVAL '7 days')
        ORDER BY t.due_date
    """, (user_id, week_offset, week_offset))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    tasks = []
    for r in rows:
        tasks.append({
            "id":                str(r[0]),
            "title":             r[1],
            "due_date":          r[2].isoformat(),
            "priority":          r[3],
            "status":            r[4],
            "estimated_minutes": r[5],
            "subject":           r[6]
        })
    return tasks


def get_high_priority_tasks(user_id, limit=3):
    """Upcoming high-priority tasks ordered by due date."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.priority,
            t.status,
            s.subject_name,
            (t.due_date::date - CURRENT_DATE) AS days_left
        FROM  public.tasks t
        JOIN  public.subjects s ON s.id = t.subject_id
        WHERE s.user_id = %s
          AND t.status  <> 'completed'
          AND t.due_date >= CURRENT_TIMESTAMP
        ORDER BY
            CASE t.priority
                WHEN 'high'   THEN 1
                WHEN 'medium' THEN 2
                ELSE               3
            END,
            t.due_date
        LIMIT %s
    """, (user_id, limit))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [{
        "id":       str(r[0]),
        "title":    r[1],
        "due_date": r[2].isoformat(),
        "priority": r[3],
        "status":   r[4],
        "subject":  r[5],
        "days_left": int(r[6])
    } for r in rows]


def get_ai_insight(user_id):
    """Return the most urgent pending task as the AI suggested next task."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            t.id,
            t.title,
            t.estimated_minutes,
            t.due_date,
            s.subject_name,
            p.completion_percentage
        FROM  public.tasks t
        JOIN  public.subjects s ON s.id = t.subject_id
        LEFT  JOIN public.progress p
               ON  p.subject_id = s.id AND p.user_id = s.user_id
        WHERE s.user_id = %s
          AND t.status  <> 'completed'
          AND t.due_date >= CURRENT_TIMESTAMP
        ORDER BY
            CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            t.due_date
        LIMIT 1
    """, (user_id,))

    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return None

    task_id, title, est_min, due_date, subject, mastery = row
    mastery = float(mastery or 0)
    est     = est_min or 45

    return {
        "task_id":     str(task_id),
        "title":       title,
        "subject":     subject,
        "due_date":    due_date.isoformat(),
        "est_minutes": est,
        "mastery":     mastery,
        "reason": (
            f"Based on your recent performance in {subject}, focusing "
            f"{est} minutes on this task will maximize retention efficiency."
        )
    }
