/** @param {NS} ns **/
export async function main(ns) {
	let allServerHostNames = getAllServerHostNames("home", ns);

	for (const host of allServerHostNames) {
		let files = ns.ls(host, ".cct");
		if (files.length > 0) {
			ns.tprint(host + ": " + JSON.stringify(files));
		}
	}
}

/** @param {string} startHost
 *  @param {NS} ns
 *  @returns {string[]} allFindableServerHosts
 **/
function getAllServerHostNames(startHost, ns) {
	let visited = [startHost];
	/** @type {string[]}*/
	let toVisit = ns.scan(startHost);

	while (toVisit.length > 0) {
		let current = toVisit.shift();
		visited.push(current);
		let newHosts = ns.scan(current).filter(h => !visited.includes(h) && !toVisit.includes(h));
		toVisit = toVisit.concat(newHosts);
	}

	return visited;
}