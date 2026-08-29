(() => {
  "use strict";

  const storageKey = "gecko-seat-planner";
  const $ = (selector) => document.querySelector(selector);
  const state = { names: "", students: [], layout: "rows", rows: 4, cols: 7, communityGroups: 7, seats: [], selected: null, dragged: null, message: "可貼上名單後開始安排" };
  const seatCount = () => state.layout === "rows" ? state.rows * state.cols : state.communityGroups * 4;
  const studentMap = () => new Map(state.students.map((student) => [student.id, student]));
  const seatedIds = () => new Set(state.seats.filter(Boolean));
  const unseated = () => state.students.filter((student) => !seatedIds().has(student.id));

  function resizeSeats() {
    const count = seatCount();
    state.seats = Array.from({ length: count }, (_, index) => state.seats[index] ?? null);
  }

  function setMessage(message) {
    state.message = message;
    $("#message").textContent = message;
  }

  function moveStudent(studentId, targetIndex) {
    const sourceIndex = state.seats.indexOf(studentId);
    const targetStudent = state.seats[targetIndex];
    if (sourceIndex >= 0) state.seats[sourceIndex] = targetStudent;
    state.seats[targetIndex] = studentId;
    state.selected = null;
    render();
  }

  function returnStudent(studentId) {
    state.seats = state.seats.map((id) => id === studentId ? null : id);
    state.selected = null;
    render();
  }

  function startDrag(event, studentId) {
    state.dragged = studentId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function finishDrag(event) {
    if (!state.dragged) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const seat = target?.closest("[data-seat]");
    if (seat) moveStudent(state.dragged, Number(seat.dataset.seat));
    else if (target?.closest("#student-pool")) returnStudent(state.dragged);
    state.dragged = null;
  }

  function makeSeat(index, map) {
    const id = state.seats[index];
    const student = id ? map.get(id) : null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `seat${student ? " filled" : ""}${state.selected === id ? " selected" : ""}`;
    button.dataset.seat = index;
    button.setAttribute("aria-label", `座位 ${index + 1}${student ? `，${student.name}` : "，空位"}`);
    button.innerHTML = `<span class="seat-number">${index + 1}</span>${student ? `<span class="student"></span>` : '<span class="empty">拖到這裡</span>'}`;
    if (student) {
      const name = button.querySelector(".student");
      name.textContent = student.name;
      name.addEventListener("pointerdown", (event) => startDrag(event, student.id));
      name.addEventListener("pointerup", finishDrag);
      name.addEventListener("pointercancel", () => { state.dragged = null; });
    }
    button.addEventListener("click", () => {
      if (state.selected) moveStudent(state.selected, index);
      else if (student) { state.selected = student.id; render(); }
    });
    return button;
  }

  function makeGroup(groupIndex, map) {
    const group = document.createElement("div");
    group.className = "community-group";
    group.innerHTML = `<span class="community-group-label">第 ${groupIndex + 1} 組</span>`;
    const seats = document.createElement("div");
    seats.className = "community-group-seats";
    for (let offset = 0; offset < 4; offset += 1) seats.append(makeSeat(groupIndex * 4 + offset, map));
    group.append(seats);
    return group;
  }

  function renderSeats() {
    const map = studentMap();
    const area = $("#seat-area");
    area.replaceChildren();
    if (state.layout === "rows") {
      const grid = document.createElement("div");
      grid.className = "row-layout";
      grid.style.gridTemplateColumns = `repeat(${state.cols}, minmax(82px, 1fr))`;
      state.seats.forEach((_, index) => grid.append(makeSeat(index, map)));
      area.append(grid);
    } else {
      const layout = document.createElement("div");
      layout.className = "u-layout";
      const left = document.createElement("div"); left.className = "u-side u-left";
      const right = document.createElement("div"); right.className = "u-side u-right";
      [0, 1, 2].forEach((index) => left.append(makeGroup(index, map)));
      [3, 4, 5].forEach((index) => right.append(makeGroup(index, map)));
      const center = document.createElement("div"); center.className = "u-center"; center.innerHTML = "<span>共同學習走道</span><small>比一般走道稍寬</small>";
      const back = document.createElement("div"); back.className = "u-back";
      for (let index = 6; index < state.communityGroups; index += 1) back.append(makeGroup(index, map));
      layout.append(left, center, right, back);
      area.append(layout);
    }
  }

  function render() {
    resizeSeats();
    const waiting = unseated();
    $("#names").value = state.names;
    $("#rows").value = state.rows;
    $("#cols").value = state.cols;
    $("#rows-tab").classList.toggle("active", state.layout === "rows");
    $("#community-tab").classList.toggle("active", state.layout === "community");
    $("#rows-controls").classList.toggle("hidden", state.layout !== "rows");
    $("#community-controls").classList.toggle("hidden", state.layout !== "community");
    document.querySelectorAll("[data-groups]").forEach((button) => button.classList.toggle("active", Number(button.dataset.groups) === state.communityGroups));
    $("#board-label").textContent = state.layout === "rows" ? "黑板・教室前方" : "黑板・教室前方（ㄇ字開口）";
    $("#message").textContent = state.message;
    $("#summary").textContent = `${state.students.length} 位學生・${seatCount()} 個座位（最多 32）・尚未安排 ${waiting.length} 位`;
    $("#unseated-count").textContent = waiting.length;
    const list = $("#student-list");
    list.replaceChildren();
    if (!waiting.length) {
      const done = document.createElement("div"); done.className = "all-set"; done.textContent = "✓ 全部安排完成"; list.append(done);
    } else waiting.forEach((student) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `student-chip${state.selected === student.id ? " selected" : ""}`;
      button.textContent = student.name;
      button.addEventListener("click", () => { state.selected = state.selected === student.id ? null : student.id; render(); });
      button.addEventListener("pointerdown", (event) => startDrag(event, student.id));
      button.addEventListener("pointerup", finishDrag);
      button.addEventListener("pointercancel", () => { state.dragged = null; });
      list.append(button);
    });
    renderSeats();
  }

  function arrange(random = false) {
    const ids = state.students.map((student) => student.id);
    if (random) for (let index = ids.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[other]] = [ids[other], ids[index]];
    }
    state.seats = Array.from({ length: seatCount() }, (_, index) => ids[index] ?? null);
    setMessage(random ? "已隨機安排，可再手動微調" : "已依名單順序安排");
    render();
  }

  $("#names").addEventListener("input", (event) => { state.names = event.target.value; });
  $("#import-button").addEventListener("click", () => {
    state.students = state.names.split(/\n|,|，/).map((name) => name.trim()).filter(Boolean).map((name, index) => ({ id: `s-${Date.now()}-${index}`, name }));
    state.seats = Array(seatCount()).fill(null); state.selected = null;
    setMessage(`已匯入 ${state.students.length} 位學生`); render();
  });
  $("#save-button").addEventListener("click", () => {
    localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 3, names: state.names, students: state.students, layout: state.layout, rows: state.rows, cols: state.cols, communityGroups: state.communityGroups, seats: state.seats }));
    setMessage("已儲存在這台裝置");
  });
  $("#random-button").addEventListener("click", () => arrange(true));
  $("#order-button").addEventListener("click", () => arrange(false));
  $("#clear-button").addEventListener("click", () => { state.seats = Array(seatCount()).fill(null); setMessage("已清空座位"); render(); });
  $("#rows-tab").addEventListener("click", () => { state.layout = "rows"; render(); });
  $("#community-tab").addEventListener("click", () => { state.layout = "community"; render(); });
  $("#rows").addEventListener("change", (event) => {
    const value = Math.max(1, Math.min(10, Number(event.target.value) || 1));
    if (value * state.cols > 32) return setMessage("座位最多 32 人，請先減少每行座位數"), render();
    state.rows = value; render();
  });
  $("#cols").addEventListener("change", (event) => {
    const value = Math.max(1, Math.min(12, Number(event.target.value) || 1));
    if (value * state.rows > 32) return setMessage("座位最多 32 人，請先減少行數"), render();
    state.cols = value; render();
  });
  document.querySelectorAll("[data-groups]").forEach((button) => button.addEventListener("click", () => {
    state.communityGroups = Number(button.dataset.groups); setMessage(`已設定 ${state.communityGroups} 組，共 ${state.communityGroups * 4} 個座位`); render();
  }));
  document.addEventListener("pointerup", finishDrag);

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) Object.assign(state, { names: saved.names ?? "", students: saved.students ?? [], layout: saved.layout ?? "rows", rows: saved.rows ?? 4, cols: saved.cols ?? 7, communityGroups: saved.communityGroups ?? 7, seats: saved.seats ?? [], message: "已載入這台裝置上次的座位表" });
  } catch (_) { /* 忽略損壞的舊資料，避免網站無法開啟 */ }
  render();
})();
