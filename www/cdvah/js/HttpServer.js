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
(function() {
    'use strict';
    /* global myApp */
    /* global chrome */
    myApp.factory('HttpServer', ['$q', function($q) {
        var DEFAULT_PORT = 2424;

        var STATE_NEW = 0;
        var STATE_REQUEST_DATA_RECEIVED = 1;
        var STATE_HEADERS_RECEIVED = 2;
        var STATE_REQUEST_RECEIVED = 3;
        var STATE_RESPONSE_STARTED = 4;
        var STATE_RESPONSE_WAITING_FOR_FLUSH = 5;
        var STATE_COMPLETE = 6;

        function HttpRequest(requestData) {
            this._requestData = requestData;
            this.method = requestData.method;
            this.headers = requestData.headers;
            this.bytesRemaining = 0;
            this._readChunkCalled = false;
            if (requestData.method == 'POST' || requestData.method == 'PUT') {
                this.bytesRemaining = parseInt(requestData.headers['content-length'] || '0');
            }
            if (this.bytesRemaining === 0) {
                this._requestData.state = STATE_REQUEST_RECEIVED;
            }

            var host = this.headers['host'] || 'localhost';
            var queryMatch = /\?.*/.exec(requestData.resource);
            this.url = 'http://' + host + requestData.resource;
            this.path = requestData.resource.replace(/\?.*/, '');
            this.query = queryMatch ? queryMatch[0] : '';
        }

        HttpRequest.prototype.getQueryParam = function(name) {
            var pattern = new RegExp('[\\?&]' + name + '=([^&#]*)');
            var m = pattern.exec(this.query);
            return m && decodeURIComponent(m[1]);
        };

        HttpRequest.prototype.readAsJson = function() {
            var self = this;
            return this.readEntireBody()
            .then(function(arrayBuffer) {
                var s = arrayBufferToString(arrayBuffer);
                return JSON.parse(s);
            }).then(null, function(e) {
                return self._requestData.httpResponse.sendTextResponse(400, 'Invalid JSON received.\n')
                .then(function() {
                    throw e;
                });
            });
        };

        HttpRequest.prototype.readEntireBody = function() {
            var byteArray = null;
            var soFar = 0;
            var self = this;
            function handleChunk(chunk) {
                if (byteArray) {
                    byteArray.set(chunk, soFar);
                    soFar += chunk.byteLength;
                }
                if (self.bytesRemaining === 0) {
                    return byteArray ? byteArray.buffer : chunk;
                }
                return self.readChunk().then(handleChunk);
            }
            return this.readChunk().then(handleChunk);
        };

        HttpRequest.prototype.readChunk = function(/* optional */maxChunkSize) {
            // Allow readChunk() to be called *once* after request is already received.
            // This is convenient for empty payloads.
            if (this._requestData.state === STATE_REQUEST_RECEIVED) {
                if (this._readChunkCalled) {
                    throw new Error('readChunk() when request already received.');
                }
                this._readChunkCalled = true;
                if (this.bytesRemaining === 0) {
                    return $q.when(new ArrayBuffer(0));
                }
            }
            var self = this;
            return this._requestData.socket.read(maxChunkSize)
            .then(function(chunk) {
                var chunkSize = chunk.byteLength;
                console.log('Processing request chunk of size ' + chunkSize);
                self.bytesRemaining -= chunkSize;
                if (self.bytesRemaining < 0) {
                    throw new Error('Bytes remaining negative: ' + self.bytesRemaining);
                }
                if (self.bytesRemaining === 0 && self._requestData.state === STATE_HEADERS_RECEIVED) {
                    self._requestData.state = STATE_REQUEST_RECEIVED;
                }
                return chunk;
            });
        };

        function HttpResponse(requestData) {
            this._requestData = requestData;
            this.headers = Object.create(null);
            var keepAlive = requestData.headers['connection'] === 'keep-alive';
            this.headers['Connection'] = keepAlive ? 'keep-alive' : 'close';
            var self = this;
            requestData.socket.onClose = function(err) {
                if (err) {
                    console.error(err);
                }
                self._finish(!!err);
            };
        }

        HttpResponse.prototype.sendTextResponse = function(status, message, /* optional */ contentType) {
            this.headers['Content-Type'] = contentType || 'text/plain';
            this.headers['Content-Length'] = message.length;
            this._startResponse(status);
            this.writeChunk(stringToArrayBuffer(message));
            return this.close();
        };

        HttpResponse.prototype.sendJsonResponse = function(json) {
            return this.sendTextResponse(200, JSON.stringify(json, null, 4), 'application/json');
        };

        HttpResponse.prototype.writeChunk = function(arrayBuffer) {
            if (this._requestData.state !== STATE_RESPONSE_STARTED) {
                this._startResponse(200);
            }
            var promise = this._requestData.socket.write(arrayBuffer);
            if (!arrayBuffer) {
                this._requestData.state = STATE_RESPONSE_WAITING_FOR_FLUSH;
                promise = promise.then(this._finish.bind(this, true));
            }
            return promise;
        };

        HttpResponse.prototype.close = function() {
            if (this._requestData.state < STATE_RESPONSE_WAITING_FOR_FLUSH) {
                return this.writeChunk(null);
            }
        };

        HttpResponse.prototype._startResponse = function(status) {
            var headers = this.headers;
            // Check if they haven't finished reading the request, and error out.
            if (this._requestData.state < STATE_REQUEST_RECEIVED) {
                this._requestData.socket.close(new Error('Started to write response before request data was finished.'));
                return;
            }
            this._requestData.state = STATE_RESPONSE_STARTED;
            var statusMsg = status === 404 ? 'Not Found' :
                            status === 400 ? 'Bad Request' :
                            status === 200 ? 'OK' :
                            'meh';
            var lines = ['HTTP/1.1 ' + status + ' ' + statusMsg];
            Object.keys(headers).forEach(function(k) {
                lines.push(k + ': ' + headers[k]);
            });
            lines.push('', '');
            this.writeChunk(stringToArrayBuffer(lines.join('\r\n')));
        };

        HttpResponse.prototype._finish = function(disconnect) {
            if (this._requestData.state === STATE_COMPLETE) {
                return;
            }
            this._requestData.state = STATE_COMPLETE;
            this._requestData.socket.onClose = null;
            var socketId = this._requestData.socketId;
            if (typeof disconnect == 'undefined') {
                disconnect = (this.headers['Connection'] || '').toLowerCase() != 'keep-alive';
            }
            delete this._requestData.httpServer._requests[socketId];
            if (disconnect) {
                this._requestData.socket.close();
            } else {
                this._requestData.httpServer._onAccept(socketId);
            }
        };

        function Socket(socketId) {
            this.socketId = socketId;
            this.alive = true;
            this.onClose = null;
            this._pendingReadChunk = null;
            this._writeQueue = [];
            this._readInProgress = false;
        }

        Socket.prototype.unread = function(chunk) {
            if (this._pendingReadChunk) {
                throw new Error('Socket.unread called multiple times.');
            }
            this._pendingReadChunk = chunk;
        };

        Socket.prototype.read = function(maxLength) {
            if (this._readInProgress) {
                throw new Error('Read already in progress.');
            }
            this._readInProgress = true;
            maxLength = maxLength || Infinity;
            var self = this;
            var deferred = $q.defer();
            var bufSize = Math.min(200 * 1024, maxLength);
            var chunk = this._pendingReadChunk;
            if (chunk) {
                self._readInProgress = false;
                if (chunk.byteLength <= maxLength) {
                    this._pendingReadChunk = null;
                    deferred.resolve(chunk);
                } else {
                    this._pendingReadChunk = chunk.slice(maxLength);
                    deferred.resolve(chunk.slice(0, maxLength));
                }
            } else {
                chrome.socket.read(this.socketId, bufSize, function(readInfo) {
                    self._readInProgress = false;
                    if (!readInfo.data) {
                        var err = new Error('Socket.read() failed with code ' + readInfo.resultCode);
                        self.close(err);
                        deferred.reject(err);
                    } else {
                        deferred.resolve(readInfo.data);
                    }
                });
            }
            return deferred.promise;
        };

        // Multiple writes in are allowed at a time.
        // A null arrayBuffer can be used as a synchronization point.
        Socket.prototype.write = function(arrayBuffer) {
            var deferred = $q.defer();
            this._writeQueue.push(arrayBuffer, deferred);
            if (this._writeQueue.length === 2) {
                this._pokeWriteQueue();
            }
            return deferred.promise;
        };

        Socket.prototype.close = function(/*(optional*/ error) {
            if (this.alive) {
                this.alive = false;
                chrome.socket.destroy(this.socketId);
                if (this.onClose) {
                    this.onClose(error);
                }
            }
        };

        Socket.prototype._pokeWriteQueue = function() {
            if (this._writeQueue.length === 0) {
                return;
            }
            var arrayBuffer = this._writeQueue[0];
            var deferred = this._writeQueue[1];
            if (arrayBuffer && arrayBuffer.byteLength > 0) {
                var self = this;
                chrome.socket.write(this.socketId, arrayBuffer, function(writeInfo) {
                    if (writeInfo.bytesWritten !== arrayBuffer.byteLength) {
                        console.warn('Failed to write entire ArrayBuffer.');
                    }
                    self._writeQueue.shift();
                    self._writeQueue.shift();
                    if (writeInfo.bytesWritten < 0) {
                        var err = new Error('Write error: ' + -writeInfo.bytesWritten);
                        deferred.reject(err);
                        self.close(err);
                    } else {
                        deferred.resolve();
                        self._pokeWriteQueue();
                    }
                });
            } else {
                this._writeQueue.shift();
                this._writeQueue.shift();
                deferred.resolve();
                this._pokeWriteQueue();
            }
        };


        function HttpServer() {
            this._requests = Object.create(null); // Map of socketId -> Object
            this._handlers = Object.create(null); // Map of resourcePath -> function(httpRequest, httpResponse)
        }

        HttpServer.prototype.addRoute = function(path, func) {
            this._handlers[path] = func;
            return this;
        };

        HttpServer.prototype.start = function(/* optional */ port) {
            port = port || DEFAULT_PORT;
            var deferred = $q.defer();
            var boundAccept = this._onAccept.bind(this);
            console.log('Starting web server on port ' + port);
            chrome.socket.create('tcp', function(createInfo) {
                if (!createInfo) {
                    console.error('Failed to create socket: ' + chrome.runtime.lastError);
                    deferred.reject(new Error('Failed to create socket: ' + chrome.runtime.lastError));
                    return;
                }
                chrome.socket.listen(createInfo.socketId, '0.0.0.0', port, function(result) {
                    if (result === 0) {
                        acceptLoop(createInfo.socketId, boundAccept);
                        deferred.resolve();
                    } else {
                        console.error('Error on socket.listen: ' + result);
                        deferred.reject(new Error('Error on socket.listen: ' + result));
                    }
                });
            });
            return deferred.promise;
        };

        function acceptLoop(socketId, acceptCallback) {
            chrome.socket.accept(socketId, function(acceptInfo) {
                acceptCallback(acceptInfo.socketId);
                acceptLoop(socketId, acceptCallback);
            });
        }

        HttpServer.prototype._onAccept = function(socketId) {
            console.log('Connection established on socket ' + socketId);
            var requestData = {
                state: STATE_NEW,
                socket: new Socket(socketId),
                dataAsStr: '', // Used only when parsing head of request.
                method: null,
                resource: null,
                httpVersion: null,
                headers: null,
                httpServer: this,
                httpResponse: null,
                httpRequest: null
            };
            this._requests[socketId] = requestData;
            var self = this;
            return readRequestHeaders(requestData)
            .then(function() {
                var req = new HttpRequest(requestData);
                var resp = new HttpResponse(requestData);
                requestData.httpRequest = req;
                requestData.httpResponse = resp;
                // Strip query params.
                var handler = self._handlers[req.path];
                if (handler) {
                    // Wrap to catch exceptions.
                    return $q.when().then(function() {
                        return handler(req, resp);
                    }).then(function() {
                        if (requestData.state < STATE_RESPONSE_WAITING_FOR_FLUSH) {
                            if (requestData.state == STATE_REQUEST_RECEIVED) {
                                console.warn('No response was sent for action ' + requestData.resource);
                                return resp.sendTextResponse(200, '');
                            } else {
                                return requestData.socket.close();
                            }
                        }
                    }, function(err) {
                        console.error('Error while handling ' + req.path, err);
                        if (requestData.state !== STATE_RESPONSE_WAITING_FOR_FLUSH) {
                            if (requestData.state < STATE_RESPONSE_STARTED) {
                                return req.readEntireBody()
                                .then(function() {
                                    return resp.sendTextResponse(500, '' + err);
                                });
                            } else {
                                return requestData.socket.close();
                            }
                        }
                    });
                }
                return resp.sendTextResponse(404, 'Not Found');
            });
        };

        function stringToArrayBuffer(str) {
            var view = new Uint8Array(str.length);
            for (var i = 0; i < str.length; i++) {
                view[i] = str.charCodeAt(i);
            }
            return view.buffer;
        }

        function arrayBufferToString(buffer) {
            var str = '';
            var uArrayVal = new Uint8Array(buffer);
            for (var s = 0; s < uArrayVal.length; s++) {
                str += String.fromCharCode(uArrayVal[s]);
            }
            return str;
        }

        function readRequestHeaders(requestData) {
            return requestData.socket.read()
            .then(function(arrayBuffer) {
                var oldLen = requestData.dataAsStr.length;
                var newData = arrayBufferToString(arrayBuffer);
                var splitPoint;
                requestData.dataAsStr += newData;
                if (requestData.state === STATE_NEW) {
                    splitPoint = requestData.dataAsStr.indexOf('\r\n');
                    if (splitPoint > -1) {
                        var requestDataLine = requestData.dataAsStr.substring(0, splitPoint);
                        requestData.dataAsStr = '';
                        arrayBuffer = arrayBuffer.slice(splitPoint + 2 - oldLen);
                        var requestDataParts = requestDataLine.split(' ');
                        requestData.method = requestDataParts[0].toUpperCase();
                        requestData.resource = requestDataParts[1];
                        requestData.httpVersion = requestDataParts[2];
                        console.log(requestData.method + ' requestData received for ' + requestData.resource);
                        requestData.state = STATE_REQUEST_DATA_RECEIVED;
                        requestData.socket.unread(arrayBuffer);
                        return readRequestHeaders(requestData);
                    }
                } else {
                    splitPoint = requestData.dataAsStr.indexOf('\r\n\r\n');
                    if (splitPoint > -1) {
                        requestData.headers = parseHeaders(requestData.dataAsStr.substring(0, splitPoint));
                        requestData.dataAsStr = '';
                        arrayBuffer = arrayBuffer.slice(splitPoint + 4 - oldLen);
                        requestData.state = STATE_HEADERS_RECEIVED;
                        requestData.socket.unread(arrayBuffer);
                        return requestData;
                    }
                }
                return readRequestHeaders(requestData);
            });
        }

        function strip(str) {
            return str.replace(/^\s*|\s*$/g, '');
        }

        function parseHeaders(headerText) {
            var headers = Object.create(null);
            var headerLines = headerText.split('\r\n');
            var currentKey;
            for (var i = 0; i < headerLines.length; i++) {
                if (/^\s/.test(headerLines[i])) {
                    if (!currentKey) {
                        break;
                    }
                    headers[currentKey] += ' ' + strip(headerLines[i]);
                } else {
                    var splitPoint = headerLines[i].indexOf(':');
                    if (splitPoint == -1) {
                        break;
                    }
                    currentKey = strip(headerLines[i].substring(0,splitPoint).toLowerCase());
                    headers[currentKey] = strip(headerLines[i].substring(splitPoint+1));
                }
            }
            return headers;
        }

        return HttpServer;
    }]);
})();
