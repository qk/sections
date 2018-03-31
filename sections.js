(function() {
	'use strict';

	globals.updateDocumentDims();
	let overallTimer = new Timer("all done");

	// SECTION DETECTION

	// find candidate sets
	let sets;
	let root = document.querySelector('#' + globals.contentDivIDs.join(', #')) || document.body;
	console.log('root element', root);

	let areaFSFTimer = new Timer("fuzzy section detection (area method)");
	let areaFSF = new FuzzySectionFinderByPoints(1000, globals);
	sets = areaFSF.detect(root)
		.map(entry => Array.from(entry.node.children).map(wrap))
		.map(sortupdate);
	areaFSFTimer.stop();
	// console.table(areaFSF.detect(document.body, null).map(n => ({node:n.node, sections:n.node.children[0], size:n.node.children.length, hits:n.count})));

	let filters = createFilters(sortupdate, false);
	function filter(sets, filters, globals, verbose) {
		let filterchain = [
			"discardHeaderFooter",
			"equalCollapsedStatus",
			"onLeftSide",
			"equalTags", // costly
			"sortupdate",
			"minimumRequirements",
			"noDominators",
			"equalx",
			// "equalWidth",
			"sortupdate",
			// "differenty", // probably already implied in equalx
			"broad", // pretty dirty
			// "mediansized",
			"trim2",
			"separators", // costly
			"separators", // costly again
			"partitionByClassNames",
			"noDuplicates",
			"trim",
			// "noSingles", // applied after each step already 
			"sortupdate"
		];
		let allFilterTimer = new Timer("done filtering");
		let filteredSets, filter, filterTimer, filterName;
		let prevSetsLength = sets.length;
		if (verbose) console.log(sets.map(set => set.map(unwrap)), "sets before filtering");
		for (let i = 0; i < filterchain.length; i++) {
			filterName = filterchain[i];
			if (verbose) console.log("=============", filterName, "=============");
			filter = filters[filterName];
			if (filter === undefined) {
				console.error("filter", filterName, "is undefined");
				break;
			}
			filterTimer = new Timer(filterName + " (" + ((filteredSets && filteredSets.length) || 0));
			filteredSets = filter(sets).filter(set => set.length > 1);
			prevSetsLength = filteredSets.length;
			filterTimer.msg += ' => ' + ((filteredSets && filteredSets.length) || 0) + ')';
			filterTimer.stop();
			if (verbose) {
				console.log(filteredSets, "filteredSets");
				console.table(filteredSets.map(set => ({tag: set[0].node.tagName, size:set.length, area:round(sum(set.map(n => n.area)), 4)})));
			}
			if (verbose) console.log("---------", filteredSets.length, "sets remaining --------");
			if (filteredSets.length === 0) {
				console.error(filterName + " made sets become empty");
			} else {
				sets = filteredSets;
			}
		}
		allFilterTimer.stop();
		if (verbose) console.log(sets.map(set => set.map(unwrap)), "sets after filtering");

		let scoringTimer = new Timer("calculated scores, selected sections");
		// table of values for use in the scorefunction
		let table = {
			"A": softmax(sets.map(set => sum(set.map(node => round(node.area))))), // area
			"W": sets.map(set => mean(set.map(node => node.w))), // mean width
			"L": sets.map(set => set.length),
			"lL": sets.map(set => Math.log(set.length)),
			"gL": sets.map(set => sigmoid(set.length-2)), // sigmoid(0)==0.5
			"T": sets.map(set => { // tag
				return mean(set.map(node => {
					let tag = node.node.tagName;
					if (/^H\d$/.test(tag)) return 1.1; // h1, h2, ...
					if (tag == 'P') return 0.8;
					if (tag == 'PRE') return 0.9;
					return 1.0;
				}));
			}),
			// "lF": sets.map(set => { // cross reference with sections detected fuzzily
				// let parent = set[0].node.parentNode;
				// if (leafsFSF.map.has(parent)) {
					// return leafsFSF.map.get(parent).count;
				// } else {
					// return 0.0;
				// }
			// }),
			"aF": sets.map(set => { // cross reference with sections detected fuzzily
				let parent = set[0].node.parentNode;
				if (areaFSF.map.has(parent)) {
					return areaFSF.map.get(parent).count;
				} else {
					return 0.0;
				}
			}),
			// some standard deviations (std of width and x is always 0, because of the filters)
			"meanH": sets.map(set => set.map(node => node.h)).map(mean),
			"meanA": sets.map(set => set.map(node => node.area)).map(mean),
			"meanY": sets.map(set => set.map(node => node.y/globals.H)).map(mean),
			"stdH": sets.map(set => set.map(node => node.h)).map(std),
			"stdA": sets.map(set => set.map(node => node.area)).map(std),
			"stdY": sets.map(set => set.map(node => node.y/globals.H)).map(std),
			"U": softmax(sets.map(set => { // uniformity score is based on how the the differences between element y-positions change
				set = set.sort((a,b) => a.y - b.y);
				let Y = [0].concat(set.map(node => node.y)).concat([globals.H]);
				// differences between element y-positions
				let D = Y.map((y, i) => (i+1 < Y.length ? (Y[i+1]-y)/globals.H : 0)).slice(0,-1);
				let maxD = max(D);
				D = D.map(d => d/maxD);
				// changes between the element position differences themselves
				let D2 = D.map((d, i) => (i+1 < D.length ? Math.abs(D[i+1] - d) : 0));
				return 1/sum(D2);
			})),
			"U'": softmax(sets.map(set => { // alternate uniformity score, uses division instead of subtraction
				set = set.sort((a,b) => a.y - b.y);
				let Y = [0].concat(set.map(node => node.y)).concat([globals.H]);
				let D = Y.map((y, i) => (i+1 < Y.length ? Y[i+1]-y : 0)).slice(0,-1).map(v => v/globals.H);
				let divs = D.map((d, i) => {
					if (i+1 < D.length) {
						d = (d === 0 ? 1 : d);
						let v = D[i+1]/d;
						if (v < 1) return 1/v;
						else return v;
					} else return 0;
				});
				return 1/sum(divs);
			})),
			"S": sets.map(set => {
				// similarity score to ideal sequence
				let h = set.map(n => n.h);
				let l = 2*globals.H/window.innerHeight;
				let deviation = [
					window.innerHeight/2/globals.H - mean(h),
					0 - std(h),
					1 - set.length/l,
				];
				let expscore = Math.exp(1-Math.sqrt(mean(deviation.map(v => v*v))));
				return expscore/(1+expscore);
			}),
			"C": sets.map(set => set[0].collapsed ? 0.75 : 1)
		};

		// very basic and harmful formula evaluator, because i'm too lazy to implement each formula for every little change
		// it also lets you skip the multiplication asterisk
		let varnames = [];
		for (let name in table) varnames.push(name);
		let varnameRegex = new RegExp("(" + varnames.sort().reverse().join("|") + ")", "g");
		function evaluate(formula) {
			// table["aF"][i]
			let expandedFormula = formula.replace(varnameRegex, "table[\"$1\"][i]").replace(/(\[i\])(table|\()/g, "$1*$2");
			// TODO: replace eval by the actual function, once a suitable function is found and no more testing has to be done
			let scoreFunction = eval("(function(i) { return " + expandedFormula + "; })");
			scoreFunction.formula = formula;
			return scoreFunction;
		}

		// lL, stdA, 1-stdY, lLA, lLAC, +gLACT(1-stdH), lLAU, lLAU'
		// let scoreFormula = "FgLACT(1-stdH)";
		// let scoreFormula = "aFgLACT/(1+stdH)";
		let scoreFormula = "AgLaFCT/(1+stdH)";
		let score = evaluate(scoreFormula);
		let sortedI = argsort(sets.map((v,i) => score(i))).reverse();
		scoringTimer.stop();

		if (true) { // log scores to console
			let scorefunctions = "T S L gL A aF W U U' 1/(1+stdH) C".split(" ").concat([scoreFormula]).map(evaluate);
			console.table(sortedI.map(i => {
				let entry = {};
				let index, value;
				for (let f of scorefunctions) {
					index = f.formula;
					value = f(i);
					entry[index] = isNaN(value) ? value : round(value,3);
				}
				entry.node = sets[i][0].node;
				return entry;
			}));
			console.log(sortedI.map(i => sets[i].map(unwrap)), "nodes");
			console.log(sortedI.map(i => sets[i]), "wrapped nodes");
		}

		let sections = sets[sortedI[0]].sort((a,b) => a.y - b.y);
		let finaldepth = getDepth(sections[0].node);
		overallTimer.msg += ", sections in depth " + finaldepth;
		overallTimer.stop();

		let best = sortedI[0];
		let scores = {};
		for (let k in table) {
			scores[k] = table[k][best];
		}

		// return {sections:sections, scores:scores};
		return sortedI.map(i => sets[i]);
	}
	sets = filter(sets, filters, globals, false);
	console.table(sets[0]);
	// sets = extendSelected(sets);
	console.table(sets[0]);
	highlight(sets[0], globals.color.sections);
	let sj = new SectionJumper(sets[0], globals, false);

	// EVENT LISTENERS

	let reinit = {
		elements: [],
		add: function(element) {
			this.elements.push(element);
			if (this.elements.length == 2) {
				let parent = commonAncestor(this.elements[0], this.elements[1]);
				console.log("MANUAL SECTION OVERRIDE");
				this.reinitialize([].map.call(parent.children, wrap), true);
				this.elements.forEach(node => {node.style.cssText = "";});
				this.elements = [];
			}
		},
		reinitialize: function(newSections, use_filters) {
			// collect scores to help find a more robust scoring formula
			console.log("REINITIALIZING");
			sj.sections.forEach(node => {node.node.style.cssText = "";});
			if (use_filters) {
				sj.sections = filter([newSections], filters, globals, false)[0];
			} else {
				sj.sections = newSections;
			}
			console.log(sj.sections.map(node => node.node));
			highlight(sj.sections, globals.color.sections);
		}
	};

	// register mutation observer and handle newly inserted dom nodes
	// let sectionParent = sets[0][0].node.parentNode;
	let commonClasses = [].reduce.call(
		sets[1].map(e => new Set(e.node.classList)), // sets[0] is the extendSelected'() set, sets[1] the original one
		intersect
	);
	console.log("commonClasses", commonClasses);
	let observer = new MutationObserver((records) => {
		// console.log(records);
		// console.log(observer);
		let changed = false;
		for (let record of records) {
			// if (record.removedNodes.length > 0) {
				// console.log("removedNodes.length", record.removedNodes.length);
				// for (let rnode of record.removedNodes) {
					// let k = sj.sections.indexOf(rnode);
					// console.log("removed node", rnode, "k", k);
					// if (k != -1) {
						// let removed = sj.sections.splice(k, 1);
						// console.log("removed element", removed, "at", k);
					// }
				// }
			// }
			if (record.addedNodes.length > 0) {
				let nodes = [...record.addedNodes]
					.filter(e => e.nodeType != 3) // ignore textnodes
					.map(e => [e,...e.querySelectorAll('*')])
					.reduce(concat, [])
					.filter(e => intersect(new Set(e.classList), commonClasses).size == commonClasses.size);
				if (nodes && nodes.length > 0) console.log("adding", nodes);
				if (nodes.length > 0) {
					changed = true;
					// sj.sections = sj.sections.concat(nodes.map(wrap));
				}
			}
		}
		if (changed && commonClasses.size > 0) {
			// reinit.reinitialize(sj.sections);
			console.log("SECTION MUTATION DETECTED");
			let nodes = document.body.querySelectorAll("."+[...commonClasses].join("."));
			console.log(nodes, "NODES TO REINIT ON");
			reinit.reinitialize([...nodes].map(wrap), false);
		}
	});
	// let observedNode = sectionParent;
	// do {
		// observer.observe(observedNode, {childList:true, subtree:true});
		// observedNode = observedNode.parentNode;
	// } while (observedNode.parentNode != document.body);
	if (commonClasses.size > 0) {
		observer.observe(document.body, {childList:true, subtree:true});
	}

	window.addEventListener("load", () => {
		// refresh everything (incl. images) is loaded
		console.log("onloadevent fired");
		sj.update(true);
	});

	window.addEventListener("keydown", e => {
		// console.log(e); // uncomment this to see keyboard button details on the console
		if (e.ctrlKey || e.shiftKey || e.metaKey) return;
		let active = document.activeElement;
		let tag = active.tagName;
		let type = active.type;
		let ignoreInputElements = {"button":0, "image":0}; // still jump if these are focused
		// don't jump if user is entering something into a form
		if ((tag == "INPUT" && !(type in ignoreInputElements)) || tag == "IFRAME" || tag == "TEXTAREA") return;
		if (e.key == "ArrowDown") {
			e.stopPropagation();
			e.preventDefault();
			sj.jump(1, -1);
			return false;
		} else if (e.key == "ArrowUp") {
			e.stopPropagation();
			e.preventDefault();
			sj.jump(-1, -1);
			return false;
		} else if (globals.useDigits && /\d/.test(e.key)) { // digit 0-9
			let i = parseInt(e.key, 10);
			console.log(e.key, i, sj.sections.length);
			if (i <= sj.sections.length) { // 0: page top, 1: first section
				highlight(sj.sections, globals.color.sections);
				sj.update();
				e.stopPropagation();
				e.preventDefault();
				sj.startScroll(i-1);
				// eat the key. otherwise you might trigger <number><action> mappings in cVim.
				return false;
			}
		}
	});

	if (globals.useScrollWheel) {
		window.addEventListener("wheel", e => {
			if (e.altKey) return;
			if (sj.sections) {
				e.stopPropagation();
				e.preventDefault();
				// console.log(e);
				if (e.deltaY > 0) {
					sj.jump(1, e.clientY);
				} else if (e.deltaY < 0) {
					sj.jump(-1, e.clientY);
				}
				return false;
			}
		});
	}

	window.addEventListener("contextmenu", e => {
		// selecting two different sections will infer the remaining ones
		if (e.ctrlKey) {
			e.target.style.background = globals.color.sections;
			reinit.add(e.target);
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
		// download datapoints
		if (e.altKey) {
			e.stopPropagation();
			e.preventDefault();
			let command = prompt("enter sections.user.js command");
			let data;
			if (command == "dl" || command == "download") {
				data = GM_getValue("points", null);
				console.log(data);
				if (data) download(data, "section_scores.json");
				else alert("no points collected");
			} else if (command == 'dl scrollpoints') {
				data = GM_getValue("scrollpoints", null);
				if (data) download(data, "scrollpoints.json");
				else alert("no scrollpoints collected");
			} else if (command == 'show') {
				data = JSON.parse(GM_getValue("points", null)) || {positives:[], negatives:[]};
				console.log(data);
			} else if (command == 'clear') {
				alert("clearing...");
				GM_setValue("points", null);
			} else if (command == 'remove last' || command == 'delete last') {
				data = JSON.parse(GM_getValue("points", null)) || [];
				console.log(data);
				if (data && data.length > 0) {
					data.pop();
					GM_setValue("points", JSON.stringify(data));
					console.log("deleted last entry");
				}
			} else if (/^\d+!?$/.test(command)) {
				// select sets i as best and reinitialize
				let i = parseInt(command.match(/(^\d+)/)[1]);
				console.log('MANUAL SCORE OVERRIDE');
				reinit.reinitialize(sets[i], false);
				console.log(i);
				highlight(sj.sections, globals.color.sections);
				if (/!$/.test(command)) {
					// store as training data
					console.log('storing sections');
					data = JSON.parse(GM_getValue("points", null)) || [];
					data.push({best:i, sets:sets.map(set => {
						return set.map(shallowCopy).map(n => {
							n.tag = n.node.tagName;
							n.classes = n.node.classList;
							delete n.node;
							return n;
						});
					})});
					GM_setValue("points", JSON.stringify(data));
				}
			}
			return false;
		}
	});
	// GM_setValue("scrollpoints", [[]]);
})();
