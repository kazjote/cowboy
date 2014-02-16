/* Based on https://github.com/michaelday/rtm-js */

const ExtensionUtils = imports.misc.extensionUtils;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Soup = imports.gi.Soup;

const Me = ExtensionUtils.getCurrentExtension();

const RememberTheMilk = new Lang.Class({
    Name: 'RememberTheMilk',

    //// Public methods ////

    _init: function(appKey, appSecret, permissions, label) {
        this._authUrl = 'https://www.rememberthemilk.com/services/auth/';
        this._baseUrl = 'https://api.rememberthemilk.com/services/rest/';
        this._appKey = appKey;
        this._appSecret = appSecret;
        this._permissions = permissions;
        this._label = label
        this._processNotifications = [];
    },

    checkCredentials: function(callbacks) {
        this.get('rtm.auth.checkToken', {}, function(resp) {
            if (resp.rsp.stat == 'ok') {
                callbacks.success();
            } else {
                callbacks.failure();
            }
        });
    },

    get: function(method, params, callback) {
        if (!callback && typeof params == 'function') {
            callback = params;
            params = {};
        }

        if (!callback) {
            callback = function () {};
        }

        params.method = method;

        if (this.auth_token) {
            params.auth_token = this.auth_token;
        }

        let requestUrl = this._baseUrl + this._encodeUrlParams(params, true);

        if (this._httpSession == null) {
            this._httpSession = new Soup.SessionAsync();
            Soup.Session.prototype.add_feature.call(
                this._httpSession,
                new Soup.ProxyResolverDefault()
            );
        }

        var request = Soup.Message.new('GET', requestUrl);
        // log('Request: ' + requestUrl);

        let notification = {
            description: 'Processing ' + method + ' ...',

            finish: Lang.bind(this, function() {
                let index = this._processNotifications.indexOf(notification);

                this._processNotifications.splice(index, 1);
                this._refreshLabel();
            })
        };

        this._processNotifications.push(notification);

        this._refreshLabel();

        this._httpSession.queue_message(request, imports.lang.bind(this,
            function(_httpSession, message) {
                // log('Answer: ' + request.response_body.data);
                notification.finish();
                this._refreshLabel();
                callback.call(this, JSON.parse(request.response_body.data));
            }
        ));
    },

    getAuthUrl: function(frob) {
        let params = {
            api_key: this.appKey,
            perms: this._permissions
        };

        if (frob) {
            params.frob = frob;
        }

        return this._authUrl + this._encodeUrlParams(params, true);
    },

    //// Private methods ////

    _encodeUrlParams: function(params, signed) {
        let paramString = '';
        let count = 0;

        params.format = 'json';
        params.api_key = this._appKey;

        // Encode the parameter keys and values
        for (let key in params) {
            if (count == 0) {
                paramString += '?' + key + '=' + encodeURIComponent(params[key]);
            } else {
                paramString += '&' + key + '=' + encodeURIComponent(params[key]);
            }

            count++;
        }

        // Append an auth signature if needed
        if (signed) {
            paramString += this._generateSig(params);
        }

        return paramString;
    },

    _generateSig: function(params) {
        let signature = '';
        let signatureUrl = '&api_sig=';

        let keys = Object.keys(params);
        keys.sort();

        for (let i = 0; i < keys.length; i++) {
            signature += keys[i] + params[keys[i]];
        }

        signature = this._appSecret + signature;

        let checksum = new GLib.Checksum(GLib.ChecksumType.MD5);
        checksum.update(signature);

        signatureUrl += checksum.get_string();

        return signatureUrl;
    },

    _refreshLabel: function() {
        if(this._processNotifications.length == 0) {
            this._label.hide();
        } else {
            this._label.text = this._processNotifications.map(function(notification) {
                return notification.description;
            }).join('\n');

            this._label.show();
        }
    }

});

// vim: ts=4 sw=4
