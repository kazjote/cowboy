const Lang = imports.lang;
const St   = imports.gi.St;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const Notifier = new Lang.Class({
    Name: 'Notifier',

    //// Public methods ////

   _init: function() {
       this._notificationSource = null;
       this._authNotification
   },

   notify: function(title, banner, configurationCallback) {
        if (!this._notificationSource || this._notificationSource.count === 0) {
            this._notificationSource = new MessageTray.Source('RTM', 'rtm-symbolic');
            Main.messageTray.add(this._notificationSource);
        }

        let icon   = new St.Icon({ icon_name: 'rtm-symbolic' });
        let notification = new MessageTray.Notification(this._notificationSource,
                                                        title,
                                                        banner,
                                                        { icon: icon });
        if (configurationCallback) {
            configurationCallback(notification);
        }

        this._notificationSource.notify(notification);
        return notification;
   }
});

