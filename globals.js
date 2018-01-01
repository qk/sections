let globals = {
	// OPTIONS
	// press UP on the first sections to go to the last
	wrapAroundTop: false,
	// press DOWN on the last section to go to the first
	wrapAroundBottom: false,
	// use scroll wheel to jump
	useScrollWheel: true,
	// use digits to jump to corresponding section index
	useDigits: true,
	// scrolling duration in ms
	scrollDuration: 500,
	// frames per seconds for the scrolling animation
	scrollMaxFPS: 150,
	// section colors
	color: {sections:"dodgerblue", lastActive:"orange", active:"red"},
	// GLOBAL VARIABLES
	H: 0, // document height
	W: 0, // document width
	updateDocumentDims: function() {
		let body = document.body;
		let html = document.documentElement;
		let H = Math.max(
			body.scrollHeight,
			body.offsetHeight,
			html.clientHeight,
			html.scrollHeight,
			html.offsetHeight
		);
		let W = Math.max(
			body.scrollWidth,
			body.offsetWidth,
			html.clientWidth,
			html.scrollWidth,
			html.offsetWidth
		);
		if (isNaN(H)) throw "calculated height is NaN";
		if (isNaN(W)) throw "calculated width is NaN";
		this.H = H;
		this.W = W;
	}
};
