const typeToScript = {
	"Algorithmic Stock Trader I": null,
	"Algorithmic Stock Trader II": null,
	"Algorithmic Stock Trader III": null,
	"Algorithmic Stock Trader IV": null,
	"Array Jumping Game": null,
	"Find All Valid Math Expressions": null,
	"Find Largest Prime Factor": null,
	"Generate IP Addresses": null,
	"Merge Overlapping Intervals": null,
	"Minimum Path Sum in a Triangle": null,
	"Sanitize Parentheses in Expression": null,
	"Spiralize Matrix": null,
	"Subarray with Maximum Sum": null,
	"Total Ways to Sum": null,
	"Unique Paths in a Grid I": null,
	"Unique Paths in a Grid II": null
};

/** @param {NS} ns **/
export async function main(ns) {
	let allServerHostNames = getAllServerHostNames("home", ns);

	for (const host of allServerHostNames) {
		let files = ns.ls(host, ".cct");
		if (files.length > 0) {
			for (const file of files) {
				const type = ns.codingcontract.getContractType(file, host);
				const data = ns.codingcontract.getData(file, host);
				await solveContract(type, data, ns, host, file);
			}
		}
		await ns.asleep(1000);
	}

	ns.tprint("Check complete");
}

/** @param {NS} ns
 *  @param {string} type
 *  @param {any} data
 *  @param {string} host
 *  @param {string} file
 */
async function solveContract(type, data, ns, host, file) {
	if (typeToScript[type]) {
		let pid = ns.run(typeToScript[type], 1, JSON.stringify({ "host": host, "file": file, "data": data }));
		while (ns.ps().find(pi => pi.pid == pid)) {
			await ns.asleep(5000);
		}
	} else if (typeToScript[type] == null) {
		ns.print("Recognised but not yet solvable: " + JSON.stringify({ "host": host, "file": file, "type": type }));
	} else {
		ns.tprint("Unknown type: " + JSON.stringify({ "host": host, "file": file, "type": type }));
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