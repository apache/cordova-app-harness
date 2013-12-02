(function() {
    'use strict';
    /* global myApp */
    myApp.factory('PluginMetadata', function() {
        var harnessPlugins = cordova.require('cordova/plugin_list').metadata;

        // Returns -1, (a > b), 0 (a = b), or 1 (a < b).
        function semverCompare(a, b) {
            var regex = /^(\d+)\.(\d+)\.(\d+)/;
            var aComps = a.match(regex);
            var bComps = b.match(regex);

            for(var i = 1; i <= 3; i++) {
                if (+aComps[i] != +bComps[i]) {
                    return +aComps[i] < +bComps[i] ? 1 : -1;
                }
            }

            return 0;
        }

        return {
            // Returns an object with plugin matching data.
            process: function(childPlugins) {
                var results = {
                    raw: childPlugins,
                    matched: [],
                    missing: [],
                    newer: [], // Those dependencies which are newer in the child than the harness.
                    older: []  // And those which are older in the child than the harness.
                };

                if (!childPlugins) {
                    results.raw = {};
                    return results;
                }

                Object.keys(childPlugins).forEach(function(plugin) {
                    if (!harnessPlugins[plugin]) {
                        results.missing.push({ id: plugin, version: childPlugins[plugin] });
                    } else {
                        switch(semverCompare(harnessPlugins[plugin], childPlugins[plugin])) {
                            case -1: // Child older.
                                results.older.push({ id: plugin, versions: { harness: harnessPlugins[plugin], child: childPlugins[plugin] } });
                                break;
                            case 1: // Child newer.
                                results.newer.push({ id: plugin, versions: { harness: harnessPlugins[plugin], child: childPlugins[plugin] } });
                                break;
                            case 0: // Match!
                                results.matched.push({ id: plugin, version: harnessPlugins[plugin] });
                                break;
                        }
                    }
                });

                return results;
            }
        };
    });
})();

