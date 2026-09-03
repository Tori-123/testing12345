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
