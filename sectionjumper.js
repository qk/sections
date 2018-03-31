class SectionJumper {
	constructor(sections, globals, verbose) {
		this.verbose = Boolean(verbose);
		this.globals = globals;
		// general
		this.sections = sections;
		this.interval = null; // scrolling interval
		this.scrollingto = -1; // index of section currently scrolling to
		this.clientY = -1; // mouse position relative to view
		this.running = false;
		this.updateTimer = new Timer("section update");
		this.fixedHeaderHeightPX = 0;
		// scroller
		this.toX = 0; // px
		this.toY = 0; // px
		this.lastScroll = 0; // ms
		this.lastY = 0; // px
		this.startY = 0; // px
		this.distance = 0; // px
		this.startTime = 0; // ms
		this.noopCount = 0;
		this.restart = true;
		this.boundScroll = this.scroll.bind(this);
	}

	// updates section size measurements
	update(force) {
		this.updateTimer.reset();
		// update section positions if document parts were resized after the sections were detected
		// always update all sections, it's fast and there are no onElementResize handlers available
		let H = this.globals.H;
		this.globals.updateDocumentDims();
		if (force || H != this.globals.H) {
			this.sections = sortupdate(this.sections);
		}
		this.updateTimer.stop();
	}

	// figure out current section and  which section to jump to
	jump(di, clientY) {
		// since no 'current section index' is kept, this function has to figure 
		// it out for itself. this is complicated, but allows for much greater 
		// behavioural flexibility. furthermore, an index can become 
		// invalid/outdated very easily, and not keeping one gets rid of having 
		// to deal with that.
		if (this.verbose) console.log(this.scrollingto, "scrollingto");
		let i = 0; // current section index
		let tol = 5; // tolerance [px]
		if (this.scrollingto != -1) { // currently scrolling to some section
			if (this.scrollingto >= 0 && this.scrollingto < this.sections.length) {
				highlight([this.sections[this.scrollingto]], this.globals.color.sections);
			}
			i = this.scrollingto + di;
			if (i < -1) {
				i = -1;
			} else if (i >= this.sections.length) {
				i = this.sections.length;
			}
			this.startScroll(i, clientY);
		} else {
			this.update(true); // check if section dimensions measured at the start are still accurate
			// figure out current section index
			let oldHeaderHeight = this.fixedHeaderHeightPX;
			this.fixedHeaderHeightPX = fixedHeaderHeight();
			let headerAppeared = 1.0*(oldHeaderHeight < this.fixedHeaderHeightPX); // when a fixed header has appeared during the last scroll
			let headerDisappeared = 1.0*(oldHeaderHeight > this.fixedHeaderHeightPX); // when a fixed header has disappeared during the last scroll
			let viewTop = window.scrollY + this.fixedHeaderHeightPX;
			let viewTopIfSmall = 0; // small sections will be aligned to this y-coordinate
			let viewHeight = window.innerHeight - this.fixedHeaderHeightPX;
			let viewBottom = viewTop + viewHeight;
			let section = this.sections[0];
			let h = section.hPX; // section height in pixel
			let top = section.y;
			let bottom = section.y + h;
			let scrollsteps = [];
			if (top - tol > viewTop && bottom > viewBottom && di == 1) {
				i = -1;
				if (this.verbose) console.log(i, "scroll down to first element");
			} else {
				let l = this.sections.length;
				let headerHeight = headerAppeared*this.fixedHeaderHeightPX - headerDisappeared*oldHeaderHeight;
				if (clientY == -1) { // used keyboard
					// find index of current section
					// find the first section that starts past the screen top edge
					for (i = 0; i < l; i++) {
						section = this.sections[i];
						h = section.hPX;
						top = section.y + headerHeight;
						bottom = section.y + h;
						scrollsteps.push({step:"top edge", i:i, l:l, top:top, viewTop:viewTop});
						if (top >= viewTop - tol) {
							break;
						}
					}
					// continue the search, but with a lowered screen top edge (= top edge of sections that are centered on screen)
					for (; i < l; i++) {
						section = this.sections[i];
						h = section.hPX;
						top = section.y + headerHeight;
						bottom = section.y + h;
						viewTopIfSmall = viewTop + (viewHeight - h)*0.382;
						scrollsteps.push({step:"centered", i:i, l:l, top:top, viewTIS:viewTopIfSmall});
						if (top >= viewTopIfSmall - tol) {
							break;
						}
					}
					scrollsteps.push({step:"final", i:i, l:l, top:top, viewTIS:viewTopIfSmall});
					if (this.verbose) console.table(scrollsteps);
					if (h < viewHeight && top >= viewTopIfSmall + 200)  {
						// if the first section is a small section and it's misaligned by 
						// quite a bit, align it properly first
						i--;
					} else if (top >= viewTop + tol && bottom > viewBottom) {
						// if a section extends past the screen bottom and is not 
						// top-aligned, assume the previous one was active.
						// only active sections larger then the viewHeight are allowed to 
						// extend past the screen bottom.
						i--;
					}
				} else if (clientY >= 0) { // used mouse to scroll
					let pageY = clientY + window.scrollY;
					// find current section
					for (i = 0; i < l; i++) {
						section = this.sections[i];
						if (section.y > pageY) {
							break;
						}
					}
					i--;
					if (i >= 0 && i < this.sections.length) {
						section = this.sections[i];
						top = section.y + headerHeight;
						bottom = section.y + section.hPX;
						if (top >= viewTop + tol && bottom > viewBottom + tol) {
							// if a section extends past the screen bottom and is not 
							// top-aligned, assume the previous one was active.
							// only active sections larger then the viewHeight are allowed to 
							// extend past the screen bottom.
							i--;
						}
					}
				}
			}
			// console.log(scrollsteps, "=>", i);
			if (this.globals.wrapAroundTop && di == -1 && viewTop === 0) {
				highlight(this.sections, this.globals.color.sections);
				this.startScroll(this.sections.length - 1, clientY);
				return;
			} else if (this.globals.wrapAroundBottom && di == 1 && viewBottom - this.H >= 0) {
				highlight(this.sections, this.globals.color.sections);
				this.startScroll(0, clientY);
				return;
			}
			highlight(this.sections, this.globals.color.sections);
			if (this.verbose) console.log("i + di = ", i + di, ", where di", di, "i", i);
			i = i + di;
			if (i >= -1 && i <= this.sections.length) {
				if (i+1 < this.sections.length && this.sections[i+1].y + tol < viewTop) {
					// current section's top edge is just slightly above the visible 
					// area , so just align it instead ot scrolling all the way to the 
					// page top. this happens when a loaded hyperlink included an 
					// anchor reference, or when a fixed header appears during scrolling.
					if (this.verbose) console.log("current section's top is just slightly above the visible area", this.sections[i+1].y, viewTop);
					this.startScroll(i+1, clientY);
				} else {
					this.startScroll(i, clientY);
				}
			} else if (i <= -1) {
				this.startScroll(-1, clientY);
			} else {
				if (this.verbose) console.log("couldn't find current section, i", i, "sections y", this.sections.map(s => s.y), "Y", viewTop);
				i = 0;
			}
		} // scrolling-to was -1
	}

	// initiate scrolling animation
	startScroll(i, clientY) {
		this.scrollingto = i;
		let h, toY;
		let viewHeight = window.innerHeight - this.fixedHeaderHeightPX;
		if (i == -1) {
			if (this.verbose) console.log("scrolling to top");
			toY = 0;
		} else if (i == this.sections.length) {
			if (this.verbose) console.log("scrolling to bottom");
			toY = this.globals.H - window.innerHeight;
		} else {
			let section = this.sections[i];
			let y = section.y;
			highlight([section], this.globals.color.active);
			h = section.hPX;
			if (h < viewHeight) {
				if (clientY >= 0) {
					toY = contain(
						y + h - viewHeight - this.fixedHeaderHeightPX, // align to bottom
						y + h/2 - clientY, // center on mouse
						y - this.fixedHeaderHeightPX // align to top
					);
				} else {
					// approx. center section vertically, if it fits
					toY = y - (viewHeight - h)*0.382 - this.fixedHeaderHeightPX;
				}
			} else {
				toY = y - this.fixedHeaderHeightPX;
			}
		}
		let Y = window.scrollY;
		let pageBottom = this.globals.H - viewHeight;
		this.toX = window.scrollX;
		this.toY = contain(0, toY, pageBottom);
		this.startY = Y;
		this.distance = this.toY - this.startY;
		this.restart = true;
		this.noopCount = 0;
		if (!this.running) {
			this.lastY = Y;
			this.running = true;
			requestAnimationFrame(this.boundScroll);
		}
	}

	// perform one scrolling step
	scroll(now) {
		if (this.restart) {
			// setting startTime and lastScroll in startScroll() results in negative 
			// dt values in the first step for some reason. it's like 
			// requestAnimationFrame() executes before startScroll has finished.
			this.startTime = now - 16; // 16ms is equiv. to 60 fps
			this.lastScroll = this.startTime;
			this.restart = false;
		}
		let elapsedTime = now - this.startTime;
		// console.log("scrolling", now, this.lastScroll, dt, this.startY, this.lastY, this.toY, elapsedTime);
		let Y = window.scrollY;
		this.lastScroll = now;
		let progress = elapsedTime/this.globals.scrollDuration;
		this.lastY = this.toY - parseInt(this.distance*Math.pow(0.5,10*progress));
		if (this.verbose) console.log("scrolling ", this.lastY, Y - this.toY);
		window.scroll(this.toX, this.lastY);
		if (Math.abs(Y - this.toY) < 1 || elapsedTime > this.globals.scrollDuration) {
			this.scrollingto = -1;
			this.running = false;
			return; // don't request another animation-frame
		}
		requestAnimationFrame(this.boundScroll);
	}
}
