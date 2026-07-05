from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
from dotenv import load_dotenv
import os, jwt, bcrypt, datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

import subjectDao
import authDao

load_dotenv()

app = Flask(__name__)
CORS(app)

JWT_SECRET        = os.environ.get("JWT_SECRET")
GOOGLE_CLIENT_ID  = os.environ.get("GOOGLE_CLIENT_ID")


# JWT helpers 

def generate_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


# Auth decorator 

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        token = auth_header.split(" ")[1]
        try:
            payload = decode_token(token)
            request.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated



#  AUTH ENDPOINTS

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json()
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    try:
        existing = authDao.find_user_by_email(email)
        if existing:
            return jsonify({"error": "An account with this email already exists."}), 409

        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user    = authDao.create_user(name, email, pw_hash)
        token   = generate_token(user["id"])
        return jsonify({"token": token, "user": user}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    try:
        user = authDao.find_user_by_email(email)
        if not user:
            return jsonify({"error": "Invalid email or password."}), 401

        if not user["password_hash"]:
            return jsonify({"error": "This account uses Google sign-in. Please use the Google button."}), 401

        if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
            return jsonify({"error": "Invalid email or password."}), 401

        token = generate_token(user["id"])
        safe_user = {k: v for k, v in user.items() if k != "password_hash"}
        return jsonify({"token": token, "user": safe_user}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    data       = request.get_json()
    credential = data.get("credential")

    if not credential:
        return jsonify({"error": "Missing Google credential"}), 400

    try:
        # Verify the token with Google
        id_info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        name  = id_info.get("name", "")
        email = id_info.get("email", "").lower()

        user  = authDao.find_or_create_google_user(name, email)
        token = generate_token(user["id"])
        safe_user = {k: v for k, v in user.items() if k != "password_hash"}
        return jsonify({"token": token, "user": safe_user}), 200

    except ValueError as e:
        return jsonify({"error": "Invalid Google token: " + str(e)}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500



#  SUBJECTS ENDPOINTS  (protected)

@app.route("/api/subjects", methods=["GET"])
@require_auth
def get_subjects():
    try:
        subjects = subjectDao.get_all_subjects(request.user_id)
        return jsonify(subjects), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects", methods=["POST"])
@require_auth
def create_subject():
    data = request.get_json()
    try:
        new_id = subjectDao.add_subject(
            user_id=request.user_id,
            subject_name=data["subject_name"],
            description=data.get("description", "")
        )
        return jsonify({"id": new_id, "message": "Subject created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects/<subject_id>", methods=["PUT"])
@require_auth
def edit_subject(subject_id):
    data = request.get_json()
    try:
        subjectDao.update_subject(
            subject_id=subject_id,
            subject_name=data["subject_name"],
            description=data.get("description", "")
        )
        return jsonify({"message": "Subject updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects/<subject_id>", methods=["DELETE"])
@require_auth
def remove_subject(subject_id):
    try:
        subjectDao.delete_subject(subject_id)
        return jsonify({"message": "Subject deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
