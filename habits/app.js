/* ==========================================================================
   Атомные привычки — логика приложения.
   Всё хранится в localStorage этого браузера (по устройству).
   Экспорт/импорт JSON позволяет перенести данные между устройствами вручную.
   ========================================================================== */

(() => {
  "use strict";

  const STORAGE_KEY = "atomic-habits:v1";
  const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]; // начиная с понедельника

  /* ------------------------------ утилиты дат ------------------------------ */

  const pad = (n) => String(n).padStart(2, "0");
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keyToDate = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const startOfDay = (d) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
  const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
  const todayKey = () => toKey(new Date());

  function formatDayLabel(d) {
    const today = startOfDay(new Date());
    const target = startOfDay(d);
    const diff = Math.round((target - today) / 86400000);
    if (diff === 0) return "Сегодня";
    if (diff === -1) return "Вчера";
    if (diff === 1) return "Завтра";
    return target.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
  }

  /* ------------------------------ хранилище ------------------------------ */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { habits: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.habits)) return { habits: [] };
      return parsed;
    } catch {
      return { habits: [] };
    }
  }

  let state = loadState();
  let viewedDate = startOfDay(new Date());

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast("Не удалось сохранить: хранилище браузера переполнено или недоступно.");
    }
  }

  function uid() {
    return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /* ------------------------------ модель привычки ------------------------------
     {
       id, kind: 'good'|'bad', title, identity, why,
       time, place, stack, reward, tiny,   // 'good' — четыре закона
       cueBad, cost, friction,             // 'bad' — обратные законы
       days: [0..6] дни недели, когда активна (для good; bad активна всегда),
       archived: bool,
       createdAt: key,
       logs: { 'YYYY-MM-DD': 'done' | 'slip' }
     }
  ------------------------------------------------------------------------- */

  function isScheduled(habit, date) {
    if (habit.kind === "bad") return true; // вредную привычку отслеживаем каждый день
    if (!habit.days || habit.days.length === 0) return true;
    return habit.days.includes(date.getDay());
  }

  function logFor(habit, key) {
    return (habit.logs || {})[key];
  }

  function setLog(habit, key, value) {
    habit.logs = habit.logs || {};
    if (value === null) delete habit.logs[key];
    else habit.logs[key] = value;
  }

  // Текущая цепочка подряд идущих успешных дней, считая от `key` назад.
  function currentStreak(habit, fromKey = todayKey()) {
    let streak = 0;
    let cursor = keyToDate(fromKey);
    for (let i = 0; i < 3650; i++) {
      const key = toKey(cursor);
      if (habit.kind === "good") {
        if (!isScheduled(habit, cursor)) { cursor = addDays(cursor, -1); continue; }
        if (logFor(habit, key) === "done") { streak++; cursor = addDays(cursor, -1); continue; }
        break;
      } else {
        const v = logFor(habit, key);
        if (v === "slip") break;
        // 'done' (устоял) или нет записи (день ещё не наступил/не учитывался) — считаем чистым только явное 'done'
        if (v === "done") { streak++; cursor = addDays(cursor, -1); continue; }
        break;
      }
    }
    return streak;
  }

  // Пропущен ли предыдущий запланированный день (без отметки) — сигнал «не пропускай дважды».
  function missedYesterday(habit, fromKey = todayKey()) {
    if (habit.kind === "bad") {
      const y = toKey(addDays(keyToDate(fromKey), -1));
      return logFor(habit, y) === "slip";
    }
    let cursor = addDays(keyToDate(fromKey), -1);
    for (let i = 0; i < 14; i++) {
      if (isScheduled(habit, cursor)) {
        const key = toKey(cursor);
        const v = logFor(habit, key);
        if (v === "done") return false;
        if (key < habit.createdAt) return false;
        return v === undefined; // запланирован, прошёл, не отмечен — пропуск
      }
      cursor = addDays(cursor, -1);
    }
    return false;
  }

  function totalStats(habit) {
    const logs = habit.logs || {};
    let done = 0, slip = 0;
    for (const v of Object.values(logs)) {
      if (v === "done") done++;
      else if (v === "slip") slip++;
    }
    return { done, slip };
  }

  /* ------------------------------ рендер: узлы DOM ------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, className, children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (children != null) {
      for (const c of [].concat(children)) {
        if (c == null) continue;
        node.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return node;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  /* ------------------------------ навигация по вкладкам ------------------------------ */

  const views = { today: $("#view-today"), habits: $("#view-habits"), stats: $("#view-stats"), settings: $("#view-settings") };

  function showView(name) {
    for (const [k, node] of Object.entries(views)) node.hidden = k !== name;
    $$(".tab", $("#tabbar")).forEach((btn) => btn.classList.toggle("is-active", btn.dataset.view === name));
    if (name === "habits") renderHabitsView();
    if (name === "stats") renderStatsView();
  }

  $("#tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (btn) showView(btn.dataset.view);
  });

  /* ------------------------------ тема ------------------------------ */

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("atomic-habits:theme", theme);
  }
  applyTheme(localStorage.getItem("atomic-habits:theme") || "auto");

  $("#theme-btn").addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    const cur = document.documentElement.getAttribute("data-theme") || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    applyTheme(next);
    toast(next === "auto" ? "Тема: системная" : next === "light" ? "Тема: светлая" : "Тема: тёмная");
  });

  /* ------------------------------ вкладка «Сегодня» ------------------------------ */

  function activeHabits() {
    return state.habits.filter((h) => !h.archived);
  }

  function renderTodayView() {
    $("#day-label").textContent = formatDayLabel(viewedDate);
    $("#day-today").hidden = toKey(viewedDate) === todayKey();
    $("#day-next").disabled = toKey(viewedDate) >= toKey(addDays(new Date(), 60));

    const key = toKey(viewedDate);
    const goodBox = $("#today-good");
    const badBox = $("#today-bad");
    const warnBox = $("#today-warnings");
    goodBox.innerHTML = "";
    badBox.innerHTML = "";
    warnBox.innerHTML = "";

    const good = activeHabits().filter((h) => h.kind === "good" && isScheduled(h, viewedDate) && key >= h.createdAt);
    const bad = activeHabits().filter((h) => h.kind === "bad" && key >= h.createdAt);

    if (good.length === 0) goodBox.append(el("div", "empty", "На этот день нет запланированных полезных привычек."));
    else good.forEach((h) => goodBox.append(renderTodayRow(h, key)));

    if (bad.length === 0) badBox.append(el("div", "empty", "Нет привычек, от которых вы отказываетесь."));
    else bad.forEach((h) => badBox.append(renderTodayRow(h, key)));

    // предупреждения «не пропускай дважды», только для сегодняшнего дня
    if (key === todayKey()) {
      [...good, ...bad].forEach((h) => {
        if (missedYesterday(h)) {
          const kindWord = h.kind === "good" ? "Вчера привычка была пропущена" : "Вчера случился срыв";
          warnBox.append(el("div", "warn", [
            el("b", null, "⚠ Не пропускай дважды. "),
            `${kindWord} «${h.title}». Один раз — случайность, два подряд — новая привычка.`,
          ]));
        }
      });
    }

    const total = good.length + bad.length;
    let doneCount = 0;
    good.forEach((h) => { if (logFor(h, key) === "done") doneCount++; });
    bad.forEach((h) => { if (logFor(h, key) === "done") doneCount++; });
    const pct = total ? Math.round((doneCount / total) * 100) : 0;
    $("#progress-num").textContent = `${pct}%`;
    $("#progress-sub").textContent = total ? `${doneCount} из ${total} выполнено` : "нет привычек на этот день";
    const ring = $("#ring-fg");
    const circumference = 213.6;
    ring.style.strokeDashoffset = String(circumference - (circumference * pct) / 100);
  }

  function renderTodayRow(habit, key) {
    const status = logFor(habit, key);
    const row = el("div", "habit");
    const isFuture = key > todayKey();

    const check = el("button", "check", status === "done" ? "✓" : status === "slip" ? "✕" : "");
    check.type = "button";
    check.classList.toggle("is-on", status === "done");
    check.classList.toggle("is-slip", status === "slip");
    check.setAttribute("aria-label", habit.kind === "good" ? "Отметить выполнение" : "Отметить, что устоял");
    check.disabled = isFuture;
    check.addEventListener("click", () => {
      const cur = logFor(habit, key);
      setLog(habit, key, cur === "done" ? null : "done");
      save();
      renderTodayView();
    });
    row.append(check);

    const main = el("div", "habit__main");
    main.append(el("div", "habit__title", habit.title));
    if (habit.identity) main.append(el("div", "habit__identity", `→ ${habit.identity}`));

    const metaBits = [];
    if (habit.kind === "good") {
      if (habit.time) metaBits.push(habit.time);
      if (habit.place) metaBits.push(habit.place);
    }
    if (metaBits.length) main.append(el("div", "habit__meta", metaBits.join(" · ")));

    const chips = el("div", "chips");
    const streak = currentStreak(habit, key <= todayKey() ? key : todayKey());
    if (streak > 0) {
      chips.append(el("span", "chip chip--streak", habit.kind === "good" ? `🔥 ${streak} подряд` : `🛡 ${streak} дн. держитесь`));
    }
    if (habit.kind === "bad" && status !== "done") {
      const slipBtn = el("button", null, status === "slip" ? "Срыв отмечен" : "Отметить срыв");
      slipBtn.addEventListener("click", () => {
        setLog(habit, key, status === "slip" ? null : "slip");
        save();
        renderTodayView();
      });
      chips.append(el("span", `chip ${status === "slip" ? "chip--risk" : ""}`, slipBtn));
    }
    if (habit.kind === "good" && habit.tiny) {
      chips.append(el("span", "chip", `2 мин: ${habit.tiny}`));
    }
    if (chips.children.length) main.append(chips);

    row.append(main);
    row.addEventListener("click", (e) => {
      if (e.target === check || e.target.closest(".chip button")) return;
      openHabitDialog(habit);
    });
    row.classList.add("habit--row");
    return row;
  }

  $("#day-prev").addEventListener("click", () => { viewedDate = addDays(viewedDate, -1); renderTodayView(); });
  $("#day-next").addEventListener("click", () => { viewedDate = addDays(viewedDate, 1); renderTodayView(); });
  $("#day-today").addEventListener("click", () => { viewedDate = startOfDay(new Date()); renderTodayView(); });

  /* ------------------------------ вкладка «Привычки» ------------------------------ */

  function renderHabitsView() {
    const list = $("#habits-list");
    const archiveList = $("#archive-list");
    list.innerHTML = "";
    archiveList.innerHTML = "";

    const live = state.habits.filter((h) => !h.archived);
    const archived = state.habits.filter((h) => h.archived);

    if (live.length === 0) list.append(el("div", "empty", "Пока нет привычек — нажмите «Добавить»."));
    else live.forEach((h) => list.append(renderHabitCard(h)));

    if (archived.length === 0) archiveList.append(el("div", "empty", "Архив пуст."));
    else archived.forEach((h) => archiveList.append(renderHabitCard(h, true)));
  }

  function renderHabitCard(habit, archivedView = false) {
    const card = el("div", `habit habit--row${archivedView ? " habit--archived" : ""}`);
    const badge = el("div", "check", habit.kind === "good" ? "＋" : "－");
    badge.style.pointerEvents = "none";
    badge.classList.add(habit.kind === "good" ? "is-on" : "is-slip");
    card.append(badge);

    const main = el("div", "habit__main");
    main.append(el("div", "habit__title", habit.title));
    if (habit.identity) main.append(el("div", "habit__identity", `→ ${habit.identity}`));
    const { done, slip } = totalStats(habit);
    const metaText = habit.kind === "good"
      ? `Выполнено всего: ${done}`
      : `Устояли: ${done} · Срывы: ${slip}`;
    main.append(el("div", "habit__meta", metaText));
    card.append(main);

    card.addEventListener("click", () => openHabitDialog(habit));
    return card;
  }

  $("#add-habit").addEventListener("click", () => openHabitDialog(null));

  /* ------------------------------ вкладка «Статистика» ------------------------------ */

  function renderStatsView() {
    const box = $("#stats-list");
    box.innerHTML = "";
    const live = activeHabits();
    if (live.length === 0) {
      box.append(el("div", "empty", "Добавьте привычки, чтобы увидеть статистику."));
      return;
    }
    live.forEach((h) => box.append(renderStatCard(h)));
  }

  function renderStatCard(habit) {
    const card = el("div", "card");
    const head = el("div", "stat-head");
    head.append(el("b", null, habit.title));
    head.append(el("span", "chip", habit.kind === "good" ? "Осваиваю" : "Бросаю"));
    card.append(head);

    const { done, slip } = totalStats(habit);
    const streak = currentStreak(habit);
    const nums = el("div", "stat-nums");
    nums.append(statNum(streak, habit.kind === "good" ? "дней подряд" : "дней держусь"));
    nums.append(statNum(done, habit.kind === "good" ? "всего выполнено" : "всего устоял"));
    if (habit.kind === "bad") nums.append(statNum(slip, "срывов"));
    card.append(nums);

    card.append(renderHeatGrid(habit));
    return card;
  }

  function statNum(n, cap) {
    const box = el("div");
    box.append(el("div", "stat-num", String(n)));
    box.append(el("div", "stat-cap", cap));
    return box;
  }

  // Сетка последних ~12 недель, по столбцам-неделям (как в GitHub-графике активности).
  function renderHeatGrid(habit) {
    const wrap = el("div", "grid-log");
    const weeks = 12;
    const days = weeks * 7;
    const today = startOfDay(new Date());
    const start = addDays(today, -(days - 1));
    // выравниваем начало на понедельник
    const startDow = (start.getDay() + 6) % 7;
    const gridStart = addDays(start, -startDow);

    let cursor = gridStart;
    for (let w = 0; w < weeks + 1; w++) {
      const col = el("div", "grid-col");
      for (let d = 0; d < 7; d++) {
        const key = toKey(cursor);
        let cls = "grid-cell grid-cell--off";
        if (cursor > today) cls = "grid-cell grid-cell--off grid-cell--future";
        else if (key >= habit.createdAt) {
          const v = logFor(habit, key);
          if (v === "done") cls = "grid-cell grid-cell--on";
          else if (v === "slip") cls = "grid-cell grid-cell--slip";
        }
        const cell = el("div", cls);
        cell.title = `${key}${logFor(habit, key) ? ": " + (logFor(habit, key) === "done" ? "выполнено" : "срыв") : ""}`;
        col.append(cell);
        cursor = addDays(cursor, 1);
      }
      wrap.append(col);
    }
    return wrap;
  }

  /* ------------------------------ форма привычки ------------------------------ */

  const dialog = $("#habit-dialog");
  const form = $("#habit-form");
  let editingId = null;
  let currentKind = "good";

  function buildDaysPicker(selected) {
    const box = $("#f-days");
    box.innerHTML = "";
    ALL_DAYS.forEach((dow) => {
      const btn = el("button", `day${selected.includes(dow) ? " is-on" : ""}`, DAY_NAMES[dow]);
      btn.type = "button";
      btn.dataset.dow = String(dow);
      btn.addEventListener("click", () => btn.classList.toggle("is-on"));
      box.append(btn);
    });
  }

  function setKind(kind) {
    currentKind = kind;
    $$(".seg__btn", $("#kind-seg")).forEach((b) => b.classList.toggle("is-active", b.dataset.kind === kind));
    $$("[data-for]", form).forEach((node) => { node.hidden = node.dataset.for !== kind; });
  }

  $("#kind-seg").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg__btn");
    if (btn) setKind(btn.dataset.kind);
  });

  function openHabitDialog(habit) {
    editingId = habit ? habit.id : null;
    $("#dialog-title").textContent = habit ? "Изменить привычку" : "Новая привычка";
    setKind(habit ? habit.kind : "good");

    $("#f-title").value = habit?.title || "";
    $("#f-identity").value = habit?.identity || "";
    $("#f-time").value = habit?.time || "";
    $("#f-place").value = habit?.place || "";
    $("#f-stack").value = habit?.stack || "";
    $("#f-reward").value = habit?.reward || "";
    $("#f-tiny").value = habit?.tiny || "";
    $("#f-cue-bad").value = habit?.cueBad || "";
    $("#f-cost").value = habit?.cost || "";
    $("#f-friction").value = habit?.friction || "";
    $("#f-why").value = habit?.why || "";
    buildDaysPicker(habit?.days || ALL_DAYS);

    $("#delete-btn").hidden = !habit;
    $("#archive-btn").hidden = !habit || habit.archived;
    if (habit) $("#archive-btn").textContent = "В архив";

    dialog.showModal();
    setTimeout(() => $("#f-title").focus(), 50);
  }

  form.addEventListener("submit", (e) => {
    const action = e.submitter?.value;
    if (action !== "save") return; // "cancel" просто закрывает <dialog method="dialog">

    if (!$("#f-title").value.trim()) {
      e.preventDefault();
      toast("Введите название привычки");
      return;
    }

    const days = $$(".day.is-on", $("#f-days")).map((b) => Number(b.dataset.dow));

    let habit = state.habits.find((h) => h.id === editingId);
    const isNew = !habit;
    if (isNew) {
      habit = { id: uid(), createdAt: todayKey(), logs: {} };
      state.habits.push(habit);
    }

    Object.assign(habit, {
      kind: currentKind,
      title: $("#f-title").value.trim(),
      identity: $("#f-identity").value.trim(),
      time: $("#f-time").value,
      place: $("#f-place").value.trim(),
      stack: $("#f-stack").value.trim(),
      reward: $("#f-reward").value.trim(),
      tiny: $("#f-tiny").value.trim(),
      cueBad: $("#f-cue-bad").value.trim(),
      cost: $("#f-cost").value.trim(),
      friction: $("#f-friction").value.trim(),
      why: $("#f-why").value.trim(),
      days: currentKind === "good" ? days : [],
    });

    save();
    renderAll();
    toast(isNew ? "Привычка добавлена" : "Изменения сохранены");
  });

  $("#delete-btn").addEventListener("click", () => {
    if (!editingId) return;
    if (!confirm("Удалить привычку вместе со всей историей? Это необратимо.")) return;
    state.habits = state.habits.filter((h) => h.id !== editingId);
    save();
    dialog.close();
    renderAll();
    toast("Привычка удалена");
  });

  $("#archive-btn").addEventListener("click", () => {
    if (!editingId) return;
    const habit = state.habits.find((h) => h.id === editingId);
    if (habit) habit.archived = true;
    save();
    dialog.close();
    renderAll();
    toast("Перенесено в архив");
  });

  /* ------------------------------ настройки: экспорт/импорт/сброс ------------------------------ */

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atomic-habits-${todayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Файл выгружен");
  });

  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.habits)) throw new Error("bad shape");
      if (state.habits.length > 0 && !confirm("Заменить текущие данные содержимым файла?")) return;
      state = parsed;
      save();
      renderAll();
      toast("Данные загружены");
    } catch {
      toast("Не удалось прочитать файл");
    }
  });

  $("#demo-btn").addEventListener("click", () => {
    const today = todayKey();
    state.habits.push(
      { id: uid(), kind: "good", title: "Читать 10 минут", identity: "Я читающий человек",
        time: "21:30", place: "кровать", stack: "после чистки зубов", reward: "чашка травяного чая",
        tiny: "прочитать одну страницу", why: "хочу больше знать и лучше спать",
        days: ALL_DAYS, createdAt: today, logs: {} },
      { id: uid(), kind: "bad", title: "Листать телефон в кровати", identity: "",
        cueBad: "телефон на зарядке у кровати", cost: "теряю час сна, утром разбитый",
        friction: "заряжать телефон на кухне", why: "хочу высыпаться",
        days: [], createdAt: today, logs: {} }
    );
    save();
    renderAll();
    toast("Примеры добавлены");
  });

  $("#reset-btn").addEventListener("click", () => {
    if (!confirm("Удалить все привычки и историю без возможности восстановления?")) return;
    state = { habits: [] };
    save();
    renderAll();
    toast("Все данные удалены");
  });

  /* ------------------------------ инициализация ------------------------------ */

  function renderAll() {
    renderTodayView();
    if (!views.habits.hidden) renderHabitsView();
    if (!views.stats.hidden) renderStatsView();
  }

  $("#ver").textContent = new Date().toISOString().slice(0, 10);
  renderAll();

  // Регистрируем service worker для офлайн-доступа (PWA на iPhone/Mac/ПК).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
