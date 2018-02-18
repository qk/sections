class Timer {
	constructor(msg) {
		this.time = +(new Date());
		this.msg = (msg === undefined ? "" : msg);
	}
	reset() {
		this.time = +(new Date());
	}
	stop() {
		let t = (+(new Date()) - this.time).toString();
		t = "	 ".substr(t.length) + t;
		console.log("[", t, "ms ]", this.msg);
	}
}

function highlight(nodes, color) {
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i] && nodes[i].node) {
			nodes[i].node.style.cssText += "border-left: 4px solid " + color + " !important; padding-left:4px !important;";
		} else {
			if (!nodes[i]) {
				throw "tried to highlight invalid node " + nodes[i];
			} else if (!nodes[i].node) {
				throw "tried to highlight invalid (unwrapped?) node " + nodes[i] + ", which' .node is " + nodes[i].node;
			}
		}
	}
}

// ~scoring function for section lengths
function sigmoid(x) {
	let expX = Math.exp(x);
	return expX/(1+expX);
}

// round x to n digits
function round(x, n) {
	n = n || 2;
	let d = Math.pow(10,n);
	return Math.round(x*d)/d;
}

// wraps node with some values for convenience and readability
function wrap(node, i, set) {
	return {
		node: node,
		collapsed: false, // wether the element's height had to be approximated
		area: 0, // % of document area
		h: 0, // % of document height
		w: 0, // % of document width
		hPX: 0, // px
		wPX: 0, // px
		x: 0, // px
		y: 0 // px
	};
}

function unwrap(node) { return node.node; }
function ascY(a,b) { return a.y - b.y; }
function ascArea(a,b) { return a.area - b.area; }
function ascHeight(a,b) { return a.hPX - b.hPX; }

function range(from, to, stepsize) {
	if (stepsize === undefined) stepsize = 1;
	let I = [];
	for (let i = from; i < to; i += stepsize) {
		I.push(i);
	}
	return I;
}

function partition(A, getter) {
	// partitions an array A of any elements by equal getter(element)-values. 
	// returns a {getter()-value: elements} hashmap s.t. all elements have the 
	// same getter()-value
	let box = {};
	for (let i = 0; i < A.length; i++) {
		let property = getter(A[i], i);
		if (box[property] === undefined) {
			box[property] = [A[i]];
		} else {
			box[property].push(A[i]);
		}
	}
	return box;
}

function argsort(A) {
	return range(0, A.length).sort((i,j) => A[i] - A[j]);
}

function sum(A) { return A.reduce((sum, n) => sum + n, 0); }
function mean(A) { return sum(A)/A.length; }
function std(A) { return Math.sqrt(mean( A.map(a => a-mean(A)).map(c => c*c) )); }
// function max(A) { return Math.max(...A); } // 25ms for A.length == 100k
// function min(A) { return Math.min(...A); }
function max(A) { return A.reduce((maxV, v) => Math.max(maxV, v), -Infinity); } // 7ms for A.length == 100k
function min(A) { return A.reduce((minV, v) => Math.min(minV, v), Infinity); }
function concat(a,b) { return a.concat(b); }

function any(A) {
	for (let b of A) {
		if (b) return true;
	}
	return false;
}

function softmax(A) {
	A = A.map(v => Math.exp(v));
	let sumA = sum(A);
	return A.map(v => v/sumA);
}

function contain(minimum, value, maximum) {
	return Math.max(Math.min(value, maximum), minimum);
}

function getDepth(node) {
	let depth = 0;
	while (node != document.body) {
		depth++;
		node = node.parentNode;
	}
	return depth;
}

function commonAncestor(node1, node2) {
	let depth1 = getDepth(node1);
	let depth2 = getDepth(node2);
	if (depth1 > depth2) {
		while (depth1 > depth2) { node1 = node1.parentNode; depth1--; }
	} else if (depth2 > depth1) {
		while (depth2 > depth1) { node2 = node2.parentNode; depth2--; }
	}
	while (node1 != node2) {
		node1 = node1.parentNode;
		node2 = node2.parentNode;
	}
	return node1;
}

function ignoreTags(node) {
	let tag = node.tagName;
	return tag != "SCRIPT" && tag != "NOSCRIPT";
}

class PrioQ {
	// https://github.com/adamhooper/js-priority-queue/blob/master/src/PriorityQueue/ArrayStrategy.coffee
	constructor(compare, A) {
		if (A instanceof Array) {
			this.Q = A.slice(0).sort(compare).reverse();
		} else {
			this.Q = [];
		}
		this.compare = compare;
	}

	enqueue(value) {
		let mid = 0;
		let high = this.Q.length;
		let low = 0;
		while (low < high) {
			mid = (low + high) >>> 1;
			if (this.compare(this.Q[mid], value) >= 0) {
				low = mid + 1;
			} else {
				high = mid;
			}
		}
		this.Q.splice(low, 0, value);
		return low;
	}

	dequeue() {
		return Q.shift();
	}
}

function update(node, i, set) { // update node properties
	let rect = node.node.getBoundingClientRect();
	// let heightPX = Math.abs(rect.bottom - rect.top);
	// let widthPX = Math.abs(rect.right - rect.left);
	// clientRect() will report a height of 0 for some elements, although they contain other elements
	// see rockpapershotgun.com element #page for an example element of height 0, that actually houses 45% of the content
	// using element.scrollHeight and -Width is more reliable but also fails in certain cases
	// let heightPX = node.node.scrollHeight;
	let heightPX = 0;
	let collapsed = (rect.top === rect.bottom);
	let nextY = 0;
	/*
	if (i+1 < set.length) {
		nextY = set[i+1].node.getBoundingClientRect().top;
		heightPX = nextY - rect.top - 5;
	} else {
		// have to approximate a strictly positive height, otherwise the trim-filter will remove the element
		heightPX = Math.max(Math.abs(rect.bottom - rect.top), (H - (rect.top + window.scrollY))/3);
	}
	*/
	if (i+1 < set.length) {
		nextY = set[i+1].node.getBoundingClientRect().top;
		heightPX = Math.abs(nextY - rect.top - 5);
	} else {
		heightPX = node.node.scrollHeight;
		if (heightPX === 0 || /^h\d$/i.test(node.node.tagName)) {
			// have to approximate a strictly positive height, otherwise the trim-filter will remove the element
			heightPX = (globals.H - (rect.top + window.scrollY));
		}
	}
	heightPX = Math.max(heightPX, node.node.scrollHeight);
	let widthPX = node.node.scrollWidth;
	let height = heightPX/globals.H;
	let width = widthPX/globals.W;
	node.collapsed = collapsed; // wether the element's height had to be approximated
	node.area = height * width;
	node.h = height;
	node.w = width;
	node.hPX = heightPX;
	node.wPX = widthPX;
	node.x = rect.left + window.scrollX;
	node.y = rect.top + window.scrollY;
	return node;
}

// because this is used so often
function sortupdate(set) { return set.sort(ascY).map(update); }

function toArray(htmlcollection) {
	return Array.prototype.slice.call(htmlcollection, 0);
}

class SetCollector extends PrioQ {
	constructor(compare) {
		if (compare == null)
			compare = (a,b) => a.area - b.area;
		super(compare);
		this.counter = 0;
	}

	descend(node, exclude, inertia, eps) {
		if (inertia === 0 || node.node.children.length === 0 || (exclude && exclude == node.node)) return;
		this.counter++;
		let children = [].filter.call(node.node.children, ignoreTags)
			.map(wrap).map(update)
			.sort(ascY).map(update);
		let area = sum(children.map(n => n.area));
		let pos = this.enqueue({area:area, set:children});
		// some wrapper elements are (falsely?) reported having a height of 0, but their children have positive heights. not sure what causes this, but they're rare so just skipping past them works well enough.
		if (pos >= 20 || Math.max(node.area, area) < eps) {
			inertia--;
		}
		children.forEach(node => this.descend(node, exclude, inertia, eps));
	}

	collect(root, exclude, inertia, eps) {
		this.counter = 0;
		// start descending right at the root node
		this.descend(wrap(root), exclude, inertia, eps);
		console.log("looked at", this.counter, "elements");
		return this.Q
			.map(q => q.set)
			.map(set => set.filter(n => !isNaN(n.area)))
			.filter(set => set.length > 1);
	}
}

class FuzzySectionFinder {
	constructor(n, globals) {
		this.map = new Map();
		this.n = n || 1000; // number of random initializations
		this.globals = globals;
	}

	randint(maxint) {
		return parseInt(Math.random()*maxint, 10);
	}

	getLeaves(tree, exclude) {
		// straightforward, returns all leafs of tree except for those under the 
		// exclude node
		if (exclude == tree || tree.nodeType == 3) {
			// exclude leafs in subtree starting at the 'exclude' element
			// and ignore textnodes
				return [];
		}
		if (tree.children.length > 0) {
			let L = [];
			for (let i=0; i<tree.children.length; i++) {
				L = L.concat(this.getLeaves(tree.children[i]));
			}
			return L;
		}
		return [tree];
	}

	increaseCount(node) {
		if (this.map.has(node)) {
			this.map.get(node).count += 1;
		} else {
			this.map.set(node, {count:0, node:node});
		}
	}

	detect(root, exclude) {
		let leafs = this.getLeaves(root, exclude);
		if (leafs.length <= 1) { // only 1 set found, all elmeents will have the same parentNode
			if (leafs.length == 1) return [{node:leafs[0].parentNode, count:1.0}];
			return [];
		}
		let ancestor; // nodes
		let ra, rb; // random ints
		let n = this.n; // number of random picks

		for (let i = 0; i < n; i++) {
			ra = this.randint(leafs.length);
			do {
				rb = this.randint(leafs.length);
			} while (ra == rb);
			ancestor = commonAncestor(leafs[ra], leafs[rb]);
			this.increaseCount(ancestor);
		}

		let parents = Array.from(this.map.values());
		for (let i of parents) { i.count = i.count/n; }
		parents = parents.sort((a,b) => b.count - a.count).splice(0,20);
		return parents;
	}
}

class FuzzySectionFinderByPoints extends FuzzySectionFinder {
	constructor(n, globals) {
		super(n, globals);
	}

	dist2(ax,ay,bx,by) {
		// squared eucl. distance
		let dx = ax - bx;
		let dy = ay - by;
		return dx*dx + dy*dy;
	}

	elementFromPoint(x,y,leafs) {
		// window.elementFromPoint() only works with currently visible points and 
		// only with coordinates relative the actual browser window.
		return leafs.reduce((a,b) => {
			let dista = this.dist2(a.x + a.w/2, a.y + a.h/2, x, y);
			let distb = this.dist2(b.x + b.w/2, b.y + b.h/2, x, y);
			if (dista <= distb) return a;
			else return b;
		});
	}

	detect(root, exclude) {
		let leafsA = (new SetCollector()).collect(root, exclude, 3, 0.01);
		if (leafsA.length <= 1) { // only 1 set found, all elmeents will have the same parentNode
			if (leafsA.length == 1) return [{node:leafsA[0][0].parentNode, count:1.0}];
			return [];
		}
		leafsA = leafsA.reduce(concat);
		let leafsB;
		if (exclude) leafsB = (new SetCollector()).collect(exclude, null, 2, 0.01).reduce(concat);
		else leafsB = leafsA;

		let ax, ay, bx, by; // random ints
		let n = this.n; // number of random picks
		let retries;
		let H = this.globals.H;
		let W = this.globals.W;

		for (let i = 0; i < n; i++) {
			let child1, child2;
			ax = this.randint(W);
			ay = this.randint(H);
			child1 = this.elementFromPoint(ax,ay,leafsA);
			retries = 1;
			do {
				bx = this.randint(W);
				by = this.randint(H);
				// console.log(xa, ya, xb, yb);
				child2 = this.elementFromPoint(bx,by,leafsB);
				retries--;
			} while (child1 == child2 && retries >= 0);
			if (child1 == child2) console.log('fsf child collision');
			// console.log(child1, child2);
			let ancestor = commonAncestor(child1.node, child2.node);
			this.increaseCount(ancestor);
		}

		let parents = Array.from(this.map.values());
		for (let i of parents) { i.count = i.count/n; }
		parents = parents.sort((a,b) => b.count - a.count);
		return parents;
	}
}

function isUpToDate(nodeA, nodeB) {
	let tol = 20;
	let properties = ["hPX", "wPX", "y"];
	let p = "";
	for (let i = 0; i < properties.length; i++) {
		p = properties[i];
		log(nodeA[p], nodeB[p], Math.abs(nodeA[p]-nodeB[p]), tol);
		if (Math.abs(nodeA[p] - nodeB[p]) > tol) {
			return false;
		}
	}
	return true;
}

function fixedHeaderHeight() {
	let node = document.elementFromPoint(window.innerWidth/2, 2);
	// console.log(node, "fixedHeaderHeight start");
	if (!node) return 0;
	do {
		// console.log(node.tagName, window.getComputedStyle(node).position);
		if (/fixed|sticky/i.test(window.getComputedStyle(node).position)) {
			// console.log(node, "fixed element");
			// there's also .scrollHeight, but we only care about the actually visible part
			return Math.max(node.clientHeight, node.offsetHeight);
		}
	} while (Boolean(node = node.parentElement));
	return 0;
}

function extendSelected(sets) { // join sections from different sets
	// sort asc. by height, then asc. by y
	let selected = sets[0].slice(0); // assumes sets are already sorted by score
	let rest = sets.slice(1).reduce(concat);
	let ascYi = range(0, rest.length);
	ascYi.sort((i,j) => rest[i].y == rest[j].y ? rest[j].hPX - rest[i].hPX : rest[i].y - rest[j].y);
	let restAscY = ascYi.map(i => rest[i]);
	console.log(restAscY.map(e => [e.y, e.hPX].join(' ')), "rest asc y");

	// add elements to selected sections
	let fixedHeaderHeightPX = fixedHeaderHeight();
	let viewHeight = window.innerHeight - fixedHeaderHeightPX;
	let top = selected[0].y;
	let bottom = selected[selected.length-1].y + selected[selected.length-1].hPX;
	let e, y, b, add, next, lastB = 0;
	for (let i = 0; i < ascYi.length; i++) {
		e = rest[ascYi[i]];
		y = e.y;
		b = e.y + e.hPX; // current element bottom
		add = false;
		// TODO: maybe add a check to skip elements until a full viewHeight has accumulated
		if (e.y < lastB) continue;
		if (!((y <= top  && b <= top) || (y >= bottom && b >= bottom))) continue; // if element inside of selected sections
		if (e.hPX > viewHeight) {
			if (i < ascYi.length-1) {
				next = rest[ascYi[i+1]];
				if (next.y + next.hPX <= b) { // if exists smaller element that ends inside the current
					continue;
				}
			} else {
				add = true;
			}
		} else {
			add = true;
		}
		if (add) {
			selected.push(e);
			lastB = b;
		}
	}

	// return modified sets
	sets.unshift(selected.sort(ascY).map(update)); // insert at pos 0
	return sets;
}

function shallowCopy(obj) {
	let copy = {};
	for (let p in obj) {
		copy[p] = obj[p];
	}
	return copy;
}

function zipReduce(A, B, func, neutral) {
	let length = Math.min(A.length, B.length);
	let value = func(A[0], B[0], neutral);
	for (let i = 1; i < length; i++) {
		value = func(A[i], B[i], value);
	}
	return value;
}

function zipAny(A, B, func) {
	let length = Math.min(A.length, B.length);
	for (let i = 0; i < length; i++) {
		if (func(A[i], B[i])) {
			return true;
		}
	}
	return false;
}

// function intersect(set1, set2) { return new Set([...set1].filter(v => set2.has(v))); } // 0.0558 ms
function intersect(set1, set2) { // 0.0097 ms
	let result = new Set();
	for (let v of set1) {
		if (set2.has(v)) {
			result.add(v);
		}
	}
	return result;
}

function download(text, filename) {
	// typeof(new String("")) === "object"
	if (!(typeof text === 'string' || text instanceof String)) {
		throw "download(text, ...) expects text to be a string, but was " + (typeof text);
	}
	if (!(typeof filename === 'string' || filename instanceof String)) {
		filename = "download.txt";
	}
	// <a href="data:application/octet-stream;charset=utf-8;base64,Zm9vIGJhcg==" download="filename.txt">text file</a>
	// <a href="data:application/octet-stream,field1%2Cfield2%0Afoo%2Cbar%0Agoo%2Cgai%0A" download="filename.csv">CSV</a>
	let header = "data:application/octet-stream;charset=utf-8;base64,";
	let base64 = btoa(text);
	let a = document.createElement("a");
	a.href = header + base64;
	a.download = filename;
	a.click();
}
