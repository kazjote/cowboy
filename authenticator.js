const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;

const RtmAuthenticator = new Lang.Class({
  Name: 'RtmAuthenticator',

  _init: function(rtm) {
    this._queue = [];
    this._rtm   = rtm;
    // TODO: load token from a file
  },

  authenticated: function(job) {
    this._queue.push(job);

    if(this._queue.length == 1) {
      this._authenticateUser();
    }
  },

  _resumeQueue: function() {
    this._queue.forEach(function(job) {
      job();
    });
    this._queue = [];
  },

  _createNotification: function(frob, authUrl) {
    let source       = new MessageTray.SystemNotificationSource();
    let notification = new MessageTray.Notification(source, "Test notification", "Banner");

    notification.setResident(true);
    Main.messageTray.add(source);
    notification.addButton('web-browser', 'Authenticate');

    notification.connect('action-invoked', Lang.bind(this, function() {
      GLib.spawn_command_line_async("gnome-open '" + authUrl + "'");

      this._continueWithCredentials(frob);
    }));

    notification.connect('destroy', Lang.bind(this, function(_, reason) {
      if(this._queue.length > 0) {
        this._createNotification(frob, authUrl);
      }
    }));

    source.notify(notification);
  },

  _displayAuthNotification: function() {
    // requires frob and displays notification with a button to authenticate
    // 
    // Runs also in the loop checking for succesful authentication.
    // when authentication is done, notification is removed and queue is resumed
    //
    // TODO: add recover from network problems
    // TODO: redisplay notification on notification close
    this._rtm.get('rtm.auth.getFrob', {}, Lang.bind(this, function(resp) {
      let frob    = resp.rsp.frob;
      let authUrl = this._rtm.getAuthUrl(frob);

      this._createNotification(frob, authUrl)
    }));
  },

  _continueWithCredentials: function(frob) {
    this._rtm.get('rtm.auth.getToken', { frob: frob }, Lang.bind(this, function(resp) {
      if (resp.rsp.stat == 'ok') {
        let token = resp.rsp.auth.token;
        this._rtm.auth_token = token;
        this._saveToken(token);

        this._resumeQueue();
      } else {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, Lang.bind(this, function() {
          this._continueWithCredentials(frob);
        }));
      }
    }));
  },

  _authenticateUser: function() {
    // pseudo code
    if(!this._rtm.auth_token) {
      this._displayAuthNotification();
    } else {
      this._rtm.checkCredentials({
        success: Lang.bind(this, this._resumeQueue),
        failure: Lang.bind(this, this._displayAuthNotification)
      });
    }
  },

  _loadToken: function() {
    let path = GLib.get_home_dir() + '/.todo_lists_this._rtm_token';
    let file = Gio.File.new_for_path(path);

    try {
      let stream = file.read(null, null);
      let dstream = new Gio.DataInputStream({base_stream: stream});
      let token = dstream.read_until('', null)[0];

      stream.close(null);

      return token;
    } catch (e) {
      log('Exception while reading file');
      log(e)
      return null;
    }
  },

  _saveToken: function(token) {
    let path = GLib.get_home_dir() + '/.todo_lists_this._rtm_token';
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
