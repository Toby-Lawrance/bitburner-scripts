import * as HE from "HostExtensions.js";

const hackScript = "/Manager/min-hack.js";
const weakenScript = "/Manager/min-weaken.js";
const growScript = "/Manager/min-grow.js";
const breakScript = "/Manager/breakServer.js";

/** @param {NS} ns */
function disableLogs(ns) {
    ns.disableLog("ALL");
}

/** @param {NS} ns */
function performChecks(ns) {
    const scriptsToCheck = [hackScript, weakenScript, growScript];
    const neededScripts = scriptsToCheck.concat([breakScript]);

    let success = true;

    for (const script of neededScripts) {
        if (!ns.fileExists(script)) {
            ns.tprint("File: " + script + " is missing and needed to run");
            success = false;
        }
    }

    if (!success) {
        ns.tprint("Script missed requirements");
        ns.exit();
    }
}

/** @param {string[]} hostnames
 *  @param {NS} ns
 *  @returns {{}}
 */
function produceServers(hostnames, ns) {
    return hostnames.map(h => new HE.Host(h))
        .filter(s => s.host != ns.getHostname() &&
            (s.ports <= portsHackable(ns) || s.root) &&
            s.maxRam >= ns.getScriptRam(hackScript) ||
            s.maxRam >= ns.getScriptRam(weakenScript) ||
            s.maxRam >= ns.getScriptRam(growScript))
        .map(s => {
            s.allocations = [];
            s.maxThreads = {
                "hack": Math.floor(s.maxRam / ns.getScriptRam(hackScript)),
                "grow": Math.floor(s.maxRam / ns.getScriptRam(growScript)),
                "weaken": Math.floor(s.maxRam / ns.getScriptRam(weakenScript))
            };
            return s;
        });
}

/** @param {NS} ns **/
export async function main(ns) {

    disableLogs(ns);

    performChecks(ns);

    let memory = produceServers(getAllServerHostNames(ns.getHostname(), ns), ns);

    for (const index in memory) {
        let s = memory[index];
        if (!s.root) {
            ns.run(breakScript, 1, s.host);
            await waitForScript(breakScript, ns);
        }
        memory[index] = updateServerInfo(s, ns);
    }

    while (true) {


        let target = determineWork(1, ns);

        while (!ns.hasRootAccess(target.host)) {
            ns.run(breakScript, 1, target.host);
            await waitForScript(breakScript, ns);
            target = determineTarget(ns);
        }

        ns.print(target);

        memory = await allocateWork(target, memory, ns);

        memory = memory.map(s => updateServerInfo(s, ns));
        console.log("Memory: ", memory);

        let allNewPotentials = produceServers(getAllServerHostNames(ns.getHostname(), ns)
            .filter(h => !(memory.map(s => s.host).includes(h))));

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
 * @param {number} totalThreads
 * @param {NS} ns
 * @returns {{
 *  host: string;
 *  growThreads: number;
 *  weakenThreads: number;
 *  hackThreads: number;
 * }[]}
 */
function determineWork(totalThreads, ns) {
    let allHosts = getAllServerHostNames(ns.getHostname(), ns);
    let allServers = allHosts.map(h => getServerInfo(h, ns));
    let hackable = allServers
        .filter(s => s.host != "home" && !s.host.startsWith("pserv"))
        .filter(s => s.hackLevel <= ns.getHackingLevel() &&
            s.ports <= portsHackable(ns))
        .sort((a, b) => b.maxMoney - a.maxMoney);

    /** @type {{
 *  host: string;
 *  growThreads: number;
 *  weakenThreads: number;
 *  hackThreads: number;
 *  maxTime: number;
 * }[]} */
    let workAllocation = [];

    for (const server of hackable) {
        if (totalThreads == 0) {
            continue;
        }

        const sObj = ns.getServer(server.host);
        let growTime = ns.getGrowTime(server.host);
        let weakenTime = ns.getWeakenTime(server.host);
        let hackTime = ns.getHackTime(server.host);

        let hackThreads = Math.floor(ns.hackAnalyzeThreads(server.host, server.money));
        let growThreads = Math.floor(ns.growthAnalyze(server.host, 100 / server.moneyPercent, sObj.cpuCores));
        let weakenThreads = Math.floor((server.security - server.minSecurity + (growTime < weakenTime ? ns.growthAnalyzeSecurity(growThreads) : 0)) / 0.05);

        //Don't bother if you have a decent chance of failure
        if (ns.hackAnalyzeChance(server.host) < 0.75) {
            hackThreads = 0;
            hackTime = 0;
        }

        if (weakenThreads < totalThreads) {
            weakenThreads = totalThreads;
        }
        totalThreads -= weakenThreads;
        if (growThreads < totalThreads) {
            growThreads = totalThreads;
        }
        totalThreads -= growThreads;
        if (hackThreads < totalThreads) {
            hackThreads = totalThreads;
        }
        totalThreads -= hackThreads;

        workAllocation.push({ "host": server.host, "growThreads": growThreads, "weakenThreads": weakenThreads, "hackThreads": hackThreads, "maxTime": Math.max(hackThreads > 0 ? hackTime : 0, growThreads > 0 ? growTime : 0, weakenThreads > 0 ? weakenTime : 0) });
    }

    console.log("Work Allocations: ", workAllocation);

    return workAllocation;
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