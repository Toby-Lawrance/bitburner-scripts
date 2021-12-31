/** @param {string} hostName 
	@param {NS} ns
	@returns {{
	host: string;
	ram: number;
	ports: number;
	root: boolean;
	}} simpleServerInfo**/
function getBasicServerInfo(hostName, ns) {
	let info = {
		"host": hostName,
		"ram": (ns.getServerMaxRam(hostName)),
		"ports": ns.getServerNumPortsRequired(hostName),
		"root": ns.hasRootAccess(hostName),
	};
	return info;
}

/** @param {NS} ns **/
export async function main(ns) {
	let target = ns.args[0];

	let toConnect = getBasicServerInfo(target, ns);

	if (!(toConnect.root)) {
		let portsOpened = 0;

		if (toConnect.ports > 0) {
			if (ns.fileExists("BruteSSH.exe", "home")) {
				console.log("Bruting: ", toConnect.host);
				await ns.brutessh(toConnect.host);
				++portsOpened;
			}

			if (ns.fileExists("FTPCrack.exe", "home")) {
				console.log("FTP'ing: ", toConnect.host);
				await ns.ftpcrack(toConnect.host);
				++portsOpened;
			}

			if (ns.fileExists("relaySMTP.exe", "home")) {
				await ns.relaysmtp(toConnect.host);
				++portsOpened;
			}

			if (ns.fileExists("HTTPWorm.exe", "home")) {
				await ns.httpworm(toConnect.host);
				++portsOpened;
			}

			if (ns.fileExists("SQLInject.exe", "home")) {
				await ns.sqlinject(toConnect.host);
				++portsOpened;
			}
		}

		if (portsOpened >= toConnect.ports) {
			console.log("Attempting to nuke: ", toConnect.host);
			await ns.nuke(toConnect.host);
		} else if (!(toConnect.root)) {
			console.log("Unable to gain root");
			return;
		}
	}
}