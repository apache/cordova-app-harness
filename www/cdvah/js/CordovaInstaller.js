/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/
(function(){
    'use strict';

    /* global myApp */
    myApp.factory('CordovaInstaller', ['$q', 'Installer', 'ResourcesLoader', 'PluginMetadata', function($q, Installer, ResourcesLoader, PluginMetadata) {

        function CordovaInstaller() {}
        CordovaInstaller.prototype = Object.create(Installer.prototype);
        CordovaInstaller.prototype.constructor = CordovaInstaller;
        CordovaInstaller.type = 'cordova';

        CordovaInstaller.prototype.initFromJson = function(json) {
            var self = this;
            return Installer.prototype.initFromJson.call(this, json)
            .then(function() {
                return self.readCordovaPluginsFile();
            }).then(function() {
                return self;
            }, function(e) {
                console.warn('Deleting broken app: ' + json['installPath']);
                ResourcesLoader.delete(json['installPath']);
                throw e;
            });
        };

        CordovaInstaller.prototype.onFileAdded = function(path, etag) {
            var self = this;
            return $q.when(Installer.prototype.onFileAdded.call(this, path, etag))
            .then(function() {
                if (path == 'orig-cordova_plugins.js') {
                    return self.readCordovaPluginsFile();
                }
            });
        };

        CordovaInstaller.prototype.getPluginMetadata = function() {
            return ResourcesLoader.readFileContents(this.directoryManager.rootURL + 'orig-cordova_plugins.js')
            .then(function(contents) {
                return PluginMetadata.extractPluginMetadata(contents);
            });
        };

        CordovaInstaller.prototype.readCordovaPluginsFile = function() {
            var etag = this.directoryManager.getAssetEtag('orig-cordova_plugins.js');
            return this.updateCordovaPluginsFile(etag);
        };

        return CordovaInstaller;
    }]);

    myApp.run(['CordovaInstaller', 'AppsService', function(CordovaInstaller, AppsService) {
        AppsService.registerInstallerFactory(CordovaInstaller);
    }]);
})();
