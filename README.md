# Our Little Story

A small, responsive visual-novel-style monthsary game made with HTML, CSS, JavaScript, Bootstrap 5, and editable JSON. No PHP or build step is required. The sample art is an abstract illustration—not a photo of a real couple.

## Files

- `index.html` — opening screen, game shell, memory dialog, and audio player.
- `assets/css/style.css` — responsive layout, colors, and animations.
- `assets/js/game.js` — story loader, safe text rendering, typewriter, choices, gallery, meter, music, and replay.
- `data/story.json` — names, labels, chapters, dialogue, choices, memories, and ending text.
- `assets/images/memory-placeholder.svg` — abstract art used until you add your own pictures.

Bootstrap 5 and the display fonts load from CDNs, so an internet connection is needed for those external styles/fonts. The game itself has no JavaScript library dependency.

## Run locally

The game fetches `data/story.json`, so open it through a local web server rather than double-clicking `index.html`.

### Python (quickest)

1. Install Python if it is not already installed.
2. Open a terminal in the project folder.
3. Run `py -m http.server 8000`.
4. Visit `http://localhost:8000`.
5. Stop the server with Ctrl+C when finished.

### PHP / XAMPP (optional)

PHP is not used by this project; it is a static website. To use XAMPP, put the project folder inside `C:\xampp\htdocs\monthsary-game`, start Apache in the XAMPP Control Panel, and visit `http://localhost/monthsary-game/`. PHP is not needed and there is no editor page or server-side saving.

## Personalize the game

Edit `data/story.json` in a text editor. Keep the JSON syntax valid: property names and text use double quotes, commas separate entries, and the last item in an object or array must not have a trailing comma.

### Change names, date, music, and buttons

Edit the `settings` object near the top:

- `girlfriendName` and `boyfriendName` — your names. Replace the sample speaker names in scenes too if you want those names displayed.
- `monthsaryDate` — the date or message shown on the opening screen.
- `typingSpeed` — milliseconds between characters; smaller is faster (for example, `20`).
- `buttonLabels` — labels for start, next, continue, replay, and music controls.
- `musicFile` — relative path to your audio file, for example `assets/audio/our-song.mp3`. Create that folder and add a file you have permission to use. Leave it as an empty string to disable playback.
- `showMusicButton` — set `true` or `false`.

The music player never autoplays. The viewer starts, pauses, and mutes it with the on-screen controls. Check the browser console and file path if the audio cannot load.

You can use `{{girlfriendName}}` and `{{boyfriendName}}` in displayed story text, speaker names, headings, button labels, and memory messages; the game fills those in from the settings automatically.

### Change dialogue or add dialogue

Each chapter has a `scenes` array. A dialogue scene looks like:

```json
{
  "type": "dialogue",
  "speaker": "Your name",
  "title": "A little heading",
  "text": "Your message here.\n\nA new paragraph. **Bold text** and *italic text* are supported."
}
```

Copy a scene object, edit its values, and put a comma between neighboring scenes. Text is rendered as text rather than HTML, so pasted HTML will not execute. Newlines make line breaks; a blank line starts a new paragraph.

### Add or remove chapters

Each item in `chapters` has a unique-for-you `id`, a `title`, and one or more scenes. Add a chapter object to the `chapters` array, or remove one. Scenes run in order. The final `ending` scene displays the replay screen; include one ending scene at the end of the story.

Supported scene types:

- `dialogue` — typewriter dialogue and a Next button.
- `choices` — a question and two or more answer options, each with its own response. After the response, the game continues to the next scene.
- `gallery` — clickable memory cards. Each card opens a larger image, title, and personal message.
- `meter` — a playful meter. Its button fills the meter in steps.
- `surprise` — a reveal button shows its message and then a Continue button.
- `ending` — the final message and replay button.

See the included sample chapters for complete examples of each type.

### Replace the placeholder pictures

Put your image files in `assets/images/`, then edit each memory's `image` path, `alt` description, title, and message in `data/story.json`. Example:

```json
{
  "title": "Our picnic",
  "image": "assets/images/picnic.jpg",
  "alt": "The two of us at the picnic",
  "message": "I still think about how we laughed when..."
}
```

Use an accurate `alt` description for accessibility. Missing images fall back to the abstract placeholder illustration.

### Change the story and endings

Replace sample dialogue, questions, answer labels/responses, memory messages, surprise text, and ending text with your own. Choices always return to the next scene after their selected response; they do not branch to other chapters.

## Deploy online

Upload the entire project folder to a static hosting service that serves HTML, CSS, JavaScript, JSON, and image/audio files (for example, GitHub Pages or another static web host). Keep the folder structure and relative paths intact, then share the site's HTTPS link. Do not upload private or sensitive photos unless you are comfortable with the hosting provider's privacy terms. No PHP server is required.

## Troubleshooting

- **The story won't load:** run it from `http://localhost` or a hosted web server, not `file://`. Check that `data/story.json` is in the right location and contains valid JSON.
- **The page says the story data is invalid:** check quotes, commas, required scene fields, and that every chapter has at least one scene.
- **A picture is missing:** confirm the path is relative to the project root and spelling/capitalization matches the filename.
- **Music is silent:** set `musicFile` to an existing supported audio file. Browsers only play it after the viewer presses Play.
- **External fonts or Bootstrap are missing:** check the internet connection; the custom game layout remains available without the fonts, but Bootstrap styles come from its CDN.
- **To replay:** use Restart in the top-right to return to the opening screen, or the final screen's replay button to begin again.
