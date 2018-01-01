// ==UserScript==
// @name         Sections
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Detect and Jump through Sections (blog posts) of a webpage. Won't work on pages that reject inline-scripts (steam, github, etc) or on pages that load Prototype.js.
// @author       p
// @match        http://*/*
// @match        https://*/*
// @exclude      *//localhost:*/*.ipynb*
// @exclude      *//localhost:*/tree*
// @exclude      *//pr0gramm.com/*
// @exclude      *//www.youtube.com/*
// @exclude      *//192.168.*.*
// @exclude      *//mail.google.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

%globals
%lib
%filters
%sectionjumper

%sections
