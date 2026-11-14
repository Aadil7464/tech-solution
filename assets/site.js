document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.innerHTML = `${open ? "Close" : "Menu"} <span aria-hidden="true">${open ? "×" : "☰"}</span>`;
    nav.classList.toggle("open", open);
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = 'Menu <span aria-hidden="true">☰</span>';
      nav.classList.remove("open");
    }
  });
});
