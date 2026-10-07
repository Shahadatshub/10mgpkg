# 10MGPKG

A scrolling photo gallery. An opening screen, then a sequence of titled sections you write yourself.

---

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:4321. Empty until you add photos — that's expected.

---

## How the page is built

**The opening screen** is your title with photographs drifting around it, slowly swapping for others. Edit the `hero` block in `src/data/photos.js`:

```js
export const hero = {
  title: "10MGPKG PHOTO GALLERY",
  welcome: "へようこそ",
  photos: [],   // empty = draw from everything
};
```

**Then sections**, top to bottom, in the order you write them. Each is a title with a row of photographs that advances on its own:

```js
export const sections = [
  {
    id: "night",
    title: "夜の街",
    subtitle: "Night streets",
    photos: ["DSC_4821.jpg", "DSC_4822.jpg", "DSC_4901.jpg"],
  },
];
```

Reorder the page by reordering this list. Delete a section and its photos fall to the bottom rather than disappearing.

**Anything you don't assign** to a section still appears, in an untitled section at the end. Nothing gets lost while you're organising.

---

## Adding photos

1. Copy files into `src/photos/`
2. Add filenames to whichever section you want them in
3. Optionally give them titles in the `photos` block at the bottom of the file

That's the whole workflow. Undescribed photos use their filename as a title.

---

## Behaviour worth knowing

Rows advance every few seconds, but **pause the moment your cursor is over them**, and don't move at all while off screen. Arrows appear on hover if you want to move manually.

Rows show three photographs on a desktop, two on a tablet, one on a phone.

Clicking any photograph opens it full size, uncropped. Arrow keys move through that section, Escape closes.

Everything holds still for visitors who've asked their system to reduce motion.

---

## Deploying to Cloudflare Pages

Free, no bandwidth limit, no sleeping.

1. Push this folder to a GitHub repository
2. Cloudflare Dashboard → Workers & Pages → Create → Pages
3. Connect the repo
4. Framework preset `Astro` (build command `npm run build`, output `dist`)
5. Deploy

**Then set `site` in `astro.config.mjs`** to your real URL, or link previews won't work.

---

## Customising the look

`src/styles/global.css` has every colour, font, size, and animation speed at the top:

```css
--bg: #0a0a0a;          /* page background   */
--accent: #e6d5a8;      /* the one accent    */
--serif: ...            /* titles            */
--mono: ...             /* small labels      */
```

Change one value and the whole site follows.

**To crop rows differently**, change `aspect-ratio: 4 / 5` on `.frame` in `src/styles/showcase.css`. Try `3 / 2` for landscape rows or `1 / 1` for squares. Full-size photos are never cropped.

**To change how often rows advance**, the `4600` in `src/components/Showcase.jsx` is the interval in milliseconds. The `5200` nearby is the opening screen.

---

## Structure

```
src/
├── photos/              your photographs
├── data/photos.js       hero, sections, titles  ← the file you edit
├── components/
│   ├── Showcase.jsx     opening screen, rows, lightbox
│   └── Footer.astro
├── layouts/Base.astro   page shell, meta tags, fonts
├── lib/gallery.js       build-time image processing
├── pages/
│   ├── index.astro      the scrolling page
│   └── i/[slug]         one shareable page per photograph
└── styles/
    ├── global.css       colours, type, spacing, timing
    └── showcase.css     opening screen, rows, lightbox
```

---

## Notes

If you list a filename in a section that isn't in `src/photos/`, the build prints a warning naming it and carries on rather than failing.

First build takes about a second per photo. After that Astro only reprocesses what changed.
