#!/usr/bin/env node
/**
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
 */

var nopt = require('nopt');
var HarnessClient = require('cordova-harness-client');

function parseArgs(argv) {
    var opts = {
        'help': Boolean,
        'target': String
    };
    var ret = nopt(opts, null, argv);
    if (!ret.target) {
        ret.target = 'localhost:2424';
    }
    return ret;
}

function usage() {
    console.log('Usage: harness-push push path/to/app --target=IP_ADDRESS:PORT');
    console.log('Usage: harness-push menu');
    console.log('Usage: harness-push eval "alert(1)"');
    console.log('Usage: harness-push info');
    console.log('Usage: harness-push launch [appId]');
    console.log('Usage: harness-push assetmanifest [appId]');
    console.log('Usage: harness-push delete appId');
    console.log('Usage: harness-push deleteall');
    console.log();
    console.log('--target defaults to localhost:2424');
    console.log('    To deploy to Android over USB: adb forward tcp:2424 tcp:2424');
    console.log('        "adb" comes with the Android SDK');
    console.log('    To deploy to iOS over USB: python tcprelay.py 2424:2424');
    console.log('        "tcprelay.py" is available from https://github.com/chid/tcprelay');
    process.exit(1);
}

function main() {
    var args = parseArgs(process.argv);

    function onFailure(err) {
        console.error(err);
    }
    function onSuccess(result) {
        if (typeof result.body == 'object') {
            console.log(JSON.stringify(result.body, null, 4));
        } else if (result.body) {
            console.log(result.body);
        }
    }

    var client = new HarnessClient(args.target);

    var cmd = args.argv.remain[0];
    if (cmd == 'push') {
        if (!args.argv.remain[1]) {
            usage();
        }
        var pushSession = client.createPushSession(args.argv.remain[1]);
        pushSession.push().then(onSuccess, onFailure);
    } else if (cmd == 'deleteall') {
        client.deleteAllApps();
    } else if (cmd == 'delete') {
        if (!args.argv.remain[1]) {
            usage();
        }
        client.deleteApp().then(onSuccess, onFailure);
    } else if (cmd == 'menu') {
        client.menu().then(onSuccess, onFailure);
    } else if (cmd == 'eval') {
        if (!args.argv.remain[1]) {
            usage();
        }
        client.evalJs(args.argv.remain[1]).then(onSuccess, onFailure);
    } else if (cmd == 'assetmanifest') {
        client.assetmanifest(args.appid).then(onSuccess, onFailure);
    } else if (cmd == 'info') {
        client.info().then(onSuccess, onFailure);
    } else if (cmd == 'launch') {
        client.launch(args.argv.remain[1]).then(onSuccess, onFailure);
    } else {
        usage();
    }
}

if (require.main === module) {
    main();
}
