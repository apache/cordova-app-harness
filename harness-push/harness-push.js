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

var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    url = require('url'),
    Q = require('q'),
    request = require('request'),
    nopt = require('nopt'),
    shelljs = require('shelljs');

// Takes a Node-style callback: function(err).
exports.push = function(target, dir, pretend) {
  var appId;
  var appType = 'cordova';
  var configXmlPath = path.join(dir, 'config.xml');
  dir = path.join(dir, 'www');
  if (!fs.existsSync(configXmlPath)) {
    configXmlPath = path.join(dir, 'config.xml');
  }
  if (!fs.existsSync(configXmlPath)) {
    throw new Error('Not a Cordova project.');
  }
  var configData = fs.readFileSync(configXmlPath, { encoding: 'utf-8' });
  var m = /\bid="(.*?)"/.exec(configData);
  appId = m && m[1];

  // ToDo - Add ability to bootstrap with a zip file.
  return doFileSync(target, appId, appType, configXmlPath, dir, pretend);
}

function calculateMd5(fileName) {
    var BUF_LENGTH = 64*1024,
        buf = new Buffer(BUF_LENGTH),
        bytesRead = BUF_LENGTH,
        pos = 0,
        fdr = fs.openSync(fileName, 'r');

    try {
        var md5sum = crypto.createHash('md5');
        while (bytesRead === BUF_LENGTH) {
            bytesRead = fs.readSync(fdr, buf, 0, BUF_LENGTH, pos);
            pos += bytesRead;
            md5sum.update(buf.slice(0, bytesRead));
        }
    } finally {
        fs.closeSync(fdr);
    }
    return md5sum.digest('hex');
}

function buildAssetManifest(configXmlPath, dir) {
  var fileList = shelljs.find(dir).filter(function(a) {
    return !fs.statSync(a).isDirectory();
  });

  var ret = Object.create(null);
  for (var i = 0; i < fileList.length; ++i) {
    // TODO: convert windows slash to unix slash here.
    var appPath = 'www' + fileList[i].slice(dir.length);
    ret[appPath] = {
        path: appPath,
        realPath: fileList[i],
        etag: calculateMd5(fileList[i]),
    };
  }
  if (configXmlPath && path.dirname(configXmlPath) != dir) {
    ret['config.xml'] = {
        path: 'config.xml',
        realPath: configXmlPath,
        etag: calculateMd5(configXmlPath)
    };
  }
  return ret;
}

function buildDeleteList(existingAssetManifest, newAssetManifest) {
  var toDelete = [];
  for (var k in existingAssetManifest) {
    // Don't delete top-level files ever.
    if (k.slice(0, 4) != 'www/') {
      continue;
    }
    if (!newAssetManifest[k]) {
      toDelete.push(k);
    }
  }
  return toDelete;
}

function buildPushList(existingAssetManifest, newAssetManifest) {
  var ret = [];
  for (var k in newAssetManifest) {
    var entry = newAssetManifest[k];
    if (entry.etag != existingAssetManifest[k]) {
      if (entry.path == 'config.xml' || entry.path == 'www/config.xml') {
        ret.unshift(entry);
      } else {
        ret.push(entry);
      }
    }
  }
  return ret;
}

function calculatePushBytes(pushList) {
  var ret = 0;
  for (var i = 0; i < pushList.length; ++i) {
    ret += fs.statSync(pushList[i].realPath).size;
  }
  return ret;
}

function doFileSync(target, appId, appType, configXmlPath, dir, pretend) {
  return exports.assetmanifest(target, appId)
  .then(function(result) {
    var existingAssetManifest = result.body['assetManifest'] || {};
    var newAssetManifest = buildAssetManifest(configXmlPath, dir);
    var deleteList = buildDeleteList(existingAssetManifest, newAssetManifest);
    var pushList = buildPushList(existingAssetManifest, newAssetManifest);
    var totalPushBytes = calculatePushBytes(pushList);
    if (pretend) {
      console.log('AppId=' + appId);
      console.log('Would delete: ' + JSON.stringify(deleteList));
      console.log('Would upload: ' + JSON.stringify(pushList));
      console.log('Upload bytes: ' + totalPushBytes);
    } else if (deleteList.length === 0 && pushList.length === 0) {
      console.log('Application already up-to-date.');
    } else {
      return doRequest('POST', target, 'prepupdate', { appId: appId, appType: appType, json: {'transferSize': totalPushBytes}})
      .then(function() {
        if (deleteList.length > 0) {
          return doRequest('POST', target, 'deletefiles', { appId: appId, appType: appType, json: {'paths': deleteList}})
        }
      })
      .then(function pushNextFile() {
        if (pushList.length === 0) {
          console.log('Push complete.');
          return;
        }
        var curPushEntry = pushList.shift();
        return doRequest('PUT', target, '/putfile', {
          appId: appId,
          appType: appType,
          body: fs.readFileSync(curPushEntry.realPath),
          query: {
            path: curPushEntry.path,
            etag: curPushEntry.etag
          }
        }).then(pushNextFile);
      });
    }
  });
}

function doRequest(method, target, action, options) {
  var ret = Q.defer();
  var targetParts = target.split(':');
  var host = targetParts[0];
  var port = +(targetParts[1] || 2424);
  options = options || {};

  var queryParams = {};
  if (options.query) {
    Object.keys(options.query).forEach(function(k) {
      queryParams[k] = options.query[k];
    });
  }
  if (options.appId) {
    queryParams['appId'] = options.appId;
  }
  if (options.appType) {
    queryParams['appType'] = options.appType;
  }

  // Send the HTTP request. crxContents is a Node Buffer, which is the payload.
  // Prepare the form data for upload.
  var uri = url.format({
    protocol: 'http',
    hostname: host,
    port: port,
    pathname: action,
    query: queryParams
  });

  process.stdout.write(method + ' ' + uri);

  var headers = {};
  if (options.json) {
    options.body = JSON.stringify(options.json);
    headers['Content-Type'] = 'application/json';
  }

  function statusCheck(err, res, body) {
    if (err) {
      err.statusCode = res && res.statusCode;
    } else if (res) {
      process.stdout.write(' ==> ' + (res && res.statusCode) + '\n');
      if (res.statusCode != 200) {
        err = new Error('Server returned status code: ' + res.statusCode);
      } else if (options.expectJson) {
        try {
          body = JSON.parse(body);
        } catch (e) {
          err = new Error('Invalid JSON: ' + body.slice(500));
        }
      }
    }
    if (err) {
      ret.reject(err);
    } else {
      ret.resolve({res:res, body:body});
    }
  }
  var req = request({
    uri: uri,
    headers: headers,
    method: method,
    body: options.body
  }, statusCheck);

  if (options.form) {
    var f = options.form;
    req.form().append(f.key, f.formBody, { filename: f.filename, contentType: f.contentType });
  }
  return ret.promise;
};

exports.info = function(target) {
  return doRequest('GET', target, '/info', { expectJson: true });
};

exports.assetmanifest = function(target, appId) {
  return doRequest('GET', target, '/assetmanifest', {expectJson: true, appId: appId});
};

exports.menu = function(target) {
  return doRequest('POST', target, '/menu');
};

exports.eval = function(target, someJs) {
  return doRequest('POST', target, '/exec', { query: {code: someJs} });
};

exports.launch = function(target, appId) {
  return doRequest('POST', target, '/launch', { appId: appId});
};

exports.deleteAllApps = function(target) {
  return doRequest('POST', target, '/deleteapp', { query: {'all': 1} });
};

exports.deleteApp = function(target, appId) {
  return doRequest('POST', target, '/deleteApp', { appId: appId});
};

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
  console.log('Usage: harness-push push path/to/chrome_app --target=IP_ADDRESS:PORT');
  console.log('Usage: harness-push menu');
  console.log('Usage: harness-push eval "alert(1)"');
  console.log('Usage: harness-push info');
  console.log('Usage: harness-push launch [appId]');
  console.log();
  console.log('--target defaults to localhost:2424');
  console.log('To deploy to Android over USB, use: adb forward tcp:2424 tcp:2424');
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

  var cmd = args.argv.remain[0];
  if (cmd == 'push') {
    if (!args.argv.remain[1]) {
      usage();
    }
    exports.push(args.target, args.argv.remain[1], args.pretend).then(onSuccess, onFailure);
  } else if (cmd == 'deleteall') {
    exports.deleteAllApps(args.target);
  } else if (cmd == 'delete') {
    if (!args.argv.remain[1]) {
      usage();
    }
    exports.deleteApp(args.target).then(onSuccess, onFailure);
  } else if (cmd == 'menu') {
    exports.menu(args.target).then(onSuccess, onFailure);
  } else if (cmd == 'eval') {
    if (!args.argv.remain[1]) {
      usage();
    }
    exports.eval(args.target, args.argv.remain[1]).then(onSuccess, onFailure);
  } else if (cmd == 'assetmanifest') {
    exports.assetmanifest(args.target, args.appid).then(onSuccess, onFailure);
  } else if (cmd == 'info') {
    exports.info(args.target).then(onSuccess, onFailure);
  } else if (cmd == 'launch') {
    exports.launch(args.target, args.argv.remain[1]).then(onSuccess, onFailure);
  } else {
    usage();
  }
}

if (require.main === module) {
  main();
}
