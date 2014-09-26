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
/* global myApp */
(function() {
    'use strict';

    myApp.factory('ResourcesLoader', ['$q', '$window', '$http', 'TEMP_DIR', function($q, $window, $http, TEMP_DIR) {
        function resolveURL(url) {
            var d = $q.defer();
            $window.resolveLocalFileSystemURL(url, d.resolve, d.reject);
            return d.promise;
        }

        // promise returns URL of downloaded file
        function fileTransferDownload(from, to) {
            var urlutil = cordova.require('cordova/urlutil');
            from = urlutil.makeAbsolute(from);
            var deferred = $q.defer();

            function downloadSuccess(fileEntry) {
                deferred.resolve(fileEntry.toURL());
            }
            function fail() {
                deferred.reject(new Error('Failed to download file: ' + from));
            }

            var fileTransfer = new $window.FileTransfer();
            fileTransfer.download(from, to, downloadSuccess, fail);
            return deferred.promise;
        }

        function getFilePromisified(entry, path, opts) {
            var deferred = $q.defer();
            entry.getFile(path, opts, deferred.resolve, deferred.reject);
            return deferred.promise;
        }

        function getDirectoryPromisified(entry, path, opts) {
            var deferred = $q.defer();
            entry.getDirectory(path, opts, deferred.resolve, deferred.reject);
            return deferred.promise;
        }

        function dirName(path) {
            return path.replace(/\/[^\/]+\/?$/, '/');
        }

        function baseName(path) {
            return path.replace(/\/$/, '').replace(/.*\//, '');
        }

        function ensureDirectoryExists(targetUrl) {
            function helper(url) {
                return resolveURL(url)
                .then(null, function() {
                    var parentUrl = dirName(url);
                    if (parentUrl == url) {
                        throw new Error('No root filesystem for: ' + targetUrl);
                    }
                    return helper(parentUrl)
                    .then(function(entry) {
                        return getDirectoryPromisified(entry, baseName(url), {create: true});
                    });
                });
            }
            return helper(targetUrl);
        }

        function createFileWriter(url, append) {
            var rootUrl = dirName(url);
            return ensureDirectoryExists(rootUrl)
            .then(function(dirEntry) {
                var path = decodeURI(baseName(url));
                return getFilePromisified(dirEntry, path, {create: true});
            }).then(function(fileEntry) {
                var deferred = $q.defer();
                function gotWriter(writer) {
                    if (!append && writer.length > 0) {
                        writer.onwrite = function() {
                            if (writer.length === 0) {
                                writer.onwriteend = null;
                                writer.onerror = null;
                                deferred.resolve(writer);
                            }
                        };
                        writer.onerror = deferred.reject;
                        writer.truncate(0);
                    } else {
                        deferred.resolve(writer);
                    }
                }
                fileEntry.createWriter(gotWriter, deferred.reject);
                return deferred.promise;
            });
        }

        function writeToFile(url, contents, append) {
            return createFileWriter(url, append)
            .then(function(writer) {
                var deferred = $q.defer();
                writer.onwrite = deferred.resolve;
                writer.onerror = deferred.reject;
                writer.write(contents);
                return deferred.promise;
            });
        }

        var ResourcesLoader = {
            createTmpFileUrl: function(extension) {
                return TEMP_DIR + Math.floor(Math.random()* 100000000) + (extension || '');
            },

            doesFileExist: function(url){
                return resolveURL(url).then(function() { return true; }, function() { return false; });
            },

            // returns a promise with a full path to the downloaded file
            downloadFromUrl: function(from, to) {
                return ensureDirectoryExists(dirName(to))
                .then(function() {
                    return fileTransferDownload(from, to);
                });
            },

            //returns a promise with the contents of the file
            readFileContents: function(url) {
                return ResourcesLoader.xhrGet(url);
            },

            //returns a promise with the json contents of the file
            readJSONFileContents: function(url) {
                return ResourcesLoader.xhrGet(url, true);
            },

            xhrGet: function(url, json) {
                var opts = json ? null : {transformResponse: []};
                return $http.get(url, opts)
                .then(function(response, status) {
                    if (!response) {
                        throw new Error('Got ' + status + ' when fetching ' + url);
                    }
                    return response.data;
                });
            },

            createFileWriter: createFileWriter,

            writeFileContents: function(url, contents) {
                return writeToFile(url, contents, false /* append */);
            },

            appendFileContents: function(url, contents) {
                return writeToFile(url, contents, true /* append */);
            },

            copy: function(fromUrl, toUrl) {
                return resolveURL(fromUrl)
                .then(function(fromEntry) {
                    return ensureDirectoryExists(dirName(toUrl))
                    .then(function(destEntry) {
                        var deferred = $q.defer();
                        fromEntry.copyTo(destEntry, baseName(toUrl), deferred.resolve, deferred.reject);
                        return deferred.promise;
                    });
                });
            },

            moveFile: function(fromUrl, toUrl) {
                return resolveURL(fromUrl)
                .then(function(fromEntry) {
                    return ensureDirectoryExists(dirName(toUrl))
                    .then(function(destEntry) {
                        var deferred = $q.defer();
                        fromEntry.moveTo(destEntry, baseName(toUrl), deferred.resolve, deferred.reject);
                        return deferred.promise;
                    });
                });
            },

            delete: function(url) {
                return resolveURL(url)
                .then(function(entry) {
                    var deferred = $q.defer();
                    if (entry.removeRecursively) {
                        entry.removeRecursively(deferred.resolve, function(error) {
                            deferred.reject(new Error('There was an error deleting directory: ' + url + ' ' + JSON.stringify(error)));
                        });
                    } else {
                        entry.remove(deferred.resolve, function(error) {
                            deferred.reject(new Error('There was an error deleting file: ' + url + ' ' + JSON.stringify(error)));
                        });
                    }
                    return deferred.promise;
                }, function() {});
            },

            extractZipFile: function(zipUrl, outputDirectory) {
                return ensureDirectoryExists(outputDirectory)
                .then(function(){
                    var deferred = $q.defer();

                    var onZipDone = function(returnCode) {
                        if (returnCode !== 0) {
                            deferred.reject(new Error('Failed to unzip! Bad URL?'));
                        } else {
                            deferred.resolve();
                        }
                    };

                    var onZipProgress = function(progressEvent) {
                        var unzipPercentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        deferred.notify(unzipPercentage);
                    };

                    /* global zip */
                    zip.unzip(zipUrl, outputDirectory, onZipDone, onZipProgress);
                    return deferred.promise;
                });
            }
        };
        return ResourcesLoader;
    }]);
})();
