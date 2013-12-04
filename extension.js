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
const BoxPointer  = imports.ui.boxpointer;

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

let rtm, dbusNameId, dbusOpener, authenticator, notifier, tray;

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
        tray.menu.open();
        return 0;
    },

    close: function() {
      this._impl.unexport();
    }
});

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

function connectDBus() {
    dbusNameId = Gio.DBus.session.own_name('eu.kazjote.todo_lists.opener',
        Gio.BusNameOwnerFlags.NONE,
        function(name) { },
        function(name) { connectDBus(); });
}

function enable() {
    var theme = imports.gi.Gtk.IconTheme.get_default();
    let icon_dir = Me.dir.get_child('icons');
    theme.append_search_path(icon_dir.get_path());

    let icon = new St.Icon({ icon_name: 'rtm-symbolic',
                             style_class: 'system-status-icon' });

    rtm           = new Rtm.RememberTheMilk(AppKey, AppSecret, 'write');
    dbusOpener    = new DBusOpener();
    notifier      = new Notifier.Notifier();
    authenticator = new Authenticator.RtmAuthenticator(rtm, notifier);

    connectDBus();

    tray = new PanelMenu.Button(0.5);

    let panel = Main.panel._rightBox;
    let StatusArea = Main.panel._statusArea;

    if (StatusArea == undefined){
        StatusArea = Main.panel.statusArea;
    }

    Main.panel._addToPanelBox('cowboy', tray, 1, panel);

    let box = new St.BoxLayout();
    tray.actor.add_actor(box);
    box.add_actor(icon);

    let table_layout = new St.Table();

    let label = new St.Label({ name: 'newTaskLabel',
                               style_class: 'task-label',
                               text: "New task" });

    let entry = new St.Entry({ name: 'newTask',
                               hint_text: "New task...",
                               track_hover: true,
                               style_class: 'task-entry' });

    table_layout.add(label, {row: 0, col: 0, x_expand: false});
    table_layout.add(entry, {row: 0, col: 1, x_expand: true, x_fill: true, y_fill: false, y_expand: false});

    entry.connect('key-release-event', function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Return) {
            let text = entry.get_text();

            authenticator.authenticated(function() {
                _addEntry(text);
            });

            entry.set_text('');
        }


    });

    tray.menu.connect('open-state-changed', function(self, open) {
        if(open) {
            entry.grab_key_focus();
        }
    });

    label = new St.Label({
          name: 'searchTaskLabel',
          style_class: 'task-label',
          text: "Search" });

    let searchEntry = new St.Entry({
          name: 'search',
          hint_text: "Search query...",
          track_hover: true,
          style_class: 'task-entry' });

    table_layout.add(label, {row: 1, col: 0, x_expand: false});
    table_layout.add(searchEntry, {row: 1, col: 1, x_expand: true, x_fill: true, y_fill: false, y_expand: false});

    let taskList = new St.ScrollView({ style_class: 'task-list' });

    let main_box = new St.BoxLayout({vertical: true});

    main_box.add(table_layout);
    main_box.add(taskList);

    let menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});

    menu_item.addActor(main_box, {expand: true});

    let boxLayout = new St.BoxLayout({ vertical: true });
    taskList.add_actor(boxLayout);

    searchEntry.connect('key-release-event', function(object, event) {
        let symbol = event.get_key_symbol();

        if(symbol == Clutter.Return) {
            let filter = searchEntry.text + ' status:incomplete';

            authenticator.authenticated(function() {
                rtm.get('rtm.tasks.getList', { filter: filter }, function(resp) {
                    if(resp.rsp.stat == 'ok') {

                        let children = boxLayout.get_children();
                        for ( let i = 0; i < children.length; i += 1 ) {
                            boxLayout.remove_actor(children[i]);
                        }

                        let lists = resp.rsp.tasks.list;

                        if(lists === undefined) { return null; }

                        for(let i = 0; i < lists.length; i += 1) {

                            let taskSeries = lists[i].taskseries;

                            for(let j = 0; j < taskSeries.length; j += 1) {
                                let taskSerie = taskSeries[j]

                                let actionLabel = new St.Label({ text: taskSerie.name, style_class: 'task' });

                                boxLayout.add_actor(actionLabel);
                            }
                        }
                    }

                    return null;
                });
            });
        }
    });

    tray.menu.addMenuItem(menu_item);
}

function disable() {
    dbusOpener.close();
    authenticator.close();
    tray.actor.destroy();
    Gio.DBus.session.unown_name(dbusNameId);
}

// vim: set ts=4 sw=4
