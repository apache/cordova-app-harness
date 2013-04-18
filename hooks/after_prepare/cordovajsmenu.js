#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
 
var androidAppend = function() {
    var location = document.location.toString();
    if(location.indexOf("file:///android_asset") === 0) {
        console.log("Not injecting");
    } else {
        console.log("Injecting menu script");
        var contextScript = document.createElement('script');
        contextScript.setAttribute("type","text/javascript");
        contextScript.setAttribute("src", "file://__cordovaappharness_contextMenu_script.js");
        document.getElementsByTagName("head")[0].appendChild(contextScript);
    }
};

var iosAppend = function() {
    var location = document.location.toString();
    //Match file:///SOME_PATH/Applications/SOME_GUID/SOME_NAME.app/SOME_PATH
    var regex = /^file:\/\/\/.*?\/Applications\/(\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\}{0,1})\/.*?\.app/g;
    if(location.search(regex) === 0) {
        console.log("Not injecting");
    } else {
        console.log("Injecting menu script");
        var contextScript = document.createElement('script');
        contextScript.setAttribute("type","text/javascript");
        contextScript.setAttribute("src", "file://__cordovaappharness_contextMenu_script.js");
        document.getElementsByTagName("head")[0].appendChild(contextScript);
    }
}; 

console.log("Modifying cordova.js");

var androidCordova = path.join('.', 'platforms', 'android', 'assets', 'www', 'cordova.js');
 
if (fs.existsSync(androidCordova)) {
    var dataToAppend = '\n(' + androidAppend.toString() + ')();'
    fs.appendFile(androidCordova, dataToAppend, function (err) {
        if(err) {
            console.error("Error appending to cordova.js for android: " + err);
        }
    });
} else {
    console.error("cordova.js not found for android");
}

var iosCordova = path.join('.', 'platforms', 'ios', 'www', 'cordova.js');
 
if (fs.existsSync(iosCordova)) {
    var dataToAppend = '\n(' + iosAppend.toString() + ')();'
    fs.appendFile(iosCordova, dataToAppend, function (err) {
        if(err) {
            console.error("Error appending to cordova.js for ios: " + err);
        }
    });
} else {
    console.error("cordova.js not found for ios");
}