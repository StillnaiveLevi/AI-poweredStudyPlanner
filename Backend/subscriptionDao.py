from dbConnection import get_connection


def get_subscription(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT plan, status, stripe_customer_id, stripe_sub_id, current_period_end
        FROM   public.subscriptions
        WHERE  user_id = %s
    """, (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return {"plan": "free", "status": "active",
                "stripe_customer_id": None, "stripe_sub_id": None,
                "current_period_end": None}
    return {
        "plan":               row[0],
        "status":             row[1],
        "stripe_customer_id": row[2],
        "stripe_sub_id":      row[3],
        "current_period_end": row[4].isoformat() if row[4] else None
    }


def upsert_subscription(user_id, plan, status,
                        stripe_customer_id=None,
                        stripe_sub_id=None,
                        current_period_end=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO public.subscriptions
               (user_id, plan, status, stripe_customer_id, stripe_sub_id, current_period_end)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE
        SET plan               = EXCLUDED.plan,
            status             = EXCLUDED.status,
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_sub_id      = EXCLUDED.stripe_sub_id,
            current_period_end = EXCLUDED.current_period_end
    """, (user_id, plan, status, stripe_customer_id, stripe_sub_id, current_period_end))
    conn.commit()
    cursor.close()
    conn.close()


def get_user_email_by_stripe_customer(stripe_customer_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.email
        FROM   public.users u
        JOIN   public.subscriptions s ON s.user_id = u.id
        WHERE  s.stripe_customer_id = %s
    """, (stripe_customer_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return None
    return {"user_id": str(row[0]), "email": row[1]}
