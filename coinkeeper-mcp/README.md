# Coin Keeper MCP

MCP-коннектор для [Coin Keeper](https://coinkeeper.me): позволяет Claude (Claude Desktop, Claude Code и др.) читать ваши категории, счета и операции и строить сводки расходов.

> ⚠️ У Coin Keeper нет официального публичного API. Коннектор использует внутренний API веб-версии coinkeeper.me с cookie вашей сессии. Эндпоинты могут измениться без предупреждения. Cookie даёт полный доступ к аккаунту — не публикуйте его.

## Инструменты

| Инструмент | Что делает |
|---|---|
| `get_user_info` | Данные пользователя, в т.ч. `budgetId` |
| `list_categories` | Категории доходов, счета и категории расходов (фильтр `kind`) |
| `list_transactions` | Операции с фильтрами по датам, категории и тексту |
| `spending_summary` | Итоги доходов/расходов по категориям за период |

## Подключение к Claude на телефоне

Коннектор разворачивается как веб-сервер на бесплатном хостинге Render, а в Claude добавляется по ссылке.

1. **Cookie.** На компьютере войдите на https://coinkeeper.me и скопируйте заголовок `Cookie` (см. «Получение cookie» ниже).
2. **Хостинг.** Зарегистрируйтесь на https://render.com (можно через GitHub) → **New → Blueprint** → выберите этот репозиторий. Render прочитает `render.yaml` из корня репозитория.
3. Когда Render попросит `COINKEEPER_COOKIE`, вставьте скопированный cookie. `MCP_ACCESS_TOKEN` сгенерируется автоматически.
4. После деплоя откройте сервис → **Environment**, скопируйте значение `MCP_ACCESS_TOKEN`. Адрес коннектора:
   `https://<имя-сервиса>.onrender.com/<MCP_ACCESS_TOKEN>/mcp`
5. **Claude.** На claude.ai (с компьютера или телефона): **Settings → Connectors → Add custom connector**, вставьте адрес. Коннектор появится и в приложении Claude на телефоне.

Адрес с токеном — это ключ к вашим финансам: никому его не пересылайте. Если cookie истечёт, обновите `COINKEEPER_COOKIE` в Render → Environment.
На бесплатном тарифе Render сервер засыпает без запросов, поэтому первый запрос после паузы может идти ~30–60 секунд.

## Локальная установка (Claude Code / Claude Desktop)

```bash
cd coinkeeper-mcp
pip install .          # или: uv tool install .
```

## Получение cookie

1. Войдите на https://coinkeeper.me в браузере.
2. Откройте DevTools → Network, обновите страницу, выберите любой запрос к `coinkeeper.me`.
3. Скопируйте значение заголовка `Cookie` целиком.

## Подключение

**Claude Code:**

```bash
claude mcp add coinkeeper -e COINKEEPER_COOKIE='...' -- coinkeeper-mcp
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "coinkeeper": {
      "command": "coinkeeper-mcp",
      "env": { "COINKEEPER_COOKIE": "..." }
    }
  }
}
```

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `COINKEEPER_COOKIE` | да | Cookie сессии coinkeeper.me |
| `COINKEEPER_BUDGET_ID` | нет | ID бюджета (иначе берётся из `/api/user/info`) |
| `COINKEEPER_BASE_URL` | нет | По умолчанию `https://coinkeeper.me` |
| `MCP_ACCESS_TOKEN` | для веб-режима | Секрет в адресе коннектора, не короче 16 символов |
| `MCP_ALLOWED_HOSTS` | нет | Домены сервера через запятую (на Render определяется сам) |
| `PORT` / `MCP_TRANSPORT=http` | нет | Включают веб-режим (Streamable HTTP) |
