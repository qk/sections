function createFilters(sortupdate, verbose) {
	return {
		noDominators: function (sets) {
			return sets.filter(set => !set.some(node => node.h > 0.8));
		},

		noSingles: function(sets) {
			return sets.filter(set => set.length > 1);
		},

		minimumRequirements: function(sets) { // filter obvious negatives
			return sets.map(set => set.filter(node => node.x >= 0 && node.wPX > 100 && node.hPX > 10));
		},

		sortupdate: function(sets) {
			return sets.map(sortupdate);
		},

		equalx: function(sets) {
			// partition candidate sets into sets of elements with equal x-coordinates
			let equalx = [];
			for (let set of sets) {
				let P = partition(set, node => Math.round(node.x));
				for (let p in P) {
					equalx.push(P[p]);
				}
			}
			return equalx;
		},

		equalWidth: function(sets) {
			// partition candidate sets into sets of elements with equal x-coordinates
			let equalW = [];
			for (let set of sets) {
				let P = partition(set, node => Math.round(node.w));
				for (let p in P) {
					equalW.push(P[p]);
				}
			}
			return equalW;
		},

		// separate out elements with equal classnames, because those tend to be separators
		// equalClassNames: function(sets) {
			// let selector = function(n) {
				// let id = (n.node.id === "" ? "" : "#" + n.node.id);
				// return n.node.tagName + id + n.node.className.replace(/\s+/g, ".");
			// };
			// let equalClassNames = [];
			// for (let i = 0; i < sets.length; i++) {
				// let P = partition(sets[i], selector);
				// let remaining = [];
				// for (let p in P) {
					// if (P[p].length > 1 && P[p].length > sets[i].length/3 - 1) {
						// if (verbose) console.log("separating", p, ":", P[p].map(selector));
						// equalClassNames.push(P[p]);
					// } else {
						// remaining.push.apply(remaining, P[p]);
					// }
				// }
				// if (remaining.length > 0) equalClassNames.push(remaining);
			// }
			// equalClassNames = equalClassNames.map(sortupdate);
			// if (verbose) console.table(equalClassNames.map(set => {
				// let entry = {size:set.length, area:sum(set.map(n => n.area))};
				// return entry;
			// }));
			// if (verbose) console.log(equalClassNames);
			// return equalClassNames;
		// },

		partitionByClassNames: function(sets) {
			// let verbose = false;
			let filteredSets = [];
			for (let set of sets) {
				// count class name occurences
				let classNameCounts = {};
				for (let e of set) {
					for (let name of e.node.classList) {
						let count = classNameCounts[name];
						classNameCounts[name] = (count)? count+1 : 1;
					}
				}

				// discard names that only occurr once
				let commonClassNames = new Set();
				for (let name in classNameCounts) {
					if (classNameCounts[name] <= 1) {
						delete classNameCounts[name];
					} else {
						commonClassNames.add(name);
					}
				}
				if (verbose) console.log("trim: classNameCounts", classNameCounts);

				// partition
				let classSets = set.map(node => new Set(node.node.classList));
				if (verbose) console.log('classsets', classSets);
				let P = partition(set, (node,i) => {
					return [...intersect(classSets[i], commonClassNames)].sort().join(" ");
				});
				if (verbose) console.log('partition', P);
				for (let p in P) {
					filteredSets.push(sortupdate(P[p].map(shallowCopy)));
				}

				// keep the original set as well (may the best win)
				filteredSets.push(set);
			}
			return filteredSets;
		},

		majorityClassNames: function(sets) {
			// let verbose = true;
			// only keep elements that share the most common class names
			let filteredSets = [];
			for (let set of sets) {
				// count class name occurences
				let classNameCounts = {};
				for (let e of set) {
					for (let name of e.node.classList) {
						let count = classNameCounts[name];
						classNameCounts[name] = (count)? count+1 : 1;
					}
				}

				// discard names that only occurr once
				for (let name in classNameCounts) {
					if (classNameCounts[name] <= 1) {
						delete classNameCounts[name];
					}
				}
				if (verbose) console.log( "trim: classNameCounts", classNameCounts);

				// find names that all elements should share
				let majorityNames = [];
				for (let k in classNameCounts) {
					if (classNameCounts[k] >= set.length*0.66) {
						majorityNames.push(k);
					}
				}
				majorityNames.sort((a,b) => classNameCounts[a] - classNameCounts[b]);

				if (verbose) {
					let loglist = [];
					for (let name of majorityNames) {
						loglist.push([name, classNameCounts[name], set.length]);
					}
					console.log(loglist);
				}

				// only keep elements, that share the names
				if (majorityNames.length == 0) {
					filteredSets.push(set);
				} else {
					let filteredSet = [];
					for (let e of set) {
						let keep = true;
						for (let name of majorityNames) {
							if (!e.node.classList.contains(name)) {
								keep = false;
								break;
							}
						}
						if (keep) {
							filteredSet.push(e);
						}
					}
					filteredSets.push(filteredSet);
				}
			}
			return filteredSets;
		},

		// separate out elements s.t. they have equal 'collapsed' status (see update function for what that means)
		equalCollapsedStatus: function(sets) {
			let equal = [];
			for (let i = 0; i < sets.length; i++) {
				let P = partition(sets[i], node => node.collapsed?1:0);
				for (let p in P) {
					if (verbose) console.log("status", p, "#", P[p].length, P[p].map(unwrap));
					equal.push(sortupdate(P[p].map(shallowCopy)));
				}
			}
			return equal;
		},

		// doesn't work as intended, because y coordinates may be changed by contentscripts after this code has run
		differenty: function(sets) {
			let differenty = [];
			for (let i = 0; i < sets.length; i++) {
				let P = partition(sortupdate(sets[i]), n => round(n.y, 4));
				let remaining = [];
				for (let p in P) {
					if (P[p].length > 1) {
						if (verbose) console.log("tossing", P[p]);
					} else {
						remaining.push.apply(
							remaining,
							sortupdate(P[p].map(shallowCopy))
						);
					}
				}
				if (remaining.length > 0) {
					differenty.push(remaining);
				}
			}

			if (verbose) console.table(differenty.map(set => {
				let P = partition(set, node => round(node.y, 0));
				let entry = [];
				for (let p in P) {
					entry.push(P[p].length);
				}
				return entry;
			}));

			if (verbose) console.log(differenty);

			return differenty;
		},

		separators: function(sets) {
			// seperate out many small elements with equal height
			// (trying to filter separators)
			let verbose = "toss";
			let equalh = [];
			let P = {};
			let remaining = [];
			let tossed = false;
			let setHeight = 0;
			let partitionMeanHeight = 0;
			let smallest = 0;

			for (let set of sets) {
				// f.i. single-element sets will not enter the following k-loop, but 'remaining' and 'tossed' still need to be reset
				remaining = [];
				for (let k = 2; k <= 3 && set.length/k >= 1; k++) {
					// don't update the height of this partition. the element heights must remain the same as in their original set
					P = partition(set, (node,j) => {
						return node.node.tagName + (j%k + node.h); // 0 < node.h < 1
					});
					if (verbose == "keep") {
						console.log(k, "k");
						console.log(set.map(n => n.node));
						console.log(P, "sets of equal height");
					}
					setHeight = sum(set.map(n => n.hPX))/globals.H;
					remaining = [];
					tossed = false;
					for (let p in P) {
						partitionMeanHeight = mean(P[p].map(n => n.hPX));
						smallest = globals.H;
						for (let q in P) {
							if (q != p) {
								smallest = Math.min(smallest, min(P[q].map(n => n.hPX)));
							}
						}
						// if (any(P[p].map(n => n.node.classList.contains('divider')))) {
							// console.table([{
								// k:k,
								// pl:P[p].length,
								// sl:set.length,
								// 'sl/k-3':set.length/k-3,
								// 'ph/sh':sum(P[p].map(n => n.h))/setHeight,
								// '1/(k+2)':1/(k+2),
								// 'pmeanH':partitionMeanHeight,
								// 'smallest':smallest,
								// 'pmh*pl':partitionMeanHeight*P[p].length/setHeight,
								// '1/k':1/k,
								// 'pl > 1':P[p].length > 1,
								// 'pl>sl/k-3':P[p].length > set.length/k - 3,
								// 'pmh>=smallest':partitionMeanHeight >= smallest,
								// 'pmh*pl/sh < 1/k*':partitionMeanHeight/globals.H*P[p].length/setHeight < 1/k
							// }]);
						// }
						if (P[p].length > 1 && P[p].length > set.length/k - 3 && partitionMeanHeight < smallest && partitionMeanHeight/globals.H*P[p].length/setHeight < 1/k) {
							if (verbose == "toss") {
								console.log(P[p], "partition", p, "for k", k);
								console.log(sum(P[p].map(n => n.h))/setHeight, "partitionheight/setheight", setHeight, "setHeight");
								console.log(P[p].length, set.length/3, "size quotient");
								console.log("tossing");
							}
							tossed = true;
						} else {
							remaining.push.apply(remaining, P[p]);
						}
					} // for p
					if (tossed) break;
				} // for k
				if (remaining.length > 0) {
					if (tossed && verbose=="toss") console.log("remaining set", remaining);
					equalh.push(remaining);
				}
			} // for set
			return equalh.map(sortupdate);
		},

		broad: function(sets) {
			// filter sets with narrow elements
			let meanWidths = sets.map(set => mean(set.map(node => node.w)));
			let wmax = max(meanWidths.filter(w => w < 1));
			let wmin = min(meanWidths.filter(w => w > 0));
			if (verbose) console.log(round(wmax), round(wmin), round(wmax-wmin), "width");
			if (verbose) console.log(meanWidths.map(w => round(w)), "mean widths");
			if (wmax - wmin > 0.2) {
				let sortedWidthsI = argsort(meanWidths.map((v, i) => meanWidths[i])).reverse();
				let meanWidth = mean(meanWidths);
				let minWidth = round(meanWidth/1.5);
				if (verbose) console.log(sortedWidthsI.map(i => round(meanWidths[i])), "sorted meanWidths", round(meanWidth), "mean value", minWidth, "minWidth");
				let wideSets = sets.filter((set, i) => meanWidths[i] > minWidth);
				sets = wideSets;
			}
			return sets;
		},

		mediansized: function(sets) {
			// filter large elements and elements that are too small
			sets = sets.filter(set => {
				let maxnode = max(set.map(node => node.area));
				let smallnodesArea = sum(set.map(node => (node != maxnode ? node.area : 0)));
				// return false if maxnode area dominates the others nodes' cumulative area
				if (smallnodesArea/maxnode.area < 0.1) return false;
				// return false if the set only covers a small fraction of the total area
				if ((smallnodesArea + maxnode.area) < 0.1) return false;
				return true;
			});
			return sets;
		},

		discardHeaderFooter: function(sets) {
			return sets.map(set => {
				return set.filter(n => !/^header$|^footer$/.test(n.node.id));
			});
		},

		equalTags: function(sets) {
			// filter by tagNames
			let equalTags = [];
			for (let i = 0; i < sets.length; i++) {
				let P = partition(sets[i], node =>
					(/^h[01234]$/i.test(node.node.tagName) && "hx") || node.node.tagName
				);
				console.log(P);
				for (let p in P) {
					if (verbose) console.log("tag", p, P[p].length);
					equalTags.push(P[p]);
				}
			}
			return equalTags;
		},

		noDuplicates: function(sets) {
			let seen = {};
			let id = 1;

			function equals(set1, set2) {
				if (set1.length != set2.length) return false;
				for (let i = 0; i < set1.length; i++) {
					if (set1[i].node != set2[i].node) {
						return false;
					}
				}
				return true;
			}

			for (let i=0; i < sets.length; i++) {
				if (seen[i]) continue;
				for (let j=0; j < sets.length; j++) {
					if (i == j) continue;
					if (equals(sets[i], sets[j])) {
						if (seen[j]) {
							seen[i] = seen[j];
						} else {
							seen[i] = id;
							seen[j] = id;
							id++;
						}
					}
				}
			}

			let included = {};
			let remaining = [];
			for (let i=0; i < sets.length; i++) {
				if (seen[i]) {
					if (included[seen[i]]) continue;
					included[seen[i]] = true;
					remaining.push(sets[i]);
				} else {
					remaining.push(sets[i]);
				}
			}

			return remaining;
		},

		trim2: function(sets) {
			let additional = [];
			let num = 3;
			for (let set of sets) {
				for (let i = 1; i <= num; i++) {
					for (let j = 1; j <= num; j++) {
						additional.push(set.slice(i,-j).map(shallowCopy));
					}
				}
			}
			return sets.concat(additional);
		},

		trim: function(sets) {
			// let verbose = true;
			// filter leading/trailing small elements
			let additional = [];
			for (let set of sets) {
				let trimmed = set.map(shallowCopy);
				trimmed = trimmed.sort((a,b) => a.y - b.y);
				let stdH = std(trimmed.map(n => n.h));
				// let meanH = mean(trimmed.map(n => n.h));
				let minHeight = 3*stdH;
				if (verbose) console.log(minHeight*globals.H, "trim: minimum height");
				if (stdH === 0) continue;

				let height = 0;
				let lb, ub; // lower bound, upper bound indices
				for (lb = 0; lb < trimmed.length; lb++) {
					height += trimmed[lb].h;
					if (height > minHeight) {
						lb--;
						break;
					}
				}
				height = 0;
				for (ub = trimmed.length-1; ub >= 0; ub--) {
					height += trimmed[ub].h;
					if (height > minHeight) {
						ub++;
						break;
					}
				}
				// remove leading, trailing small elements
				lb += 1; // how many elements to remove from the start of the array
				ub = trimmed.length - ub; // how many elements to remove from the end of the array
				if (lb > 0 || ub > 0) {
					if (verbose) console.log(trimmed.map(n => n.node), "removing elements [:" + lb + "][-" + ub + ":]");
					if (lb > 0) trimmed.splice(0,lb);
					if (ub > 0) trimmed.splice(-ub,ub);
					if (verbose) console.log(trimmed, "trimmed result");
				}
				if (trimmed.length > 1 && set.length > trimmed.length) {
					additional.push(trimmed);
				}
			}
			if (verbose) console.log(additional);
			return sets.concat(additional);
		}
	};
}
