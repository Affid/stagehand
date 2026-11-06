// Start after every part has loaded.
render();
setTimeout(() => showNews("new"), 600);
if (Q.get("demo") === "select") { ST.page = "library"; ST.select = true; ST.selected = new Set(["modular-av-audio-echo", "modular-av-audio-eq", "modular-av-audio-reverb"]); render(); }
