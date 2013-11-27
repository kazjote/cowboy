const St             = imports.gi.St;
const Clutter        = imports.gi.Clutter;
const Gio            = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const GLib           = imports.gi.GLib;
const Lang           = imports.lang;
const PanelMenu      = imports.ui.panelMenu;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu   = imports.ui.popupMenu;

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

let entry, dialog, button, shown, rtm, dbusNameId, dbusOpener, authenticator, notifier, taskList, searchEntry;

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

const MainDialog = Lang.Class({
    Name: 'MainDialog',
    Extends: ModalDialog.ModalDialog,

    _init : function() {
        this.parent({ styleClass: 'prompt-dialog' });
        let mainContentBox = new St.BoxLayout({ style_class: 'prompt-dialog-main-layout',
                                                vertical: false });

        let entry = new St.Entry({ name: 'newTask',
                                   hint_text: "New task...",
                                   track_hover: true,
                                   style_class: 'task-entry' });

        this.contentLayout.add(mainContentBox,
                               { x_fill: true,
                                 y_fill: true });

        mainContentBox.add(entry);
    }
});

function _hideDialog() {
    dialog.close();
    dialog = null;
    entry  = null;
    taskList = null;
    searchEntry = null;
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

        searchEntry = new St.Entry({ name: 'search',
                                     hint_text: 'Type searched text...',
                                     text: 'status:incomplete ',
                                     track_hover: true});
        dialog.contentLayout.add(searchEntry);

        dialog.contentLayout.add(taskList, { x_fill: true, y_fill: true });

        let boxLayout = new St.BoxLayout({ vertical: true });
        taskList.add_actor(boxLayout);

        let children = boxLayout.get_children();
        for ( let i = 0; i < children.length; i += 1 ) {
            boxLayout.remove_actor(children[i]);
        }

        searchEntry.connect('key-release-event', function(object, event) {
            let symbol = event.get_key_symbol();

            if(symbol == Clutter.Return) {
                let filter = searchEntry.text;

                authenticator.authenticated(function() {
                    rtm.get('rtm.tasks.getList', { filter: filter }, function(resp) {
                        if(resp.rsp.stat == 'ok') {

                            let children = boxLayout.get_children();
                            for ( let i = 0; i < children.length; i += 1 ) {
                                boxLayout.remove_actor(children[i]);
                            }

                            let lists = resp.rsp.tasks.list;

                            for(let i = 0; i < lists.length; i += 1) {

                                let taskSeries = lists[i].taskseries;

                                for(let j = 0; j < taskSeries.length; j += 1) {
                                    let taskSerie = taskSeries[j]

                                    let actionLabel = new St.Label({ text: taskSerie.name });

                                    boxLayout.add_actor(actionLabel);
                                }
                            }
                        }
                    });
                });
            }
        });

        dialog.open();
    }

    entry.grab_key_focus();

}

function connectDBus() {
    dbusNameId = Gio.DBus.session.own_name('eu.kazjote.todo_lists.opener',
        Gio.BusNameOwnerFlags.NONE,
        function(name) { },
        function(name) { connectDBus(); });
}

function enable() {
    // button = new St.Bin({ style_class: 'panel-button',
    //                       reactive: true,
    //                       can_focus: true,
    //                       x_fill: true,
    //                       y_fill: false,
    //                       track_hover: true });

    var theme = imports.gi.Gtk.IconTheme.get_default();
    let icon_dir = Me.dir.get_child('icons');
    theme.append_search_path(icon_dir.get_path());

    let icon = new St.Icon({ icon_name: 'rtm-symbolic',
                             style_class: 'system-status-icon' });

    // button.set_child(icon);

    // Main.mainDialog = new MainDialog();

    // button.connect('button-press-event', function() {
    //     Main.mainDialog.open();
    // });

    // // button.connect('button-press-event', _showDialog);

    rtm           = new Rtm.RememberTheMilk(AppKey, AppSecret, 'write');
    // dbusOpener    = new DBusOpener();
    notifier      = new Notifier.Notifier();
    authenticator = new Authenticator.RtmAuthenticator(rtm, notifier);

    // Main.panel._rightBox.insert_child_at_index(button, 0);

    // connectDBus();

    let tray = new PanelMenu.Button(0.5);

    let panel = Main.panel._rightBox;
    let StatusArea = Main.panel._statusArea;

    if (StatusArea == undefined){
        StatusArea = Main.panel.statusArea;
    }

    Main.panel._addToPanelBox('cowboy', tray, 1, panel);

    let box = new St.BoxLayout();
    tray.actor.add_actor(box);
    box.add_actor(icon);

    let entry = new St.Entry({ name: 'newTask',
                               hint_text: "New task...",
                               track_hover: true,
                               style_class: 'task-entry' });

    let menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});
    menu_item.addActor(entry, {span: -1, expand: true});

    tray.menu.addMenuItem(menu_item);

    entry.connect('key-release-event', function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Return) {
            let text = entry.get_text();

            authenticator.authenticated(function() {
                _addEntry(text);
            });
        }
    });
}

function disable() {
    Main.panel._rightBox.remove_child(button);

    dbusOpener.close();
    authenticator.close();
    Gio.DBus.session.unown_name(dbusNameId);
}
