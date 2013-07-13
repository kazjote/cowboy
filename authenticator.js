const Gio  = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St   = imports.gi.St;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const RtmAuthenticator = new Lang.Class({
    Name: 'RtmAuthenticator',

    //// Public methods ////

    _init: function(rtm) {
        this._queue               = [];
        this._rtm                 = rtm;
        this._rtm.auth_token      = this._loadToken();
        this._notificationSource = null;
        // TODO: load token from a file
    },

    authenticated: function(job) {
        this._queue.push(job);

        if(this._queue.length == 1) {
            this._authenticateUser();
        }
    },

    //// Private methods ////

    _authenticateUser: function() {
        if(!this._rtm.auth_token) {
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
                let token            = resp.rsp.auth.token;
                this._rtm.auth_token = token;

                if (this._authNotification) {
                    this._authNotification.destroy();
                    this._authNotification = null;
                }

                this._saveToken(token);

                this._resumeQueue();
            } else {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, Lang.bind(this, function() {
                    this._continueWithCredentials(frob);
                }));
            }
        }));
    },

    _createNotification: function(frob, authUrl) {
        if (!this._notificationSource) {
            this._notificationSource = new MessageTray.Source('RTM', 'rtm-symbolic');
            Main.messageTray.add(this._notificationSource);
        }
        let title  = "RememberTheMilk - authentication";
        let banner = "You need to authenticate to proceed";
        let icon   = new St.Icon({ icon_name: 'rtm-symbolic' });

        this._authNotification = new MessageTray.Notification(this._notificationSource,
                                                                  title,
                                                                  banner,
                                                                  { icon: icon });

        this._authNotification.setResident(true);
        this._authNotification.addButton('web-browser', "Authenticate");

        this._authNotification.connect('action-invoked', Lang.bind(this, function() {
            GLib.spawn_command_line_async('gnome-open \'' + authUrl + '\'');

            this._continueWithCredentials(frob);
        }));

        this._notificationSource.notify(this._authNotification);
    },

    _displayAuthNotification: function() {
        // requires frob and displays notification with a button to authenticate
        // 
        // Checks also in the loop for succesful authentication.
        // When authentication is done, notification is removed and queue is resumed
        //
        // TODO: add recover from network problems
        // TODO: redisplay notification on notification close
        this._rtm.auth_token = null;

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

        let stream = file.replace(null, false, null, null, null);

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
