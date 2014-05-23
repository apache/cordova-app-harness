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

        function DirectoryManager() {}

        DirectoryManager.prototype.init = function(rootURL) {
            this.rootURL = rootURL;
            this.onFileAdded = null;
            this._assetManifest = null;
            this._assetManifestEtag = null;
            this._flushTimerId = null;
            var deferred = $q.defer();
            var me = this;
            ResourcesLoader.readJSONFileContents(rootURL + ASSET_MANIFEST)
            .then(function(json) {
                me._assetManifest = json['assetManifest'];
                me._assetManifestEtag = json['etag'];
                deferred.resolve();
            }, function() {
                me._assetManifest = {};
                me._assetManifestEtag = 0;
                deferred.resolve();
            });
            return deferred.promise;
        };

        DirectoryManager.prototype.deleteAll = function() {
            this._assetManifest = null;
            this._assetManifestEtag = null;
            window.clearTimeout(this._flushTimerId);
            return ResourcesLoader.delete(this.rootURL);
        };

        DirectoryManager.prototype.getAssetManifest = function() {
            return this._assetManifest;
        };

        DirectoryManager.prototype.getAssetEtag = function(relativePath) {
            if (this._assetManifest.hasOwnProperty(relativePath)) {
                return this._assetManifest[relativePath];
            }
        };

        DirectoryManager.prototype.getAssetManifestEtag = function() {
            return (this._assetManifestEtag).toString(36).toUpperCase();
        };

        DirectoryManager.prototype._lazyWriteAssetManifest = function() {
            if (this._flushTimerId === null) {
                this._flushTimerId = window.setTimeout(this._writeAssetManifest.bind(this), 1000);
            }
        };

        DirectoryManager.prototype._updateManifest = function(relativePath, etag) {
            if (etag !== null) {
                this._assetManifest[relativePath] = etag;
            } else {
                delete this._assetManifest[relativePath];
            }
            this._assetManifestEtag = Math.floor(Math.random() * 0xFFFFFFFF);
            this._lazyWriteAssetManifest();
            if (etag !== null && this.onFileAdded) {
                return this.onFileAdded(relativePath, etag);
            }
        };

        DirectoryManager.prototype._writeAssetManifest = function() {
            this._flushTimerId = null;
            var stringContents = JSON.stringify({
                'assetManifest': this._assetManifest,
                'etag': this._assetManifestEtag
            });
            return ResourcesLoader.writeFileContents(this.rootURL + ASSET_MANIFEST, stringContents);
        };

        DirectoryManager.prototype.addFile = function(srcURL, relativePath, etag) {
            var self = this;
            return ResourcesLoader.moveFile(srcURL, this.rootURL + relativePath)
            .then(function() {
                return self._updateManifest(relativePath, etag);
            });
        };

        DirectoryManager.prototype.writeFile = function(data, relativePath, etag) {
            var self = this;
            return ResourcesLoader.writeFileContents(this.rootURL + relativePath, data)
            .then(function() {
                return self._updateManifest(relativePath, etag);
            });
        };

        DirectoryManager.prototype.deleteFile = function(relativePath) {
            if (!this._assetManifest[relativePath]) {
                console.warn('Tried to delete non-existing file: ' + relativePath);
            } else {
                this._updateManifest(relativePath, null);
                return ResourcesLoader.delete(this.rootURL + relativePath);
            }
        };

        return DirectoryManager;
    }]);

})();

