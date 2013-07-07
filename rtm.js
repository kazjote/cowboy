const Lang           = imports.lang;
const Soup           = imports.gi.Soup;
const ExtensionUtils = imports.misc.extensionUtils;

const Md5 = Me.imports.md5;
const Me  = ExtensionUtils.getCurrentExtension();

const RememberTheMilk = new Lang.Class({
    Name: 'RememberTheMilk',

    _init: function(appKey, appSecret, permissions) {
        this._authUrl         = 'https://www.rememberthemilk.com/services/auth/';
        this._baseUrl         = 'https://api.rememberthemilk.com/services/rest/';
        this._appKey            = appKey;
        this._appSecret     = appSecret;
        this._permissions = permissions;
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

    getAuthUrl: function(frob) {
        let params = {
            api_key: this.appKey,
            perms:     this._permissions
        };

        if (frob) {
            params.frob = frob;
        }

        return this._authUrl + this._encodeUrlParams(params, true);
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

        this._httpSession.queue_message(request, imports.lang.bind(this,
            function(_httpSession, message) {
                // log('Answer: ' + request.response_body.data);
                callback.call(this, JSON.parse(request.response_body.data));
            }
        ));
    },

    _encodeUrlParams: function(params, signed) {
        let paramString = '';
        let count = 0;

        params.format    = 'json';
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
        signatureUrl += Md5.hex_md5(signature);

        return signatureUrl;
    },
});
