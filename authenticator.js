const Gio  = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St   = imports.gi.St;

const RtmAuthenticator = new Lang.Class({
    Name: 'RtmAuthenticator',

    //// Public methods ////

    _init: function(rtm, notifier) {
        this._queue = [];
        this._notifier = notifier;
        this._rtm = rtm;
        this._rtm.authToken = this._loadToken();
        this._authNotification = null;
        this._timeout_id = null;
    },

    authenticated: function(job) {
        this._queue.push(job);

        if(this._queue.length == 1) {
            this._authenticateUser();
        }
    },

    close: function() {
      if(this._timeout_id) { GLib.source_remove(this._timeout_id); }
    },

    //// Private methods ////

    _authenticateUser: function() {
        if(!this._rtm.authToken) {
            this._displayAuthNotification();
        } else {
            this._rtm.checkCredentials({
                success: Lang.bind(this, this._resumeQueue),
                failure: Lang.bind(this, this._displayAuthNotification)
            });
        }
    },

    _continueWithCredentials: function(frob) {
        this._rtm.get('rtm.auth.getToken', { frob: frob }, Lang.bind(this, function(resp) {
            if (resp.rsp.stat == 'ok') {
                let token = resp.rsp.auth.token;
                this._rtm.authToken = token;

                if (this._authNotification) {
                    this._authNotification.destroy();
                    this._authNotification = null;
                }

                this._saveToken(token);

                this._resumeQueue();
            } else {
                if(!this._timeout_id) { // Prevent multiple checking loops from running
                    this._timeout_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, Lang.bind(this, function() { // TODO: remove with source_remove
                        this._timeout_id = null;
                        this._continueWithCredentials(frob);
                    }));
                }
            }
        }));
    },

    _createNotification: function(frob, authUrl) {
        let title = "RememberTheMilk - authentication";
        let banner = "You need to authenticate to proceed";

        this._authNotification = this._notifier.notify(title, banner, Lang.bind(this, function(notification) {
            notification.setResident(true);
            notification.addButton('web-browser', "Authenticate");

            notification.connect('action-invoked', Lang.bind(this, function() {
                Gio.app_info_launch_default_for_uri(authUrl, global.create_app_launch_context());

                this._continueWithCredentials(frob);
            }));
        }));
    },

    _displayAuthNotification: function() {
        // requires frob and displays notification with a button to authenticate
        // 
        // Checks also in the loop for succesful authentication.
        // When authentication is done, notification is removed and queue is resumed
        //
        // TODO: add recover from network problems
        // TODO: redisplay notification on notification close
        this._rtm.authToken = null;

        this._rtm.get('rtm.auth.getFrob', {}, Lang.bind(this, function(resp) {
            let frob    = resp.rsp.frob;
            let authUrl = this._rtm.getAuthUrl(frob);

            this._createNotification(frob, authUrl)
        }));
    },

    _loadToken: function() {
        let path = GLib.get_home_dir() + '/.todo_lists';
        let file = Gio.File.new_for_path(path);

        try {
            let stream = file.read(null, null);
            let dstream = new Gio.DataInputStream({base_stream: stream});
            let token = dstream.read_until('', null)[0];

            stream.close(null);

            return token;
        } catch (e) {
            return null;
        }
    },

    _resumeQueue: function() {
        this._queue.forEach(function(job) {
            job();
        });
        this._queue = [];
    },

    _saveToken: function(token) {
        let path = GLib.get_home_dir() + '/.todo_lists';
        let file = Gio.File.new_for_path(path);

        let stream = file.replace(null, null, Gio.FileCreateFlags.NONE, null);

        stream.write(token, null, null, null);
        stream.close(null);
    }

});

/*
 * Features:
 *
 * - Queueing few tasks and resuming all when user is authenticated
 * - Authorizing user with browser
 * - Saving and loading on startup key from file
 *
 * Covered usecases:
 *
 * - User has never entered key and adds a few new tasks
 * - User enters the task but key got invalidated in the meantime
 *
 * Not covered usecases:
 *
 * - User has network problems
 * - Token gets invalidated after authentication and before all queued tasks are sent
 *
 */

// vim: ts=4 sw=4
