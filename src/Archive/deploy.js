/** @param {string[]} hostNames 
    @param {NS} ns
    @returns {{
    host: string;
    ram: number;
    ports: number;
    root: boolean;
    }[]} simpleServerInfo**/
function getBasicServerInfo(hostNames, ns) {
    return hostNames.map(hostname => {
        let info = {
            "host": hostname,
            "ram": (ns.getServerMaxRam(hostname)),
            "ports": ns.getServerNumPortsRequired(hostname),
            "root": ns.hasRootAccess(hostname),
        };
        return info;
    });
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

/** @param {NS} ns **/
export async function main(ns) {
    let target = ns.args[0];
    let scriptName = ns.getScriptName();
    let payload = ns.args[1];

    if (payload == undefined) {
        console.log("Payload undefined");
        ns.print("Payload undefined");
        return;
    }

    let payloadArgs = ns.args.slice(2).map(v => {
        console.log("Payload Arg: ", v);
        return v.toString();
    });
    let payloadSize = ns.getScriptRam(payload);

    console.log("Payload Args: ", payloadArgs);
    console.log("Payload size: ", payloadSize);

    console.log("All server: ", allServers);

    let serverInfo = getBasicServerInfo([target], ns);

    let toConnect = serverInfo[0];

    if (toConnect === undefined) {
        continue;
    }

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
            continue;
        }
    }

    await ns.scp(payload, toConnect.host);

    ns.killall(toConnect.host);
    let payloadThreads = Math.floor(ns.getServerMaxRam(toConnect.host) / payloadSize);
    let pid = await ns.exec(payload, toConnect.host, payloadThreads, ...payloadArgs);

    ns.print("PID: " + pid);

    if (pid == 0) {
        console.log("Unable to start script on: " + toConnect.host);
    } else {
        console.log("Deployed: ", payload, " on ", toConnect.host, " PID: ", pid);
    }
}