const targetLevel = 200;
const targetRam = 64;
const targetCores = 16;

/** @param {NodeStats} nodeStats 
 * @param {NS} ns 
 * @returns {bool} */
function nodeComplete(nodeStats, ns) {
	return nodeStats.level >= targetLevel && nodeStats.ram >= targetRam && nodeStats.cores >= targetCores;
}

/** @param {NS} ns
 *  @returns {number}
 */
function getMoney(ns) {
	return ns.getServerMoneyAvailable("home");
}

/** @param {NS} ns **/
export async function main(ns) {

	let nodes = Array.from({ length: ns.hacknet.numNodes() }, (x, i) => {
		return ns.hacknet.getNodeStats(i);
	});
	while (nodes.length == 0 || !(nodes.every(n => nodeComplete(n, ns)))) {
		let changeMade = false;


		while (ns.hacknet.getPurchaseNodeCost() <= getMoney(ns) && ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
			let newServer = ns.hacknet.purchaseNode();
			if (newServer >= 0) {
				nodes[newServer] = ns.hacknet.getNodeStats(newServer);
				changeMade = true;
			}
		}

		for (const index in nodes) {
			if (nodeComplete(nodes[index], ns)) {
				continue;
			}

			if (ns.hacknet.getLevelUpgradeCost(index, 1) <= getMoney(ns) && nodes[index].level < targetLevel) {
				ns.hacknet.upgradeLevel(index, 1);
				nodes[index] = ns.hacknet.getNodeStats(index);
				ns.print(nodes[index]);
				changeMade = true;
				continue;
			}

			if (ns.hacknet.getRamUpgradeCost(index, 1) <= getMoney(ns) && nodes[index].ram < targetRam) {
				ns.hacknet.upgradeRam(index, 1);
				nodes[index] = ns.hacknet.getNodeStats(index);
				ns.print(nodes[index]);
				changeMade = true;
				continue;
			}

			if (ns.hacknet.getCoreUpgradeCost(index, 1) <= getMoney(ns) && nodes[index].cores < targetCores) {
				ns.hacknet.upgradeCore(index, 1);
				nodes[index] = ns.hacknet.getNodeStats(index);
				ns.print(nodes[index]);
				changeMade = true;
				continue;
			}
		}

		if (!changeMade) {
			await ns.sleep(60000);
		} else {
			await ns.sleep(50);
			console.log("Changes made");
		}
	}
}