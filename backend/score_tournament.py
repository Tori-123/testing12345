import os

import httpx

# service_role/secret key 只存在于后端 .env，绝不放入前端。用它做可信的积分结算。
# 注意：必须在调用时惰性读取 os.getenv——main.py 是先 import 本模块、后 load_dotenv，
# 若在模块顶层读取会拿到空值。
WIN_DELTA = 5
LOSE_DELTA = -2


def _config():
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SCORE_SERVICE_ROLE", "")
    if not url or not key:
        return None, {}
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    return url, headers


def apply_score(user_id: str, username: str, delta: int, won: bool) -> bool:
    """给某用户结算 delta 分（胜 +5 / 负 -2），分数下限 0。返回是否成功。"""
    url, headers = _config()
    if not url:
        print("[score] service_role 未配置，跳过积分结算", flush=True)
        return False
    try:
        resp = httpx.post(
            f"{url}/rest/v1/rpc/bump_score",
            headers=headers,
            json={
                "p_uid": user_id,
                "p_username": username,
                "p_delta": delta,
                "p_win": bool(won),
            },
            timeout=8.0,
        )
        if resp.status_code >= 400:
            print(f"[score] bump_score 失败: {resp.status_code} {resp.text}", flush=True)
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[score] bump_score 异常: {exc}", flush=True)
        return False


def get_points(user_id: str) -> int:
    """读 tournament_scores 当前积分；没有行或读失败当 0。"""
    url, headers = _config()
    if not url or not user_id:
        return 0
    try:
        resp = httpx.get(
            f"{url}/rest/v1/tournament_scores",
            headers={
                **headers,
                "Accept": "application/json",
                "Prefer": "return=representation",
            },
            params={"user_id": f"eq.{user_id}", "select": "points"},
            timeout=8.0,
        )
        if resp.status_code >= 400:
            print(f"[score] get_points 失败: {resp.status_code} {resp.text}", flush=True)
            return 0
        rows = resp.json()
        if isinstance(rows, list) and rows:
            return int(rows[0].get("points") or 0)
    except Exception as exc:  # noqa: BLE001
        print(f"[score] get_points 异常: {exc}", flush=True)
    return 0


def list_scores(limit: int = 100) -> list[dict]:
    url, headers = _config()
    if not url:
        return []
    try:
        resp = httpx.get(
            f"{url}/rest/v1/tournament_scores",
            headers={
                **headers,
                "Accept": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "select": "user_id,username,points,wins,losses",
                "order": "points.desc",
                "limit": str(limit),
            },
            timeout=8.0,
        )
        if resp.status_code >= 400:
            print(f"[score] list_scores 失败: {resp.status_code} {resp.text}", flush=True)
            return []
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[score] list_scores 异常: {exc}", flush=True)
        return []


def seed_virtual_scores(rows: list[dict]) -> bool:
    """写入虚拟用户种子分。外键挡住时返回 False，调用方仍可内存合并展示。"""
    url, headers = _config()
    if not url or not rows:
        return False
    payload = [
        {
            "user_id": row["id"],
            "username": row["username"],
            "points": int(row.get("points") or 0),
            "wins": int(row.get("wins") or 0),
            "losses": int(row.get("losses") or 0),
        }
        for row in rows
    ]
    try:
        resp = httpx.post(
            f"{url}/rest/v1/tournament_scores",
            headers={
                **headers,
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json=payload,
            timeout=12.0,
        )
        if resp.status_code >= 400:
            print(f"[score] seed_virtual 失败: {resp.status_code} {resp.text}", flush=True)
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[score] seed_virtual 异常: {exc}", flush=True)
        return False
