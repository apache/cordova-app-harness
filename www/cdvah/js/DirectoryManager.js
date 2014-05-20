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
    myApp.factory('DirectoryManager', ['$q', 'ResourcesLoader', function($q, ResourcesLoader) {
        var ASSET_MANIFEST = 'assetmanifest.json';
        function DirectoryManager(rootURL) {
            this.rootURL = rootURL;
            this.lastUpdated = null;
            this._assetManifest = null;
            this._flushTimerId = null;
        }

        DirectoryManager.prototype.deleteAll = function() {
            this.lastUpdated = null;
            this._assetManifest = null;
            window.clearTimeout(this._flushTimerId);
            return ResourcesLoader.delete(this.rootURL);
        };

        DirectoryManager.prototype.getAssetManifest = function() {
            if (this._assetManifest) {
                return $q.when(this._assetManifest);
            }
            var deferred = $q.defer();
            var me = this;
            ResourcesLoader.readJSONFileContents(this.rootURL + ASSET_MANIFEST)
            .then(function(json) {
                me._assetManifest = json;
                deferred.resolve(json);
            }, function() {
                me._assetManifest = {};
                deferred.resolve({});
            });
            return deferred.promise;
        };

        DirectoryManager.prototype._lazyWriteAssetManifest = function() {
            if (this._flushTimerId === null) {
                this._flushTimerId = window.setTimeout(this._writeAssetManifest.bind(this), 1000);
            }
        };

        DirectoryManager.prototype._writeAssetManifest = function() {
            this._flushTimerId = null;
            var stringContents = JSON.stringify(this._assetManifest);
            return ResourcesLoader.writeFileContents(this.rootURL + ASSET_MANIFEST, stringContents);
        };

        DirectoryManager.prototype.addFile = function(srcURL, relativePath, etag) {
            var self = this;
            return ResourcesLoader.moveFile(srcURL, this.rootURL + relativePath)
            .then(function() {
                self._assetManifest[relativePath] = etag;
                self._lazyWriteAssetManifest();
            });
        };

        DirectoryManager.prototype.writeFile = function(data, relativePath, etag) {
            var self = this;
            return ResourcesLoader.writeFileContents(this.rootURL + relativePath, data)
            .then(function() {
                self._assetManifest[relativePath] = etag;
                self._lazyWriteAssetManifest();
            });
        };

        DirectoryManager.prototype.deleteFile = function(relativePath) {
            if (!this._assetManifest[relativePath]) {
                console.warn('Tried to delete non-existing file: ' + relativePath);
            } else {
                delete this._assetManifest[relativePath];
                this._lazyWriteAssetManifest();
                return ResourcesLoader.delete(this.rootURL + relativePath);
            }
        };

        return DirectoryManager;
    }]);

})();

