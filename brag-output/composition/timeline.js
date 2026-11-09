const $ = (selector, root = document) => root.querySelector(selector);
const edit = window.scamsunoEdit;
const stage = $("#scamsuno");
const scenes = [...stage.querySelectorAll("section.scene")];
const sections = [
  ["00 / THE QUESTION", "", "hook"],
  ["01 / THE SIMULATION", "", "product"],
  ["02 / THE VOICE TURN", "Speak in your own words.", "voice"],
  ["03 / THE INDEPENDENT CHECK", "Verify through a trusted channel.", "verification"],
  ["04 / THE DEBRIEF", "Feedback based on what you did.", "debrief"],
  ["05 / SCENARIO CATEGORIES", "", "categories"],
  ["06 / TRUST OR TRAP", "", "close"],
];
const proofSlots = new Map();
for (const [chapter, heading, name] of sections) {
  const slot = edit[name];
  if (!slot?.src) continue;
  const section = document.getElementById(name);
  const overlay = document.createElement("div");
  overlay.className = "evidence-take";
  const text = document.createElement("div");
  const eyebrow = document.createElement("div");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = chapter;
  const title = document.createElement("h2");
  title.textContent = heading;
  const meta = document.createElement("p");
  meta.textContent = slot.caption;
  const caption = document.createElement("div");
  caption.className = "evidence-caption";
  text.append(eyebrow, title, meta, caption);
  const video = document.createElement("video");
  video.id = name + "-take";
  video.className = "clip";
  video.src = slot.src;
  video.preload = "auto";
  video.playsInline = true;
  video.dataset.start = section.dataset.sceneStart;
  video.dataset.duration = section.dataset.sceneDuration;
  video.dataset.trackIndex = "3";
  video.dataset.hasAudio = "true";
  video.dataset.volume = "1";
  overlay.append(text, video);
  section.append(overlay);
  proofSlots.set(name, { caption, subtitles: slot.subtitles ?? [] });
}
$("#destination").textContent = edit.destination;

const bars = Array.from({ length: 22 }, () => document.createElement("b"));
$(".wave-bars").append(...bars);
const voiceSteps = [...stage.querySelectorAll(".voice-step")];
const categoryCards = [...stage.querySelectorAll(".category-card")];
const phases = [
  ["#mic", "Record a reply"],
  ["#paper", "Review the transcript"],
  ["#wave", "Listen to the caller"],
];
const chrome = $("#chrome");
const clamp = (value) => Math.min(Math.max(value, 0), 1);
const ease = (value) => 1 - (1 - clamp(value)) ** 3;
const rise = (element, amount) => {
  element.style.opacity = amount;
  element.style.transform = "translateY(" + ((1 - amount) * 34) + "px)";
};

function frame(time) {
  const t = Math.min(Math.max(time, 0), 59.999);
  const index = scenes.findIndex(scene =>
    t >= Number(scene.dataset.sceneStart) && t < Number(scene.dataset.sceneStart) + Number(scene.dataset.sceneDuration));
  const current = scenes[index];
  const local = t - Number(current.dataset.sceneStart);
  scenes.forEach((scene, i) => { scene.style.display = i === index ? "block" : "none"; });
  chrome.classList.toggle("light", current.classList.contains("paper") && !proofSlots.has(current.id));
  current.querySelectorAll(".rise").forEach((element, order) => rise(element, ease((local + .16 - order * .11) / .42)));
  if (index === 0) {
    $(".signal-icon").style.transform = "rotate(" + (-8 + 2.1 * Math.sin(t * 4)) + "deg)";
    $(".orbit-a").style.transform = "scale(" + (1 + Math.sin(t * 1.7) * .035) + ")";
    bars.forEach((bar, i) => {
      const envelope = Math.sin((i + 1) / (bars.length + 1) * Math.PI);
      bar.style.transform = "scaleY(" + (.16 + envelope * (.42 + .33 * Math.sin(i * .72 - t * 6))) + ")";
    });
  }
  if (index === 2) {
    const phase = local < 8 ? 0 : local < 17 ? 1 : 2;
    voiceSteps.forEach((step, i) => step.classList.toggle("active", i === phase));
    $("#voice-symbol").setAttribute("href", phases[phase][0]);
    $("#voice-detail").textContent = phases[phase][1];
    $(".voice-rings").style.transform = "scale(" + (1 + Math.sin(t * 1.5) * .045) + ")";
  }
  if (index === 3) {
    current.querySelectorAll(".proof-row, .proof-link").forEach((element, i) => rise(element, ease((local + .1 - i * 1.75) / .48)));
  }
  if (index === 4) {
    current.querySelectorAll(".rubric-row").forEach((element, i) => rise(element, ease((local + .1 - i * 1.35) / .42)));
  }
  if (index === 5) categoryCards.forEach((card, i) => rise(card, ease((local + .12 - i * .13) / .55)));
  const slot = proofSlots.get(current.id);
  if (slot) {
    slot.caption.textContent = slot.subtitles.find(cue => local >= cue.from && local < cue.to)?.text ?? "";
  }
}
window.renderScamSunoFrame = frame;
frame(0);
const playhead = { time: 0 };
window.__timelines = window.__timelines || {};
window.__timelines.scamsuno = gsap.timeline({ paused: true }).to(playhead, {
  time: 60, duration: 60, ease: "none", onUpdate: () => frame(playhead.time),
});

