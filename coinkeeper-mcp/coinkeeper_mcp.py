"""MCP-сервер для Coin Keeper.

У Coin Keeper нет публичного API, поэтому сервер работает через тот же
внутренний API, что и веб-версия coinkeeper.me, авторизуясь cookie сессии.
"""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

BASE_URL = os.environ.get("COINKEEPER_BASE_URL", "https://coinkeeper.me").rstrip("/")
COOKIE = os.environ.get("COINKEEPER_COOKIE", "")
BUDGET_ID = os.environ.get("COINKEEPER_BUDGET_ID", "")

ACCESS_TOKEN = os.environ.get("MCP_ACCESS_TOKEN", "")
# Разрешённые Host-заголовки: localhost + домен хостинга (Render задаёт его сам)
# + список из MCP_ALLOWED_HOSTS через запятую.
ALLOWED_HOSTS = ["localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"] + [
    h.strip()
    for h in [os.environ.get("RENDER_EXTERNAL_HOSTNAME", ""),
              *os.environ.get("MCP_ALLOWED_HOSTS", "").split(",")]
    if h.strip()
]

# stateless_http: каждый запрос независим — подходит для бесплатных хостингов,
# где инстанс может перезапускаться.
mcp = FastMCP("coinkeeper", stateless_http=True, streamable_http_path="/mcp",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True, allowed_hosts=ALLOWED_HOSTS
    ),
)

_client: httpx.AsyncClient | None = None
_budget_id: str | None = BUDGET_ID or None


def _http() -> httpx.AsyncClient:
    global _client
    if not COOKIE:
        raise RuntimeError(
            "Не задан COINKEEPER_COOKIE. Войдите на coinkeeper.me, скопируйте "
            "заголовок Cookie из DevTools и передайте его в переменной окружения."
        )
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=30,
            headers={
                "Cookie": COOKIE,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "coinkeeper-mcp/0.1",
            },
        )
    return _client


async def _request(method: str, path: str, json: Any = None) -> Any:
    resp = await _http().request(method, path, json=json)
    if resp.status_code in (401, 403) or "/login" in str(resp.url).lower():
        raise RuntimeError("Сессия Coin Keeper недействительна — обновите COINKEEPER_COOKIE.")
    resp.raise_for_status()
    return resp.json()


async def _get_budget_id() -> str:
    global _budget_id
    if _budget_id:
        return _budget_id
    info = await _request("GET", "/api/user/info")
    data = info.get("data", info) if isinstance(info, dict) else {}
    user = data.get("user", data)
    budget_id = user.get("budgetId") or data.get("budgetId")
    if not budget_id:
        raise RuntimeError("Не удалось определить budgetId — задайте COINKEEPER_BUDGET_ID.")
    _budget_id = str(budget_id)
    return _budget_id


def _parse_date(value: str | None) -> date | None:
    return datetime.strptime(value, "%Y-%m-%d").date() if value else None


def _tx_date(tx: dict) -> date | None:
    raw = tx.get("dateTimestampISO") or tx.get("dateTimestamp") or tx.get("date")
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return datetime.fromtimestamp(raw / 1000 if raw > 1e11 else raw).date()
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).date()
    except ValueError:
        return None


async def _snapshot() -> dict:
    """Полный снимок данных бюджета (категории, счета, цели) через синхронизацию."""
    budget_id = await _get_budget_id()
    res = await _request("POST", "/Exchange/Ping", {"items": [], "budgetId": budget_id})
    return res.get("data", res) if isinstance(res, dict) else {}


@mcp.tool()
async def get_user_info() -> Any:
    """Информация о текущем пользователе Coin Keeper (включая budgetId)."""
    return await _request("GET", "/api/user/info")


@mcp.tool()
async def list_categories(kind: str | None = None) -> list[dict]:
    """Список категорий: доходы, счета (кошельки) и расходы.

    kind — необязательный фильтр: "income", "account" или "expense".
    """
    snap = await _snapshot()
    cats = snap.get("categories") or snap.get("userCategories") or []
    type_map = {1: "income", 2: "account", 3: "expense"}
    result = []
    for c in cats:
        if c.get("isDeleted"):
            continue
        t = type_map.get(c.get("categoryType"), c.get("categoryType"))
        if kind and t != kind:
            continue
        result.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "type": t,
            "currency": c.get("currency"),
            "balance": c.get("balance", c.get("amount")),
            "limit": c.get("limit"),
        })
    return result


@mcp.tool()
async def list_transactions(
    date_from: str | None = None,
    date_to: str | None = None,
    category_id: str | None = None,
    search: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Операции из Coin Keeper, от новых к старым.

    date_from / date_to — даты в формате YYYY-MM-DD (включительно).
    category_id — оставить только операции, где категория источник или получатель.
    search — подстрока в комментарии или тегах (без учёта регистра).
    limit — максимум возвращаемых операций (до 1000).
    """
    budget_id = await _get_budget_id()
    d_from, d_to = _parse_date(date_from), _parse_date(date_to)
    limit = max(1, min(limit, 1000))
    needle = search.lower() if search else None
    out: list[dict] = []
    skip, page = 0, 200
    while len(out) < limit:
        res = await _request("POST", "/api/transaction/get", {
            "budgetId": budget_id,
            "skip": skip,
            "take": page,
            "categoryIds": [category_id] if category_id else [],
            "tagIds": [],
            "period": None,
        })
        batch = (res.get("data") or {}).get("transactions", []) if isinstance(res, dict) else []
        if not batch:
            break
        for tx in batch:
            d = _tx_date(tx)
            if d_from and d and d < d_from:
                return out  # дальше только более старые операции
            if d_to and d and d > d_to:
                continue
            if category_id and category_id not in (tx.get("sourceId"), tx.get("destinationId")):
                continue
            text = f"{tx.get('comment') or ''} {' '.join(tx.get('tags') or [])}".lower()
            if needle and needle not in text:
                continue
            out.append({
                "id": tx.get("id"),
                "date": d.isoformat() if d else None,
                "amount": tx.get("amount"),
                "amountConverted": tx.get("amountConverted"),
                "sourceId": tx.get("sourceId"),
                "destinationId": tx.get("destinationId"),
                "comment": tx.get("comment"),
                "tags": tx.get("tags"),
            })
            if len(out) >= limit:
                break
        skip += page
    return out


@mcp.tool()
async def spending_summary(date_from: str, date_to: str) -> dict:
    """Сумма расходов и доходов по категориям за период (YYYY-MM-DD, включительно)."""
    cats = {c["id"]: c for c in await list_categories()}
    txs = await list_transactions(date_from=date_from, date_to=date_to, limit=1000)
    expenses: dict[str, float] = {}
    incomes: dict[str, float] = {}
    for tx in txs:
        amount = float(tx.get("amount") or 0)
        src, dst = cats.get(tx["sourceId"]), cats.get(tx["destinationId"])
        if dst and dst["type"] == "expense":
            expenses[dst["name"]] = expenses.get(dst["name"], 0) + amount
        elif src and src["type"] == "income":
            incomes[src["name"]] = incomes.get(src["name"], 0) + amount
    return {
        "period": {"from": date_from, "to": date_to},
        "transactions": len(txs),
        "total_expense": round(sum(expenses.values()), 2),
        "total_income": round(sum(incomes.values()), 2),
        "expenses_by_category": dict(sorted(expenses.items(), key=lambda kv: -kv[1])),
        "incomes_by_category": dict(sorted(incomes.items(), key=lambda kv: -kv[1])),
    }


def http_app():
    """ASGI-приложение для удалённого подключения (приложение Claude на телефоне).

    Адрес коннектора: https://<хост>/<MCP_ACCESS_TOKEN>/mcp — секретный токен в
    пути не даёт посторонним читать ваши финансы.
    """
    if len(ACCESS_TOKEN) < 16:
        raise RuntimeError("Задайте MCP_ACCESS_TOKEN длиной не менее 16 символов.")
    inner = mcp.streamable_http_app()
    prefix = f"/{ACCESS_TOKEN}"

    async def app(scope, receive, send):
        if scope["type"] == "lifespan":
            return await inner(scope, receive, send)
        path = scope.get("path", "")
        if scope["type"] == "http" and path in ("/", "/health"):
            await send({"type": "http.response.start", "status": 200,
                        "headers": [(b"content-type", b"text/plain")]})
            return await send({"type": "http.response.body", "body": b"ok"})
        if not path.startswith(prefix + "/"):
            await send({"type": "http.response.start", "status": 404, "headers": []})
            return await send({"type": "http.response.body", "body": b""})
        scope = dict(scope, path=path[len(prefix):])
        return await inner(scope, receive, send)

    return app


def main() -> None:
    if os.environ.get("MCP_TRANSPORT") == "http" or os.environ.get("PORT"):
        import uvicorn

        uvicorn.run(http_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "8000")),
                    proxy_headers=True, forwarded_allow_ips="*")
    else:
        mcp.run()


if __name__ == "__main__":
    main()
