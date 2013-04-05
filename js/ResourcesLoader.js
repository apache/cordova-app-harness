(function() {
    "use strict";
    function ResourcesLoader() {
        var fs;
        var initialised = false;

        function initialise() {
            initialised = true;

            var failedFileSystemLookUp = function (error) {
                var errorString = "An error occurred while reading the file system.";
                if(error) {
                    errorString += " " + JSON.stringify(error);
                }
                console.error(errorString);
            };

            var success = function(_fs) {
                fs = _fs;
            };

            try {
                /* global LocalFileSystem */
                window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, success, failedFileSystemLookUp);
            } catch (e) {
                failedFileSystemLookUp(e);
            }
        }

        function ensureDirectoryExists(directory, success, fail) {
            //remove the filename if it exists
            var lastLevelIndex = directory.search(/\/[\w ]+\.[\w ]+$/g);
            if(lastLevelIndex !== -1) {
                directory = directory.substring(0, lastLevelIndex);
            }

            //we need the directory name w.r.t the root, so remove any slashes in the beginning
            if(directory.indexOf("/") === 0) {
                directory = directory.substring(1);
            }

            var gotDirEntry = function() {
                success();
            };

            var failedToGetDirEntry = function(error) {
                fail("There was an error checking the directory: " + directory, error);
            };

            fs.root.getDirectory(directory, {create: true, exclusive: false}, gotDirEntry, failedToGetDirEntry);
        }

        function getFullFilePath(filePath, success, fail) {
            // Use the file"s parent folder to get the full path
            var directory = filePath;
            var fileName = "";

            //remove the filename if it exists
            var lastLevelIndex = directory.search(/\/[\w ]+\.[\w ]+$/g);
            if(lastLevelIndex !== -1) {
                directory = filePath.substring(0, lastLevelIndex);
                fileName = filePath.substring(lastLevelIndex + 1);
            }

            //we need the directory name w.r.t the root, so remove any slashes in the beginning
            if(directory.indexOf("/") === 0) {
                directory = directory.substring(1);
            }

            var gotFullPath = function(dirEntry) {
                var fullFilePath = dirEntry.fullPath + "/" + fileName;
                success(fullFilePath);
            };

            var failedToGetFullPath = function(error) {
                fail("There was an error getting the full path of file: " + filePath, error);
            };

            fs.root.getDirectory(directory, {create: true, exclusive: false}, gotFullPath, failedToGetFullPath);
        }

        // callback -> fn (fullFilePath, optional error string if any)
        this.downloadFromUrl = function(url, filePath, callback) {
            var fail = function(errorString, error) {
                if(error) {
                    errorString += " " + JSON.stringify(error);
                }
                callback(undefined, errorString);
            };

            var success = function(result) {
                callback(result, undefined);
            };

            if(!fs) {
                fail("The file system was not initialised.");
            }

            var directoryExistsCallback = function() {
                var gotFullFilePath = function(fullFilePath) {
                    downloadFromUrlToFullFilePath(url, fullFilePath, success, fail);
                };
                getFullFilePath(filePath, gotFullFilePath, fail);
            };

            ensureDirectoryExists(filePath, directoryExistsCallback, fail);
        };

        function downloadFromUrlToFullFilePath(url, fullFilePath, success, fail) {
            if(fullFilePath) {

                var downloadFail = function(error) {
                    fail("There was an error while downloading the file", error);
                };

                var downloadSuccess = function(fileEntry) {
                    if(fileEntry) {
                        success(fileEntry.fullPath);
                    } else {
                        fail("There was anrror while getting the file entry after downloading.");
                    }
                };

                /* global FileTransfer */
                var fileTransfer = new FileTransfer();
                var uri = encodeURI(url);
                fileTransfer.download(uri, fullFilePath, downloadSuccess, downloadFail);
            } else {
                fail("There was an error resolving the path specified to save the downloaded file.");
            }
        }

        // callback -> fn (array of dir names, optional error string if any)
        this.getSubDirectories = function(directoryPath, callback, createIfUnavailable) {
            var fail = function(errorString, error) {
                if(error) {
                    errorString += " " + JSON.stringify(error);
                }
                callback(undefined, errorString);
            };

            var success = function(result) {
                callback(result, undefined);
            };

            if(!fs) {
                fail("The file system was not initialised.");
            }

            createIfUnavailable = createIfUnavailable || false;

            var failedDirectoryLookUp = function(error) {
                fail("Could not look up the directory. Check if the directory exists.", error);
            };

            var gotDirectory = function (dirEntry) {
                getSubDirectoriesForDirectoryEntry(dirEntry, success, fail);
            };

            fs.root.getDirectory(directoryPath, {create: createIfUnavailable, exclusive: false}, gotDirectory , failedDirectoryLookUp);
        };

        function getSubDirectoriesForDirectoryEntry(dirEntry, success, fail) {
            if(dirEntry) {
                var directoryReader = dirEntry.createReader();

                var failedToGetDirectoryEntries = function(error) {
                    fail("There was an error while iterating through the directory " + dirEntry.fullPath, error);
                };

                var gotDirectoryEntries = function(entries) {
                    if(entries) {
                        var dirList = [];
                        for(var i = 0; i < entries.length; i++) {
                            if(entries[i].isDirectory === true) {
                                dirList.push(entries[i].name);
                            }
                        }
                        success(dirList);
                    } else {
                        fail("There was an error retrieving names after listing the files");
                    }
                };

                // Get a list of all the entries in the directory
                directoryReader.readEntries(gotDirectoryEntries, failedToGetDirectoryEntries);
            } else {
                fail("There was an error while retrieving the directory entry.");
            }
        }

        document.addEventListener("deviceready", function() { initialise(); }, false);
    }

    /* global myApp */
    myApp.value("resourcesLoader", new ResourcesLoader());
})();