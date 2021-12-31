class Host {
	/** @param {string} hostname
	 *  @param {NS} ns
	*/
	constructor(hostname, ns) {
		this.host = hostname;
	}

	/** @type {number} */
	get maxRam() {
		return ns.getServerMaxRam(this.host);
	}

	/** @type {number} */
	get availableRam() {
		return (ns.getServerMaxRam(this.host) - ns.getServerUsedRam(this.host));
	}

	/** @type {number} */
	get maxMoney() {
		return ns.getServerMaxMoney(this.host);
	}

	/** @type {number} */
	get money() {
		return ns.getServerMoneyAvailable(this.host);
	}

	/** @type {number} */
	get security() {
		return ns.getServerSecurityLevel(this.host);
	}

	/** @type {number} */
	get minSecurity() {
		return ns.getServerMinSecurityLevel(this.host);
	}

	/** @type {number} */
	get moneyPercent() {
		return (ns.getServerMoneyAvailable(this.host) / ns.getServerMaxMoney(this.host)) * 100;
	}

	/** @type {number} */
	get hackLevel() {
		return ns.getServerRequiredHackingLevel(this.host);
	}

	/** @type {number} */
	get ports() {
		return ns.getServerNumPortsRequired(this.host);
	}

	/** @type {boolean} */
	get root() {
		return ns.hasRootAccess(this.host);
	}

}