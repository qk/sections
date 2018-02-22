// ==UserScript==
// @name         Sections
// @namespace    http://github.com/qk/sections
// @run-at       document-end
// @version      0.3
// @description  Detect and jump through sections (f.i. blog posts) of a webpage. Won't work on pages that reject inline-scripts (steam, chrome store, etc) or on pages that idiotically load Prototype.js.
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

(function(window, document) {
	%globals

	%lib
	%filters
	%sectionjumper

	%sections
})(window, document);
