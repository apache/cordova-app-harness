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
        var STATE_COMPLETE = 5;

        function HttpRequest(requestData) {
            this._requestData = requestData;
            this.method = requestData.method;
            this.headers = requestData.headers;
            this.bytesRemaining = 0;
            if (requestData.method == 'POST' || requestData.method == 'PUT') {
                this.bytesRemaining = parseInt(requestData.headers['content-length'] || '0');
            }
            this.onData = null; // function(arrayBuffer, req, resp) : Promise

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

        HttpRequest.prototype._feedData = function(arrayBuffer) {
            console.log('Processing request chunk of size ' + arrayBuffer.byteLength);
            this.bytesRemaining -= arrayBuffer.byteLength;
            if (this.bytesRemaining < 0) {
                throw new Error('Bytes remaining negative: ' + this.bytesRemaining);
            } else if (this.bytesRemaining === 0 && this._requestData.state === STATE_HEADERS_RECEIVED) {
                this._requestData.state = STATE_REQUEST_RECEIVED;
            }
            if (arrayBuffer.byteLength > 0) {
                if (this.onData) {
                    return this.onData(arrayBuffer, this, this._requestData.httpResponse);
                } else {
                    // Set to an empty function to avoid this warning.
                    console.warn('onData not set when callback is fired for request: ' + this.getUrl());
                }
            }
            return $q.when();
        };

        function HttpResponse(requestData) {
            this._requestData = requestData;
            this.headers = Object.create(null);
            var keepAlive = requestData.headers['connection'] === 'keep-alive';
            this.headers['Connection'] = keepAlive ? 'keep-alive' : 'close';
            this._writeQueue = [];
        }

        HttpResponse.prototype.sendTextResponse = function(status, message, /* optional */ contentType) {
            this.headers['Content-Type'] = contentType || 'text/plain';
            this.headers['Content-Length'] = message.length;
            this._startResponse(status);
            this.writeChunk(stringToArrayBuffer(message));
            this.close();
        };

        HttpResponse.prototype.sendJsonResponse = function(json) {
            this.sendTextResponse(200, JSON.stringify(json, null, 4), 'application/json');
        };

        HttpResponse.prototype.writeChunk = function(arrayBuffer) {
            if (this._requestData.state !== STATE_RESPONSE_STARTED) {
                this._startResponse(200);
            }
            this._addToWriteQueue(arrayBuffer);
        };

        HttpResponse.prototype.close = function() {
            this.writeChunk(null);
        };

        HttpResponse.prototype._addToWriteQueue = function(arrayBuffer) {
            this._writeQueue.push(arrayBuffer);
            if (this._writeQueue.length === 1) {
                this._pokeWriteQueue();
            }
        };

        HttpResponse.prototype._pokeWriteQueue = function() {
            var arrayBuffer = this._writeQueue[0];
            if (arrayBuffer) {
                var self = this;
                chrome.socket.write(this._requestData.socketId, arrayBuffer, function(writeInfo) {
                    if (writeInfo.bytesWritten !== arrayBuffer.byteLength) {
                        console.warn('Failed to write entire ArrayBuffer.');
                    }
                    self._writeQueue.shift();
                    if (writeInfo.bytesWritten < 0) {
                        console.error('Write error: ' + -writeInfo.bytesWritten);
                        self._finish(true);
                    } else {
                        self._pokeWriteQueue();
                    }
                });
            } else if (arrayBuffer === null) {
                this._finish();
            }
        };

        HttpResponse.prototype._startResponse = function(status) {
            var headers = this.headers;
            if (this._requestData.httpRequest.bytesRemaining > 0) {
                headers['Connection'] = 'Close';
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
            this._requestData.state = STATE_COMPLETE;
            var socketId = this._requestData.socketId;
            if (typeof disconnect == 'undefined') {
                disconnect = (this.headers['Connection'] || '').toLowerCase() != 'keep-alive';
            }
            delete this._requestData.httpServer._requests[socketId];
            if (disconnect) {
                chrome.socket.destroy(socketId);
            } else {
                this._requestData.httpServer._onAccept(socketId);
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

        HttpServer.prototype._onAccept = function(socketId) {
            console.log('Connection established on socket ' + socketId);
            var requestData = {
                state: STATE_NEW,
                dataAsStr: '', // Used only when parsing head of request.
                socketId: socketId,
                method: null,
                resource: null,
                httpVersion: null,
                headers: null,
                httpServer: this,
                httpResponse: null,
                httpRequest: null
            };
            this._requests[socketId] = requestData;
            receiveHttpData(requestData);
        };

        HttpServer.prototype._onReceivedRequest = function(requestData) {
            var req = new HttpRequest(requestData);
            var resp = new HttpResponse(requestData);
            requestData.httpRequest = req;
            requestData.httpResponse = resp;
            // Strip query params.
            var handler = this._handlers[req.path];
            if (handler) {
                handler(req, resp);
            } else {
                resp.sendTextResponse(404, 'Not Found');
            }
        };

        function acceptLoop(socketId, acceptCallback) {
            chrome.socket.accept(socketId, function(acceptInfo) {
                acceptCallback(acceptInfo.socketId);
                acceptLoop(socketId, acceptCallback);
            });
        }

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

        function receiveHttpData(requestData) {
            if (requestData.state < STATE_REQUEST_RECEIVED) {
                chrome.socket.read(requestData.socketId, function(readInfo) {
                    processHttpRequest(requestData, readInfo.data);
                });
            }
        }

        function processHttpRequest(requestData, arrayBuffer) {
            switch (requestData.state) {
                case STATE_NEW:
                case STATE_REQUEST_DATA_RECEIVED:
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
                            processHttpRequest(requestData, arrayBuffer);
                            return;
                        }
                    } else {
                        splitPoint = requestData.dataAsStr.indexOf('\r\n\r\n');
                        if (splitPoint > -1) {
                            requestData.headers = parseHeaders(requestData.dataAsStr.substring(0, splitPoint));
                            requestData.dataAsStr = '';
                            arrayBuffer = arrayBuffer.slice(splitPoint + 4 - oldLen);
                            requestData.state = STATE_HEADERS_RECEIVED;
                            requestData.httpServer._onReceivedRequest(requestData);
                            processHttpRequest(requestData, arrayBuffer);
                            return;
                        }
                    }
                    break;
                case STATE_HEADERS_RECEIVED:
                    requestData.httpRequest._feedData(arrayBuffer)
                    .then(function() {
                        receiveHttpData(requestData);
                    }, function(e) {
                        requestData.httpResponse.sendTextResponse(500, '' + e);
                    });
                    return;
            }
            receiveHttpData(requestData);
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

        return {
            create: function() {
                return new HttpServer();
            }
        };

    }]);
})();
