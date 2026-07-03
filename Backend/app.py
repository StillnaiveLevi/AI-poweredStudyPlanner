from flask import Flask, jsonify, request
from flask_cors import CORS
import subjectDao

app = Flask(__name__)
CORS(app)

# ── Temporary: hard-coded user_id for development ──────
# Replace with session/token-based auth later
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


# ── Subjects ───────────────────────────────────────────

@app.route("/api/subjects", methods=["GET"])
def get_subjects():
    user_id = request.args.get("user_id", DEV_USER_ID)
    try:
        subjects = subjectDao.get_all_subjects(user_id)
        return jsonify(subjects), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects", methods=["POST"])
def create_subject():
    data = request.get_json()
    user_id = data.get("user_id", DEV_USER_ID)
    try:
        new_id = subjectDao.add_subject(
            user_id=user_id,
            subject_name=data["subject_name"],
            description=data.get("description", "")
        )
        return jsonify({"id": new_id, "message": "Subject created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects/<subject_id>", methods=["PUT"])
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
def remove_subject(subject_id):
    try:
        subjectDao.delete_subject(subject_id)
        return jsonify({"message": "Subject deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
