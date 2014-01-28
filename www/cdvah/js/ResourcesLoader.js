(function() {
    'use strict';

    /* global myApp */
    myApp.factory('ResourcesLoader', ['$q', '$window', function($q, $window) {
        var rootDir;

        function initialiseFileSystem() {
            var d = $q.defer();
            $window.resolveLocalFileSystemURL('file:///', function(entry) {
                rootDir = entry;
                d.resolve(entry);
            }, d.reject);
            return d.promise;
        }

        //promise returns full path to downloaded file
        function downloadFromUrl(url, fullFilePath) {
            var deferred = $q.defer();

            var downloadFail = function(error) {
                var str = 'There was an error while downloading the file ' + JSON.stringify(error);
                deferred.reject(new Error(str));
            };

            var downloadSuccess = function(fileEntry) {
                deferred.resolve(fileEntry.fullPath);
            };

            var fileTransfer = new $window.FileTransfer();
            fileTransfer.download(url, fullFilePath, downloadSuccess, downloadFail);
            return deferred.promise;
        }

        function trim(str) {
            return str && str.replace(/^\s+|\s+$/g, '');
        }

        function fixFilePath(path) {
            if(path && path.indexOf('file://') === 0) {
                path = path.substring('file://'.length);
            }
            return path;
        }

        function getScheme(uri){
            var ret = uri.match(/^[a-z0-9+.-]+(?=:)/);
            if(!ret){
                return;
            }
            return ret[0];
        }

        //promise returns the directory entry
        function getDirectoryEntry(directoryName) {
            var deferred = $q.defer();

            var errorWhileGettingDirectoryEntry = function(error) {
                var str = 'There was an error while getting the directory entry for directory ' + directoryName + ' ' + JSON.stringify(error);
                deferred.reject(new Error(str));
            };
            var success = function(directoryEntry) {
                deferred.resolve(directoryEntry);
            };
            rootDir.getDirectory(directoryName, {create: true, exclusive: false}, success, errorWhileGettingDirectoryEntry);
            return deferred.promise;
        }

        //promise returns the file entry
        function getFileEntry(fileName, createFlag) {
            var deferred = $q.defer();

            var errorWhileGettingFileEntry = function(error) {
                var str = 'There was an error while getting the file entry for file ' + fileName + ' ' + JSON.stringify(error);
                deferred.reject(new Error(str));
            };
            var success = function(fileEntry) {
                deferred.resolve(fileEntry);
            };
            // !! - ensures a boolean value
            rootDir.getFile(fixFilePath(fileName), {create: !!createFlag, exclusive: false}, success, errorWhileGettingFileEntry);
            return deferred.promise;
        }

        //promise returns the file
        function getFile(fileName) {
            return getFileEntry(fileName, true  /* create */).
            then(function(fileEntry){
                var deferred = $q.defer();

                var errorWhileGettingFile = function(error) {
                    var str = 'There was an error while getting the file for file ' + fileName + ' ' + JSON.stringify(error);
                    deferred.reject(new Error(str));
                };

                fileEntry.file(deferred.resolve, errorWhileGettingFile);
                return deferred.promise;
            });
        }

        function truncateToDirectoryPath(path) {
            return path.replace(/\/[^\/]+$/, '/');
        }

        function getPathSegments(path){
            //truncate leading and trailing slashes
            if(path.charAt(0) === '/'){
                path = path.substring(1);
            }
            if(path.charAt(path.length - 1) === '/'){
                path = path.substring(0, path.length - 1);
            }
            var segments = path.split('/');
            return segments;
        }

        function ensureSingleDirectoryExists(directory){
            var deferred = $q.defer();

            var gotDirEntry = function(dirEntry) {
                deferred.resolve(dirEntry.fullPath);
            };

            var failedToGetDirEntry = function(error) {
                var str = 'There was an error checking the directory: ' + directory + ' ' + JSON.stringify(error);
                deferred.reject(new Error(str));
            };

            rootDir.getDirectory(directory, {create: true, exclusive: false}, gotDirEntry, failedToGetDirEntry);
            return deferred.promise;
        }

        function ensureDirectoryExists(directory){
            directory = truncateToDirectoryPath(directory);
            directory = fixFilePath(directory);
            var segments = getPathSegments(directory);
            var currentDir = directory.charAt(0) === '/'? '/' : '';
            var promiseArr = [];
            while(segments.length !== 0) {
                currentDir +=  segments.shift() + '/';
                promiseArr.push(ensureSingleDirectoryExists(currentDir));
            }
            return $q.all(promiseArr)
            .then(function(paths){
                return paths[paths.length - 1];
            });
        }

        function writeToFile(fileName, contents, append) {
            return getFileEntry(fileName, true)
            .then(function(fileEntry){
                var deferred = $q.defer();

                var errorGettingFileWriter = function(error) {
                    var str = 'There was an error writing the file.' + JSON.stringify(error);
                    deferred.reject(new Error(str));
                };

                var gotFileWriter = function(writer) {
                    writer.onwrite = deferred.resolve;
                    writer.onerror = function(evt) {
                        deferred.reject(new Error(evt));
                    };
                    if(append){
                        writer.seek(writer.length);
                    }
                    writer.write(contents);
                };
                fileEntry.createWriter(gotFileWriter, errorGettingFileWriter);
                return deferred.promise;
            });
        }

        function xhrGet(url){
            var deferred = $q.defer();
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if(xhr.status === 200 || xhr.status === 0) {
                        deferred.resolve(xhr);
                    } else {
                        deferred.reject(new Error('XHR return status: ' + xhr.status + ' for url: ' + url));
                    }
                }
            };
            xhr.open('GET', url, true);
            xhr.send();
            return deferred.promise;
        }

        return {
            doesFileExist : function(fileName){
                return initialiseFileSystem()
                .then(function(){
                    return getFileEntry(fileName, false /* create */);
                })
                .then(function(){
                    return true;
                }, function(){
                    return false;
                });
            },

            // returns a promise with a full path to the dir
            ensureDirectoryExists : function(directory) {
                return initialiseFileSystem()
                .then(function(){
                    return ensureDirectoryExists(directory);
                });
            },

            // returns a promise with a full path to the downloaded file
            downloadFromUrl : downloadFromUrl,

            //returns a promise with the contents of the file
            readFileContents : function(fileName) {
                var scheme = getScheme(fileName);
                // assume file scheme by default
                if (!scheme || scheme === 'file') {
                    return initialiseFileSystem()
                    .then(function(){
                        return getFile(fileName);
                    })
                    .then(function(file){
                        var deferred = $q.defer();

                        var reader = new $window.FileReader();
                        reader.onload = function(evt) {
                            var text = evt.target.result;
                            deferred.resolve(text);
                        };
                        reader.onerror = function(evt) {
                            deferred.reject(new Error(evt));
                        };
                        reader.readAsText(file);

                        return deferred.promise;
                    });
                } else if(scheme === 'http' || scheme === 'https') {
                    return xhrGet(fileName)
                    .then(function(xhr){
                        return xhr.responseText;
                    });
                }
                throw new Error('Cannot read file ' + fileName);
            },

            //returns a promise with the json contents of the file
            readJSONFileContents : function(fileName) {
                return this.readFileContents(fileName)
                .then(function (text) {
                    text = trim(text);
                    var resultJson = {};
                    if(text) {
                        resultJson = JSON.parse(text);
                    }
                    return resultJson;
                });
            },

            //returns a promise when file is written
            writeFileContents : function(fileName, contents) {
                return initialiseFileSystem()
                .then(function(){
                    var scheme = getScheme(fileName);
                    // assume file scheme by default
                    if(!scheme || scheme === 'file') {
                        return writeToFile(fileName, contents, false /* append */);
                    } else {
                        throw new Error('Cannot write to ' + fileName);
                    }
                });
            },

            //returns a promise when file is appended
            appendFileContents : function(fileName, contents) {
                return initialiseFileSystem()
                .then(function(){
                    return writeToFile(fileName, contents, true /* append */);
                });
            },

            deleteDirectory : function(directoryName) {
                return initialiseFileSystem()
                .then(function(){
                    return getDirectoryEntry(directoryName);
                })
                .then(function(dirEntry){
                    var deferred = $q.defer();
                    var failedToDeleteDirectory = function(error) {
                        var str = 'There was an error deleting the directory: ' + directoryName + ' ' + JSON.stringify(error);
                        deferred.reject(new Error(str));
                    };
                    dirEntry.removeRecursively(deferred.resolve, failedToDeleteDirectory);
                    return deferred.promise;
                });
            },

            extractZipFile : function(fileName, outputDirectory){
                return initialiseFileSystem()
                .then(function(){
                    return ensureDirectoryExists(outputDirectory);
                })
                .then(function(){
                    var deferred = $q.defer();

                    var onZipDone = function(returnCode) {
                        if(returnCode !== 0) {
                            deferred.reject(new Error('Failed to unzip! Bad URL?'));
                        } else {
                            deferred.resolve();
                        }
                    };

                    /* global zip */
                    zip.unzip(fileName, outputDirectory, onZipDone);
                    return deferred.promise;
                });
            },

            xhrGet : xhrGet
        };
    }]);

})();
