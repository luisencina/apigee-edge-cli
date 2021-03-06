const fs = require("fs-plus");
const SwaggerParser = require('swagger-parser');
const fromXML = require("from-xml").fromXML;
const Table = require('cli-table2');
const _ = require("lodash");
const Command = require("../classes/core/Command");
const FlowDrawer = require("../classes/drawer/Flow.js");
const TagFactory = require("../classes/xml/TagFactory");
const APIProxyHelper = require("../classes/core/helpers/APIProxy");
const TargetEndpointHelper = require("../classes/core/helpers/TargetEndpoint");
const Autocomplete = require("../classes/core/helpers/Autocomplete");
const Prompt = require("../classes/core/ui/Prompt");

class TargetEndpoint {
	static injectCommand(vorpal) {
		vorpal
		.command('targetEndpoint open <targetEndpointName>', 'Open the TargetEndpoint file')
		.autocomplete(Autocomplete.getTargetEndpoints())
		.action(async (args, callback) => {
			try {
				if(APIProxyHelper.existsTargetEndpoint(args.targetEndpointName)) await Command.openFile(`./${global.actualRevision}/apiproxy/targets/${args.targetEndpointName}.xml`);
				else throw `TargetEndpoint ${args.targetEndpointName} doesn't exists!!`;
			} catch(e) {
				global.output.error(e);
			} finally {
				callback();
			}
		});

		vorpal
		.command('targetEndpoint info <targetEndpointName>', 'Details of a TargetEndpoint')
		.autocomplete(Autocomplete.getTargetEndpoints())
		.action((args, callback) => {
			try {
				let targetEndpointHelper = new TargetEndpointHelper(args.targetEndpointName);
				var rows = [];

				rows.push(["Name", targetEndpointHelper.getName()]);
				rows.push(["FaultRules", targetEndpointHelper.getFaultRulesNames().join()]);
				rows.push(["PreFlow Request", targetEndpointHelper.getPreFlowRequestStepNames().join()]);
				rows.push(["PreFlow Response", targetEndpointHelper.getPreFlowResponseStepNames().join()]);
				rows.push(["PostFlow Request", targetEndpointHelper.getPostFlowRequestStepNames().join()]);
				rows.push(["PostFlow Response", targetEndpointHelper.getPostFlowResponseStepNames().join()]);
				rows.push(["Flows", targetEndpointHelper.getFlowsNames().join()]);
					
				Command.showHeaderApiproxy();
				Command.showTable([], [30, 70], rows)
			} catch(e) {
				global.output.error(e);
			} finally {
				callback();	
			}
		});

		vorpal
		.command('targetEndpoint list <targetEndpointName>', 'Details of a TargetEndpoint')
		.autocomplete(Autocomplete.getTargetEndpoints())
		.action((args, callback) => {
			try {
				let targetEndpointHelper = new TargetEndpointHelper(args.targetEndpointName);
				let flows = targetEndpointHelper.getFlows();
				let rows = [];

				for(let index in flows) {
					rows.push([Command.analizeVerbInCondition(flows[index].condition), Command.analizePathInCondition(flows[index].condition), flows[index].name]);
				}
					
				Command.showHeaderApiproxy();
				Command.showTable([], [30, 30, 40], rows);
			} catch(e) {
				global.output.error(e);
			} finally {
				callback();	
			}
		});

		vorpal
		.command('targetEndpoint preflow <targetEndpointName>', 'Show preflow graph')
		.autocomplete(Autocomplete.getTargetEndpoints())
		.action((args, callback) => {
			try {
				let targetEndpointHelper = new TargetEndpointHelper(args.targetEndpointName);

				global.output.log(FlowDrawer.draw("request", targetEndpointHelper.getPreFlowRequestStep()));
				global.output.log(FlowDrawer.draw("response", targetEndpointHelper.getPreFlowResponseStep()));
	    	} catch(e) {
	    		global.output.error(e);
	    	} finally {
	    		callback();
			}
		});

		vorpal
		.command('targetEndpoint postflow <targetEndpointName>', 'Show postflow graph')
		.autocomplete(Autocomplete.getTargetEndpoints())
		.action((args, callback) => {
			try {
				let targetEndpointHelper = new TargetEndpointHelper(args.targetEndpointName);

				global.output.log(FlowDrawer.draw("request", targetEndpointHelper.getPostFlowRequestStep()));
				global.output.log(FlowDrawer.draw("response", targetEndpointHelper.getPostFlowResponseStep()));
			} catch(e) {
				global.output.error(e);
			} finally {
				callback();
			}	
		});

		vorpal
		.command('targetEndpoint create <targetEndpointName>', 'Create a new Target Endpoint')
		.action(async (args, callback) => {
			try {
				if(APIProxyHelper.existsTargetEndpoint(args.targetEndpointName)) {
					global.output.error("TargetEndpoint exists!!");
				} else {
					let nodeFiles = fs.listSync(`./${global.actualRevision}/apiproxy/resources/node/`, ["js"]);
					nodeFiles.unshift("< new js file >");

					let prompt = new Prompt();
					prompt.list('type', 'Select type:', ['HTTPTargetConnection', 'ScriptTarget', 'LocalTargetConnection']);
					prompt.input('url', 'Enter the url:', {when: (answer) => answer.type == "HTTPTargetConnection"});
					prompt.list('script', 'Select your script:', nodeFiles,  {when: (answer) => answer.type === "ScriptTarget" && nodeFiles.length > 1});
					prompt.input('newScript', 'Enter the new script', {when: (answer) => answer.type === "ScriptTarget" && (nodeFiles.length == 1 || answer.script == "< new js file >")});
					prompt.list('localTargetType', 'Select type:', ['Path', 'Apiproxy\'s name'], {when: (answer) => answer.type === "LocalTargetConnection"});
					prompt.input('apiProxyName', 'Enter the Apiproxy\'s name:', {when: (answer) => answer.type === "LocalTargetConnection" && answer.localTargetType == 'Apiproxy\'s name'});
					prompt.input('proxyEndpointName', 'Enter the ProxyEndpoint\'s name:', {when: (answer) => answer.type === "LocalTargetConnection" && answer.localTargetType == "Apiproxy\'s name"});
					prompt.input('path', 'Enter the path:', {when: (answer) => answer.type === "LocalTargetConnection" && answer.localTargetType == "Apiproxy\'s name"});

					let result = await prompt.show();

					let targetEndpoint = new TagFactory("TargetEndpoint");
					if(result.type === "HTTPTargetConnection") {
						targetEndpoint.createEmptyWithHTTPTargetConnection(args.targetEndpointName, result.url);
					} else if(result.type === "ScriptTarget") {
						if(result.script == "< new js file >") {
							fs.writeFileSync(`./${global.actualRevision}/apiproxy/resources/node/${result.newScript}.js`, "", { encoding: 'utf8'});
							targetEndpoint.createEmptyWithScriptTarget(args.targetEndpointName, result.newScript);
						} else {
							targetEndpoint.createEmptyWithScriptTarget(args.targetEndpointName, result.script);
						}
					} else if(result.type === "LocalTargetConnection") {
						targetEndpoint.createEmptyLocalTargetConnection(args.targetEndpointName, {path: result.path, apiproxy: result.apiProxyName, proxyEndpoint: result.proxyEndpointName});
					}

					if(!_.has(global.prefs, 'live.validation') && !global.prefs.live.validation) APIProxyHelper.addTargetEndpoint(args.proxyEndpointName);
					
					fs.writeFileSync(`./${global.actualRevision}/apiproxy/targets/${args.targetEndpointName}.xml`, targetEndpoint.toXml(), { encoding: 'utf8'});

					global.output.success(`TargetEndpoint ${args.targetEndpointName} was created.`);
				}
			} catch(e) {
				global.output.error(e);
			} finally {
				callback();
			}
		});

		vorpal
		.command('targetEndpoint move <targetEndpointName>', 'Move flow\'s position')
		.autocomplete(Autocomplete.getProxyEndpoints())
		.action(async (args, callback) => {
			try {
				let targetEndpointHelper = new TargetEndpointHelper(args.targetEndpointName);
				let choices = targetEndpointHelper.getFlowsNames();
				if(choices.length < 2) throw `In Proxy Endpoint ${args.targetEndpointName} may be 2 or more flows`;

				let choicesFun = (result) => {
					if(result !== null && result.to_move) _.remove(choices, (o) => o == result.to_move);
					return choices;
				};

				let prompt = new Prompt();
				prompt.list('to_move', 'Select a flow to move:', choicesFun);
				prompt.selectLine('index', 'Select the order', choicesFun, {placeholder: "MOVE HERE"});

				let result = await prompt.show();

				targetEndpointHelper.moveFlow(result.to_move, result.index);

				global.output.success(`In ProxyEndpoint ${args.targetEndpointName} the flow ${result.to_move} was moved to ${result.index} position `);
			} catch(e) {
				global.output.error(e);
			} finally {
				callback();	
			}
		});
	}
}

module.exports = TargetEndpoint;