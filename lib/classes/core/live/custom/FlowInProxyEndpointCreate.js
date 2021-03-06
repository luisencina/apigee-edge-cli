const fs = require("fs-plus");
const rimraf = require("rimraf");
const fromXML = require("from-xml").fromXML;
const toXML = require("to-xml").toXML;
const _ = require("lodash");

class FlowInProxyEndpointCreate {

	constructor(vorpal, nameFlow, nameProxyEndpoint, index, content) {
		this._vorpal = vorpal;
		this._index = index;
		this._nameFlow = nameFlow;
		this._nameProxyEndpoint = nameProxyEndpoint;
		this._content = content;
	}

	static process(vorpal, nameFlow, nameProxyEndpoint, index, content) {
		let me = new FlowInProxyEndpointCreate(vorpal, nameFlow, nameProxyEndpoint, index, content);
		me.process();
	}

	process() {
		let proxyEndpointContent = fs.readFileSync(`./${global.actualRevision}/apiproxy/proxies/${this._nameProxyEndpoint}.xml`, 'utf8');
		let json = fromXML(proxyEndpointContent);
		
		let flowIndex = _.indexOf(json.ProxyEndpoint.Flows.Flow, (item) => item['@name'] == this._nameFlow);

		if(this._index != flowIndex) {
			let aux = _.remove(json.ProxyEndpoint.Flows.Flow, (item) => item['@name'] == this._nameFlow);
			json.ProxyEndpoint.Flows.Flow.splice(this._index, 0, aux[0]);
			flowIndex = this._index;
		}

		if(flowIndex !== -1) {
			let newFlow = fromXML(this._content);
			if(JSON.stringify(json.ProxyEndpoint.Flows.Flow[flowIndex]) !== JSON.stringify(newFlow.Flow) && this.validation(newFlow)) {
				json.ProxyEndpoint.Flows.Flow[flowIndex] = newFlow.Flow;

				fs.writeFileSync(`./${global.actualRevision}/apiproxy/proxies/${this._nameProxyEndpoint}.xml`, toXML(json, null, 2), { encoding: 'utf8'});
				this._vorpal.ui.imprint();
				this._vorpal.log(global.chalk.green(`'${this._nameFlow}' in '${this._nameProxyEndpoint}' was saved in './${global.actualRevision}/apiproxy/proxies/${this._nameProxyEndpoint}.xml' file !`));	
			}
		}
	}

	validation(json) {
		
		let policiesFiles = fs.listSync(`./${global.actualRevision}/apiproxy/policies/`, ["xml"]);
		if(_.has(json, 'Flow.Request.Step')) {
			if(_.isArray(json.Flow.Request.Step)) {
				let policiesWrited = json.Flow.Request.Step.map((item) => `${global.actualRevision}/apiproxy/policies/${item.Name}.xml`);
				for(let index in policiesWrited) {
					if(policiesFiles.indexOf(policiesWrited[index]) === -1) {
						this._vorpal.ui.imprint();
						this._vorpal.log(global.chalk.red(`${json.Flow.Request.Step[index].Name} policy doesn't exists!`));
						return false;
					}
				}
			} else if(_.isObject(json.Flow.Request.Step)) {
				let policiesWrited = `${global.actualRevision}/apiproxy/policies/${json.Flow.Request.Step.Name}.xml`;

				if(policiesFiles.indexOf(policiesWrited) === -1) {
					this._vorpal.ui.imprint();
					this._vorpal.log(global.chalk.red(`${json.Flow.Request.Step.Name} policy doesn't exists!`));
					return false;
				}
			}
		}

		if(_.has(json, 'Flow.Response.Step')) {
			if(_.isArray(json.Flow.Response.Step)) {
				let policiesWrited = json.Flow.Response.Step.map((item) => `${global.actualRevision}/apiproxy/policies/${item.Name}.xml`);
				for(let index in policiesWrited) {
					if(policiesFiles.indexOf(policiesWrited[index]) === -1) {
						this._vorpal.ui.imprint();
						this._vorpal.log(global.chalk.red(`${json.Flow.Response.Step[index].Name} policy doesn't exists!`));
						return false;
					}
				}
			} else if(_.isObject(json.Flow.Response.Step)) {
				let policiesWrited = `${global.actualRevision}/apiproxy/policies/${json.Flow.Response.Step.Name}.xml`;

				if(policiesFiles.indexOf(policiesWrited) === -1) {
					this._vorpal.ui.imprint();
					this._vorpal.log(global.chalk.red(`${json.Flow.Response.Step.Name} policy doesn't exists!`));
					return false;
				}
			}
		}

		return true;
	}
}

module.exports = FlowInProxyEndpointCreate;