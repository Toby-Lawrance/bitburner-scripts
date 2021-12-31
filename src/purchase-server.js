/** @param {NS} ns **/
export async function main(ns) {
	var ram = ns.args.length > 0 ? parseInt(ns.args[0]) : 8;
	var scriptToRun = ns.args.length > 1 ? ns.args[1] : "early-hack-template.ns";
	var scriptArguments = ns.args.length > 2 ? ns.args.slice(2).join(" ") : "n00dles";

	console.log("RAM: ", ram);
	console.log("Script: ", scriptToRun);
	console.log("Script Arguments: ", scriptArguments);

	let scriptRamCost = ns.getScriptRam(scriptToRun);

	console.log("Script RAM cost: ", scriptRamCost);

	let existingServers = ns.getPurchasedServers();

	console.log("Owned Servers: ", existingServers);

	for (const host of existingServers) {
		console.log("Attempting to get the script on the existing server: ", host);
		ns.killall(host);
		let serverRam = ns.getServerMaxRam(host);
		await ns.scp(scriptToRun, host);
		await ns.exec(scriptToRun, host, Math.floor(serverRam / scriptRamCost), scriptArguments);
	}

	var i = existingServers.length;

	while (i < ns.getPurchasedServerLimit()) {
		if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram)) {
			var hostname = await ns.purchaseServer("pserv-" + i, ram);
			await ns.scp(scriptToRun, hostname);
			await ns.exec(scriptToRun, hostname, Math.floor(ram / scriptRamCost), scriptArguments);
			++i;
		}
		await ns.sleep(5000);
	}
}