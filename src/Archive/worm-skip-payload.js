let allKnownServers = [];

/** @param {string} lockFileName
    @param {string[]} hostNames 
    @param {NS} ns
    @returns {{
    host: string;
    ram: number;
    ports: number;
    root: boolean;
    claimed: boolean;
    }[]} simpleServerInfo**/
function getBasicServerInfo(lockFileName, hostNames, ns) {
    return hostNames.map(hostname => {
        let info = {
            "host": hostname,
            "ram": (ns.getServerMaxRam(hostname)),
            "ports": ns.getServerNumPortsRequired(hostname),
            "root": ns.hasRootAccess(hostname),
            "claimed": ns.ls(hostname).find(f => f == lockFileName) != undefined
        };
        console.log(info);
        return info;
    });
}

/** @param {NS} ns **/
export async function main(ns) {
    const lockFileName = "LOCK.txt";
    let scriptName = ns.getScriptName();
    let payload = ns.args[0];

    if (payload == undefined) {
        console.log("Payload undefined");
        ns.print("Payload undefined");
        return;
    }

    let payloadArgs = ns.args.slice(1).map(v => {
        console.log("Payload Arg: ", v);
        return v.toString();
    });
    let payloadSize = ns.getScriptRam(payload);

    console.log("Payload Args: ", payloadArgs);
    console.log("Payload size: ", payloadSize);

    let currentHost = ns.getHostname();

    console.log("Running from: ", currentHost);

    let connectable = ns.scan();
    let wormCost = ns.getScriptRam(scriptName);

    await ns.write(lockFileName, "", "w");

    let serverInfo = getBasicServerInfo(lockFileName, connectable, ns);

    /** @param {{
    host: string;
    ram: number;
    ports: number;
    root: boolean;
    claimed: boolean;
    }} server **/
    let connectionFilterFunc = (server) => server.ram >= wormCost &&
        !(server.claimed) &&
        !(ns.scriptRunning(scriptName, server.host));

    let toConnectable = serverInfo.filter(server => connectionFilterFunc(server));

    let deadChecked = [];
    let skipOver = serverInfo.filter(s => !toConnectable.includes(s));
    while (skipOver.length > 0) {
        let so = skipOver.pop();
        deadChecked.push(so.host);
        let furtherConnectable = getBasicServerInfo(lockFileName, ns.scan(so.host), ns);
        console.log("Further Connectable: ", furtherConnectable);
        let toConnectAdds = furtherConnectable.filter(s => !toConnectable.includes(s) && connectionFilterFunc(s));
        console.log("ToConnectAdds: ", toConnectAdds);
        toConnectable = toConnectable.concat(toConnectAdds);
        skipOver = skipOver.concat(furtherConnectable.filter(s => !toConnectable.includes(s) && !skipOver.includes(s) && !(deadChecked.includes(s.host))));
        console.log("Skip Over: ", skipOver);
    }

    console.log("Attempting to connect to: ", toConnectable);

    if (toConnectable.length == 0) {
        console.log("Could not find any suitable from: ", currentHost);
    }

    for (const toConnect of toConnectable) {
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

        await ns.scp(scriptName, toConnect.host);
        await ns.scp(payload, toConnect.host);

        ns.killall(toConnect.host);
        let numThreads = 1;

        ns.print("Num threads: " + numThreads);

        let pid = await ns.exec(scriptName, toConnect.host, numThreads, ...(ns.args));

        await ns.sleep(2500);

        ns.print("PID: " + pid);

        if (pid == 0) {
            console.log("Unable to start script on: " + toConnect.host);
        }
    }

    let payloadThreads = Math.floor(ns.getServerMaxRam(currentHost) / payloadSize);

    ns.spawn(payload, payloadThreads, ...payloadArgs);
}