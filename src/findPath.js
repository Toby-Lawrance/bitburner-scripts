/** @param {NS} ns **/
export async function main(ns) {
	let target = ns.args[0];

	let startHost = "home";
	/** @type {{"host":string, "path":string[]}[]} */
	let visited = [];
	/** @type {{"host":string, "path":string[]}[]} */
	let toVisit = [{ "host": startHost, "path": [startHost] }];

	/** @type {{"host":string, "path":string[]}} */
	let current = {"host":null,"path":[]};
	while (current.host != target && toVisit.length > 0) {
		current = toVisit.shift();
		visited.push(current);
		let newHosts = ns.scan(current.host)
			.filter(h => !visited.map(v => v.host).includes(h) && !toVisit.map(v => v.host).includes(h))
			.map(nh => { return { "host": nh, "path": current.path.concat([nh]) } });
		toVisit = toVisit.concat(newHosts);
	}

	ns.tprint(current);
}