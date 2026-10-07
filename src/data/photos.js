/* ===========================================================================
   This is the only file you need to edit.

   1. Put your photos in  src/photos/
   2. Describe them below
   3. git push

   =========================================================================== */

export const site = {
  title: "10MGPKG",
  author: "Shahadat Hossain",
    links: {
        instagram: "https://www.instagram.com/10mgpkg/",
        shop: "https://amg06.stores.jp/?category_id=66c37d0accd49a06aa094c77",
        email: "",
    },
};
export const exhibition = {
    poster: "/exhibition-photo.jpg",
    alt: "10MGPKG photo exhibition",
    title: "10MGPKG",
    kind: "PHOTO EXHIBITION",
    dates: "10.16 FRI — 10.18 SUN | 2026",
    venue: "at Gallery F16",
    place: "アメ村",
    link: "",
};
/* ---------------------------------------------------------------------------
   THE OPENING SCREEN

   `title` and `welcome` sit in the middle of the first screen. Photographs
   drift around them, slowly swapping for others.

   Leave `photos` empty to draw from everything you have. Or list filenames
   to choose exactly which ones appear on the opening screen.
   --------------------------------------------------------------------------- */

export const hero = {
  title: "10MGPKG PHOTO GALLERY",
  welcome: "へようこそ",
  photos: [],
};

/* ---------------------------------------------------------------------------
   SECTIONS

   The page is a sequence of these, top to bottom, in the order written here.
   Each one is a title with a row of photographs underneath that advances on
   its own.

     title      the heading — Japanese, English, whatever you like
     subtitle   a smaller line under it (optional)
     photos     filenames, in the order you want them shown

   Any photograph you don't put in a section still appears, in a final
   untitled section at the bottom. Nothing gets lost.

   To reorder the page, reorder this list. To rename a section, change its
   title. To retire one, delete it — its photos fall to the bottom section
   rather than disappearing.
   --------------------------------------------------------------------------- */

export const sections = [
    {
        id: "newyork",
        title: "New York Shots",
        subtitle: "",
        photos: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"],
    },
    {
        id: "rootspicnic",
        title: "Roots Picnic, Philadelphia",
        subtitle: "",
        photos: ["8.jpg", "9.jpg", "10.jpg"],
    },
    {
        id: "f16",
        title: "Gallery Studio F16",
        subtitle: "10 / 16, 17, 18",
        photos: ["11.jpg", "12.jpg", "13.jpg", "14.jpg", "15.jpg", "16.jpg"],
    },
    {
        id: "other",
        title: "Other Random Shoots",
        subtitle: "",
        photos: ["17.jpg", "18.jpg", "19.jpg", "20.jpg"],
    },
];

/* ---------------------------------------------------------------------------
   PHOTOGRAPHS

   Optional. Titles and captions for individual files.
   A photo with no entry here uses its filename as its title.
   --------------------------------------------------------------------------- */

export const photos = {
  // "DSC_4821.jpg": {
  //   title: "Rain on the window",
  //   caption: "Shot from the train, somewhere past Osaka.",
  // },
};
