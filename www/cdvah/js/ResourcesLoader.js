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

        return {
            createTmpFileUrl: function(extension) {
                return TEMP_DIR + Math.floor(Math.random()* 100000000) + (extension || '');
            },

            doesFileExist: function(url){
                return resolveURL(url).then(function() { return true; }, function() { return false; });
            },

            toNativeURL: function(url){
                return resolveURL(url).then(function(e) { return e.toNativeURL(); });
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
                return this.xhrGet(url);
            },

            //returns a promise with the json contents of the file
            readJSONFileContents: function(url) {
                return this.xhrGet(url, true);
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

            moveFile: function(fromUrl, toUrl) {
                return resolveURL(fromUrl)
                .then(function(fromEntry) {
                    return ensureDirectoryExists(dirName(toUrl))
                    .then(function(destEntry) {
                        var deferred = $q.defer();
                        fromEntry.moveTo(destEntry, baseName(toUrl), deferred.reslove, deferred.reject);
                        return deferred;
                    });
                });
            },

            deleteDirectory: function(url) {
                return resolveURL(url)
                .then(function(dirEntry) {
                    var deferred = $q.defer();
                    dirEntry.removeRecursively(deferred.resolve, function(error) {
                        deferred.reject(new Error('There was an error deleting the directory: ' + url + ' ' + JSON.stringify(error)));
                    });
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

                    /* global zip */
                    zip.unzip(zipUrl, outputDirectory, onZipDone);
                    return deferred.promise;
                });
            }
        };
    }]);
})();
