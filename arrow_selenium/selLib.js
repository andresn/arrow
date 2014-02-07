/*jslint forin:true sub:true anon:true, sloppy:true, stupid:true nomen:true, node:true continue:true*/
/*
 * Copyright (c) 2014, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var fs = require("fs");
var nopt = require("nopt");
var util = require("util");
var log4js = require("log4js");

var Properties = require("../lib/util/properties");
var ArrowSetup = require('../lib/util/arrowsetup');

var WdSession = require("../lib/session/wdsession");
var CapabilityManager = require("../lib/util/capabilitymanager");

var wd = require("../lib/util/wd-wrapper");
var logger = log4js.getLogger("selLib");

function SelLib(config, argv) {
    this.config = config;
    this.argv = argv;
    this.hub = new WdSession(config);
}

/**
 *
 * @param sessionCaps
 */
SelLib.prototype.describeSessions = function (sessionCaps) {
    console.log(sessionCaps);
};

/**
 *
 * @param sessionCap
 */
SelLib.prototype.describeSession = function (sessionCap) {
    console.log(sessionCap);
};

/**
 *
 * @param error
 * @param next
 * @param arrSessions
 */
SelLib.prototype.listSessions = function (error, next, arrSessions) {

    var sessionCaps = [],
        sessionCount = 0,
        i,
        sessionId,
        webdriver,
        self = this,
        errMsg;

    if (error !== null) {
        errMsg = "Unable to connect to a Selenium session.  Download the selenium server JAR from http://code.google.com/p/selenium/downloads/list," +
            " start it with: \"java -jar path/to/jar/selenium-server-standalone-<VERSION>.jar\" " +
            "Create a browser session on http://127.0.0.1:4444/wd/hub or with \"arrow_server --open=<browser_name>\"\n";
        logger.fatal(errMsg);
        return;
    }

    if (0 === arrSessions.length) {
        next(sessionCaps, self.config, self.argv);
    }

    function onSessionCap(val) {
        sessionCaps[val.get("browserName")] = val.toJSON();
        sessionCount += 1;
        if (sessionCount === arrSessions.length) {
            next(sessionCaps, self.config, self.argv);
        }
    }

    for (i = 0; i < arrSessions.length; i += 1) {
        sessionId = arrSessions[i];

        webdriver = new wd.Builder().
            usingServer(self.config["seleniumHost"]).
            usingSession(sessionId).
            build();

        webdriver.getCapabilities().then(function(val) {
            onSessionCap(val);
        });

    }

};

/**
 *
 * @param sessionCaps
 * @param config
 * @param argv
 */
SelLib.prototype.openBrowser = function (sessionCaps, config, argv) {
    var
        self = this,
        browsers = argv.open,
        browserList = browsers.split(","),
        webdriver,
        browser,
        i,
        cm,
        capabilities,
        caps;

    for (i = 0; i < browserList.length; i += 1) {

        browser = browserList[i];
        if (0 === browser.length) { continue; }

        logger.info("Opening browser: " + browser);
        if (sessionCaps.hasOwnProperty(browser)) {
            logger.info("Already open, ignored");
            continue;
        }

        //When user has passed capabilities.json
        if (argv.capabilities) {

            caps = {
                "platform": "ANY",
                "javascriptEnabled": true,
                "seleniumProtocol": "WebDriver"
            };

            caps.browserName = argv.open;
            if (!caps.browserName) {
                logger.error("No Browser is specified");
                process.exit(1);
            }

            cm = new CapabilityManager();
            capabilities = cm.getCapability(argv.capabilities, caps.browserName);
            if (capabilities === null) {
                logger.error("No related capability for " + caps.browserName + " in " + argv.capabilities);
                process.exit(1);
            }

        } else {
            capabilities = {
                "browserName": browser,
                "version": "",
                "platform": "ANY",
                "javascriptEnabled": true
            };
        }

        webdriver = new wd.Builder().
            usingServer(config["seleniumHost"]).
            withCapabilities(capabilities).build();
        webdriver.session_.then(self.describeSession);
    }

};

/**
 *
 */
SelLib.prototype.listHelp = function () {

    console.info("\nCommandline Options :" + "\n" +
        "--list : Lists all selenium browser sessions" + "\n" +
        "--open=<browser1[, browser2]> : Comma seperated list of browsers to launch" + "\n" +
        "--open=<browser> : browser to choose from capabilities.json" + " --capabilities= path to capabilities.json" + "\n" +
        "--close : Close all selenium controller browser sessions" + "\n\n" +
        "Examples:\n" +
        "Open Firefox and Chrome browser instances:\n" +
        "arrow_selenium --open=firefox,chrome\n"  +
        "Open Firefox with given capabilities:\n" +
        "arrow_selenium --open=firefox --capabilities=./cap.json\n"
        );
};

/**
 *
 */
SelLib.prototype.seleniumSessionSetup = function () {

    var self = this,
        i,
        sessionId;

    if (self.argv.list || self.argv.ls) {
        self.hub.getSessions(function (error, arrSessions) {
            self.listSessions(error, self.describeSessions, arrSessions);
        }, false);

    } else if (self.argv.open) {
        self.hub.getSessions(function (error, arrSessions) {
            self.listSessions(error, self.openBrowser, arrSessions);
        }, true);

    } else if (self.argv.close) {

        self.hub.getSessions(function (error, arrSessions) {

            if (arrSessions) {
                logger.info("Found " + arrSessions.length + " Browsers.");
                for (i = 0; i < arrSessions.length; i += 1) {
                    sessionId = arrSessions[i];
                    logger.info("Killing Session ID :" + sessionId);
                    var webdriver  = new wd.Builder().
                        usingServer(self.config["seleniumHost"]).
                        usingSession(sessionId).
                        build();

                    webdriver.quit();
                }
            }
        });

    } else if (self.argv.help) {
        self.listHelp();
    } else {
        self.listHelp();
    }


};

module.exports = SelLib;