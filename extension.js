const St             = imports.gi.St;
const Clutter        = imports.gi.Clutter;
const Gio            = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const GLib           = imports.gi.GLib;
const Lang           = imports.lang;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;

const Me            = ExtensionUtils.getCurrentExtension();
const Rtm           = Me.imports.rtm;
const Authenticator = Me.imports.authenticator;
const Notifier      = Me.imports.notifier;

window.md5 = function(str) {
    // I tried glib md5 but it didn't work
    return Md5.hex_md5(str);
}

const AppKey    = '7dfc8cb9f7985d712e355ee4526d5c88';
const AppSecret = '5792b9b6adbc3847';

let entry, dialog, button, shown, rtm, dbusNameId, dbusOpener, authenticator, notifier, taskList;

const DBusOpenerInterface = <interface name='eu.kazjote.todo_lists.opener'>
    <method name='open'>
    </method>
</interface>;

const DBusOpener = new Lang.Class({
    Name: 'DBusOpener',

    //// Public methods ////

    _init: function() {
        this._impl = Gio.DBusExportedObject.wrapJSObject(DBusOpenerInterface, this);
        this._impl.export(Gio.DBus.session, '/eu/kazjote/todo_lists/opener');
    },

    /*
     * Invoke with:
     * dbus-send --session --type=method_call --print-reply --dest=eu.kazjote.todo_lists.opener '/eu/kazjote/todo_lists/opener' 'eu.kazjote.todo_lists.opener.open'
     */
    open: function(args) {
        _showDialog();
        return 0;
    },

    close: function() {
      this._impl.unexport();
    }
});

function _hideDialog() {
    dialog.close();
    dialog = null;
    entry  = null;
}

function _addEntry(content) {

    rtm.get('rtm.timelines.create', {}, function(resp) {
        let options = { timeline: resp.rsp.timeline, name: content, parse: 1 };
        rtm.get('rtm.tasks.add', options, function(resp) {
            if (resp.rsp.stat == 'ok') {
                notifier.notify("Task successfully created", content);
            } else {
                notifier.notify("Failed to create the task", content);
            }
        });
    });
}

function _showDialog() {
    if (!entry) {
        entry = new St.Entry({ name: 'newTask',
                                      hint_text: "New task...",
                                      track_hover: true,
                                      style_class: 'task-entry' });
    }

    if (!taskList) {
      taskList = new St.ScrollView({ style_class: 'task-list' });
    }

    if (!dialog) {
        let label = new St.Label({ name: 'newTaskLabel',
                                   style_class: 'task-label',
                                   text: "New task" });

        dialog = new ModalDialog.ModalDialog();
        dialog.contentLayout.add(label);
        dialog.contentLayout.add(entry);

        dialog.contentLayout.add(taskList, { x_fill: true, y_fill: true });

        let boxLayout = new St.BoxLayout({ vertical: true });
        taskList.add_actor(boxLayout);

        let children = boxLayout.get_children();
        for ( let i = 0; i < children.length; i += 1 ) {
            boxLayout.remove_actor(children[i]);
        }

        authenticator.authenticated(function() {
            let actionLabel = new St.Label({ text: "Here I am!" });

            boxLayout.add_actor(actionLabel);
        });

        dialog.open();
    }

    entry.grab_key_focus();

    entry.connect('key-release-event', function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Escape) {
            _hideDialog();
        }

        if(symbol == Clutter.Return) {
            let text = entry.get_text();

            _hideDialog();

            authenticator.authenticated(function() {
                _addEntry(text);
            });
        }
    });
}

function connectDBus() {
    dbusNameId = Gio.DBus.session.own_name('eu.kazjote.todo_lists.opener',
        Gio.BusNameOwnerFlags.NONE,
        function(name) { },
        function(name) { connectDBus(); });
}

function enable() {
    button = new St.Bin({ style_class: 'panel-button',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });

    var theme = imports.gi.Gtk.IconTheme.get_default();
    let icon_dir = Me.dir.get_child('icons');
    theme.append_search_path(icon_dir.get_path());

    let icon = new St.Icon({ icon_name: 'rtm-symbolic',
                             style_class: 'system-status-icon' });

    button.set_child(icon);
    button.connect('button-press-event', _showDialog);

    rtm           = new Rtm.RememberTheMilk(AppKey, AppSecret, 'write');
    dbusOpener    = new DBusOpener();
    notifier      = new Notifier.Notifier();
    authenticator = new Authenticator.RtmAuthenticator(rtm, notifier);

    Main.panel._rightBox.insert_child_at_index(button, 0);

    connectDBus();
}

function disable() {
    Main.panel._rightBox.remove_child(button);

    dbusOpener.close();
    authenticator.close();
    Gio.DBus.session.unown_name(dbusNameId);
}
