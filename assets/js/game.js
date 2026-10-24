(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const elements = {
    loading: byId("loading-screen"),
    error: byId("error-screen"),
    errorMessage: byId("error-message"),
    opening: byId("opening-screen"),
    game: byId("game-screen"),
    title: byId("opening-title"),
    subtitle: byId("opening-subtitle"),
    date: byId("monthsary-date"),
    start: byId("start-button"),
    retry: byId("retry-button"),
    restart: byId("restart-button"),
    chapter: byId("chapter-label"),
    progressLabel: byId("progress-label"),
    progress: document.querySelector(".story-progress"),
    progressBar: byId("progress-bar"),
    scene: byId("scene-card"),
    content: byId("scene-content"),
    musicButton: byId("music-button"),
    muteButton: byId("mute-button"),
    musicNote: byId("music-note"),
    audio: byId("background-audio"),
    memoryDialog: byId("memory-dialog"),
    memoryImage: byId("memory-image"),
    memoryTitle: byId("memory-title"),
    memoryMessage: byId("memory-message"),
    closeMemory: byId("close-memory")
  };

  let story;
  let chapterIndex = 0;
  let sceneIndex = 0;
  let typingTimer = null;
  let transitionTimer = null;
  let isTyping = false;
  let displayedText = "";
  let activeTypewriter = null;
  let choiceMade = false;
  let isTransitioning = false;
  let love = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const showOnly = (screen) => {
    elements.loading.hidden = screen !== "loading";
    elements.error.hidden = screen !== "error";
    elements.opening.hidden = screen !== "opening";
    elements.game.hidden = screen !== "game";
  };

  const required = (value, description) => {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Story data is missing ${description}.`);
    return value;
  };

  function personalize(value) {
    return String(value ?? "").replace(/\{\{(girlfriendName|boyfriendName)\}\}/g, (_, name) => {
      return String(story.settings[name] || name);
    });
  }

  function validateStory(data) {
    if (!data || typeof data !== "object" || !data.settings || !Array.isArray(data.chapters) || data.chapters.length === 0) {
      throw new Error("The story file must contain settings and at least one chapter.");
    }
    required(data.settings.websiteTitle, "settings.websiteTitle");
    required(data.settings.openingSubtitle, "settings.openingSubtitle");
    if (!Number.isFinite(data.settings.typingSpeed) || data.settings.typingSpeed < 1) {
      throw new Error("settings.typingSpeed must be a positive number.");
    }
    data.chapters.forEach((chapter, chapterNumber) => {
      required(chapter.title, `the title for chapter ${chapterNumber + 1}`);
      if (!Array.isArray(chapter.scenes) || chapter.scenes.length === 0) {
        throw new Error(`Chapter ${chapterNumber + 1} needs at least one scene.`);
      }
      chapter.scenes.forEach((scene, sceneNumber) => {
        const location = `chapter ${chapterNumber + 1}, scene ${sceneNumber + 1}`;
        if (!scene || typeof scene !== "object") throw new Error(`Invalid ${location}.`);
        if (scene.type === "dialogue") {
          required(scene.text, `${location} text`);
        } else if (scene.type === "choices") {
          required(scene.question, `${location} question`);
          if (!Array.isArray(scene.options) || scene.options.length < 2) throw new Error(`${location} needs at least two options.`);
          scene.options.forEach((option) => {
            required(option.label, `${location} choice label`);
            required(option.response, `${location} choice response`);
          });
        } else if (scene.type === "gallery") {
          if (!Array.isArray(scene.memories)) throw new Error(`${location} needs a memories list.`);
          scene.memories.forEach((memory) => {
            required(memory.title, `${location} memory title`);
            required(memory.image, `${location} memory image`);
            required(memory.message, `${location} memory message`);
          });
        } else if (scene.type === "meter") {
          required(scene.title, `${location} title`);
        } else if (scene.type === "surprise") {
          required(scene.title, `${location} title`);
          required(scene.buttonLabel, `${location} button label`);
          required(scene.message, `${location} surprise message`);
        } else if (scene.type === "ending") {
          required(scene.title, `${location} title`);
          required(scene.message, `${location} ending message`);
        } else {
          throw new Error(`Unknown scene type "${scene.type}" in ${location}.`);
        }
      });
    });
  }

  async function loadStory() {
    showOnly("loading");
    try {
      const response = await fetch("data/story.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load data/story.json (HTTP ${response.status}).`);
      const data = await response.json();
      validateStory(data);
      story = data;
      initialize();
      showOnly("opening");
    } catch (error) {
      elements.errorMessage.textContent = `${error.message} Run this project using the instructions in README.md.`;
      showOnly("error");
    }
  }

  function initialize() {
    document.title = personalize(story.settings.websiteTitle);
    elements.title.textContent = personalize(story.settings.websiteTitle);
    elements.subtitle.textContent = personalize(story.settings.openingSubtitle);
    elements.date.textContent = personalize(story.settings.monthsaryDate || "");
    elements.start.textContent = `${personalize(story.settings.buttonLabels?.start || "Start Our Story")} →`;
    setupMusic();
  }

  function setupMusic() {
    const settings = story.settings;
    elements.musicButton.hidden = settings.showMusicButton !== true;
    elements.muteButton.hidden = settings.showMusicButton !== true;
    elements.musicNote.hidden = settings.showMusicButton !== true;
    elements.audio.pause();
    elements.audio.muted = false;
    elements.audio.removeAttribute("src");
    if (!settings.musicFile) {
      elements.musicButton.disabled = true;
      elements.muteButton.disabled = true;
      elements.musicButton.textContent = "♫ Music";
      elements.muteButton.textContent = "Mute";
      elements.musicNote.textContent = "Add a music file in story.json";
      elements.musicButton.setAttribute("aria-label", "Music is unavailable until a file is configured");
      return;
    }
    elements.audio.src = settings.musicFile;
    elements.musicButton.disabled = false;
    elements.muteButton.disabled = false;
    elements.musicButton.textContent = personalize(settings.buttonLabels?.musicPlay || "♫ Play music");
    elements.musicButton.setAttribute("aria-label", "Play background music");
    elements.muteButton.setAttribute("aria-label", "Mute background music");
    elements.musicNote.textContent = "";
  }

  function getStoryMetrics() {
    const total = story.chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0);
    const completed = story.chapters.slice(0, chapterIndex).reduce((sum, chapter) => sum + chapter.scenes.length, 0) + sceneIndex;
    return { total, completed };
  }

  function updateProgress() {
    const { total, completed } = getStoryMetrics();
    const percentage = Math.min(100, Math.round((completed / total) * 100));
    elements.chapter.textContent = personalize(story.chapters[chapterIndex]?.title || "The End");
    elements.progressLabel.textContent = "A little more of our story";
    elements.progressBar.style.width = `${percentage}%`;
    elements.progress.setAttribute("aria-valuenow", String(percentage));
  }

  function makeButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = personalize(label);
    button.addEventListener("click", onClick);
    return button;
  }

  function makeHeading(scene, kicker) {
    const wrapper = document.createElement("div");
    if (kicker) {
      const label = document.createElement("p");
      label.className = "scene-kicker";
      label.textContent = personalize(kicker);
      wrapper.append(label);
    }
    const heading = document.createElement("h1");
    heading.className = "scene-heading";
    heading.textContent = personalize(scene.title || "");
    wrapper.append(heading);
    elements.content.append(wrapper);
  }

  function appendFormattedText(container, text) {
    const paragraphs = text.split(/\n{2,}/);
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const p = document.createElement("p");
      const lines = paragraph.split("\n");
      lines.forEach((line, lineIndex) => {
        const tokens = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        tokens.forEach((token) => {
          if (token.startsWith("**") && token.endsWith("**")) {
            const strong = document.createElement("strong");
            strong.textContent = token.slice(2, -2);
            p.append(strong);
          } else if (token.startsWith("*") && token.endsWith("*")) {
            const emphasis = document.createElement("em");
            emphasis.textContent = token.slice(1, -1);
            p.append(emphasis);
          } else {
            p.append(document.createTextNode(token));
          }
        });
        if (lineIndex < lines.length - 1) p.append(document.createElement("br"));
      });
      container.append(p);
      if (paragraphIndex < paragraphs.length - 1) container.append(document.createElement("br"));
    });
  }

  function typeDialogue(speaker, text, onComplete, onTyped = () => {}, showNext = true) {
    const box = document.createElement("div");
    box.className = "dialogue-box";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Dialogue. Click or press Enter to reveal all text.");
    box.tabIndex = 0;
    const speakerLabel = document.createElement("span");
    speakerLabel.className = "speaker-name";
    speakerLabel.textContent = personalize(speaker || "{{boyfriendName}}");
    const dialogue = document.createElement("div");
    dialogue.className = "dialogue-text";
    dialogue.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "dialogue-actions";
    const next = makeButton(story.settings.buttonLabels?.next || "Next →", "btn btn-love next-button", () => {
      if (isTyping) finishTyping();
      else if (!isTransitioning) onComplete();
    });
    next.hidden = true;
    actions.append(next);
    box.append(speakerLabel, dialogue, actions);
    elements.content.append(box);
    const message = personalize(text);
    activeTypewriter = { dialogue, text: message, next, onTyped, showNext };
    displayedText = "";
    isTyping = true;
    next.hidden = true;

    box.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      if (isTyping) finishTyping();
    });
    box.addEventListener("keydown", (event) => {
      if (event.target.closest("button") || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      if (isTyping) finishTyping();
      else if (showNext && !isTransitioning) onComplete();
    });
    const speed = reducedMotion ? 0 : story.settings.typingSpeed;
    let index = 0;
    const typeNext = () => {
      if (index >= message.length) {
        completeTyping();
        return;
      }
      index += 1;
      displayedText = message.slice(0, index);
      dialogue.replaceChildren();
      appendFormattedText(dialogue, displayedText);
      typingTimer = window.setTimeout(typeNext, speed);
    };
    if (speed === 0) {
      displayedText = message;
      appendFormattedText(dialogue, message);
      completeTyping();
    } else {
      typeNext();
    }
  }

  function completeTyping() {
    if (typingTimer !== null) window.clearTimeout(typingTimer);
    typingTimer = null;
    isTyping = false;
    if (activeTypewriter) {
      if (displayedText !== activeTypewriter.text) {
        activeTypewriter.dialogue.replaceChildren();
        appendFormattedText(activeTypewriter.dialogue, activeTypewriter.text);
      }
      activeTypewriter.next.hidden = !activeTypewriter.showNext;
      if (activeTypewriter.showNext) activeTypewriter.next.focus({ preventScroll: true });
      activeTypewriter.onTyped();
    }
  }

  function finishTyping() {
    if (!isTyping) return;
    if (typingTimer !== null) window.clearTimeout(typingTimer);
    displayedText = activeTypewriter.text;
    completeTyping();
  }

  function transition(render) {
    if (transitionTimer !== null) window.clearTimeout(transitionTimer);
    isTransitioning = true;
    elements.scene.classList.add("is-changing");
    transitionTimer = window.setTimeout(() => {
      elements.content.replaceChildren();
      elements.content.className = "scene-content";
      render();
      elements.scene.classList.remove("is-changing");
      isTransitioning = false;
      transitionTimer = null;
    }, reducedMotion ? 0 : 140);
  }

  function showScene() {
    if (chapterIndex >= story.chapters.length) {
      showOnly("opening");
      return;
    }
    const chapter = story.chapters[chapterIndex];
    const scene = chapter.scenes[sceneIndex];
    updateProgress();
    choiceMade = false;
    activeTypewriter = null;
    isTyping = false;
    transition(() => {
      if (scene.type === "dialogue") renderDialogue(scene);
      if (scene.type === "choices") renderChoices(scene);
      if (scene.type === "gallery") renderGallery(scene);
      if (scene.type === "meter") renderMeter(scene);
      if (scene.type === "surprise") renderSurprise(scene);
      if (scene.type === "ending") renderEnding(scene);
    });
  }

  function advance() {
    if (isTransitioning) return;
    if (isTyping) {
      finishTyping();
      return;
    }
    sceneIndex += 1;
    if (sceneIndex >= story.chapters[chapterIndex].scenes.length) {
      chapterIndex += 1;
      sceneIndex = 0;
    }
    if (chapterIndex >= story.chapters.length) {
      showOnly("opening");
      return;
    }
    showScene();
  }

  function renderDialogue(scene) {
    makeHeading(scene, story.chapters[chapterIndex].title);
    typeDialogue(scene.speaker, scene.text, advance);
  }

  function renderChoices(scene) {
    makeHeading({ title: scene.title || "A very important question..." }, story.chapters[chapterIndex].title);
    const choiceList = document.createElement("div");
    choiceList.className = "choice-list";
    scene.options.forEach((option) => {
      const button = makeButton(option.label, "choice-button", () => {
        if (isTyping || choiceMade) return;
        choiceMade = true;
        choiceList.replaceChildren();
        elements.content.querySelector(".dialogue-box")?.remove();
        typeDialogue(option.speaker || scene.responseSpeaker || story.settings.boyfriendName || "Me", option.response, advance);
      });
      button.disabled = true;
      choiceList.append(button);
    });
    typeDialogue(scene.speaker, scene.question, () => {}, () => {
      choiceList.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }, false);
    elements.content.append(choiceList);
  }

  function renderGallery(scene) {
    makeHeading(scene, story.chapters[chapterIndex].title);
    const intro = document.createElement("p");
    intro.className = "memory-intro";
    intro.textContent = personalize(scene.intro || "Tap a little memory to open it.");
    const grid = document.createElement("div");
    grid.className = "memory-grid";
    scene.memories.forEach((memory) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "memory-card";
      button.setAttribute("aria-label", `Open memory: ${personalize(memory.title)}`);
      const image = document.createElement("img");
      image.src = memory.image;
      image.alt = personalize(memory.alt || `Illustration placeholder for ${memory.title}`);
      image.addEventListener("error", () => { image.src = "assets/images/memory-placeholder.svg"; }, { once: true });
      const caption = document.createElement("span");
      caption.textContent = personalize(memory.title);
      button.append(image, caption);
      button.addEventListener("click", () => openMemory(memory));
      grid.append(button);
    });
    elements.content.append(intro, grid, makeContinueButton());
  }

  function openMemory(memory) {
    elements.memoryTitle.textContent = personalize(memory.title);
    elements.memoryMessage.textContent = personalize(memory.message);
    elements.memoryImage.alt = personalize(memory.alt || `Illustration placeholder for ${memory.title}`);
    elements.memoryImage.src = memory.image;
    elements.memoryImage.onerror = () => {
      elements.memoryImage.onerror = null;
      elements.memoryImage.src = "assets/images/memory-placeholder.svg";
    };
    elements.memoryDialog.showModal();
  }

  function renderMeter(scene) {
    makeHeading(scene, story.chapters[chapterIndex].title);
    const description = document.createElement("p");
    description.className = "memory-intro";
    description.textContent = personalize(scene.description || "A highly scientific test conducted by two very biased researchers.");
    const wrap = document.createElement("div");
    wrap.className = "meter-wrap";
    const emoji = document.createElement("div");
    emoji.className = "meter-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = "💗";
    const bar = document.createElement("div");
    bar.className = "progress love-meter";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Playful love meter");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(love));
    const fill = document.createElement("div");
    fill.className = "progress-bar";
    fill.style.width = `${love}%`;
    bar.append(fill);
    const label = document.createElement("p");
    label.className = "meter-label";
    label.textContent = `${love}% certified cuteness`;
    const button = makeButton(scene.buttonLabel || "Send one more smooch 💋", "btn btn-love", () => {
      love = Math.min(100, love + 20);
      fill.style.width = `${love}%`;
      bar.setAttribute("aria-valuenow", String(love));
      label.textContent = love === 100 ? "100% — meter overflow. Very suspiciously adorable." : `${love}% certified cuteness`;
      button.disabled = love === 100;
    });
    wrap.append(emoji, bar, label, button);
    elements.content.append(description, wrap, makeContinueButton());
  }

  function renderSurprise(scene) {
    makeHeading(scene, story.chapters[chapterIndex].title);
    const box = document.createElement("div");
    box.className = "surprise-box";
    const icon = document.createElement("div");
    icon.className = "surprise-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "🎁";
    const message = document.createElement("p");
    message.className = "surprise-message";
    const reveal = makeButton(scene.buttonLabel, "btn btn-love", () => {
      icon.textContent = "💌";
      message.textContent = personalize(scene.message);
      reveal.hidden = true;
      box.append(makeContinueButton());
    });
    box.append(icon, reveal, message);
    elements.content.append(box);
  }

  function renderEnding(scene) {
    elements.progressBar.style.width = "100%";
    elements.progress.setAttribute("aria-valuenow", "100");
    elements.chapter.textContent = personalize(story.settings.endingTitle || "The End (but not really)");
    elements.content.className = "scene-content ending-content";
    const heart = document.createElement("div");
    heart.className = "ending-heart";
    heart.setAttribute("aria-hidden", "true");
    heart.textContent = "♥";
    const kicker = document.createElement("p");
    kicker.className = "scene-kicker";
    kicker.textContent = personalize(story.settings.endingKicker || "You unlocked: my whole heart");
    const title = document.createElement("h1");
    title.className = "scene-heading";
    title.textContent = personalize(scene.title);
    const message = document.createElement("p");
    message.className = "ending-message";
    message.textContent = personalize(scene.message);
    const replay = makeButton(story.settings.buttonLabels?.replay || "Play our story again ↺", "btn btn-love", restartGame);
    elements.content.append(heart, kicker, title, message, replay);
  }

  function makeContinueButton() {
    return makeButton(story.settings.buttonLabels?.continue || "Continue →", "btn btn-love continue-button", advance);
  }

  function startGame() {
    cancelPendingWork();
    chapterIndex = 0;
    sceneIndex = 0;
    love = 0;
    showOnly("game");
    showScene();
  }

  function restartGame() {
    cancelPendingWork();
    if (elements.memoryDialog.open) elements.memoryDialog.close();
    chapterIndex = 0;
    sceneIndex = 0;
    love = 0;
    showOnly("opening");
    elements.progressBar.style.width = "0%";
    elements.progress.setAttribute("aria-valuenow", "0");
  }

  function cancelPendingWork() {
    if (typingTimer !== null) window.clearTimeout(typingTimer);
    if (transitionTimer !== null) window.clearTimeout(transitionTimer);
    typingTimer = null;
    transitionTimer = null;
    isTyping = false;
    activeTypewriter = null;
    isTransitioning = false;
    elements.scene.classList.remove("is-changing");
  }

  elements.start.addEventListener("click", startGame);
  elements.retry.addEventListener("click", loadStory);
  elements.restart.addEventListener("click", restartGame);
  elements.closeMemory.addEventListener("click", () => elements.memoryDialog.close());
  elements.memoryDialog.addEventListener("click", (event) => {
    if (event.target === elements.memoryDialog) elements.memoryDialog.close();
  });
  elements.musicButton.addEventListener("click", async () => {
    if (!story?.settings.musicFile) return;
    if (elements.audio.paused) {
      try {
        await elements.audio.play();
        elements.musicButton.textContent = personalize(story.settings.buttonLabels?.musicPause || "♫ Pause music");
        elements.musicButton.setAttribute("aria-label", "Pause background music");
      } catch (error) {
        elements.musicNote.textContent = "Could not play audio. Check the file path and format.";
      }
    } else {
      elements.audio.pause();
      elements.musicButton.textContent = personalize(story.settings.buttonLabels?.musicPlay || "♫ Play music");
      elements.musicButton.setAttribute("aria-label", "Play background music");
    }
  });
  elements.muteButton.addEventListener("click", () => {
    if (!story?.settings.musicFile) return;
    elements.audio.muted = !elements.audio.muted;
    elements.muteButton.textContent = elements.audio.muted ? "Unmute" : "Mute";
    elements.muteButton.setAttribute("aria-label", elements.audio.muted ? "Unmute background music" : "Mute background music");
  });
  elements.audio.addEventListener("error", () => {
    elements.musicNote.textContent = "Could not load the configured music file.";
  });

  loadStory();
})();
