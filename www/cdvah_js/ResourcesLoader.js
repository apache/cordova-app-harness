(function() {
    "use strict";

    /* global myApp */
    myApp.factory("ResourcesLoader", [ "$window", function ($window) {
        var fs;
        var initialised = false;

        function initialiseFileSystem() {
            var deferred = Q.defer();

            if(!initialised) {

                var failedFileSystemLookUp = function (error) {
                    var errorString = "An error occurred while reading the file system.";
                    if(error) {
                        errorString += " " + JSON.stringify(error);
                    }
                    deferred.reject(new Error(errorString));
                };

                var success = function(_fs) {
                    fs = _fs;
                    initialised = true;
                    deferred.resolve(fs);
                };

                try {
                    $window.requestFileSystem($window.LocalFileSystem.PERSISTENT, 0, success, failedFileSystemLookUp);
                } catch (e) {
                    failedFileSystemLookUp(e);
                }
            } else {
                deferred.resolve(fs);
            }

            return deferred.promise;
        }

        //promise returns full path to downloaded file
        function downloadFromUrl(url, fullFilePath) {
            var deferred = Q.defer();

            try {
                var downloadFail = function(error) {
                    var str = "There was an error while downloading the file " + JSON.stringify(error);
                    deferred.reject(new Error(str));
                };

                var downloadSuccess = function(fileEntry) {
                    deferred.resolve(fileEntry.fullPath);
                };

                var fileTransfer = new $window.FileTransfer();
                var uri = encodeURI(url);
                fileTransfer.download(uri, fullFilePath, downloadSuccess, downloadFail);
            } catch(e) {
                deferred.reject(new Error(e));
            } finally {
                return deferred.promise;
            }
        }

        function trim(str) {
            return str && str.replace(/^\s+|\s+$/g, "");
        }

        function fixFilePath(path) {
            if(path && path.indexOf("file://") === 0) {
                path = path.substring("file://".length);
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
            var deferred = Q.defer();

            try {
                var errorWhileGettingDirectoryEntry = function(error) {
                    var str = "There was an error while getting the directory entry for directory " + directoryName + " " + JSON.stringify(error);
                    deferred.reject(new Error(str));
                };
                var success = function(directoryEntry) {
                    deferred.resolve(directoryEntry);
                };
                fs.root.getDirectory(directoryName, {create: true, exclusive: false}, success, errorWhileGettingDirectoryEntry);
            } catch(e) {
                deferred.reject(new Error(e));
            } finally {
                return deferred.promise;
            }
        }

        //promise returns the file entry
        function getFileEntry(fileName, createFlag) {
            var deferred = Q.defer();

            try {
                var errorWhileGettingFileEntry = function(error) {
                    var str = "There was an error while getting the file entry for file " + fileName + " " + JSON.stringify(error);
                    deferred.reject(new Error(str));
                };
                var success = function(fileEntry) {
                    deferred.resolve(fileEntry);
                };
                // !! - ensures a boolean value
                fs.root.getFile(fixFilePath(fileName), {create: !!createFlag, exclusive: false}, success, errorWhileGettingFileEntry);
            } catch(e) {
                deferred.reject(new Error(e));
            } finally {
                return deferred.promise;
            }
        }

        //promise returns the file
        function getFile(fileName) {
            return getFileEntry(fileName, true  /* create */).
            then(function(fileEntry){
                var deferred = Q.defer();

                try {
                    var errorWhileGettingFile = function(error) {
                        var str = "There was an error while getting the file for file " + fileName + " " + JSON.stringify(error);
                        deferred.reject(new Error(str));
                    };

                    fileEntry.file(deferred.resolve, errorWhileGettingFile);
                } catch(e) {
                    deferred.reject(new Error(e));
                } finally {
                    return deferred.promise;
                }
            });
        }

        function truncateToDirectoryPath(path) {
            //remove the filename if it exists
            var lastLevelIndex = path.search(/[\w ]+(\.[\w ]+)+$/g);
            if(lastLevelIndex !== -1) {
                path = path.substring(0, lastLevelIndex);
            }
            return path;
        }

        function getPathSegments(path){
            //truncate leading and trailing slashes
            if(path.charAt(0) === "/"){
                path = path.substring(1);
            }
            if(path.charAt(path.length - 1) === "/"){
                path = path.substring(0, path.length - 1);
            }
            var segments = path.split("/");
            return segments;
        }

        function ensureSingleDirectoryExists(directory){
            var deferred = Q.defer();

            var gotDirEntry = function(dirEntry) {
                deferred.resolve(dirEntry.fullPath);
            };

            var failedToGetDirEntry = function(error) {
                var str = "There was an error checking the directory: " + directory + " " + JSON.stringify(error);
                deferred.reject(new Error(str));
            };

            fs.root.getDirectory(directory, {create: true, exclusive: false}, gotDirEntry, failedToGetDirEntry);
            return deferred.promise;
        }

        function writeToFile(fileName, contents, append) {
            return getFileEntry(fileName, true)
            .then(function(fileEntry){
                var deferred = Q.defer();

                var errorGettingFileWriter = function(error) {
                    var str = "There was an error writing the file." + JSON.stringify(error);
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
            var deferred = Q.defer();
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if(xhr.status === 200) {
                        deferred.resolve(xhr);
                    } else {
                        deferred.reject("XHR return status: " + xhr.statusText);
                    }
                }
            };
            xhr.open("GET", url, true);
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
                    directory = truncateToDirectoryPath(directory);
                    directory = fixFilePath(directory);
                    var segments = getPathSegments(directory);
                    var currentDir = directory.charAt(0) === "/"? "/" : "";
                    var promiseArr = [];
                    while(segments.length !== 0) {
                        currentDir +=  segments.shift() + "/";
                        promiseArr.push(ensureSingleDirectoryExists(currentDir));
                    }
                    return Q.all(promiseArr);
                })
                .then(function(paths){
                    return paths[paths.length - 1];
                });
            },

            // promise returns full path to file
            getFullFilePath : function(filePath) {
                return initialiseFileSystem()
                .then(function(){
                    var deferred = Q.defer();

                    // Use the file's parent folder to get the full path
                    var directory = filePath;
                    var fileName = "";

                    //remove the filename if it exists
                    var lastLevelIndex = directory.search(/\/[\w ]+\.[\w ]+$/g);
                    if(lastLevelIndex !== -1) {
                        directory = filePath.substring(0, lastLevelIndex);
                        fileName = filePath.substring(lastLevelIndex + 1);
                    }

                    //we need the directory name w.r.t the root, so remove any slashes in the beginning
                    if(directory.charAt(0) === "/") {
                        directory = directory.substring(1);
                    }

                    var gotFullPath = function(dirEntry) {
                        var fullFilePath = dirEntry.fullPath + "/" + fileName;
                        deferred.resolve(fullFilePath);
                    };

                    var failedToGetFullPath = function(error) {
                        var str = "There was an error getting the full path of file: " + filePath + " " + JSON.stringify(error);
                        deferred.reject(new Error(str));
                    };

                    fs.root.getDirectory(directory, {create: true, exclusive: false}, gotFullPath, failedToGetFullPath);
                    return deferred.promise;
                });
            },

            // returns a promise with a full path to the downloaded file
            downloadFromUrl : function(url, filePath) {
                var self = this;
                return initialiseFileSystem()
                .then(function(){
                    return self.ensureDirectoryExists(filePath);
                })
                .then(function(){
                    return self.getFullFilePath(filePath);
                })
                .then(function(fullFilePath){
                    return downloadFromUrl(url, fullFilePath);
                });
            },

            //returns a promise with the contents of the file
            readFileContents : function(fileName) {
                return Q.fcall(function(){
                    var scheme = getScheme(fileName);
                    // assume file scheme by default
                    if(!scheme || scheme === "file") {
                        return initialiseFileSystem()
                        .then(function(){
                            return getFile(fileName);
                        })
                        .then(function(file){
                            var deferred = Q.defer();

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
                    } else if(scheme === "http" || scheme === "https") {
                        return xhrGet(fileName)
                        .then(function(xhr){
                            return xhr.responseText;
                        });
                    } else {
                        throw new Error("Cannot read file " + fileName);
                    }
                });
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
                    if(!scheme || scheme === "file") {
                        return writeToFile(fileName, contents, false /* append */);
                    } else {
                        throw new Error("Cannot write to " + fileName);
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

            //returns a promise when json file is written
            writeJSONFileContents : function(fileName, contents) {
                var stringContents;
                if(typeof contents === "string") {
                    stringContents = contents;
                } else {
                    stringContents = JSON.stringify(contents);
                }
                return this.writeFileContents(fileName, stringContents);
            },

            deleteDirectory : function(directoryName) {
                return initialiseFileSystem()
                .then(function(){
                    return getDirectoryEntry(directoryName);
                })
                .then(function(dirEntry){
                    var deferred = Q.defer();
                    var failedToDeleteDirectory = function(error) {
                        var str = "There was an error deleting the directory: " + directoryName + " " + JSON.stringify(error);
                        deferred.reject(new Error(str));
                    };
                    dirEntry.removeRecursively(deferred.resolve, failedToDeleteDirectory);
                    return deferred.promise;
                });
            },

            extractZipFile : function(fileName, outputDirectory){
                var deferred = Q.defer();

                //will throw an exception if the zip plugin is not loaded
                try {
                    var onZipDone = function(returnCode) {
                        if(returnCode !== 0) {
                            deferred.reject(new Error("Something went wrong during the unzipping of: " + fileName));
                        } else {
                            deferred.resolve();
                        }
                    };

                    /* global zip */
                    zip.unzip(fileName, outputDirectory, onZipDone);
                } catch(e) {
                    deferred.reject(e);
                } finally {
                    return deferred.promise;
                }
            },

            xhrGet : function(url) {
                return xhrGet(url);
            }
        };
    }]);

})();