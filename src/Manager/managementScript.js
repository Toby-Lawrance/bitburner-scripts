const hackScript = "/Manager/min-hack.js";
const weakenScript = "/Manager/min-weaken.js";
const growScript = "/Manager/min-grow.js";
const breakScript = "/Manager/breakServer.js";

/** @param {NS} ns */
function disableLogs(ns) {
    ns.disableLog("ALL");
}

/** @param {NS} ns **/
export async function main(ns) {

    disableLogs(ns);

    let memory = getAllServerHostNames(ns.getHostname(), ns)
        .map(h => getServerInfo(h, ns))
        .filter(s => s.host != ns.getHostname() &&
            (s.ports <= portsHackable(ns) || s.root) &&
            s.maxRam >= ns.getScriptRam(hackScript) &&
            s.maxRam >= ns.getScriptRam(growScript) &&
            s.maxRam >= ns.getScriptRam(weakenScript));

    for (const index in memory) {
        let s = memory[index];
        if (!s.root) {
            ns.run(breakScript, 1, s.host);
            await waitForScript(breakScript, ns);
        }
        memory[index] = updateServerInfo(s, ns);
    }

    while (true) {
        let target = determineTarget(ns);

        while (!ns.hasRootAccess(target.host)) {
            ns.run(breakScript, 1, target.host);
            await waitForScript(breakScript, ns);
            target = determineTarget(ns);
        }

        ns.print(target);

        memory = await allocateWork(target, memory, ns);

        memory = memory.map(s => updateServerInfo(s, ns));
        console.log("Memory: ", memory);

        let allNewPotentials = getAllServerHostNames(ns.getHostname(), ns)
            .filter(h => !(memory.map(s => s.host).includes(h)))
            .map(h => getServerInfo(h, ns))
            .filter(s => s.host != ns.getHostname() &&
                (s.ports <= portsHackable(ns) || s.root) &&
                s.maxRam >= ns.getScriptRam(hackScript) &&
                s.maxRam >= ns.getScriptRam(growScript) &&
                s.maxRam >= ns.getScriptRam(weakenScript));

        if (allNewPotentials.length > 0) {
            memory = memory.concat(allNewPotentials);
            for (const index in memory) {
                let s = memory[index];
                if (!s.root) {
                    ns.run(breakScript, 1, s.host);
                    await waitForScript(breakScript, ns);
                }
                memory[index] = updateServerInfo(s, ns);
            }
            ns.print("Added some new servers: " + JSON.stringify(allNewPotentials));
        }


        await ns.asleep(30000);
    }

}

/**
 * @param {NS} ns
 * @returns string
 */
function determineTarget(ns) {
    let allHosts = getAllServerHostNames(ns.getHostname(), ns);
    let allServers = allHosts.map(h => getServerInfo(h, ns));
    let hackable = allServers
        .filter(s => s.host != "home" && !s.host.startsWith("pserv"))
        .filter(s => s.hackLevel <= ns.getHackingLevel() &&
            s.ports <= portsHackable(ns))
        .sort((a, b) => b.maxMoney - a.maxMoney);

    return hackable[0];
}

function portsHackable(ns) {
    const hackingTools = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
    let result = hackingTools.map(f => ns.fileExists(f, "home") ? 1 : 0).reduce((acc, v) => acc += v, 0);
    return result;
}


/**
 *  @param {NS} ns
 *  @param {{
    host: string;
    maxRam: number;
    availableRam: number;
    money: number;
    security: number;
    minSecurity: number;
    moneyPercent: number;
    hackLevel: number;
    ports: number;
    root: boolean;
    }} target
    @param {{
        "host":string;
        "task":string;
        "pid":number;
        "target":string;
        }[]} memory
    @returns {{
        "host":string;
        "task":string;
        "pid":number;
        "target":string;
        }}
 */
async function allocateWork(target, memory, ns) {
    const weakenTask = "weaken";
    const growTask = "grow";
    const hackTask = "hack";

    for (const index in memory) {
        let s = memory[index];

        if (target.security > target.minSecurity + 5) {
            if (s.target == target.host &&
                s.task == weakenTask &&
                ns.ps(s.host).find(pi => pi.pid == s.pid)) {
                continue;
            } else {
                ns.print("New Task Weakening: " + s.host);
                let pid = await deployScript(weakenScript, s, ns, [target.host]);
                if (pid == 0) {
                    ns.tprint("Failed to create script on: " + s.host);
                }
                memory[index].target = target.host;
                memory[index].task = weakenTask;
                memory[index].pid = pid;
            }
        } else if (target.moneyPercent < 50) {
            if (s.target == target.host &&
                s.task == growTask &&
                ns.ps(s.host).find(pi => pi.pid == s.pid)) {
                continue;
            } else {
                ns.print("New Task Growing: " + s.host);
                let pid = await deployScript(growScript, s, ns, [target.host]);
                if (pid == 0) {
                    ns.tprint("Failed to create script on: " + s.host);
                }
                memory[index].target = target.host;
                memory[index].task = growTask;
                memory[index].pid = pid;
            }
        } else {
            if (s.target == target.host &&
                s.task == hackTask &&
                ns.ps(s.host).find(pi => pi.pid == s.pid)) {
                continue;
            } else {
                ns.print("New Task Hacking: " + s.host);
                let pid = await deployScript(hackScript, s, ns, [target.host]);
                if (pid == 0) {
                    ns.tprint("Failed to create script on: " + s.host);
                }
                memory[index].target = target.host;
                memory[index].task = hackTask;
                memory[index].pid = pid;
            }
        }
    }

    return memory;
}

/**
 * @param {{
 * host: string;
 * availableRam: number;
 * maxRam: number;
 * }} server 
 * @param {NS} ns 
 * @returns {number}
*/
function determineThreadsToCompleteTask(server, ns) {
    let s = ns.getServer(server.host);
    let percent = ns.formulas.hacking.growPercent(s, getNumThreads(server, growScript, ns), ns.getPlayer(), s.cpuCores);
}

/**
 * @param {string} script
 * @param {{
    host: string;
    availableRam: number;
    maxRam: number;}} server
 * @param {NS} ns
 * @param {string[]} args
 * @returns {number} PID
 */
async function deployScript(script, server, ns, args) {
    if (!ns.fileExists(script, server.host)) {
        await ns.scp(script, ns.getHostname(), server.host);
    }
    ns.killall(server.host);
    let numThreads = getNumThreads(server, script, ns);
    return ns.exec(script, server.host, Math.max(numThreads, 1), ...args);
}

async function waitForScript(script, ns) {
    while (ns.scriptRunning(script, ns.getHostname())) {
        await ns.sleep(1000);
    }
}

/**
 * @param {{
    availableRam: number;
    maxRam: number;
    }} server
    @param {string} scriptName
    @param {NS} ns
    @returns number
 */
function getNumThreads(server, scriptName, ns) {
    let scriptRam = ns.getScriptRam(scriptName, "home");
    if (Number.isNaN(scriptRam) || scriptRam <= 0) {
        console.log("scriptRam was: ", scriptRam, " for ", scriptName);
        scriptRam = 5;
    }

    return Math.max(Math.floor(server.maxRam / scriptRam), 1);
}

/** @param {string} hostname 
    @param {NS} ns
    @returns {{
    host: string;
    maxRam: number;
    availableRam: number;
    maxMoney: number;
    money: number;
    security: number;
    minSecurity: number;
    moneyPercent: number;
    hackLevel: number;
    ports: number;
    root: boolean;
    }} simpleServerInfo**/
function getServerInfo(hostname, ns) {
    let info = {
        "host": hostname,
        "maxRam": (ns.getServerMaxRam(hostname)),
        "availableRam": (ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)),
        "maxMoney": (ns.getServerMaxMoney(hostname)),
        "money": (ns.getServerMoneyAvailable(hostname)),
        "security": (ns.getServerSecurityLevel(hostname)),
        "minSecurity": (ns.getServerMinSecurityLevel(hostname)),
        "moneyPercent": (ns.getServerMoneyAvailable(hostname) / ns.getServerMaxMoney(hostname)) * 100,
        "hackLevel": ns.getServerRequiredHackingLevel(hostname),
        "ports": ns.getServerNumPortsRequired(hostname),
        "root": ns.hasRootAccess(hostname),
    };
    return info;
}

function updateServerInfo(server, ns) {
    let currentInfo = getServerInfo(server.host, ns);
    server.maxRam = currentInfo.maxRam;
    server.availableRam = currentInfo.availableRam;
    server.maxMoney = currentInfo.maxMoney;
    server.money = currentInfo.money;
    server.security = currentInfo.security;
    server.minSecurity = currentInfo.minSecurity
    server.moneyPercent = currentInfo.moneyPercent;
    server.hackLevel = currentInfo.hackLevel;
    server.ports = currentInfo.ports;
    server.root = currentInfo.root;

    return server;
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