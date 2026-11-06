// ---------- News as Foundry notifications ----------
// News uses the same stack, place and look as every other notification. A new article announces
// itself once; the News button lists every article there, until dismissed.
const NEWS_ITEMS = [
  { img: "n1.webp", title: "2026 Year in Review", isNew: true },
  { img: "n2.webp", title: "2026 Anniversary Celebration Events" },
  { img: "n3.webp", title: "Version 14 Stable Release" },
  { img: "n4.png", title: "Try Out Scene Levels with The Restored Keep" },
  { img: "n5.webp", title: "Bastion of Blasphemies Available Now", featured: true },
];
function newsNote(n, withAll) {
  const li = document.createElement("li");
  li.className = "notification info active mls-newsnote";
  li.dataset.act = "newsclose"; li.dataset.tooltip = "Click to dismiss";
  const label = n.featured ? "Featured content" : n.isNew && !ST.newsSeen ? "New on foundryvtt.com" : "foundryvtt.com news";
  li.innerHTML = `<img src="fvtt/news/${n.img}" alt=""><div class="nb"><span class="k">${label}</span><strong>${esc(n.title)}</strong></div>
    <a data-act="foundry" data-what="Open “${esc(n.title)}” on foundryvtt.com">Read</a>${withAll ? '<a data-act="news">All news</a>' : ""}`;
  return li;
}
function newsBox() {
  let box = document.getElementById("notifications");
  if (!box) { box = document.createElement("ol"); box.id = "notifications"; box.className = "mls-toasts"; document.body.append(box); }
  return box;
}
function newsList() {
  const li = document.createElement("li");
  li.className = "notification info active mls-newsnote mls-newslist";
  li.dataset.act = "newsclose";
  const rows = NEWS_ITEMS.map((n) => `<li data-act="foundry" data-what="Open “${esc(n.title)}” on foundryvtt.com"><img src="fvtt/news/${n.img}" alt=""><span>${esc(n.title)}</span>${n.featured ? '<span class="k">Featured</span>' : n.isNew ? '<span class="k new">New</span>' : ""}</li>`).join("");
  li.innerHTML = `<div class="nb"><span class="k">foundryvtt.com news</span><ul>${rows}</ul></div>`;
  return li;
}
/** "new": one notification for the unread article. "all": one notification listing every article. "none": clear. */
function showNews(which) {
  const box = newsBox();
  box.querySelectorAll(".mls-newsnote").forEach((li) => li.remove());
  if (which === "all") box.prepend(newsList());
  if (which === "new" && !ST.newsSeen) NEWS_ITEMS.filter((n) => n.isNew).forEach((n) => box.prepend(newsNote(n, true)));
}
A.newsclose = (_id, el) => {
  el.closest("li.notification")?.remove();
  if (!document.querySelector(".mls-newsnote")) { ST.news = false; ST.newsSeen = true; render(); }
};
