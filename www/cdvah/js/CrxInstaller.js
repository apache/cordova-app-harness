(function(){
    'use strict';
    // TODO: put these constants into an npm module.
    // TODO: Move CRX support into MobileChromeApps/harness.
    var DEFAULT_PLUGINS = [
        'org.apache.cordova.file',
        'org.apache.cordova.inappbrowser',
        'org.apache.cordova.network-information',
        'org.apache.cordova.keyboard',
        'org.apache.cordova.statusbar',
        'org.chromium.navigation',
        'org.chromium.bootstrap',
        'org.chromium.i18n',
        'org.chromium.polyfill.CustomEvent',
        'org.chromium.polyfill.xhr_features',
        'org.chromium.polyfill.blob_constructor'
    ];

    var PLUGIN_MAP = {
      'alarms': ['org.chromium.alarms'],
      'fileSystem': ['org.chromium.fileSystem',
                     'org.chromium.FileChooser'],
      'gcm': ['org.chromium.gcm'],
      'identity': ['org.chromium.identity'],
      'idle': ['org.chromium.idle'],
      'notifications': ['org.chromium.notifications'],
      'payments': ['com.google.payments'],
      'power': ['org.chromium.power'],
      'pushMessaging': ['org.chromium.pushMessaging'],
      'socket': ['org.chromium.socket'],
      'storage': ['org.chromium.storage'],
      'syncFileSystem': ['org.chromium.syncFileSystem'],
      'unlimitedStorage': []
    };
    function extractPluginsFromManifest(manifest) {
        var permissions = [],
                plugins = [],
                i;
        if (manifest.permissions) {
            for (i = 0; i < manifest.permissions.length; ++i) {
                if (typeof manifest.permissions[i] === 'string') {
                    var matchPatternParts = /<all_urls>|([^:]+:\/\/[^\/]+)(\/.*)$/.exec(manifest.permissions[i]);
                    if (!matchPatternParts) {
                        permissions.push(manifest.permissions[i]);
                    }
                } else {
                    permissions = permissions.concat(Object.keys(manifest.permissions[i]));
                }
            }
        }
        for (i = 0; i < permissions.length; i++) {
            var pluginsForPermission = PLUGIN_MAP[permissions[i]];
            if (pluginsForPermission) {
                for (var j = 0; j < pluginsForPermission.length; ++j) {
                    plugins.push(pluginsForPermission[j]);
                }
            } else {
                console.warn('Permission not supported: ' + permissions[i] + ' (skipping)');
            }
        }
        return DEFAULT_PLUGINS.concat(plugins);
    }

    /* global myApp */
    myApp.run(['$q', 'Installer', 'AppsService', 'ResourcesLoader', 'urlCleanup', function($q, Installer, AppsService, ResourcesLoader, urlCleanup){

        var platformId = cordova.require('cordova/platform').id;

        function CrxInstaller(url, appId) {
            Installer.call(this, url, appId);
        }

        CrxInstaller.prototype = Object.create(Installer.prototype);

        CrxInstaller.prototype.type = 'crx';

        CrxInstaller.prototype.getPluginMetadata = function() {
            return ResourcesLoader.readJSONFileContents(this.installPath + '/www/manifest.json')
            .then(function(manifestJson) {
                var pluginIds = extractPluginsFromManifest(manifestJson);
                var harnessPluginMetadata = cordova.require('cordova/plugin_list').metadata;
                var ret = {};
                // Make all versions match what is installed.
                for (var i = 0; i < pluginIds.length; ++i) {
                    ret[pluginIds[i]] = harnessPluginMetadata[pluginIds[i]] || '0';
                }
                return ret;
            });
        };

        CrxInstaller.prototype.doUpdateApp = function() {
            var installPath = this.installPath;
            var platformConfig = location.pathname.replace(/\/[^\/]*$/, '/crx_files/config.' + platformId + '.xml');
            var targetConfig = installPath + '/config.xml';

            // The filename doesn't matter, but it needs to end with .crx for the zip plugin to unpack
            // it properly. So we always set the filename to package.crx.
            var crxFile = installPath + '/package.crx';

            return ResourcesLoader.downloadFromUrl(this.url, crxFile).then(function() {
                return ResourcesLoader.extractZipFile(crxFile, installPath + '/www');
            }).then(function() {
                // Copy in the config.<platform>.xml file from the harness.
                // TODO: We should be constructing this based on installed plugins.
                return ResourcesLoader.downloadFromUrl(platformConfig, targetConfig);
            });
        };

        AppsService.registerInstallerFactory({
            type: 'crx',
            createFromUrl: function(url, /*optional*/appId) {
                url = urlCleanup(url);
                return $q.when(new CrxInstaller(url, appId || 'New Chrome App'));
            },

            createFromJson: function(url, appId) {
                return new CrxInstaller(url, appId);
            }
        });
    }]);
})();
